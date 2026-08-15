#!/usr/bin/env node
/**
 * Sync the past-events archive from Luma into Firestore, and mirror every cover
 * image into this repo so the archive never depends on Luma at render time.
 *
 *   npm run events:sync                     # normal run
 *   npm run events:sync -- --dry-run        # print the diff, write nothing
 *   npm run events:sync -- --seed           # one-time: import the pre-Firestore snapshot
 *   npm run events:sync -- --refresh        # re-fetch descriptions for events we already have
 *   npm run events:sync -- --refresh-images # re-download every cover
 *
 * Runs LOCALLY, never on the droplet: web/deploy.sh rsyncs with --delete, so a
 * cover written on the server that is absent from this tree is destroyed on the
 * next deploy. The images have to be produced here.
 *
 * Credentials come from the API server's .env (FIREBASE_SERVICE_ACCOUNT_JSON),
 * which the npm script loads with node --env-file. No new secret is introduced.
 *
 * Invariants (see docs/superpowers/specs/2026-08-14-past-events-archive-design.md):
 *   - Never writes `photos`. Those images were shot at the events and have no
 *     Luma source, so the sync must be structurally unable to clobber them.
 *   - Never deletes. An event that falls out of Luma's past window stays.
 *   - Idempotent. A second run changes only `syncedAt`.
 */
import { execFile } from 'node:child_process'
import { mkdir, rm, stat, writeFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
// firebase-admin v14 exposes these only through its modular subpaths in ESM;
// the default export has no .credential/.firestore (unlike the server's usage).
import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore } from 'firebase-admin/firestore'
// Node 22 strips types on import, so the classifier stays a single source of
// truth shared with the live upcoming path in src/lib/events/luma.ts.
import { classify } from '../src/lib/events/classify.ts'

const execFileAsync = promisify(execFile)

const HERE = dirname(fileURLToPath(import.meta.url))
const WEB_ROOT = join(HERE, '..')
const PUBLIC_EVENTS = join(WEB_ROOT, 'public', 'events')
const SEED_FILE = join(HERE, 'seed', 'past-events-snapshot.json')

const API = 'https://api.lu.ma'
const HEADERS = { 'User-Agent': 'Mozilla/5.0', accept: 'application/json' }
const COLLECTION = 'pastEvents'
const CONCURRENCY = 5
// Cards render at roughly 330px CSS width (--maxw 1100px, three columns), so
// 900px is still 2x headroom. 1200px cost 40% more bytes for nothing visible.
const COVER_WIDTH = 900
const COVER_QUALITY = 80
const SLUG_TITLE_MAX = 60 // matches the slugs already on disk under public/events/

/* Both calendars. Argo is the current one; Global Builders Club holds the
 * history from before the rebrand. An event on both is kept once, as Argo. */
const CALENDARS = [
  { key: 'argo', id: 'cal-Ou3HZASzgTI50zJ' },
  { key: 'gbc', id: 'cal-cnjX7OketlYaYNZ' },
]

const flags = new Set(process.argv.slice(2))
const DRY_RUN = flags.has('--dry-run')
const SEED = flags.has('--seed')
const REFRESH = flags.has('--refresh')
const REFRESH_IMAGES = flags.has('--refresh-images')

/* ── helpers ─────────────────────────────────────────────────────────────── */

const log = (...a) => console.log('[events]', ...a)

function kebab(s) {
  return s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function makeSlug(date, title) {
  return `${date}-${kebab(title).slice(0, SLUG_TITLE_MAX).replace(/-+$/, '')}`
}

/* Flatten a Luma ProseMirror description document into plain text. Mirrors
 * flatten() in src/lib/events/luma.ts. */
function flatten(node) {
  if (!node) return ''
  if (Array.isArray(node)) return node.map(flatten).join('')
  if (typeof node === 'object') {
    let out = ''
    if (node.type === 'text' && node.text) out += node.text
    if (node.content) out += flatten(node.content)
    if (node.type === 'paragraph' || node.type === 'heading') out += '\n'
    return out
  }
  return ''
}

function localParts(iso, tz) {
  const d = new Date(iso)
  return {
    date: new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d),
    time: new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      hour: 'numeric',
      minute: '2-digit',
    }).format(d),
  }
}

