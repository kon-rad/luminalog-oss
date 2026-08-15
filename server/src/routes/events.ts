import { Router, Request, Response } from 'express'
import { db } from '../middleware/firebaseAuth'

/**
 * Past events archive. Public and unauthenticated: this is the same marketing
 * content the Argo website already renders, and it carries no user data.
 *
 * The archive is owned by us, not Luma. It is written by the local sync script
 * (web/scripts/sync-luma-past-events.mjs) and read here through the Admin SDK,
 * which bypasses Firestore rules, so `pastEvents` stays closed to clients.
 * See docs/superpowers/specs/2026-08-14-past-events-archive-design.md.
 */

export interface PastEventPhoto {
  thumb: string
  full: string
}

/** Public-safe projection. Internal sync bookkeeping never reaches the client. */
export function publicEvent(data: any) {
  return {
    slug: data.slug ?? '',
    title: data.title ?? '',
    date: data.date ?? '',
    time: data.time ?? '',
    location: data.location ?? '',
    eventType: data.eventType ?? 'OTHER',
    lumaUrl: data.lumaUrl ?? '',
    coverUrl: data.coverUrl ?? '',
    description: data.description ?? '',
    photos: Array.isArray(data.photos)
      ? data.photos.filter(
          (p: PastEventPhoto) => typeof p?.thumb === 'string' && typeof p?.full === 'string',
        )
      : [],
  }
}

export const eventsRouter = Router()

// GET /v1/events/past: the whole archive, newest first.
eventsRouter.get('/past', async (_req: Request, res: Response) => {
  try {
    const snap = await db.collection('pastEvents').orderBy('date', 'desc').get()
    // Cached at the edge and by the caller; the archive changes only on a sync.
    res.set('Cache-Control', 'public, max-age=300, stale-while-revalidate=3600')
    res.json({ events: snap.docs.map((d) => publicEvent(d.data())) })
  } catch (err) {
    // An empty archive is a valid answer; the website degrades to its empty
    // state rather than showing an error page.
    console.error('[events] failed to read pastEvents:', err)
    res.status(200).json({ events: [] })
  }
})
