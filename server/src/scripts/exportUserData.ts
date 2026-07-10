import admin from 'firebase-admin'
import { writeFileSync, mkdirSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { db } from '../middleware/firebaseAuth'
import { getOrCreateDEK } from '../crypto/keyService'
import { openFieldSafe } from '../crypto/fieldCipher'

// ---------------------------------------------------------------------------
// exportUserData — READ-ONLY, pre-cutover safety backup for one user (by email).
//
// Produces a complete, recoverable snapshot BEFORE the irreversible 1d
// zero-knowledge cutover: the raw DEK (so ANY ciphertext is decryptable later),
// every raw Firestore document the user owns (nothing lost even if a field's
// encryption context is unknown here), AND decrypted plaintext for the known
// fields (journals title/content, biography, chat message text).
//
// ⚠️ The output file contains the DEK and decrypted personal data. It is written
//    OUTSIDE the repo (~/luminalog-backups) and must be kept offline + secret and
//    NEVER committed.
//
// Usage: npx tsx src/scripts/exportUserData.ts <email>
//        (run in an environment whose FIREBASE_SERVICE_ACCOUNT_JSON points at the
//         project that holds the user's data). No writes are performed.
// ---------------------------------------------------------------------------

/** JSON replacer: Firestore Timestamps → ISO strings, Buffers → base64. */
function jsonSafe(_key: string, value: unknown): unknown {
  if (value instanceof admin.firestore.Timestamp) return value.toDate().toISOString()
  if (value && typeof value === 'object' && (value as any)._seconds !== undefined && (value as any)._nanoseconds !== undefined) {
    return new admin.firestore.Timestamp((value as any)._seconds, (value as any)._nanoseconds).toDate().toISOString()
  }
  return value
}

async function exportUser(email: string): Promise<void> {
  const userRecord = await admin.auth().getUserByEmail(email)
  const uid = userRecord.uid
  console.log(`[export] ${email} → uid ${uid}`)

  const dek = await getOrCreateDEK(uid) // existing user → reads; never mutates data

  // Profile (users/{uid}) — raw doc + decrypted biography.
  const profileRaw = (await db.collection('users').doc(uid).get()).data() ?? {}
  const biography = openFieldSafe(dek, profileRaw.biography, 'users.biography')

  // Journals (top-level, where userId == uid) — raw + decrypted title/content.
  const jSnap = await db.collection('journals').where('userId', '==', uid).get()
  const journals = jSnap.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      title: openFieldSafe(dek, data.title, 'journals.title'),
      content: openFieldSafe(dek, data.content, 'journals.content'),
      raw: data,
    }
  })

  // Chats (where userId == uid) + their messages subcollection (text via messages.text).
  const cSnap = await db.collection('chats').where('userId', '==', uid).get()
  const chats = []
  for (const c of cSnap.docs) {
    const mSnap = await c.ref.collection('messages').get()
    chats.push({
      id: c.id,
      raw: c.data(),
      messages: mSnap.docs.map((m) => {
        const md = m.data()
        return { id: m.id, text: openFieldSafe(dek, md.text, 'messages.text'), raw: md }
      }),
    })
  }

  // Daily reports (dailyReports/{uid}/days) — raw docs (ciphertext preserved; the
  // DEK above decrypts them later if needed).
  const dSnap = await db.collection('dailyReports').doc(uid).collection('days').get()
  const dailyReports = dSnap.docs.map((d) => ({ id: d.id, raw: d.data() }))

  const backup = {
    __warning: 'CONTAINS THE RAW DECRYPTION KEY (dekBase64) AND DECRYPTED PERSONAL DATA. Keep offline and secret. NEVER commit or upload.',
    exportedAt: new Date().toISOString(),
    email,
    uid,
    dekBase64: dek.toString('base64'),
    counts: { journals: journals.length, chats: chats.length, dailyReports: dailyReports.length },
    profile: { biography, raw: profileRaw },
    journals,
    chats,
    dailyReports,
  }

  const dir = join(homedir(), 'luminalog-backups')
  mkdirSync(dir, { recursive: true })
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const file = join(dir, `backup-${email.replace(/[^a-zA-Z0-9]/g, '_')}-${stamp}.json`)
  writeFileSync(file, JSON.stringify(backup, jsonSafe, 2), { mode: 0o600 })

  console.log(`[export] wrote ${file}`)
  console.log(`[export] journals=${journals.length} chats=${chats.length} dailyReports=${dailyReports.length}`)
  console.log('[export] ⚠️  file contains the DEK + plaintext — keep it offline and secret.')
}

const email = process.argv.slice(2).find((a) => !a.startsWith('--'))
if (!email) {
  console.error('Usage: npx tsx src/scripts/exportUserData.ts <email>')
  process.exit(1)
}
exportUser(email)
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[export] FAILED:', e)
    process.exit(1)
  })
