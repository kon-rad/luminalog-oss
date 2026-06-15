// DESTRUCTIVE: removes pre-encryption plaintext journals/chats + Chroma vectors
// so only encrypted data exists going forward. Preserves users/{uid} docs
// (identity, stats, and any wrappedDEK). Pre-launch use only.
// Run on the server: cd /root/luminalog/luminalog-api && node scripts/wipe-pre-encryption-data.js
require('dotenv').config()
const admin = require('firebase-admin')
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
})
const db = admin.firestore()

async function deleteCollection(ref) {
  let total = 0
  while (true) {
    const snap = await ref.limit(300).get()
    if (snap.empty) break
    const batch = db.batch()
    snap.docs.forEach(d => batch.delete(d.ref))
    await batch.commit()
    total += snap.size
    if (snap.size < 300) break
  }
  return total
}

;(async () => {
  // Journals
  const journalsDeleted = await deleteCollection(db.collection('journals'))

  // Chats + their messages subcollections
  let chatsDeleted = 0, chatMessagesDeleted = 0
  const chats = await db.collection('chats').get()
  for (const chat of chats.docs) {
    chatMessagesDeleted += await deleteCollection(chat.ref.collection('messages'))
    await chat.ref.delete()
    chatsDeleted++
  }

  // Chroma journals vectors — drop and recreate the collection clean
  let chroma = 'n/a'
  try {
    const { ChromaClient } = require('chromadb')
    const client = new ChromaClient({ path: process.env.CHROMA_URL || 'http://localhost:8000' })
    try { await client.deleteCollection({ name: 'journals' }) } catch (_) {}
    await client.getOrCreateCollection({ name: 'journals', metadata: { 'hnsw:space': 'cosine' } })
    chroma = 'reset (empty)'
  } catch (e) { chroma = 'error: ' + e.message }

  console.log(JSON.stringify({
    journalsDeleted, chatsDeleted, chatMessagesDeleted, chroma,
    usersPreserved: (await db.collection('users').count().get()).data().count,
  }, null, 2))
  process.exit(0)
})()
