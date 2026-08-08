import { Router, Request, Response } from 'express'
import { db } from '../middleware/firebaseAuth'

export interface CourseBadgeMetadata {
  name: string
  description: string
  image: string
  attributes: { trait_type: string; value: string }[]
}

export interface CourseBadgeFields {
  name: string
  course: string
  module: string
  date: string
  time: string
  location: string
  imageUrl: string
  firstName: string
}

/** Pure ERC-721 metadata builder. Contains ONLY class facts + the participant's
 *  first name + the (Luma) image — never quiz answers or any user content. */
export function buildCourseBadgeMetadata(
  tokenId: string,
  f: CourseBadgeFields,
): CourseBadgeMetadata {
  const who = f.firstName?.trim() || 'A participant'
  const attributes = [
    { trait_type: 'Course', value: f.course },
    ...(f.module?.trim() ? [{ trait_type: 'Module', value: f.module }] : []),
    { trait_type: 'Date', value: f.date },
    { trait_type: 'Time', value: f.time },
    { trait_type: 'Location', value: f.location },
    { trait_type: 'Participant', value: who },
  ]
  return {
    name: `Argo Course Badge — ${f.name}`,
    description: `${who} completed ${f.name} on ${f.date} at ${f.location}.`,
    image: f.imageUrl,
    attributes,
  }
}

/** Resolve a tokenId to published-safe metadata via the reverse index. Returns
 *  null if the token is unknown. Reads ONLY publish-safe fields. */
export async function getCourseBadgeMetadata(tokenId: string): Promise<CourseBadgeMetadata | null> {
  const idxSnap = await db.collection('courseBadgeTokens').doc(tokenId).get()
  const idx = idxSnap.data() as { classId?: string; uid?: string } | undefined
  if (!idx?.classId || !idx?.uid) return null

  const courseSnap = await db.collection('courseBadges').doc(idx.classId).get()
  const c = courseSnap.data() as Partial<CourseBadgeFields> | undefined
  if (!c) return null

  const pSnap = await db
    .collection('courseBadges')
    .doc(idx.classId)
    .collection('participants')
    .doc(idx.uid)
    .get()
  const displayName = ((pSnap.data() as { displayName?: string } | undefined)?.displayName ?? '').trim()
  const firstName = displayName.split(/\s+/)[0] || ''

  return buildCourseBadgeMetadata(tokenId, {
    name: c.name ?? '',
    course: c.course ?? '',
    module: c.module ?? '',
    date: c.date ?? '',
    time: c.time ?? '',
    location: c.location ?? '',
    imageUrl: c.imageUrl ?? '',
    firstName,
  })
}

export const courseBadgeRouter = Router()

// GET /v1/course-badge/:file — matches the on-chain tokenURI (baseURI + id + ".json").
// Public (no auth): wallets + marketplaces fetch it.
courseBadgeRouter.get('/:file', async (req: Request, res: Response) => {
  const m = /^(\d+)\.json$/.exec(req.params.file)
  if (!m) return res.status(404).json({ error: 'not found' })
  try {
    const meta = await getCourseBadgeMetadata(m[1])
    if (!meta) return res.status(404).json({ error: 'not found' })
    res.setHeader('Cache-Control', 'public, max-age=300')
    res.json(meta)
  } catch (err) {
    console.error('[course-badge] metadata failed', err)
    res.status(500).json({ error: 'internal' })
  }
})