async function getJson(url) {
  const res = await fetch(url, { headers: HEADERS })
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`)
  return res.json()
}

async function exists(path) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

/** Run `tasks` with bounded concurrency, preserving input order. */
async function pooled(items, worker) {
  const out = new Array(items.length)
  let next = 0
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
      for (;;) {
        const i = next++
        if (i >= items.length) return
        out[i] = await worker(items[i], i)
      }
    }),
  )
  return out
}

/* ── cover images ────────────────────────────────────────────────────────── */

/**
 * Download the Luma cover and write a single 1200px JPEG to
 * public/events/<slug>/cover.jpg. One file, not the full/thumb pair used for
 * event photos: covers only ever render inside a card at 440px or less and
 * there is no cover lightbox, so 1200px is already retina headroom.
 * Returns the public path, or null if there was nothing to mirror.
 */
async function mirrorCover(slug, lumaCoverUrl) {
  if (!lumaCoverUrl) return null
  const dir = join(PUBLIC_EVENTS, slug)
  const finalPath = join(dir, 'cover.jpg')
  const publicPath = `/events/${slug}/cover.jpg`

  if (!REFRESH_IMAGES && (await exists(finalPath))) return publicPath
  if (DRY_RUN) return publicPath

  await mkdir(dir, { recursive: true })
  const res = await fetch(lumaCoverUrl, { headers: { 'User-Agent': HEADERS['User-Agent'] } })
  if (!res.ok) throw new Error(`cover ${res.status} for ${lumaCoverUrl}`)

  const tmp = join(dir, '.cover-download')
  await writeFile(tmp, Buffer.from(await res.arrayBuffer()))
  try {
    // sips is a macOS built-in. This script only ever runs on the developer's Mac.
    await execFileAsync('sips', [
      '-s', 'format', 'jpeg',
      '-s', 'formatOptions', String(COVER_QUALITY),
      '-Z', String(COVER_WIDTH),
      tmp,
      '--out', finalPath,
    ])
  } finally {
    await rm(tmp, { force: true })
  }
  return publicPath
}

/* ── Luma ────────────────────────────────────────────────────────────────── */

async function fetchPastEvents() {
  const bySlug = new Map()
  for (const cal of CALENDARS) {
    const data = await getJson(
      `${API}/calendar/get-items?calendar_api_id=${cal.id}&period=past&pagination_limit=200`,
    )
    for (const entry of data.entries ?? []) {
      // Keyed on `url`, the public luma.com slug, not `api_id` (evt-XXXX):
      // `url` is what an existing lumaUrl yields, so it is what matches a
      // document we already hold. First calendar wins, so an event on both
      // calendars is attributed to Argo.
      if (!bySlug.has(entry.event.url)) {
        bySlug.set(entry.event.url, { ...entry.event, calendar: cal.key })
      }
    }
    log(`${cal.key}: ${data.entries?.length ?? 0} past events`)
  }
  return [...bySlug.values()]
}

async function fetchDescription(apiId) {
  const d = await getJson(`${API}/event/get?event_api_id=${apiId}`)
  return {
    // Full text. The old build-time snapshot sliced this to 300 chars and lost
    // the context we now want to own.
    description: flatten(d.description_mirror).replace(/\n{2,}/g, '\n').trim(),
    coverUrl: d.cover_image?.url || '',
    guestCount: typeof d.guest_count === 'number' ? d.guest_count : null,
    hostNames: (d.hosts ?? []).map((h) => h.name).filter(Boolean),
  }
}

/* ── Firestore ───────────────────────────────────────────────────────────── */

function initFirestore() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  if (!raw) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_JSON is not set. Run via `npm run events:sync`, ' +
        'which loads it from ../server/.env.',
    )
  }
  if (!getApps().length) {
    initializeApp({ credential: cert(JSON.parse(raw)) })
  }
  return getFirestore()
}

async function loadExisting(db) {
  const snap = await db.collection(COLLECTION).get()
  const bySlug = new Map()
  snap.forEach((doc) => {
    const d = doc.data()
    // Keyed on the public luma.com slug, which every document carries inside
    // lumaUrl whether it came from --seed or from a previous sync.
    const key = d.lumaSlug || (d.lumaUrl ?? '').split('/').pop()
    if (key) bySlug.set(key, { slug: doc.id, ...d })
  })
  return bySlug
}

async function commit(db, writes) {
  if (DRY_RUN || writes.length === 0) return
  // 57 documents is far below the 500-write batch limit, but chunk anyway.
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch()
    for (const { slug, payload } of writes.slice(i, i + 400)) {
      batch.set(db.collection(COLLECTION).doc(slug), payload, { merge: true })
    }
    await batch.commit()
  }
}

/* ── modes ───────────────────────────────────────────────────────────────── */

/**
 * One-time import of the archive as it existed before Firestore, read from
 * scripts/seed/past-events-snapshot.json (extracted from the old inlined
 * PAST_EVENTS constant). This is the ONLY writer of `photos`: it carries the 18
 * images shot at the events, which have no Luma source. Run before the first
 * real sync so those arrays are in place when the sync merges over them.
 */
async function runSeed(db) {
  const events = JSON.parse(readFileSync(SEED_FILE, 'utf8'))
  log(`seeding ${events.length} events from the pre-Firestore snapshot`)

  const writes = events.map((e) => ({
    slug: e.slug,
    payload: {
      slug: e.slug,
      lumaSlug: e.lumaUrl.split('/').pop(),
      title: e.title,
      date: e.date,
      time: e.time,
      location: e.location,
      eventType: e.eventType,
      lumaUrl: e.lumaUrl,
      lumaCoverUrl: e.coverUrl,
      coverUrl: e.coverUrl,
      description: e.description,
      photos: e.photos,
      seededAt: new Date().toISOString(),
    },
  }))

  const photos = writes.reduce((n, w) => n + w.payload.photos.length, 0)
  log(`  ${photos} photo entries across ${writes.filter((w) => w.payload.photos.length).length} events`)
  await commit(db, writes)
  log(DRY_RUN ? 'dry run, nothing written' : 'seed complete')
}

async function runSync(db) {
  const existing = await loadExisting(db)
  log(`${existing.size} events already in Firestore`)

  const lumaEvents = await fetchPastEvents()
  log(`${lumaEvents.length} past events on Luma (deduped across both calendars)`)

  let added = 0
  let updated = 0
  let coversMirrored = 0
  const failures = []

  const writes = (
    await pooled(lumaEvents, async (ev) => {
      const prior = existing.get(ev.url)
      const tz = ev.timezone || 'Asia/Kuala_Lumpur'
      const start = localParts(ev.start_at, tz)
      const end = ev.end_at ? localParts(ev.end_at, tz) : null
      // Keep the slug a document already has. It is the directory name under
      // public/events/, so regenerating it would orphan the photos.
      const slug = prior?.slug ?? makeSlug(start.date, ev.name)

      try {
        // Only pay for the detail fetch when we do not already have the text.
        const needDetail = REFRESH || !prior?.description
        const detail = needDetail
          ? await fetchDescription(ev.api_id)
          : {
              description: prior.description,
              coverUrl: '',
              guestCount: prior.guestCount ?? null,
              hostNames: prior.hostNames ?? [],
            }

        const lumaCoverUrl = detail.coverUrl || ev.cover_url || prior?.lumaCoverUrl || ''
        const hadCover = await exists(join(PUBLIC_EVENTS, slug, 'cover.jpg'))
        const coverUrl = await mirrorCover(slug, lumaCoverUrl)
        if (coverUrl && (!hadCover || REFRESH_IMAGES)) coversMirrored++

        const geo = ev.geo_address_info || {}
        prior ? updated++ : added++
        if (!prior) log(`  + ${start.date} ${ev.name}`)

        return {
          slug,
          payload: {
            slug,
            lumaSlug: ev.url, // public luma.com slug, the upstream match key
            lumaEventId: ev.api_id, // internal Luma id (evt-XXXX)
            calendar: ev.calendar,
            title: ev.name,
            date: start.date,
            startAt: ev.start_at,
            endAt: ev.end_at ?? null,
            timezone: tz,
            time: start.time + (end ? ` – ${end.time}` : ''),
            location:
              geo.address ||
              geo.full_address ||
              geo.city_state ||
              (ev.location_type === 'virtual' ? 'Online' : 'Network School'),
            locationType: ev.location_type === 'virtual' ? 'virtual' : 'offline',
            eventType: classify(ev.name),
            description: detail.description,
            lumaUrl: `https://luma.com/${ev.url}`,
            coverUrl: coverUrl ?? prior?.coverUrl ?? '',
            lumaCoverUrl,
            guestCount: detail.guestCount,
            hostNames: detail.hostNames,
            syncedAt: new Date().toISOString(),
            // `photos` is deliberately absent. See the header.
          },
        }
      } catch (err) {
        failures.push(`${ev.name}: ${err.message}`)
        return null
      }
    })
  ).filter(Boolean)

  log(`${added} added, ${updated} updated, ${coversMirrored} covers mirrored`)
  if (failures.length) {
    log(`${failures.length} event(s) skipped:`)
    for (const f of failures) log(`  ! ${f}`)
  }

  await commit(db, writes)
  log(DRY_RUN ? 'dry run, nothing written' : `wrote ${writes.length} documents`)
}

/* ── entry point ─────────────────────────────────────────────────────────── */

async function main() {
  const db = initFirestore()
  if (DRY_RUN) log('DRY RUN: no Firestore writes, no image downloads')
  if (SEED) await runSeed(db)
  else await runSync(db)
}

main().catch((err) => {
  console.error('[events] sync failed:', err.message)
  process.exit(1)
})
