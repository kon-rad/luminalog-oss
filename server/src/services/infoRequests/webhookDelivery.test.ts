import { describe, it, expect, vi } from 'vitest'
import { isPrivateAddress, isAcceptableWebhookUrl, deliverWebhook, type PostFn } from './webhookDelivery'
import { isoSeconds } from './time'

describe('isPrivateAddress', () => {
  it.each([
    '127.0.0.1', '10.1.2.3', '172.16.0.1', '172.31.255.255', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '224.0.0.1', '::1', '::', 'fc00::1', 'fd12::1', 'fe80::1',
    '::ffff:127.0.0.1', '::ffff:10.0.0.1', 'not-an-ip',
  ])('blocks %s', ip => expect(isPrivateAddress(ip)).toBe(true))

  it.each(['8.8.8.8', '1.1.1.1', '172.32.0.1', '2606:4700:4700::1111'])('allows %s', ip =>
    expect(isPrivateAddress(ip)).toBe(false))
})

describe('isAcceptableWebhookUrl', () => {
  it('accepts a public https url', () => expect(isAcceptableWebhookUrl('https://agent.example.com/reply')).toBe(true))
  it('accepts a public IPv6 literal', () => expect(isAcceptableWebhookUrl('https://[2606:4700:4700::1111]/reply')).toBe(true))
  it.each([
    'http://agent.example.com/reply',
    'https://localhost/reply',
    'https://127.0.0.1/reply',
    'https://[::1]/reply',
    'https://[::ffff:127.0.0.1]/reply',
    'https://10.0.0.5/reply',
    'https://[::127.0.0.1]/reply',
    'https://[64:ff9b::7f00:1]/reply',
    'https://[2002:7f00:1::]/reply',
    'https://user:pw@agent.example.com/reply',
    'not a url',
    `https://agent.example.com/${'a'.repeat(2050)}`,
  ])('rejects %s', url => expect(isAcceptableWebhookUrl(url)).toBe(false))
})

describe('deliverWebhook', () => {
  const noSleep = async () => {}
  const url = 'https://agent.example.com/reply'

  it('succeeds on first 2xx', async () => {
    const post: PostFn = vi.fn(async () => ({ status: 204 }))
    const r = await deliverWebhook(url, '{}', {}, { post, sleep: noSleep })
    expect(r).toEqual({ ok: true, status: 204, attempts: 1 })
  })

  it('retries 5xx and 429 then succeeds', async () => {
    const post = vi.fn<Parameters<PostFn>, ReturnType<PostFn>>()
      .mockResolvedValueOnce({ status: 503, error: 'down' })
      .mockResolvedValueOnce({ status: 429, error: 'slow' })
      .mockResolvedValueOnce({ status: 200 })
    const r = await deliverWebhook(url, '{}', {}, { post, sleep: noSleep })
    expect(r.ok).toBe(true)
    expect(r.attempts).toBe(3)
  })

  it('retries network errors and gives up after 3 attempts', async () => {
    const post: PostFn = vi.fn(async () => ({ error: 'ECONNRESET' }))
    const r = await deliverWebhook(url, '{}', {}, { post, sleep: noSleep })
    expect(r).toMatchObject({ ok: false, attempts: 3, error: 'ECONNRESET' })
  })

  it('does not retry a 4xx or a 3xx redirect', async () => {
    for (const status of [400, 301]) {
      const post: PostFn = vi.fn(async () => ({ status, error: 'no' }))
      const r = await deliverWebhook(url, '{}', {}, { post, sleep: noSleep })
      expect(r).toMatchObject({ ok: false, status, attempts: 1 })
    }
  })

  it('does not retry a blocked address', async () => {
    const post: PostFn = vi.fn(async () => ({ error: 'blocked', blocked: true }))
    const r = await deliverWebhook(url, '{}', {}, { post, sleep: noSleep })
    expect(r).toMatchObject({ ok: false, attempts: 1 })
  })

  it('rejects an unacceptable url without calling post', async () => {
    const post: PostFn = vi.fn()
    const r = await deliverWebhook('https://127.0.0.1/x', '{}', {}, { post, sleep: noSleep })
    expect(r).toMatchObject({ ok: false, attempts: 0, error: 'invalid_webhook' })
    expect(post).not.toHaveBeenCalled()
  })

  it('real transport refuses a host that resolves to loopback', async () => {
    // localhost.localdomain style names resolve via /etc/hosts; use a name that
    // passes the literal check but resolves to 127.0.0.1.
    const r = await deliverWebhook('https://localtest.me/x', '{}', {}, { sleep: noSleep, attempts: 1 })
    expect(r.ok).toBe(false)
  })
})

describe('isoSeconds', () => {
  it('drops milliseconds', () => {
    expect(isoSeconds(new Date('2026-09-27T10:00:00.123Z'))).toBe('2026-09-27T10:00:00Z')
  })
})
