import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- config: chain enabled toggle per test ---
let enabled = true
vi.mock('../../config', () => ({
  config: { COURSE_BADGE_CONTRACT_ADDRESS: '0x'.padEnd(42, '1'), BASE_CHAIN: 'base' },
  chainEnabled: () => enabled,
  courseChainEnabled: () => enabled,
}))

// --- firestore doc store ---
let participant: any = null
let course: any = { chainClassId: 5 }
const setSpy = vi.fn(async () => {})
vi.mock('../../middleware/firebaseAuth', () => ({
  db: {
    collection: (name: string) => ({
      doc: () => ({
        get: async () => ({
          exists: true,
          data: () => (name === 'courseBadges' ? course : participant),
        }),
        collection: () => ({
          doc: () => ({ get: async () => ({ data: () => participant }), set: setSpy }),
        }),
        set: setSpy,
      }),
    }),
  },
}))

vi.mock('./walletService', () => ({ ensureUserWallet: async () => '0xWALLET' }))

import { mintCourseBadge } from './courseBadgeService'

beforeEach(() => {
  enabled = true
  participant = null
  course = { chainClassId: 5 }
  setSpy.mockClear()
})

describe('mintCourseBadge', () => {
  it('returns the stored token without chain work when already minted', async () => {
    participant = { submittedAt: 'now', badge: { tokenId: '42', txHash: '0xabc', status: 'minted' } }
    const res = await mintCourseBadge('uid1', 'classA')
    expect(res.tokenId).toBe('42')
    expect(res.txHash).toBe('0xabc')
  })

  it('throws when the participant has no submission', async () => {
    participant = null // no submittedAt
    await expect(mintCourseBadge('uid1', 'classA')).rejects.toThrow(/no submission/i)
  })

  it('throws when chain is disabled', async () => {
    enabled = false
    participant = { submittedAt: 'now' }
    await expect(mintCourseBadge('uid1', 'classA')).rejects.toThrow(/disabled/i)
  })
})
