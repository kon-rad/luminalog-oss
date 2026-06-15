// Read-only: counts pre-encryption data so we know exactly what a wipe removes.
// Run on the server: cd /root/luminalog/luminalog-api && node scripts/assess-data.js
require('dotenv').config()
const admin = require('firebase-admin')
admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)),
})
const db = admin.firestore()

function isEnvelope(v) {
  return v && typeof v === 'object' && v.v === 1 && v.alg === 'A256GCM'
}

;(async () => {
  const [journals, chats, messages] = await Promise.all([
    db.collection('journals').count().get(),
    db.collection('chats').count().get(),
    db.collectionGroup('messages').count().get(),
  ])

  const users = await db.collection('users').get()
  let withDek = 0, plaintextBio = 0, encryptedBio = 0
  users.forEach(d => {
    const x = d.data()
    if (x.wrappedDEK) withDek++
    if (typeof x.biography === 'string' && x.biography.length) plaintextBio++
    else if (isEnvelope(x.biography)) encryptedBio++
  })

  let chroma = 'n/a'
  try {
    const { ChromaClient } = require('chromadb')
    const client = new ChromaClient({ path: process.env.CHROMA_URL || 'http://localhost:8000' })
    const col = await client.getOrCreateCollection({ name: 'journals' })
    chroma = await col.count()
  } catch (e) { chroma = 'error: ' + e.message }

  console.log(JSON.stringify({
    journals: journals.data().count,
    chats: chats.data().count,
    messages: messages.data().count,
    users: users.size,
    usersWithWrappedDEK: withDek,
    usersWithPlaintextBiography: plaintextBio,
    usersWithEncryptedBiography: encryptedBio,
    chromaJournalVectors: chroma,
  }, null, 2))
  process.exit(0)
})()
