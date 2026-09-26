import { describe, it, expect, vi, beforeEach } from 'vitest'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

vi.mock('../middleware/firebaseAuth', () => ({ db: {}, firebaseAuth: vi.fn() }))
vi.mock('../config', () => ({ config: {} }))

import { createInboxHandlers, type InboxDeps } from './inbox'
import { MemoryInboxStore, MemoryDirectory } from '../test/memoryStores'
import { SlidingWindowLimiter } from '../services/infoRequests/rateLimiter'
import { REQUEST_PREFIX, requestHash, type InfoRequestBody } from '../services/infoRequests/protocol'

const NOW = Date.parse('2026-09-27T10:00:00Z')
const sender = privateKeyToAccount(generatePrivateKey())
const signerKey = generatePrivateKey()
const ISO_SECONDS = /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = vi.fn((c: number) => { res.statusCode = c; return res })
  res.json = vi.fn((b: any) => { res.body = b; return res })
  res.end = vi.fn(() => res)
  return res
}

let n = 0
async function signedBody(over: Partial<InfoRequestBody> = {}) {
  const body = {
    to: '@konrad',
    from: { address: sender.address, name: 'Agent', description: 'Desc' },
    reason: 'Because',
    questions: ['Q1?', 'Q2?'],
    webhookUrl: 'https://agent.example.com/reply',
    issuedAt: '2026-09-27T09:59:00Z',
    nonce: `nonce_${String(n++).padStart(12, '0')}`,
    ...over,
  } as InfoRequestBody
  body.signature = await sender.signMessage({ message: REQUEST_PREFIX + requestHash({ ...body, signature: '0x' }) })
  return body
}

let store: MemoryInboxStore
let directory: MemoryDirectory
let deliver: any
let deps: InboxDeps
let h: ReturnType<typeof createInboxHandlers>

beforeEach(() => {
  store = new MemoryInboxStore()
  directory = new MemoryDirectory()
  directory.usernames.set('konrad', 'u1')
  directory.wallets.set('0x00000000000000000000000000000000000000aa', 'u1')
  directory.profiles.set('u1', { username: 'konrad', wallet: '0xSoul' })
  deliver = vi.fn(async () => ({ ok: true, status: 200, attempts: 1 })) as any
  deps = {
    store, directory, now: () => NOW, resolveEns: vi.fn(async () => null), deliver,
    signerKey: () => signerKey,
    ipLimiter: new SlidingWindowLimiter(30, 3_600_000, () => NOW),
    pairLimiter: new SlidingWindowLimiter(3, 86_400_000, () => NOW),
    pendingCap: 50,
  }
  h = createInboxHandlers(deps)
})

const intake = async (body: unknown, ip = '1.2.3.4') => {
  const res = mockRes()
  await h.createRequest({ body, ip, headers: {} } as any, res)
  return res
}

describe('createRequest', () => {
  it('stores a verified request addressed by username', async () => {
    const res = await intake(await signedBody())
    expect(res.statusCode).toBe(201)
    expect(res.body.status).toBe('pending')
    expect(res.body.expiresAt).toMatch(ISO_SECONDS)
    const doc = store.docs.get(res.body.id)!
    expect(doc).toMatchObject({ recipientUid: 'u1', webhookHost: 'agent.example.com', lastDeliveryError: null })
    expect(doc.sender.address).toBe(sender.address.toLowerCase())
  })

  it('resolves a wallet address recipient', async () => {
    const res = await intake(await signedBody({ to: '0x00000000000000000000000000000000000000AA' }))
    expect(res.statusCode).toBe(201)
  })

  it('404 for an unknown recipient', async () => {
    expect((await intake(await signedBody({ to: '@nobody' }))).statusCode).toBe(404)
  })

  it('409 on replay of the exact signed payload', async () => {
    const body = await signedBody()
    expect((await intake(body)).statusCode).toBe(201)
    const again = await intake(body)
    expect(again.statusCode).toBe(409)
    expect(again.body.error).toBe('duplicate')
  })

  it('passes verification errors through', async () => {
    const body = await signedBody()
    body.reason = 'changed'
    expect((await intake(body)).body).toEqual({ error: 'bad_signature' })
  })

  it('rate limits per sender->recipient (3/day) and per IP (30/hour)', async () => {
    for (let i = 0; i < 3; i++) expect((await intake(await signedBody(), `9.9.9.${i}`)).statusCode).toBe(201)
    expect((await intake(await signedBody(), '9.9.9.9')).statusCode).toBe(429)

    const ipDeps = createInboxHandlers({ ...deps, ipLimiter: new SlidingWindowLimiter(1, 3_600_000, () => NOW) })
    const r1 = mockRes(); await ipDeps.createRequest({ body: await signedBody({ to: '@x' }), ip: '5.5.5.5', headers: {} } as any, r1)
    const r2 = mockRes(); await ipDeps.createRequest({ body: await signedBody(), ip: '5.5.5.5', headers: {} } as any, r2)
    expect(r2.statusCode).toBe(429)
  })

  it('429 inbox_full at the pending cap', async () => {
    const capped = createInboxHandlers({ ...deps, pendingCap: 1 })
    const other = privateKeyToAccount(generatePrivateKey())
    store.docs.set('existing', { recipientUid: 'u1' } as any)
    const res = mockRes()
    await capped.createRequest({ body: await signedBody(), ip: '1.1.1.1', headers: {} } as any, res)
    expect(res.statusCode).toBe(429)
    expect(res.body.error).toBe('inbox_full')
    void other
  })
})

