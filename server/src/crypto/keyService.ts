import admin from 'firebase-admin'
import { db } from '../middleware/firebaseAuth'

/**
 * Crypto-shred a user: delete the legacy MASTER_KEY-wrapped `wrappedDEK` field so the
 * server can never decrypt their data again. The zero-knowledge architecture never
 * creates a server-held DEK — all keys are client-held (iCloud Keychain + recovery
 * code) — so this is the only key operation the server still performs.
 */
export async function cryptoShredUser(uid: string): Promise<void> {
  await db.collection('users').doc(uid).update({
    wrappedDEK: admin.firestore.FieldValue.delete(),
  })
}
