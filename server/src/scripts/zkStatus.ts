/**
 * READ-ONLY zero-knowledge cutover status. For every user, report whether the server
 * can still decrypt their data (`wrappedDEK` present under MASTER_KEY), whether both
 * client wraps are uploaded (icloud + recovery), and the finalize timestamp. Mutates
 * nothing. Run: `node --env-file=.env node_modules/.bin/tsx src/scripts/zkStatus.ts`
 */
async function main(): Promise<void> {
  const { db } = await import('../middleware/firebaseAuth.js')
  const admin = (await import('firebase-admin')).default

  const snap = await db.collection('users').get()
  const rows: Array<Record<string, unknown>> = []
  for (const doc of snap.docs) {
    const d = doc.data()
    const wk = (d.wrappedKeys as any) ?? {}
    let email = '(unknown)'
    try { email = (await admin.auth().getUser(doc.id)).email ?? '(no email)' } catch { /* deleted auth */ }
    rows.push({
      uid: doc.id,
      email,
      serverCanDecrypt: !!d.wrappedDEK, // legacy MASTER_KEY wrap still present
      icloudWrap: !!wk.icloud,
      recoveryWrap: !!wk.recovery,
      finalized: !d.wrappedDEK && !!wk.icloud && !!wk.recovery,
      zkMigratedAt: d.zkMigratedAt ? d.zkMigratedAt.toDate().toISOString() : null,
    })
  }

  rows.sort((a, b) => Number(a.serverCanDecrypt) - Number(b.serverCanDecrypt))
  console.log(JSON.stringify(rows, null, 2))
  const decryptable = rows.filter(r => r.serverCanDecrypt).length
  const finalized = rows.filter(r => r.finalized).length
  console.log(`\n[zkStatus] users=${rows.length} finalized=${finalized} server-still-decryptable=${decryptable}`)
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
