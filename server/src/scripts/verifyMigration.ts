import admin from 'firebase-admin'
import { createDecipheriv, hkdfSync } from 'node:crypto'
import { db } from '../middleware/firebaseAuth'
import { getOrCreateDEK } from '../crypto/keyService'

// Read-only verification of a 1d migration: confirms the client wraps landed, the
// legacy wrappedDEK is still present (NOT finalized), and — given the recovery code —
// independently proves the recovery wrap recovers the EXACT same DEK the server holds
// (defense-in-depth beyond the app's in-app verify). Reproduces the iOS
// RecoveryCode.deriveKEK crypto byte-for-byte. No writes.
//
// Usage: npx tsx src/scripts/verifyMigration.ts <email> [recoveryCode]

/** Mirrors iOS RecoveryCode.normalize (strip -/space, uppercase, O→0 I/L→1 U→V). */
function normalizeCode(code: string): string {
  const stripped = [...code.toUpperCase()].filter((c) => c !== '-' && !/\s/.test(c)).join('')
  let out = ''
  for (const ch of stripped) {
    if (ch === 'O') out += '0'
    else if (ch === 'I' || ch === 'L') out += '1'
    else if (ch === 'U') out += 'V'
    else out += ch
  }
  return out
}

/** Mirrors iOS RecoveryCode.deriveKEK: HKDF-SHA256 over the normalized code. */
function deriveRecoveryKEK(code: string): Buffer {
  const ikm = Buffer.from(normalizeCode(code), 'utf8')
  const salt = Buffer.from('luminalog-recovery-kek-salt-v1', 'utf8')
  const info = Buffer.from('luminalog-recovery-kek-v1', 'utf8')
  return Buffer.from(hkdfSync('sha256', ikm, salt, info, 32))
}

/** AES-256-GCM unwrap (no AAD), matching iOS WrappedKey.wrapping/unwrapping. */
function unwrapGCM(kek: Buffer, env: { iv: string; ct: string; tag: string }): Buffer {
  const d = createDecipheriv('aes-256-gcm', kek, Buffer.from(env.iv, 'base64'))
  d.setAuthTag(Buffer.from(env.tag, 'base64'))
  return Buffer.concat([d.update(Buffer.from(env.ct, 'base64')), d.final()])
}

async function main(): Promise<void> {
  const args = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const email = args.find((a) => a.includes('@'))
  const code = args.find((a) => !a.includes('@'))
  if (!email) throw new Error('Usage: verifyMigration.ts <email> [recoveryCode]')

  const uid = (await admin.auth().getUserByEmail(email)).uid
  const doc = (await db.collection('users').doc(uid).get()).data() ?? {}
  const wk = (doc.wrappedKeys ?? {}) as any

  const hasICloud = !!(wk.icloud?.v && wk.icloud?.iv && wk.icloud?.ct && wk.icloud?.tag)
  const hasRecovery = !!(wk.recovery?.v && wk.recovery?.iv && wk.recovery?.ct && wk.recovery?.tag)
  console.log(`uid=${uid}`)
  console.log(`wrappedKeys.icloud:   ${hasICloud ? 'present ✅' : 'MISSING ❌'}`)
  console.log(`wrappedKeys.recovery: ${hasRecovery ? 'present ✅' : 'MISSING ❌'}`)
  console.log(`wrappedDEK (legacy):  ${doc.wrappedDEK ? 'present — NOT finalized ✅' : 'GONE (finalized)'}`)
  console.log(`zkKeyVersion=${doc.zkKeyVersion ?? 'none'}  zkMigratedAt=${doc.zkMigratedAt ? 'set' : 'none'}`)

  const trueDEK = await getOrCreateDEK(uid) // reads (existing user); never mutates

  if (code && hasRecovery) {
    try {
      const recovered = unwrapGCM(deriveRecoveryKEK(code), wk.recovery)
      const match = recovered.length === 32 && recovered.equals(trueDEK)
      console.log(`RECOVERY-CODE PROOF: ${match ? 'PASS ✅ — the code recovers the EXACT server DEK' : 'FAIL ❌ — recovered key ≠ server DEK'}`)
      console.log(`  recovered=${recovered.toString('base64').slice(0, 10)}…  serverDEK=${trueDEK.toString('base64').slice(0, 10)}…`)
    } catch (e) {
      console.log(`RECOVERY-CODE PROOF: FAIL ❌ — unwrap threw (wrong code / bad wrap): ${String(e)}`)
    }
  } else if (!code) {
    console.log('(no recovery code passed — skipped the recovery-code proof)')
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('[verifyMigration] FAILED:', e)
    process.exit(1)
  })
