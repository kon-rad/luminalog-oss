import { CdpClient } from '@coinbase/cdp-sdk'
import { config, chainEnabled } from '../../config'
import { db } from '../../middleware/firebaseAuth'

let _loggedDisabled = false
function logDisabledOnce(): void {
  if (_loggedDisabled) return
  _loggedDisabled = true
  console.debug('[chain] disabled (missing chain env) — ensureUserWallet is a no-op')
}

/**
 * A user's backend-custodied CDP Server Wallet, stored on `users/{uid}.wallet`.
 * CDP v2 accounts are identified by `name` (idempotent get-or-create) — there is
 * no separate wallet id, so we persist the account name we derived from the uid.
 */
export interface UserWallet {
  provider: 'cdp'
  address: string
  accountName: string
}

let _cdp: CdpClient | null = null

/** Lazily construct one CdpClient from validated config (creds are `.optional()`). */
function cdp(): CdpClient {
  if (!_cdp) {
    if (!config.CDP_API_KEY_ID || !config.CDP_API_KEY_SECRET || !config.CDP_WALLET_SECRET) {
      throw new Error(
        'CDP credentials missing — set CDP_API_KEY_ID, CDP_API_KEY_SECRET, CDP_WALLET_SECRET',
      )
    }
    _cdp = new CdpClient({
      apiKeyId: config.CDP_API_KEY_ID,
      apiKeySecret: config.CDP_API_KEY_SECRET,
      walletSecret: config.CDP_WALLET_SECRET,
    })
  }
  return _cdp
}

/**
 * Derive a CDP account name from a Firebase uid. CDP names allow alphanumerics
 * and hyphens and are 2–36 chars; Firebase uids are alphanumeric, but we strip
 * anything else and truncate for safety. The `user-` prefix guarantees a
 * letter-start and a stable, collision-free mapping for real uids.
 */
export function accountNameForUid(uid: string): string {
  const cleaned = uid.replace(/[^a-zA-Z0-9]/g, '').slice(0, 30)
  return `user-${cleaned}`
}

/**
 * Ensure the user has a CDP Server Wallet and return its address. Idempotent:
 *  - if an address is already stored on the user doc, return it (no CDP call);
 *  - otherwise get-or-create the CDP account by its derived name (so a prior
 *    failed persist still resolves to the same address), then store
 *    `{ provider, address, accountName }` on `users/{uid}.wallet`.
 */
export async function ensureUserWallet(uid: string): Promise<string | undefined> {
  // Chain-disabled degradation: no-op when chain env is absent (shared server).
  if (!chainEnabled()) {
    logDisabledOnce()
    return undefined
  }

  const userRef = db.collection('users').doc(uid)
  const snap = await userRef.get()
  const existing = snap.data()?.wallet as UserWallet | undefined
  if (existing?.address) return existing.address

  const accountName = accountNameForUid(uid)
  const account = await cdp().evm.getOrCreateAccount({ name: accountName })
  const wallet: UserWallet = { provider: 'cdp', address: account.address, accountName }
  await userRef.set({ wallet }, { merge: true })
  return account.address
}
