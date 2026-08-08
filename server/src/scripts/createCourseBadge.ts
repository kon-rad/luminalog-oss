/**
 * Create/replace a course-badge class session from a JSON file, assigning the
 * next on-chain `chainClassId` transactionally.
 *   npx tsx src/scripts/createCourseBadge.ts src/scripts/example-course.json
 */
import 'dotenv/config'
import { readFileSync } from 'node:fs'
import admin from 'firebase-admin'
import { db } from '../middleware/firebaseAuth'

async function main(): Promise<void> {
  const path = process.argv[2]
  if (!path) {
    console.error('Usage: npx tsx src/scripts/createCourseBadge.ts <course.json>')
    process.exit(1)
  }
  const input = JSON.parse(readFileSync(path, 'utf8'))
  const { classId, ...fields } = input
  if (!classId) throw new Error('classId is required')
  if (!Array.isArray(fields.quiz) || fields.quiz.length === 0)
    throw new Error('quiz must be a non-empty array')

  const docRef = db.collection('courseBadges').doc(classId)
  const counterRef = db.collection('meta').doc('courseBadgeCounter')

  const chainClassId = await db.runTransaction(async (tx) => {
    const existing = await tx.get(docRef)
    if (existing.exists && typeof existing.data()?.chainClassId === 'number') {
      // Preserve the chainClassId across re-runs (the on-chain id must be stable).
      tx.set(docRef, { ...fields }, { merge: true })
      return existing.data()!.chainClassId as number
    }
    const cSnap = await tx.get(counterRef)
    const next = ((cSnap.data()?.value as number) ?? 0) + 1
    tx.set(counterRef, { value: next }, { merge: true })
    tx.set(docRef, { ...fields, chainClassId: next }, { merge: true })
    return next
  })

  console.log(`[course] wrote courseBadges/${classId} (chainClassId=${chainClassId})`)
  console.log(`[course] QR target: https://myargoquest.com/badge/${classId}`)
  await admin.app().delete()
}

main().catch((e) => {
  console.error('[course] failed', e)
  process.exit(1)
})
