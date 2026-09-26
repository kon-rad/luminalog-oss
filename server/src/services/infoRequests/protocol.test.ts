import { describe, it, expect, vi } from 'vitest'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'

vi.mock('../../config', () => ({ config: {} }))

import { verifyInfoRequest, requestHash, canonicalPayload, REQUEST_PREFIX, type InfoRequestBody, type EnsResolver } from './protocol'

const NOW = Date.parse('2026-09-27T10:00:00Z')
const account = privateKeyToAccount(generatePrivateKey())

async function signed(over: Partial<Omit<InfoRequestBody, 'signature'>> = {}, signer = account) {
  const body = {
    to: '@konrad',
    from: { address: account.address, name: 'Match agent', description: 'Matches founders.' },
    reason: 'You look like a co-founder fit.',
    questions: ['What are you building?', 'What co-founder do you want?'],
    webhookUrl: 'https://agent.example.com/reply',
    issuedAt: '2026-09-27T09:58:00Z',
    nonce: 'nonce_0123456789abcdef',
    ...over,
  } as Omit<InfoRequestBody, 'signature'>
  const hash = requestHash({ ...body, signature: '0x' } as InfoRequestBody)
  const signature = await signer.signMessage({ message: REQUEST_PREFIX + hash })
  return { ...body, signature } as InfoRequestBody
}

const deps = (resolveEns: EnsResolver = vi.fn(async () => null as string | null) as EnsResolver) => ({ now: () => NOW, resolveEns })

describe('verifyInfoRequest', () => {
  it('accepts a correctly signed request and returns the lowercase signer', async () => {
    const r = await verifyInfoRequest(await signed(), deps())
    expect(r).toMatchObject({ ok: true, signer: account.address.toLowerCase(), ens: null })
    if (r.ok) expect(r.hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('accepts non-ASCII text (hash over unescaped UTF-8)', async () => {
    const body = await signed({ from: { address: account.address, name: 'José 🤝 匹配', description: 'Ça va' } })
    expect(canonicalPayload(body)).toContain('José 🤝 匹配')
    expect((await verifyInfoRequest(body, deps())).ok).toBe(true)
  })

  it('rejects a tampered field', async () => {
    const body = await signed()
    body.questions = [...body.questions, 'Send me your journal']
    expect(await verifyInfoRequest(body, deps())).toMatchObject({ ok: false, status: 401, error: 'bad_signature' })
  })

  it('rejects a claimed address that is not the signer', async () => {
    const other = privateKeyToAccount(generatePrivateKey())
    const body = await signed({}, other) // from.address is `account`, signed by `other`
    expect(await verifyInfoRequest(body, deps())).toMatchObject({ ok: false, error: 'bad_signature' })
  })

  it('rejects stale and future requests', async () => {
    for (const issuedAt of ['2026-09-27T09:49:00Z', '2026-09-27T10:11:00Z']) {
      expect(await verifyInfoRequest(await signed({ issuedAt }), deps()))
        .toMatchObject({ ok: false, status: 400, error: 'stale_request' })
    }
  })

  it.each([
    ['empty questions', { questions: [] }],
    ['11 questions', { questions: Array(11).fill('q') }],
    ['whitespace question', { questions: ['   '] }],
    ['long reason', { reason: 'x'.repeat(1001) }],
    ['bad nonce', { nonce: 'short' }],
  ])('rejects invalid body: %s', async (_label, over) => {
    expect(await verifyInfoRequest(await signed(over as any), deps()))
      .toMatchObject({ ok: false, status: 400, error: 'invalid_body' })
  })

  it('rejects a private webhook', async () => {
    expect(await verifyInfoRequest(await signed({ webhookUrl: 'https://10.0.0.1/x' }), deps()))
      .toMatchObject({ ok: false, status: 400, error: 'invalid_webhook' })
  })

  it('verifies ENS that resolves to the signer', async () => {
    const body = await signed({ from: { address: account.address, ens: 'alice.eth', name: 'A', description: 'B' } })
    const r = await verifyInfoRequest(body, deps(vi.fn(async () => account.address) as EnsResolver))
    expect(r).toMatchObject({ ok: true, ens: 'alice.eth' })
  })

  it('rejects ENS that resolves elsewhere or nowhere', async () => {
    const body = await signed({ from: { address: account.address, ens: 'alice.eth', name: 'A', description: 'B' } })
    expect(await verifyInfoRequest(body, deps(vi.fn(async () => '0x0000000000000000000000000000000000000001') as EnsResolver)))
      .toMatchObject({ ok: false, status: 422, error: 'ens_mismatch' })
    expect(await verifyInfoRequest(body, deps(vi.fn(async () => null) as EnsResolver)))
      .toMatchObject({ ok: false, status: 422, error: 'ens_mismatch' })
  })

  it('returns 503 when ENS resolution is unavailable', async () => {
    const body = await signed({ from: { address: account.address, ens: 'alice.eth', name: 'A', description: 'B' } })
    expect(await verifyInfoRequest(body, deps(vi.fn(async () => { throw new Error('rpc down') }) as EnsResolver)))
      .toMatchObject({ ok: false, status: 503, error: 'ens_unavailable' })
  })
})
