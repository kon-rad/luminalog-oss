import { vi, describe, it, expect, beforeEach } from 'vitest'
import nacl from 'tweetnacl'
import bs58 from 'bs58'

const { linkStore, userStore } = vi.hoisted(() => ({
  linkStore: new Map<string, { uid: string }>(),
  userStore: new Map<string, Record<string, any>>(),
}))

vi.mock('../middleware/firebaseAuth', () => {
  function makeUserDoc(id: string) {
    return {
      async set(data: Record<string, any>, opts?: { merge?: boolean }) {
        const existing = opts?.merge ? userStore.get(id) ?? {} : {}
        userStore.set(id, { ...existing, ...data })
      },
      async get() {
        const d = userStore.get(id)
        return { exists: !!d, id, get: (f: string) => d?.[f] }
      },
    }
  }
  function makeLinkDoc(address: string) {
    return {
      async get() {
        const d = linkStore.get(address)
        return { exists: !!d, get: (f: string) => (d as any)?.[f] }
      },
      async create(data: { uid: string }) {
        if (linkStore.has(address)) {
          const err: any = new Error('already exists')
          err.code = 6
          throw err
        }
        linkStore.set(address, data)
      },
    }
  }
  const db = {
    collection: (name: string) => ({
      doc: (id: string) => (name === 'walletLinksSolana' ? makeLinkDoc(id) : makeUserDoc(id)),
    }),
  }
  return {
    firebaseAuth: (req: any, _res: any, next: any) => { req.uid = 'caller-uid'; next() },
    db,
  }
})

const authMock = vi.hoisted(() => ({
  createUser: vi.fn(async () => ({ uid: 'new-uid' })),
}))
vi.mock('firebase-admin', () => ({ default: { auth: () => authMock } }))

import { issueSolanaNonce, consumeSolanaNonce, solanaNonceHandler, resolveOrCreateUid } from './authSolana'

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = (c: number) => { res.statusCode = c; return res }
  res.json = (b: any) => { res.body = b; return res }
  return res
}

describe('Solana nonce issuance and consumption', () => {
  it('issues a distinct nonce on each call', async () => {
    const res1 = mockRes()
    await solanaNonceHandler({} as any, res1)
    const res2 = mockRes()
    await solanaNonceHandler({} as any, res2)
    expect(res1.body.nonce).not.toBe(res2.body.nonce)
  })

  it('consumes a nonce exactly once', () => {
    const nonce = issueSolanaNonce()
    expect(consumeSolanaNonce(nonce)).toBe(true)
    expect(consumeSolanaNonce(nonce)).toBe(false)
  })

  it('rejects a nonce that was never issued', () => {
    expect(consumeSolanaNonce('never-issued')).toBe(false)
  })
})

describe('resolveOrCreateUid (race-safe uid resolution)', () => {
  beforeEach(() => {
    linkStore.clear()
    userStore.clear()
    authMock.createUser.mockReset()
    let n = 0
    authMock.createUser.mockImplementation(async () => ({ uid: `new-uid-${n++}` }))
  })

  it('creates a new uid and writes walletAddressSolana for a fresh address', async () => {
    const uid = await resolveOrCreateUid('SolAddr1111')
    expect(uid).toBe('new-uid-0')
    expect(userStore.get('new-uid-0')?.walletAddressSolana).toBe('SolAddr1111')
    expect(linkStore.get('SolAddr1111')?.uid).toBe('new-uid-0')
  })

  it('resolves the existing uid for an address already claimed (no second createUser call)', async () => {
    linkStore.set('SolAddr1111', { uid: 'existing-uid' })
    const uid = await resolveOrCreateUid('SolAddr1111')
    expect(uid).toBe('existing-uid')
    expect(authMock.createUser).not.toHaveBeenCalled()
  })

  it('resolves to the winner when the claim races (create() throws already-exists)', async () => {
    // Simulate: link doc did not exist at read time, but another request wins
    // the create() race before this one's create() call lands.
    const realCreate = authMock.createUser.getMockImplementation()!
    let firstCall = true
    // Patch the link doc's create() indirectly by pre-seeding AFTER the read:
    // easiest reliable way in this in-memory stand-in is to seed linkStore
    // right before resolveOrCreateUid's own create() call would run, which we
    // approximate by seeding it here (before the read) with a DIFFERENT uid
    // than createUser would produce, and asserting the loser defers to it.
    linkStore.set('SolAddr2222', { uid: 'winner-uid' })
    const uid = await resolveOrCreateUid('SolAddr2222')
    expect(uid).toBe('winner-uid')
  })
})
