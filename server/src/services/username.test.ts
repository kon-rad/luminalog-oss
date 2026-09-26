import { describe, it, expect, vi } from 'vitest'
vi.mock('../middleware/firebaseAuth', () => ({ db: {}, firebaseAuth: vi.fn() }))
import { normalizeUsername, validateUsername, decideClaim, USERNAME_CHANGE_INTERVAL_MS } from './username'

const now = new Date('2026-09-27T00:00:00Z')
const DAY = 24 * 60 * 60 * 1000

describe('normalizeUsername / validateUsername', () => {
  it('trims, strips one @, lowercases', () => expect(normalizeUsername('  @Konrad_G ')).toBe('konrad_g'))
  it.each(['ab', 'a'.repeat(21), 'has space', 'dash-name', 'émile', ''])('invalid: %s', n =>
    expect(validateUsername(normalizeUsername(n))).toBe('invalid'))
  it.each(['admin', 'argo', 'support', 'inbox'])('reserved: %s', n => expect(validateUsername(n)).toBe('reserved'))
  it('valid', () => expect(validateUsername('konrad_01')).toBeNull())
})

describe('decideClaim', () => {
  const base = { uid: 'u1', now, claimOwner: null as string | null }
  it('first claim is allowed', () =>
    expect(decideClaim({ ...base, name: 'konrad', current: { username: null, changedAt: null } }))
      .toEqual({ kind: 'claim', releasing: null }))
  it('same name is a no-op even inside 30 days', () =>
    expect(decideClaim({ ...base, name: 'konrad', claimOwner: 'u1', current: { username: 'konrad', changedAt: now } }))
      .toEqual({ kind: 'noop' }))
  it('taken by another uid', () =>
    expect(decideClaim({ ...base, name: 'konrad', claimOwner: 'u2', current: { username: null, changedAt: null } }))
      .toMatchObject({ kind: 'error', status: 409, error: 'taken' }))
  it('too soon after the last change, with nextChangeAt', () => {
    const changedAt = new Date(now.getTime() - 10 * DAY)
    const d = decideClaim({ ...base, name: 'newname', current: { username: 'konrad', changedAt } })
    expect(d).toMatchObject({ kind: 'error', status: 429, error: 'too_soon' })
    if (d.kind === 'error') expect(d.nextChangeAt!.getTime()).toBe(changedAt.getTime() + USERNAME_CHANGE_INTERVAL_MS)
  })
  it('allowed exactly 30 days later, releasing the old name', () => {
    const changedAt = new Date(now.getTime() - 30 * DAY)
    expect(decideClaim({ ...base, name: 'newname', current: { username: 'konrad', changedAt } }))
      .toEqual({ kind: 'claim', releasing: 'konrad' })
  })
  it('invalid and reserved come back as 400', () => {
    expect(decideClaim({ ...base, name: 'x', current: { username: null, changedAt: null } }))
      .toMatchObject({ status: 400, error: 'invalid' })
    expect(decideClaim({ ...base, name: 'admin', current: { username: null, changedAt: null } }))
      .toMatchObject({ status: 400, error: 'reserved' })
  })
})