import { vi, describe, it, expect, beforeEach } from 'vitest'
import nacl from 'tweetnacl'
import bs58 from 'bs58'

const { linkStore, userStore, raceLosers } = vi.hoisted(() => ({
  linkStore: new Map<string, { uid: string }>(),
  userStore: new Map<string, Record<string, any>>(),
  // Addresses whose next create() call should simulate losing a concurrent
  // race: the competitor's write "lands" (linkStore gets the winner's uid)
  // and create() throws already-exists, exactly as Firestore would for two
  // concurrent create()s on the same document path. Consulted only inside
  // create(), so the preceding get() still observes exists: false and the
  // code under test genuinely takes the "not yet claimed, attempt to claim"
  // branch before losing the race.
  raceLosers: new Map<string, string>(),
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
        const winnerUid = raceLosers.get(address)
        if (winnerUid !== undefined) {
          raceLosers.delete(address)
          linkStore.set(address, { uid: winnerUid })
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
  getUser: vi.fn(async (uid: string) => ({ uid, customClaims: undefined })),
  setCustomUserClaims: vi.fn(async () => undefined),
  createCustomToken: vi.fn(async (uid: string) => `token-for-${uid}`),
}))
vi.mock('firebase-admin', () => ({ default: { auth: () => authMock } }))

import {
  issueSolanaNonce,
  consumeSolanaNonce,
  solanaNonceHandler,
  resolveOrCreateUid,
  verifySiwsRequest,
  ALLOWED_SIWS_DOMAINS,
  verifySolanaHandler,
  linkSolanaHandler,
  authSolanaRouter,
} from './authSolana'

// Captured before any `vi.spyOn(nacl.sign.detached, 'verify')` call anywhere
// in this file runs (module top-level code executes before any beforeEach),
// so it is guaranteed to be the genuine, unmocked implementation. Restoring
// TO THIS directly (rather than a spy's own .mockRestore()) sidesteps a real
// vitest gotcha: repeated vi.spyOn() calls on the same method across many
// beforeEach hooks, none of which ever restore, stack spies on top of each
// other. A later .mockRestore() then only unwraps ONE layer back to the
// PREVIOUS test's mocked state, not the real function.
const realNaclVerify = nacl.sign.detached.verify

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
    raceLosers.clear()
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
    // Simulate: link doc does not exist at read time (so resolveOrCreateUid
    // takes the "not yet claimed" branch and calls createUser()), but a
    // competing request's create() lands first. raceLosers arms the link
    // doc's create() to throw already-exists on its next call for this
    // address, writing the winner's uid to linkStore at that moment, exactly
    // like a real concurrent Firestore create() race.
    raceLosers.set('SolAddr2222', 'winner-uid')
    const uid = await resolveOrCreateUid('SolAddr2222')
    expect(uid).toBe('winner-uid')
    expect(authMock.createUser).toHaveBeenCalledTimes(1)
  })
})

const ADDRESS = '7cVfgArCheMR6Cs4t6vz5rfnqd56vZq4ndaBrY5xkxXy' // valid base58, 32 bytes decoded
const SIGNATURE_B58 = bs58.encode(new Uint8Array(64).fill(7)) // shape-valid placeholder

function siwsMessage(domain: string, nonce: string, address = ADDRESS) {
  return `${domain} wants you to sign in with your Solana account:\n${address}\n\nSign in to Argo.\n\nURI: https://${domain}\nVersion: 1\nChain ID: solana:mainnet\nNonce: ${nonce}\nIssued At: 2026-09-08T00:00:00.000Z`
}

