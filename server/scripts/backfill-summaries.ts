/* Backfill summaries + summary vectors for existing journals.
 * Usage: tsx scripts/backfill-summaries.ts [--dry-run] [--force] [--user=<uid>] */
import { db } from '../src/middleware/firebaseAuth'
import { getOrCreateDEK } from '../src/crypto/keyService'
import { openField, encryptField } from '../src/crypto/fieldCipher'
import { generateSummaryText } from '../src/services/summaryGenerator'
import { indexSummary } from '../src/services/summaryIndexer'
import admin from 'firebase-admin'

const args = process.argv.slice(2)
const dryRun = args.includes('--dry-run')
const force = args.includes('--force')
const userArg = args.find(a => a.startsWith('--user='))?.split('=')[1]

async function main() {
  let q: admin.firestore.Query = db.collection('journals')
  if (userArg) q = q.where('userId', '==', userArg)
  const snap = await q.get()
  console.log(`Found ${snap.size} journals${dryRun ? ' (dry-run)' : ''}`)

  let done = 0, skipped = 0, failed = 0
  for (const doc of snap.docs) {
    const data = doc.data()
    const uid = data.userId as string
    try {
      const dek = await getOrCreateDEK(uid)
      const content = openField(dek, data.content, 'journals.content')
      if (!content.trim()) { skipped++; continue }
      if (!force && data.summary?.text && data.vector?.summaryIndexed) { skipped++; continue }

      if (dryRun) { console.log(`would index ${doc.id}`); done++; continue }

      const title = openField(dek, data.title, 'journals.title')
      const type = data.type ?? 'text'
      const userConfig = (await db.collection('users').doc(uid).get()).data()?.summaryConfig
      const summary = await generateSummaryText({ type, content, userConfig })

      await doc.ref.update({
        summary: {
          text: encryptField(dek, summary.text, 'journals.summary.text'),
          generatedAt: admin.firestore.Timestamp.fromDate(new Date(summary.generatedAt)),
          model: summary.model,
        },
        'vector.summaryIndexed': true,
      })
      const date = (data.updatedAt as admin.firestore.Timestamp)?.toDate().toISOString().slice(0, 10)
        ?? new Date().toISOString().slice(0, 10)
      await indexSummary({ userId: uid, entryId: doc.id, summaryText: summary.text, type, title, date, dek })
      done++
      if (done % 25 === 0) console.log(`...${done} indexed`)
    } catch (err) {
      failed++
      console.error(`failed ${doc.id}:`, err)
    }
  }
  console.log(`Done. indexed=${done} skipped=${skipped} failed=${failed}`)
  process.exit(0)
}

main()
