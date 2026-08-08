import { Router, Request, Response } from 'express'
import admin from 'firebase-admin'
import { firebaseAuth, db } from '../middleware/firebaseAuth'
import { mintCourseBadge } from '../services/chain/courseBadgeService'

export interface QuizQuestion {
  id: string
  type: 'mc' | 'short'
  prompt: string
  options?: string[]
}

/** Completion gate: every quiz question must have a non-empty answer. Returns an
 *  error message (safe to send to the client) or null when valid. */
export function validateSubmission(quiz: QuizQuestion[], answers: unknown): string | null {
  if (!answers || typeof answers !== 'object') return 'answers must be an object'
  const a = answers as Record<string, unknown>
  for (const q of quiz) {
    const v = a[q.id]
    if (v === undefined || v === null) return `missing answer for ${q.id}`
    if (typeof v === 'string' && v.trim() === '') return `blank answer for ${q.id}`
  }
  return null
}

/** Public-safe class fields for the claim page (no admin-only internals). */
function publicClass(data: any) {
  return {
    name: data.name ?? '',
    course: data.course ?? '',
    module: data.module ?? '',
    date: data.date ?? '',
    time: data.time ?? '',
    location: data.location ?? '',
    imageUrl: data.imageUrl ?? '',
    contentUrl: data.contentUrl ?? null,
    active: data.active !== false,
    quiz: Array.isArray(data.quiz) ? data.quiz : [],
  }
}

export const courseRouter = Router()
courseRouter.use(firebaseAuth)

// GET /v1/course/:classId — class definition + the caller's own participation.
courseRouter.get('/:classId', async (req: Request, res: Response) => {
  const uid = (req as any).uid as string
  try {
    const snap = await db.collection('courseBadges').doc(req.params.classId).get()
    if (!snap.exists) return res.status(404).json({ error: 'not found' })
    const pSnap = await db
      .collection('courseBadges')
      .doc(req.params.classId)
      .collection('participants')
      .doc(uid)
      .get()
    const p = pSnap.data() as any
    res.json({
      class: publicClass(snap.data()),
      participation: p
        ? { answers: p.answers ?? null, submittedAt: p.submittedAt ?? null, badge: p.badge ?? null }
        : null,
    })
  } catch (err) {
    console.error('[course] get failed', err)
    res.status(500).json({ error: 'internal' })
  }
})

// POST /v1/course/:classId/submit — save answers (completion-gated).
courseRouter.post('/:classId/submit', async (req: Request, res: Response) => {
  const uid = (req as any).uid as string
  try {
    const snap = await db.collection('courseBadges').doc(req.params.classId).get()
    if (!snap.exists) return res.status(404).json({ error: 'not found' })
    const data = snap.data() as any
    if (data.active === false) return res.status(403).json({ error: 'class closed' })

    const quiz: QuizQuestion[] = Array.isArray(data.quiz) ? data.quiz : []
    const answers = (req.body as { answers?: unknown })?.answers
    const problem = validateSubmission(quiz, answers)
    if (problem) return res.status(400).json({ error: problem })

    // displayName from the user doc (plaintext, first-name greeting field).
    const userDoc = await db.collection('users').doc(uid).get()
    const displayName = ((userDoc.data()?.displayName as string) ?? '').trim()

    await db
      .collection('courseBadges')
      .doc(req.params.classId)
      .collection('participants')
      .doc(uid)
      .set(
        { displayName, answers, submittedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
      )
    res.json({ ok: true })
  } catch (err) {
    console.error('[course] submit failed', err)
    res.status(500).json({ error: 'internal' })
  }
})

// POST /v1/course/:classId/mint — mint the badge to the caller's wallet.
courseRouter.post('/:classId/mint', async (req: Request, res: Response) => {
  const uid = (req as any).uid as string
  try {
    const result = await mintCourseBadge(uid, req.params.classId)
    res.json(result)
  } catch (err: any) {
    const msg = err?.message ?? 'internal'
    const code = /no submission/i.test(msg) ? 400 : /disabled/i.test(msg) ? 503 : 500
    console.error('[course] mint failed', msg)
    res.status(code).json({ error: msg })
  }
})