describe('verifySiwsRequest', () => {
  let verifyMock: any
  beforeEach(() => {
    verifyMock = vi.spyOn(nacl.sign.detached, 'verify').mockReturnValue(true)
  })

  it('accepts a well-formed message with a valid signature and allowlisted domain', async () => {
    const nonce = issueSolanaNonce()
    const result = await verifySiwsRequest(siwsMessage('myargoquest.com', nonce), SIGNATURE_B58, ADDRESS)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.address).toBe(ADDRESS)
  })

  it('rejects when the signature does not verify', async () => {
    verifyMock.mockReturnValue(false)
    const nonce = issueSolanaNonce()
    const result = await verifySiwsRequest(siwsMessage('myargoquest.com', nonce), SIGNATURE_B58, ADDRESS)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(401)
  })

  it('rejects an unrecognized domain WITHOUT calling signature verification (check-ordering, relay-attack guard)', async () => {
    const nonce = issueSolanaNonce()
    const result = await verifySiwsRequest(siwsMessage('evil.example', nonce), SIGNATURE_B58, ADDRESS)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
    expect(verifyMock).not.toHaveBeenCalled()
  })

  it('rejects a replayed (already-consumed) nonce', async () => {
    const nonce = issueSolanaNonce()
    consumeSolanaNonce(nonce)
    const result = await verifySiwsRequest(siwsMessage('myargoquest.com', nonce), SIGNATURE_B58, ADDRESS)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(401)
  })

  it('rejects when the address param does not match the message-embedded address', async () => {
    const nonce = issueSolanaNonce()
    const otherAddress = bs58.encode(new Uint8Array(32).fill(9))
    const result = await verifySiwsRequest(siwsMessage('myargoquest.com', nonce), SIGNATURE_B58, otherAddress)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
  })

  it('400s on a missing message', async () => {
    const result = await verifySiwsRequest(undefined, SIGNATURE_B58, ADDRESS)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.status).toBe(400)
  })

  it('exposes the allowed-domains set for tests/ops visibility', () => {
    expect(ALLOWED_SIWS_DOMAINS.has('myargoquest.com')).toBe(true)
    expect(ALLOWED_SIWS_DOMAINS.has('luminalog.com')).toBe(true)
  })

  // The tests above all stub nacl.sign.detached.verify, so none of them prove
  // the actual byte-handling (message encoding, base58 decode order, argument
  // order to verify()) is correct: a bug swapping the signature and address
  // arguments, or base64-encoding instead of base58, would still pass every
  // one of them. These two tests let the real tweetnacl implementation run.
  describe('with a real ed25519 keypair (no mocked verify)', () => {
    it('accepts a genuinely valid signature over the real message bytes', async () => {
      nacl.sign.detached.verify = realNaclVerify // let the real implementation run

      const keyPair = nacl.sign.keyPair()
      const address = bs58.encode(keyPair.publicKey)
      const nonce = issueSolanaNonce()
      const message = siwsMessage('myargoquest.com', nonce, address)
      const signatureBytes = nacl.sign.detached(new TextEncoder().encode(message), keyPair.secretKey)
      const signature = bs58.encode(signatureBytes)

      const result = await verifySiwsRequest(message, signature, address)
      expect(result.ok).toBe(true)
      if (result.ok) expect(result.address).toBe(address)
    })

    it('fails closed (401) on a valid-base58 but wrong signature over the real message bytes', async () => {
      nacl.sign.detached.verify = realNaclVerify // let the real implementation run

      const keyPair = nacl.sign.keyPair()
      const address = bs58.encode(keyPair.publicKey)
      const nonce = issueSolanaNonce()
      const message = siwsMessage('myargoquest.com', nonce, address)
      // A random 64-byte array is valid base58 but not a real signature over
      // this message, so the real (non-mocked) verify() must return false.
      const wrongSignature = bs58.encode(nacl.randomBytes(64))

      const result = await verifySiwsRequest(message, wrongSignature, address)
      expect(result.ok).toBe(false)
      if (!result.ok) expect(result.status).toBe(401)
    })
  })
})

describe('POST /v1/auth/siws/verify', () => {
  beforeEach(() => {
    linkStore.clear()
    userStore.clear()
    vi.spyOn(nacl.sign.detached, 'verify').mockReturnValue(true)
    authMock.createUser.mockReset().mockResolvedValue({ uid: 'new-uid' })
  })

  it('creates a new uid and returns a custom token for an unseen wallet', async () => {
    const nonce = issueSolanaNonce()
    const req: any = { body: { message: siwsMessage('myargoquest.com', nonce), signature: SIGNATURE_B58, address: ADDRESS } }
    const res = mockRes()
    await verifySolanaHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(userStore.get('new-uid')?.walletAddressSolana).toBe(ADDRESS)
  })

  it('401s on an invalid signature', async () => {
    vi.spyOn(nacl.sign.detached, 'verify').mockReturnValue(false)
    const nonce = issueSolanaNonce()
    const req: any = { body: { message: siwsMessage('myargoquest.com', nonce), signature: SIGNATURE_B58, address: ADDRESS } }
    const res = mockRes()
    await verifySolanaHandler(req, res)
    expect(res.statusCode).toBe(401)
  })
})

