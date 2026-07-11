import { describe, it, expect, vi, beforeEach } from 'vitest'

const { ensureUserWallet, ensureMinted, renderAndStoreSoulImage, chainEnabled } = vi.hoisted(
  () => ({
    ensureUserWallet: vi.fn(),
    ensureMinted: vi.fn(),
    renderAndStoreSoulImage: vi.fn(),
    chainEnabled: vi.fn(() => true),
  }),
)
vi.mock('../../config', () => ({ config: {}, chainEnabled }))
vi.mock('./walletService', () => ({ ensureUserWallet }))
vi.mock('./mintService', () => ({ ensureMinted }))
vi.mock('./soulImage', () => ({ renderAndStoreSoulImage }))

let store: Record<string, any> = {}
vi.mock('../../middleware/firebaseAuth', () => ({
  db: {
    collection: (c: string) => ({
      doc: (id: string) => ({
        get: async () => ({ data: () => store[`${c}/${id}`] }),
        set: async (data: any, opts: any) => {
          const key = `${c}/${id}`
          const merge = (a: any, b: any): any =>
            b && typeof b === 'object' && !Array.isArray(b)
              ? { ...a, ...Object.fromEntries(Object.entries(b).map(([k, v]) => [k, merge(a?.[k], v)])) }
              : b
          store[key] = opts?.merge ? merge(store[key] || {}, data) : data
        },
      }),
    }),
  },
}))

import { ensureSoulMinted, refreshSoulImage } from './soulService'

beforeEach(() => {
  store = {}
  vi.clearAllMocks()
  chainEnabled.mockReturnValue(true)
  ensureUserWallet.mockResolvedValue('0xWALLET')
  ensureMinted.mockResolvedValue({ tokenId: '5' })
  renderAndStoreSoulImage.mockResolvedValue('https://s3/soul/5/hero.png')
})

describe('ensureSoulMinted', () => {
  it('short-circuits (no provisioning) when wallet + nft already exist', async () => {
    store['users/uid1'] = { wallet: { address: '0xW' }, nft: { tokenId: '3' } }
    await ensureSoulMinted('uid1')
    expect(ensureUserWallet).not.toHaveBeenCalled()
    expect(ensureMinted).not.toHaveBeenCalled()
  })

  it('does NOT provision or mint until the user has consented to the public Soul', async () => {
    store['users/uid1'] = {} // no consent.soulPublicNft
    await ensureSoulMinted('uid1')
    expect(ensureUserWallet).not.toHaveBeenCalled()
    expect(ensureMinted).not.toHaveBeenCalled()
  })

  it('provisions wallet then mints when the user has neither (consented)', async () => {
    store['users/uid1'] = { consent: { soulPublicNft: true } }
    await ensureSoulMinted('uid1')
    expect(ensureUserWallet).toHaveBeenCalledWith('uid1')
    expect(ensureMinted).toHaveBeenCalledWith('uid1')
    // wallet must be provisioned before mint
    expect(ensureUserWallet.mock.invocationCallOrder[0]).toBeLessThan(
      ensureMinted.mock.invocationCallOrder[0],
    )
  })

  it('completes minting when a wallet exists but no token was minted yet (consented)', async () => {
    store['users/uid1'] = { wallet: { address: '0xW' }, consent: { soulPublicNft: true } }
    await ensureSoulMinted('uid1')
    expect(ensureUserWallet).toHaveBeenCalledWith('uid1')
    expect(ensureMinted).toHaveBeenCalledWith('uid1')
  })

  it('guard: no-ops (no wallet/mint work) when chain is disabled', async () => {
    chainEnabled.mockReturnValue(false)
    store['users/uid1'] = {}
    await ensureSoulMinted('uid1')
    expect(ensureUserWallet).not.toHaveBeenCalled()
    expect(ensureMinted).not.toHaveBeenCalled()
  })
})

describe('refreshSoulImage', () => {
  it('no-ops when the user has no minted token yet', async () => {
    store['users/uid1'] = { constellation: { points: [{ x: 0, y: 0, z: 0 }] } }
    await refreshSoulImage('uid1')
    expect(renderAndStoreSoulImage).not.toHaveBeenCalled()
  })

  it('renders the current point-set and persists imageUrl without clobbering points/version', async () => {
    store['users/uid1'] = {
      nft: { tokenId: '5' },
      constellation: { version: 3, points: [{ x: 0.1, y: 0.2, z: 0.3 }, { x: -0.4, y: 0.5, z: 0.6 }] },
    }
    await refreshSoulImage('uid1')
    expect(renderAndStoreSoulImage).toHaveBeenCalledWith('5', [
      { x: 0.1, y: 0.2, z: 0.3 },
      { x: -0.4, y: 0.5, z: 0.6 },
    ])
    expect(store['users/uid1'].constellation.imageUrl).toBe('https://s3/soul/5/hero.png')
    // merge must preserve the existing constellation fields
    expect(store['users/uid1'].constellation.version).toBe(3)
    expect(store['users/uid1'].constellation.points).toHaveLength(2)
  })

  it('renders an empty point-set (nascent soul) when minted but no stars yet', async () => {
    store['users/uid1'] = { nft: { tokenId: '5' } }
    await refreshSoulImage('uid1')
    expect(renderAndStoreSoulImage).toHaveBeenCalledWith('5', [])
  })
})
