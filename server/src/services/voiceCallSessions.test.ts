import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  createSession,
  getSession,
  evictSession,
  evictByChatId,
  _clearAllSessions,
} from './voiceCallSessions'

function baseData(overrides: Record<string, unknown> = {}) {
  return {
    uid: 'user-1',
    chatId: 'chat-1',
    dek: Buffer.alloc(32, 7),
    name: 'Ada',
    bio: 'bio',
    profile: {},
    todayContext: '',
    ...overrides,
  } as any
}

describe('voiceCallSessions', () => {
  beforeEach(() => _clearAllSessions())
  afterEach(() => { vi.useRealTimers() })

  it('create → get returns the session by token', () => {
    const token = createSession(baseData())
    expect(token).toMatch(/^[0-9a-f]{48}$/) // 24 random bytes hex
    const s = getSession(token)
    expect(s?.uid).toBe('user-1')
    expect(s?.dek.equals(Buffer.alloc(32, 7))).toBe(true)
  })

  it('mints distinct tokens for distinct sessions', () => {
    expect(createSession(baseData())).not.toBe(createSession(baseData()))
  })

  it('get returns undefined for an unknown token', () => {
    expect(getSession('nope')).toBeUndefined()
  })

  it('evictSession removes the session', () => {
    const token = createSession(baseData())
    evictSession(token)
    expect(getSession(token)).toBeUndefined()
  })

  it('evictByChatId removes every session for that chatId', () => {
    const a = createSession(baseData({ chatId: 'chat-A' }))
    const b = createSession(baseData({ chatId: 'chat-A' }))
    const c = createSession(baseData({ chatId: 'chat-B' }))
    evictByChatId('chat-A')
    expect(getSession(a)).toBeUndefined()
    expect(getSession(b)).toBeUndefined()
    expect(getSession(c)).toBeDefined()
  })

  it('expires a session after the 30-minute TTL', () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-07-15T00:00:00Z'))
    const token = createSession(baseData())
    expect(getSession(token)).toBeDefined()
    vi.setSystemTime(new Date('2026-07-15T00:31:00Z'))
    expect(getSession(token)).toBeUndefined()
  })
})
