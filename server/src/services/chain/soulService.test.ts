import { describe, it, expect, vi, beforeEach } from 'vitest'

const { ensureUserWallet, ensureMinted } = vi.hoisted(() => ({
  ensureUserWallet: vi.fn(),
  ensureMinted: vi.fn(),
}))
vi.mock('./walletService', () => ({ ensureUserWallet }))
vi.mock('./mintService', () => ({ ensureMinted }))

let store: Record<string, any> = {}
vi.mock('../../middleware/firebaseAuth', () => ({
  db: {
    collection: (c: string) => ({
      doc: (id: string) => ({
        get: async () => ({ data: () => store[`${c}/${id}`] }),
      }),
    }),
  },
}))

import { ensureSoulMinted } from './soulService'

beforeEach(() => {
  store = {}
  vi.clearAllMocks()
  ensureUserWallet.mockResolvedValue('0xWALLET')
  ensureMinted.mockResolvedValue({ tokenId: '5' })
})

describe('ensureSoulMinted', () => {
  it('short-circuits (no provisioning) when wallet + nft already exist', async () => {
    store['users/uid1'] = { wallet: { address: '0xW' }, nft: { tokenId: '3' } }
    await ensureSoulMinted('uid1')
    expect(ensureUserWallet).not.toHaveBeenCalled()
    expect(ensureMinted).not.toHaveBeenCalled()
  })

  it('provisions wallet then mints when the user has neither', async () => {
    store['users/uid1'] = {}
    await ensureSoulMinted('uid1')
    expect(ensureUserWallet).toHaveBeenCalledWith('uid1')
    expect(ensureMinted).toHaveBeenCalledWith('uid1')
    // wallet must be provisioned before mint
    expect(ensureUserWallet.mock.invocationCallOrder[0]).toBeLessThan(
      ensureMinted.mock.invocationCallOrder[0],
    )
  })

  it('completes minting when a wallet exists but no token was minted yet', async () => {
    store['users/uid1'] = { wallet: { address: '0xW' } }
    await ensureSoulMinted('uid1')
    expect(ensureUserWallet).toHaveBeenCalledWith('uid1')
    expect(ensureMinted).toHaveBeenCalledWith('uid1')
  })
})
