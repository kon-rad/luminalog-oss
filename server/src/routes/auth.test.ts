import { vi, describe, it, expect, beforeEach } from 'vitest'

// In-memory Firestore stand-in supporting doc().get()/set({merge}) and
// collection().where(field, '==', value).limit(n).get(), mirroring the style
// established in keys.test.ts and nft.test.ts.
const { store, db } = vi.hoisted(() => {
  const store = new Map<string, Record<string, any>>()
  function makeDocRef(id: string) {
    return {
      id,
      async set(data: Record<string, any>, opts?: { merge?: boolean }) {
        const existing = opts?.merge ? store.get(id) ?? {} : {}
        store.set(id, { ...existing, ...data })
      },
      async get() {
        const d = store.get(id)
        return { exists: !!d, id, data: () => d, get: (field: string) => d?.[field] }
      },
    }
  }
  const db = {
    collection: (_name: string) => ({
      doc: (id: string) => makeDocRef(id),
      where: (field: string, _op: string, value: unknown) => ({
        limit: (_n: number) => ({
          async get() {
            const matches = [...store.entries()]
              .filter(([, data]) => data[field] === value)
              .map(([id, data]) => ({ id, data: () => data }))
            return { empty: matches.length === 0, docs: matches }
          },
        }),
      }),
    }),
  }
  return { store, db }
})

vi.mock('../middleware/firebaseAuth', () => ({
  firebaseAuth: (req: any, _res: any, next: any) => { req.uid = 'caller-uid'; next() },
  db,
}))

const authMock = vi.hoisted(() => ({
  createUser: vi.fn(async () => ({ uid: 'new-uid' })),
  createCustomToken: vi.fn(async (uid: string) => `token-for-${uid}`),
  getUser: vi.fn(async (uid: string) => ({ uid, customClaims: undefined })),
  setCustomUserClaims: vi.fn(async () => undefined),
}))
vi.mock('firebase-admin', () => ({
  default: { auth: () => authMock },
}))

let parseResult: any = null
const verifyMessageMock = vi.fn(async () => true)
vi.mock('viem', () => ({
  createPublicClient: () => ({ verifyMessage: verifyMessageMock }),
  http: () => ({}),
}))
vi.mock('viem/chains', () => ({ mainnet: { id: 1 } }))
let nonceCounter = 0
vi.mock('viem/siwe', () => ({
  generateSiweNonce: () => `nonce-${nonceCounter++}`,
  parseSiweMessage: (_message: string) => parseResult,
}))

import { authRouter, nonceHandler, verifyHandler, issueNonce, consumeNonce } from './auth'

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = (c: number) => { res.statusCode = c; return res }
  res.json = (b: any) => { res.body = b; return res }
  return res
}

const FIXED_ADDRESS = '0xAbC1230000000000000000000000000000000f'
const FIXED_ADDRESS_LOWER = '0xabc1230000000000000000000000000000000f'

beforeEach(() => {
  store.clear()
  nonceCounter = 0
  parseResult = { address: FIXED_ADDRESS, nonce: '', chainId: 1, domain: 'myargoquest.com' }
  verifyMessageMock.mockReset()
  verifyMessageMock.mockResolvedValue(true)
  authMock.createUser.mockReset().mockResolvedValue({ uid: 'new-uid' })
  authMock.createCustomToken.mockReset().mockImplementation(async (uid: string) => `token-for-${uid}`)
  authMock.getUser.mockReset().mockResolvedValue({ uid: 'caller-uid', customClaims: undefined })
  authMock.setCustomUserClaims.mockReset().mockResolvedValue(undefined)
})

describe('GET /v1/auth/siwe/nonce', () => {
  it('issues a distinct nonce on each call', async () => {
    const res1 = mockRes()
    await nonceHandler({} as any, res1)
    const res2 = mockRes()
    await nonceHandler({} as any, res2)
    expect(res1.body.nonce).not.toBe(res2.body.nonce)
  })
})

describe('nonce consumption', () => {
  it('consumes a nonce exactly once', () => {
    const nonce = issueNonce()
    expect(consumeNonce(nonce)).toBe(true)
    expect(consumeNonce(nonce)).toBe(false)
  })

  it('rejects a nonce that was never issued', () => {
    expect(consumeNonce('never-issued')).toBe(false)
  })
})

describe('POST /v1/auth/siwe/verify', () => {
  it('creates a new uid and returns a custom token when the wallet is unseen', async () => {
    const nonce = issueNonce()
    parseResult = { address: FIXED_ADDRESS, nonce, chainId: 1, domain: 'myargoquest.com' }
    const req: any = { body: { message: 'siwe-message', signature: '0xsig' } }
    const res = mockRes()
    await verifyHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.firebaseCustomToken).toBe('token-for-new-uid')
    expect(store.get('new-uid')?.walletAddress).toBe(FIXED_ADDRESS_LOWER)
    expect(authMock.setCustomUserClaims).toHaveBeenCalledWith('new-uid', { walletAddress: FIXED_ADDRESS_LOWER })
  })

  it('resolves the existing uid for a wallet already linked (does not create a second account)', async () => {
    store.set('existing-uid', { walletAddress: FIXED_ADDRESS_LOWER })
    const nonce = issueNonce()
    parseResult = { address: FIXED_ADDRESS, nonce, chainId: 1, domain: 'myargoquest.com' }
    const req: any = { body: { message: 'siwe-message', signature: '0xsig' } }
    const res = mockRes()
    await verifyHandler(req, res)
    expect(res.body.firebaseCustomToken).toBe('token-for-existing-uid')
    expect(authMock.createUser).not.toHaveBeenCalled()
  })

  it('401s on an invalid signature', async () => {
    verifyMessageMock.mockResolvedValue(false)
    const nonce = issueNonce()
    parseResult = { address: FIXED_ADDRESS, nonce, chainId: 1, domain: 'myargoquest.com' }
    const req: any = { body: { message: 'siwe-message', signature: '0xsig' } }
    const res = mockRes()
    await verifyHandler(req, res)
    expect(res.statusCode).toBe(401)
  })

  it('401s on a replayed (already-consumed) nonce', async () => {
    const nonce = issueNonce()
    parseResult = { address: FIXED_ADDRESS, nonce, chainId: 1, domain: 'myargoquest.com' }
    consumeNonce(nonce)
    const req: any = { body: { message: 'siwe-message', signature: '0xsig' } }
    const res = mockRes()
    await verifyHandler(req, res)
    expect(res.statusCode).toBe(401)
  })

  it('400s on a missing message', async () => {
    const req: any = { body: { signature: '0xsig' } }
    const res = mockRes()
    await verifyHandler(req, res)
    expect(res.statusCode).toBe(400)
  })

  it('400s when the SIWE message domain is not on the allowlist (relay-attack guard)', async () => {
    const nonce = issueNonce()
    parseResult = { address: FIXED_ADDRESS, nonce, chainId: 1, domain: 'evil.example' }
    const req: any = { body: { message: 'siwe-message', signature: '0xsig' } }
    const res = mockRes()
    await verifyHandler(req, res)
    expect(res.statusCode).toBe(400)
    expect(verifyMessageMock).not.toHaveBeenCalled()
  })
})
