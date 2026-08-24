import { describe, it, expect } from 'vitest'
import { buildUserData, sha256Lower } from './metaCapi'

describe('sha256Lower', () => {
  it('lowercases and trims before hashing, per Meta normalisation rules', async () => {
    const a = await sha256Lower('  Konrad@Example.COM ')
    const b = await sha256Lower('konrad@example.com')
    expect(a).toBe(b)
  })

  it('produces a 64 character hex digest', async () => {
    expect(await sha256Lower('konrad@example.com')).toMatch(/^[0-9a-f]{64}$/)
  })
})

describe('buildUserData', () => {
  it('never returns a raw email address', async () => {
    const data = await buildUserData({
      email: 'konrad@example.com',
      ip: '203.0.113.1',
      userAgent: 'test-agent',
      fbp: null,
      fbc: null,
    })
    expect(JSON.stringify(data)).not.toContain('konrad@example.com')
    expect(data.em).toMatch(/^[0-9a-f]{64}$/)
  })

  it('passes fbp and fbc through unhashed, as Meta requires', async () => {
    const data = await buildUserData({
      email: null,
      ip: '203.0.113.1',
      userAgent: 'test-agent',
      fbp: 'fb.1.123.456',
      fbc: 'fb.1.123.abc',
    })
    expect(data.fbp).toBe('fb.1.123.456')
    expect(data.fbc).toBe('fb.1.123.abc')
  })

  it('omits keys with no value rather than sending nulls', async () => {
    const data = await buildUserData({
      email: null,
      ip: null,
      userAgent: null,
      fbp: null,
      fbc: null,
    })
    expect(Object.keys(data)).toHaveLength(0)
  })
})
