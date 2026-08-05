/* ──────────────────────────────────────────────────────────────────────────
 * Live upcoming events from the Luma calendar.
 *
 * Past events are a build-time snapshot (see pastEvents.ts); upcoming events
 * are fetched at request time from Luma's public API so the page stays current
 * as events are added. Fetches are cached for 30 minutes.
 * ────────────────────────────────────────────────────────────────────────── */

const CALENDAR_ID = 'cal-Ou3HZASzgTI50zJ'
const API = 'https://api.lu.ma'
const HEADERS = { 'User-Agent': 'Mozilla/5.0', accept: 'application/json' }
const REVALIDATE = 1800 // 30 minutes

export const LUMA_CALENDAR_URL = 'https://luma.com/myargoquest'

export interface UpcomingEvent {
  id: string
  title: string
  slug: string
  date: string // YYYY-MM-DD in the event's local timezone
  time: string
  location: string
  eventType: string
  description: string
  lumaUrl: string
  coverUrl: string
}

function classify(name: string): string {
  const n = name.toLowerCase()
  if (/(muay thai|martial|\bbjj\b)/.test(n)) return 'MUAY_THAI'
  if (n.includes('robotic')) return 'ROBOTICS_CLUB'
  if (n.includes('demo') || n.includes('pitch')) return 'DEMO_DAY'
  if (n.includes('film') || n.includes('screening')) return 'FILM_DISCUSSION'
  if (n.includes('writer')) return 'WRITERS_CLUB'
  if (n.includes('speak')) return 'PUBLIC_SPEAKERS'
  if (n.includes('hackathon')) return 'HACKATHON'
  if (/(workshop|claude code|openclaw|agent)/.test(n)) return 'WORKSHOP'
  return 'OTHER'
}

/* Flatten a Luma ProseMirror description document into plain text. */
function flatten(node: unknown): string {
  if (!node) return ''
  if (Array.isArray(node)) return node.map(flatten).join('')
  if (typeof node === 'object') {
    const n = node as { type?: string; text?: string; content?: unknown }
    let out = ''
    if (n.type === 'text' && n.text) out += n.text
    if (n.content) out += flatten(n.content)
    if (n.type === 'paragraph' || n.type === 'heading') out += '\n'
    return out
  }
  return ''
}

function localParts(iso: string, tz: string): { date: string; time: string } {
  const d = new Date(iso)
  const date = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
  const time = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric',
    minute: '2-digit',
  }).format(d)
  return { date, time }
}

interface LumaGeo {
  address?: string
  full_address?: string
  city_state?: string
}

interface LumaEvent {
  api_id: string
  name: string
  url: string
  start_at: string
  end_at?: string
  timezone?: string
  cover_url?: string
  location_type?: string
  geo_address_info?: LumaGeo
}

export async function getUpcomingEvents(): Promise<UpcomingEvent[]> {
  try {
    const res = await fetch(
      `${API}/calendar/get-items?calendar_api_id=${CALENDAR_ID}&period=future&pagination_limit=50`,
      { headers: HEADERS, next: { revalidate: REVALIDATE } }
    )
    if (!res.ok) return []
    const data = (await res.json()) as { entries?: { event: LumaEvent }[] }
    const entries = Array.isArray(data.entries) ? data.entries : []

    const events = await Promise.all(
      entries.map(async (entry): Promise<UpcomingEvent> => {
        const ev = entry.event
        const tz = ev.timezone || 'Asia/Kuala_Lumpur'
        const start = localParts(ev.start_at, tz)
        const end = ev.end_at ? localParts(ev.end_at, tz) : null
        const geo = ev.geo_address_info || {}

        let description = ''
        let coverUrl = ev.cover_url || ''
        try {
          const r2 = await fetch(`${API}/event/get?event_api_id=${ev.api_id}`, {
            headers: HEADERS,
            next: { revalidate: REVALIDATE },
          })
          if (r2.ok) {
            const d2 = (await r2.json()) as {
              description_mirror?: unknown
              cover_image?: { url?: string }
            }
            description = flatten(d2.description_mirror)
              .replace(/\n{2,}/g, '\n')
              .trim()
              .slice(0, 300)
            coverUrl = d2.cover_image?.url || coverUrl
          }
        } catch {
          // description/cover are best-effort
        }

        return {
          id: ev.api_id,
          title: ev.name,
          slug: ev.url,
          date: start.date,
          time: start.time + (end ? ` – ${end.time}` : ''),
          location:
            geo.address ||
            geo.full_address ||
            geo.city_state ||
            (ev.location_type === 'virtual' ? 'Online' : 'Network School'),
          eventType: classify(ev.name),
          description,
          lumaUrl: `https://luma.com/${ev.url}`,
          coverUrl,
        }
      })
    )

    return events.sort((a, b) => a.date.localeCompare(b.date))
  } catch {
    return []
  }
}
