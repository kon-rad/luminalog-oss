// Re-index every journal into Chroma with the CURRENT embedding model.
// Required after changing TOGETHER_EMBEDDING_MODEL (embedding dimensions /
// vector space change, so old vectors are incompatible and must be replaced).
//
// Wipes + recreates the `journals` Chroma collection, then re-embeds all
// journals. Reads compiled code from dist/, so run AFTER `npm run build`.
// Run on the server: cd /root/luminalog/luminalog-api && node scripts/reindex-all.js
require('dotenv').config()
const admin = require('firebase-admin')
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
})
const db = admin.firestore()

const { ChromaClient } = require('chromadb')
const { indexJournalEntry } = require('../dist/services/journalIndexer')
const { getOrCreateDEK } = require('../dist/crypto/keyService')
const { openFieldSafe } = require('../dist/crypto/fieldCipher')

;(async () => {
  console.log(`[reindex] embedding model: ${process.env.TOGETHER_EMBEDDING_MODEL}`)

  // 1. Drop + recreate the collection so dimensions reset cleanly.
  const client = new ChromaClient({ path: process.env.CHROMA_URL || 'http://localhost:8000' })
  try { await client.deleteCollection({ name: 'journals' }) } catch (_) {}
  await client.getOrCreateCollection({ name: 'journals', metadata: { 'hnsw:space': 'cosine' } })
  console.log('[reindex] journals collection reset (empty)')

  // 2. Re-embed every journal, sequentially (avoids embedding rate limits).
  const snap = await db.collection('journals').get()
  let indexed = 0, skipped = 0, failed = 0, chunks = 0
  console.log(`[reindex] ${snap.size} journals to process`)

  for (const doc of snap.docs) {
    const data = doc.data()
    const uid = data.userId
    if (!uid) { skipped++; continue }
    try {
      const dek = await getOrCreateDEK(uid)
      const content = openFieldSafe(dek, data.content, 'journals.content')
      if (!content.trim()) { skipped++; continue }
      const title = openFieldSafe(dek, data.title, 'journals.title')
      const updatedAt = data.updatedAt?.toDate
        ? data.updatedAt.toDate().toISOString()
        : new Date().toISOString()

      const result = await indexJournalEntry({
        userId: uid, entryId: doc.id, content, title,
        type: data.type ?? 'text', updatedAt, dek,
      })
      chunks += result.chunks
      indexed++
      await doc.ref.update({
        vector: {
          status: 'indexed',
          chunkCount: result.chunks,
          indexedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
      }).catch(() => {})
      if (indexed % 25 === 0) console.log(`[reindex] ${indexed} indexed...`)
    } catch (err) {
      failed++
      console.error(`[reindex] FAILED ${doc.id}:`, err.message)
      await doc.ref.update({ 'vector.status': 'failed' }).catch(() => {})
    }
  }

  console.log(JSON.stringify({ total: snap.size, indexed, skipped, failed, chunks }, null, 2))
  process.exit(failed > 0 ? 1 : 0)
})()
