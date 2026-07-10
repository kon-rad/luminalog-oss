import admin from 'firebase-admin'

// Local, decoupled copy of the envelope guard (keys.ts's isEnvelope is not exported;
// this script must not import the router). Kept in sync with `{v,iv,ct,tag}`.
type Envelope = { v: number; iv: string; ct: string; tag: string }
function isEnvelope(x: unknown): x is Envelope {
  return (
    !!x &&
    typeof x === 'object' &&
    typeof (x as any).v === 'number' &&
    typeof (x as any).iv === 'string' &&
    typeof (x as any).ct === 'string' &&
    typeof (x as any).tag === 'string'
  )
}

export interface FinalizeResult {
  uid: string
  eligible: boolean
  finalized: boolean
  reason?: string
}

/**
 * One-time, guarded, idempotent zero-knowledge finalize (encryption phase 1d).
 *
 * For each uid, delete the legacy MASTER_KEY-wrapped `wrappedDEK` ONLY if the user
 * has already uploaded BOTH client wraps (`wrappedKeys.icloud` + `.recovery`) — the
 * server-side proof the device migrated. Without them, the user is skipped so nobody
 * is ever locked out. `check: true` mutates nothing (dry-run). Never throws on an
 * ineligible user — it skips and logs. Idempotent: re-running an already-finalized
 * user re-deletes an absent field (a no-op) and returns finalized again.
 */
export async function finalizeUsers(
  database: FirebaseFirestore.Firestore,
  uids: string[],
  opts: { check: boolean },
): Promise<FinalizeResult[]> {
  const results: FinalizeResult[] = []
  for (const uid of uids) {
    const snap = await database.collection('users').doc(uid).get()
    const wk = snap.exists ? (snap.get('wrappedKeys') as any) : undefined
    const eligible = isEnvelope(wk?.icloud) && isEnvelope(wk?.recovery)

    if (!eligible) {
      console.log(`[finalizeZk] SKIP ${uid} — client wraps not present (not migrated)`)
      results.push({ uid, eligible: false, finalized: false, reason: 'no client wraps' })
      continue
    }
    if (opts.check) {
      console.log(`[finalizeZk] WOULD finalize ${uid} (dry-run)`)
      results.push({ uid, eligible: true, finalized: false, reason: 'check mode' })
      continue
    }
    await database
      .collection('users')
      .doc(uid)
      .update({
        wrappedDEK: admin.firestore.FieldValue.delete(),
        zkMigratedAt: admin.firestore.FieldValue.serverTimestamp(),
      })
    console.log(`[finalizeZk] FINALIZED ${uid} — wrappedDEK deleted`)
    results.push({ uid, eligible: true, finalized: true })
  }
  return results
}

/** All user document ids (used when no explicit uids are passed on the CLI). */
export async function allUserIds(database: FirebaseFirestore.Firestore): Promise<string[]> {
  const snap = await database.collection('users').get()
  return snap.docs.map((d) => d.id)
}

async function main(): Promise<void> {
  // Deferred import so unit tests can import `finalizeUsers` without initializing
  // Firebase. `.js` extension required under NodeNext resolution.
  const { db } = await import('../middleware/firebaseAuth.js')
  const check = process.argv.includes('--check')
  const uidArgs = process.argv.slice(2).filter((a) => !a.startsWith('--'))
  const uids = uidArgs.length ? uidArgs : await allUserIds(db)
  console.log(`[finalizeZk] ${check ? 'CHECK (dry-run)' : 'RUN'} over ${uids.length} user(s)`)
  const results = await finalizeUsers(db, uids, { check })
  const eligible = results.filter((r) => r.eligible).length
  const finalized = results.filter((r) => r.finalized).length
  console.log(`[finalizeZk] done — eligible=${eligible} finalized=${finalized}`)
}

// Run only when invoked directly (e.g. `npx tsx src/scripts/finalizeZkMigration.ts --check`),
// not when imported by the test. CommonJS output → `require.main === module`.
if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e)
      process.exit(1)
    })
}
