import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../config', () => ({
  config: {
    CDP_API_KEY_ID: 'test-id',
    CDP_API_KEY_SECRET: 'test-secret',
    CDP_WALLET_SECRET: 'test-wallet-secret',
  },
}))

// Mock the CDP SDK: capture getOrCreateAccount and the CdpClient constructor.
// vi.mock is hoisted, so shared mock fns must come from vi.hoisted().
const { getOrCreateAccount, CdpClient } = vi.hoisted(() => {
  const getOrCreateAccount = vi.fn()
  const CdpClient = vi.fn(() => ({ evm: { getOrCreateAccount } }))
  return { getOrCreateAccount, CdpClient }
})
vi.mock('@coinbase/cdp-sdk', () => ({ CdpClient }))

// In-memory Firestore user-doc store.
let store: Record<string, any> = {}
vi.mock('../../middleware/firebaseAuth', () => ({
  db: {
    collection: (c: string) => ({
      doc: (id: string) => ({
        get: async () => ({ data: () => store[`${c}/${id}`] }),
        set: async (data: any, opts: any) => {
          const key = `${c}/${id}`
          store[key] = opts?.merge ? { ...(store[key] || {}), ...data } : data
        },
      }),
    }),
  },
}))

import { ensureUserWallet, accountNameForUid } from './walletService'

const ADDR = '0xABc0000000000000000000000000000000000001'

beforeEach(() => {
  store = {}
  vi.clearAllMocks()
  getOrCreateAccount.mockResolvedValue({ address: ADDR })
})

describe('accountNameForUid', () => {
  it('produces a valid CDP account name (letter-start, alnum+hyphen, <=36 chars)', () => {
    const name = accountNameForUid('Abc123XyzUid')
    expect(name).toMatch(/^[a-zA-Z][a-zA-Z0-9-]{1,35}$/)
    expect(name.length).toBeLessThanOrEqual(36)
  })

  it('strips characters that are not alphanumeric', () => {
    expect(accountNameForUid('a.b/c@d')).toBe('user-abcd')
  })

  it('truncates very long uids to stay within the 36-char limit', () => {
    const long = 'x'.repeat(100)
    const name = accountNameForUid(long)
    expect(name.length).toBeLessThanOrEqual(36)
    expect(name.startsWith('user-')).toBe(true)
  })
})

describe('ensureUserWallet', () => {
  it('creates a wallet on first call and persists it on the user doc', async () => {
    const addr = await ensureUserWallet('uid1')
    expect(addr).toBe(ADDR)
    expect(getOrCreateAccount).toHaveBeenCalledOnce()
    expect(getOrCreateAccount).toHaveBeenCalledWith({ name: 'user-uid1' })
    expect(store['users/uid1'].wallet).toEqual({
      provider: 'cdp',
      address: ADDR,
      accountName: 'user-uid1',
    })
  })

  it('is idempotent: returns the stored address without calling CDP again', async () => {
    store['users/uid1'] = {
      wallet: { provider: 'cdp', address: '0xEXISTING', accountName: 'user-uid1' },
    }
    const addr = await ensureUserWallet('uid1')
    expect(addr).toBe('0xEXISTING')
    expect(getOrCreateAccount).not.toHaveBeenCalled()
  })

  it('recovers from a prior failed persist by get-or-create (same address)', async () => {
    // No wallet stored yet, but CDP already holds the account for this name.
    const addr = await ensureUserWallet('uid1')
    expect(addr).toBe(ADDR)
    expect(getOrCreateAccount).toHaveBeenCalledWith({ name: 'user-uid1' })
    expect(store['users/uid1'].wallet.address).toBe(ADDR)
  })
})
