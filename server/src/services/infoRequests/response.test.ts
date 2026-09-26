import { describe, it, expect, vi } from 'vitest'
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts'
import { verifyMessage } from 'viem'

vi.mock('../../config', () => ({ config: {} }))

import { normalizeAnswers, buildResponseBody, signResponseBody, signerAddress } from './response'
import { RESPONSE_PREFIX, sha256Hex } from './protocol'

const Q = ['one?', 'two?']

describe('normalizeAnswers', () => {
  it('accepts full coverage in any order; missing/null/blank answer = declined', () => {
    expect(normalizeAnswers(Q, [{ index: 1 }, { index: 0, answer: ' hi ' }])).toEqual([
      { index: 0, answer: 'hi' }, { index: 1, answer: null },
    ])
    expect(normalizeAnswers(Q, [{ index: 0, answer: '   ' }, { index: 1, answer: null }])).toEqual([
      { index: 0, answer: null }, { index: 1, answer: null },
    ])
  })
  it.each([
    ['not an array', 'x'],
    ['missing index', [{ index: 0, answer: 'a' }]],
    ['duplicate index', [{ index: 0 }, { index: 0 }]],
    ['out of range', [{ index: 0 }, { index: 2 }]],
    ['too long', [{ index: 0, answer: 'x'.repeat(2001) }, { index: 1 }]],
    ['non-string answer', [{ index: 0, answer: 5 }, { index: 1 }]],
  ])('rejects %s', (_l, raw) => expect(normalizeAnswers(Q, raw)).toBeNull())
})

describe('buildResponseBody + signResponseBody', () => {
  it('produces a body whose signature verifies against the signer address', async () => {
    const key = generatePrivateKey()
    const body = buildResponseBody({
      requestId: 'abc', username: 'konrad', wallet: '0xW', questions: Q,
      answers: [{ index: 0, answer: 'yes' }, { index: 1, answer: null }],
      respondedAt: new Date('2026-09-27T10:05:00.999Z'),
    })
    expect(JSON.parse(body)).toEqual({
      type: 'argo.info-response.v1', requestId: 'abc',
      respondent: { username: 'konrad', wallet: '0xW' },
      answers: [
        { question: 'one?', answer: 'yes', declined: false },
        { question: 'two?', answer: null, declined: true },
      ],
      respondedAt: '2026-09-27T10:05:00Z',
    })
    const { signer, signature } = await signResponseBody(body, key)
    expect(signer).toBe(privateKeyToAccount(key).address)
    expect(await verifyMessage({ address: signer as `0x${string}`, message: RESPONSE_PREFIX + sha256Hex(body), signature: signature as `0x${string}` })).toBe(true)
  })

  it('signerAddress is null for a missing or malformed key', () => {
    expect(signerAddress(undefined)).toBeNull()
    expect(signerAddress('0x1234')).toBeNull()
  })
})