/* ──────────────────────────────────────────────────────────────────────────
 * Past events archive.
 *
 * We own this data. It lives in Firestore (`pastEvents`), is written by
 * scripts/sync-luma-past-events.mjs, and is served by the API server's public
 * GET /v1/events/past. Cover images are mirrored into public/events/<slug>/, so
 * rendering the archive touches Luma neither for data nor for images.
 *
 * Luma is queried at request time only for UPCOMING events (see luma.ts).
 *
 * Design: docs/superpowers/specs/2026-08-14-past-events-archive-design.md
 * ────────────────────────────────────────────────────────────────────────── */

const API_URL = process.env.API_URL ?? 'https://api.luminalog.com'
const REVALIDATE = 3600 // 1 hour; the archive changes only when a sync runs

export interface PastEventPhoto {
  thumb: string
  full: string
}

export interface PastEvent {
  slug: string
  title: string
  date: string // YYYY-MM-DD
  time: string
  location: string
  eventType: string
  lumaUrl: string
  coverUrl: string
  description: string
  photos: PastEventPhoto[]
}

/**
 * The whole archive, newest first. Never throws: a failed read degrades to the
 * same empty state the Upcoming tab uses, rather than erroring the page.
 */
export async function getPastEvents(): Promise<PastEvent[]> {
  try {
    const res = await fetch(`${API_URL}/v1/events/past`, {
      next: { revalidate: REVALIDATE },
    })
    if (!res.ok) return []
    const data = (await res.json()) as { events?: PastEvent[] }
    return Array.isArray(data.events) ? data.events : []
  } catch {
    return []
  }
}