describe('POST /v1/auth/siws/link (authenticated)', () => {
  beforeEach(() => {
    linkStore.clear()
    userStore.clear()
    vi.spyOn(nacl.sign.detached, 'verify').mockReturnValue(true)
  })

  it('links a fresh wallet to the caller uid', async () => {
    const nonce = issueSolanaNonce()
    const req: any = { uid: 'caller-uid', body: { message: siwsMessage('myargoquest.com', nonce), signature: SIGNATURE_B58, address: ADDRESS } }
    const res = mockRes()
    await linkSolanaHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(userStore.get('caller-uid')?.walletAddressSolana).toBe(ADDRESS)
  })

  it('409s when the address is already claimed by a different uid', async () => {
    linkStore.set(ADDRESS, { uid: 'someone-else' })
    const nonce = issueSolanaNonce()
    const req: any = { uid: 'caller-uid', body: { message: siwsMessage('myargoquest.com', nonce), signature: SIGNATURE_B58, address: ADDRESS } }
    const res = mockRes()
    await linkSolanaHandler(req, res)
    expect(res.statusCode).toBe(409)
    expect(userStore.get('caller-uid')?.walletAddressSolana).toBeUndefined()
  })

  it('409s when the caller already has a different Solana wallet linked, and does not overwrite it', async () => {
    const OTHER_ADDRESS = bs58.encode(new Uint8Array(32).fill(3))
    userStore.set('caller-uid', { walletAddressSolana: OTHER_ADDRESS })
    linkStore.set(OTHER_ADDRESS, { uid: 'caller-uid' })
    const nonce = issueSolanaNonce()
    const req: any = { uid: 'caller-uid', body: { message: siwsMessage('myargoquest.com', nonce), signature: SIGNATURE_B58, address: ADDRESS } }
    const res = mockRes()
    await linkSolanaHandler(req, res)
    expect(res.statusCode).toBe(409)
    expect(userStore.get('caller-uid')?.walletAddressSolana).toBe(OTHER_ADDRESS)
    expect(linkStore.has(ADDRESS)).toBe(false)
  })

  it('is idempotent when the caller re-links their own already-linked wallet', async () => {
    userStore.set('caller-uid', { walletAddressSolana: ADDRESS })
    linkStore.set(ADDRESS, { uid: 'caller-uid' })
    const nonce = issueSolanaNonce()
    const req: any = { uid: 'caller-uid', body: { message: siwsMessage('myargoquest.com', nonce), signature: SIGNATURE_B58, address: ADDRESS } }
    const res = mockRes()
    await linkSolanaHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(userStore.get('caller-uid')?.walletAddressSolana).toBe(ADDRESS)
  })

  it('409s (not 500) when the link create() races against a different caller claiming the same never-before-seen address', async () => {
    // Arm raceLosers so the link doc's create() throws already-exists on its
    // next call, simulating a concurrent request from a DIFFERENT uid winning
    // the race for this address, exactly like resolveOrCreateUid's own race test.
    raceLosers.set(ADDRESS, 'someone-else')
    const nonce = issueSolanaNonce()
    const req: any = { uid: 'caller-uid', body: { message: siwsMessage('myargoquest.com', nonce), signature: SIGNATURE_B58, address: ADDRESS } }
    const res = mockRes()
    await linkSolanaHandler(req, res)
    expect(res.statusCode).toBe(409)
    expect(userStore.get('caller-uid')?.walletAddressSolana).toBeUndefined()
  })

  it('treats the link create() race as idempotent success when the winner is the caller\'s own concurrent request', async () => {
    raceLosers.set(ADDRESS, 'caller-uid')
    const nonce = issueSolanaNonce()
    const req: any = { uid: 'caller-uid', body: { message: siwsMessage('myargoquest.com', nonce), signature: SIGNATURE_B58, address: ADDRESS } }
    const res = mockRes()
    await linkSolanaHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(userStore.get('caller-uid')?.walletAddressSolana).toBe(ADDRESS)
  })
})

describe('authSolanaRouter wiring', () => {
  it('requires firebaseAuth only on /siws/link', () => {
    const layerFor = (path: string) => (authSolanaRouter as any).stack.find((l: any) => l.route?.path === path)
    const namesFor = (path: string) => layerFor(path).route.stack.map((h: any) => h.name)
    expect(namesFor('/siws/nonce')).toEqual(['solanaNonceHandler'])
    expect(namesFor('/siws/verify')).toEqual(['verifySolanaHandler'])
    expect(namesFor('/siws/link')).toEqual(['firebaseAuth', 'linkSolanaHandler'])
  })
})