describe('authed inbox', () => {
  let id: string
  beforeEach(async () => { id = (await intake(await signedBody())).body.id })

  it('lists own pending requests with second-precision dates, deleting expired ones', async () => {
    store.docs.set('old', { ...store.docs.get(id)!, expiresAt: new Date(NOW - 1) })
    store.docs.set('theirs', { ...store.docs.get(id)!, recipientUid: 'u2' })
    const res = mockRes()
    await h.list({ uid: 'u1' } as any, res)
    expect(res.body.requests.map((r: any) => r.id)).toEqual([id])
    expect(res.body.requests[0].createdAt).toMatch(ISO_SECONDS)
    expect(res.body.requests[0]).not.toHaveProperty('webhookUrl')
    expect(store.docs.has('old')).toBe(false)
  })

  it("ignore deletes only the owner's request", async () => {
    const notMine = mockRes()
    await h.ignore({ uid: 'u2', params: { id } } as any, notMine)
    expect(notMine.statusCode).toBe(404)
    const mine = mockRes()
    await h.ignore({ uid: 'u1', params: { id } } as any, mine)
    expect(mine.statusCode).toBe(204)
    expect(store.docs.has(id)).toBe(false)
  })

  it('respond signs, delivers, and deletes; a missing answer key is declined', async () => {
    const res = mockRes()
    await h.respond({ uid: 'u1', params: { id }, body: { answers: [{ index: 0, answer: 'A1' }, { index: 1 }] } } as any, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ delivered: true, deliveredAt: '2026-09-27T10:00:00Z' })
    const [url, body, headers] = deliver.mock.calls[0]
    expect(url).toBe('https://agent.example.com/reply')
    expect(JSON.parse(body).answers[1]).toEqual({ question: 'Q2?', answer: null, declined: true })
    expect(headers['X-Argo-Signer']).toBe(privateKeyToAccount(signerKey).address)
    expect(headers['X-Argo-Signature']).toMatch(/^0x[0-9a-f]+$/)
    expect(store.docs.has(id)).toBe(false)
  })

  it('respond 400 on incomplete answers, 404 for non-owner', async () => {
    const bad = mockRes()
    await h.respond({ uid: 'u1', params: { id }, body: { answers: [{ index: 0, answer: 'A1' }] } } as any, bad)
    expect(bad.statusCode).toBe(400)
    const other = mockRes()
    await h.respond({ uid: 'u2', params: { id }, body: { answers: [{ index: 0 }, { index: 1 }] } } as any, other)
    expect(other.statusCode).toBe(404)
  })

  it('respond 502 keeps the request and records the error', async () => {
    deliver.mockResolvedValueOnce({ ok: false, status: 500, error: 'boom', attempts: 3 })
    const res = mockRes()
    await h.respond({ uid: 'u1', params: { id }, body: { answers: [{ index: 0 }, { index: 1 }] } } as any, res)
    expect(res.statusCode).toBe(502)
    expect(res.body.error).toBe('delivery_failed')
    expect(store.docs.get(id)!.lastDeliveryError).toBe('boom')
  })

  it('respond and signer 503 when the signer key is unconfigured', async () => {
    const noKey = createInboxHandlers({ ...deps, signerKey: () => undefined })
    const res = mockRes()
    await noKey.respond({ uid: 'u1', params: { id }, body: { answers: [{ index: 0 }, { index: 1 }] } } as any, res)
    expect(res.statusCode).toBe(503)
    const s = mockRes()
    await noKey.signer({} as any, s)
    expect(s.statusCode).toBe(503)
    expect(store.docs.has(id)).toBe(true)
  })
})