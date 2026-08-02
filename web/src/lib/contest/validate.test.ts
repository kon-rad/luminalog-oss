import { describe, it, expect } from 'vitest'
import { validateContestSubmission, type ContestSubmissionInput } from './validate'

const valid: ContestSubmissionInput = {
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  company: 'Analytical Engines',
  role: 'Mathematician',
  xAccount: '@ada',
  essayUrl: 'https://medium.com/@ada/blockchain-malaysia',
  ethAddress: '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
  agreedToTerms: true,
}

describe('validateContestSubmission', () => {
  it('accepts a fully-filled valid submission', () => {
    expect(validateContestSubmission(valid)).toEqual({ ok: true })
  })

  it('trims whitespace before checking presence', () => {
    const res = validateContestSubmission({ ...valid, name: '   ' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.errors.name).toBeDefined()
  })

  it.each([
    ['name', { name: '' }],
    ['company', { company: '' }],
    ['role', { role: '' }],
    ['xAccount', { xAccount: '' }],
    ['email', { email: '' }],
    ['essayUrl', { essayUrl: '' }],
    ['ethAddress', { ethAddress: '' }],
  ] as const)('flags a missing %s', (field, patch) => {
    const res = validateContestSubmission({ ...valid, ...patch })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.errors[field]).toBeDefined()
  })

  it('rejects a malformed email', () => {
    const res = validateContestSubmission({ ...valid, email: 'not-an-email' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.errors.email).toBeDefined()
  })

  it('rejects a non-http(s) essay URL', () => {
    const res = validateContestSubmission({ ...valid, essayUrl: 'medium.com/ada' })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.errors.essayUrl).toBeDefined()
  })

  it('accepts both http and https essay URLs', () => {
    expect(validateContestSubmission({ ...valid, essayUrl: 'http://x.com/e' }).ok).toBe(true)
    expect(validateContestSubmission({ ...valid, essayUrl: 'https://x.com/e' }).ok).toBe(true)
  })

  it.each([
    ['missing 0x prefix', '71C7656EC7ab88b098defB751B7401B5f6d8976F'],
    ['too short', '0x71C7656EC7ab88b098defB751B7401B5f6d897'],
    ['too long', '0x71C7656EC7ab88b098defB751B7401B5f6d8976FF'],
    ['non-hex characters', '0xZZC7656EC7ab88b098defB751B7401B5f6d8976F'],
  ])('rejects an ETH address that is %s', (_label, ethAddress) => {
    const res = validateContestSubmission({ ...valid, ethAddress })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.errors.ethAddress).toBeDefined()
  })

  it('accepts a lowercase, non-checksummed ETH address', () => {
    const res = validateContestSubmission({
      ...valid,
      ethAddress: '0x71c7656ec7ab88b098defb751b7401b5f6d8976f',
    })
    expect(res.ok).toBe(true)
  })

  it('requires the terms checkbox to be checked', () => {
    const res = validateContestSubmission({ ...valid, agreedToTerms: false })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(res.errors.agreedToTerms).toBeDefined()
  })

  it('reports multiple errors at once', () => {
    const res = validateContestSubmission({ ...valid, name: '', email: 'bad', agreedToTerms: false })
    expect(res.ok).toBe(false)
    if (!res.ok) expect(Object.keys(res.errors).sort()).toEqual(['agreedToTerms', 'email', 'name'])
  })
})
