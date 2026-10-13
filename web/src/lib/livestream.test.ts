import { describe, expect, it } from 'vitest'
import {
  challengeWindow, formatDuration, formatValue, fromHexUnits, goal, hoursStreamed, streamStats, walletSnapshot,
  type StreamSession,
} from './livestream'

describe('challengeWindow', () => {
  it('counts day 1 on the start date and ends after 30 days', () => {
    const w = challengeWindow(new Date('2026-10-12T15:00:00Z'), '2026-10-12', 30)
    expect(w).toEqual({ start: '2026-10-12', end: '2026-11-10', day: 1, daysLeft: 30 })
  })

  it('is day 0 before the start and clamps after the end', () => {
    expect(challengeWindow(new Date('2026-10-01T00:00:00Z'), '2026-10-12', 30).day).toBe(0)
    const after = challengeWindow(new Date('2026-12-01T00:00:00Z'), '2026-10-12', 30)
    expect(after.day).toBe(30)
    expect(after.daysLeft).toBe(0)
  })
})

describe('goal', () => {
  it('computes percent and the daily pace still needed', () => {
    const g = goal({ id: 'r', title: 'r', current: 250, target: 1000, unit: 'usd', source: 'x' }, 15)
    expect(g.pct).toBe(25)
    expect(g.perDayNeeded).toBe(50)
  })

  it('caps at 100% and needs nothing once met', () => {
    const g = goal({ id: 'h', title: 'h', current: 130, target: 120, unit: 'hours', source: 'x' }, 3)
    expect(g.pct).toBe(100)
    expect(g.perDayNeeded).toBeNull()
  })
})

describe('formatValue', () => {
  it('formats each unit', () => {
    expect(formatValue(12.5, 'usd')).toBe('$12.50')
    expect(formatValue(1000, 'usd')).toBe('$1,000')
    expect(formatValue(1234, 'followers')).toBe('1,234')
    expect(formatValue(7.64, 'hours')).toBe('7.6 h')
    expect(formatValue(0, 'hours')).toBe('0 h')
    expect(formatValue(42.6, 'hours')).toBe('43 h')
  })
})

describe('fromHexUnits', () => {
  it('converts wei and USDC base units', () => {
    expect(fromHexUnits('0x0de0b6b3a7640000', 18)).toBe(1)
    expect(fromHexUnits('0x0f4240', 6)).toBe(1)
  })
})

/* A fake fetch that answers each JSON-RPC method and the price API. */
function fakeFetch(fail: string[] = []): typeof fetch {
  return (async (url: string, init?: RequestInit) => {
    const ok = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })
    if (url.includes('coingecko')) {
      return fail.includes('prices') ? new Response('', { status: 429 }) : ok({ ethereum: { usd: 2000 }, solana: { usd: 100 } })
    }
    const chain = url.includes('ethereum') ? 'Ethereum' : url.includes('base') ? 'Base' : 'Solana'
    if (fail.includes(chain)) return new Response('', { status: 503 })
    const { method } = JSON.parse(String(init?.body)) as { method: string }
    switch (method) {
      case 'eth_getBalance': return ok({ result: '0x0de0b6b3a7640000' }) // 1 ETH
      case 'eth_call': return ok({ result: '0x' + (5_000_000).toString(16).padStart(64, '0') }) // 5 USDC
      case 'getBalance': return ok({ result: { value: 2e9 } }) // 2 SOL
      case 'getTokenAccountsByOwner':
        return ok({ result: { value: [{ account: { data: { parsed: { info: { tokenAmount: { uiAmount: 3 } } } } } }] } })
      default: return ok({ error: { message: 'unknown' } })
    }
  }) as typeof fetch
}

describe('walletSnapshot', () => {
  it('sums ETH, USDC and SOL across chains in USD', async () => {
    const s = await walletSnapshot(fakeFetch(), '0xabc', 'sol', new Date('2026-10-12T00:00:00Z'))
    // 2 × (1 ETH × 2000 + 5 USDC) + 2 SOL × 100 + 3 USDC
    expect(s.totalUsd).toBe(4213)
    expect(s.holdings).toHaveLength(6)
    expect(s.errors).toEqual([])
  })

  it('drops only the source that failed and names it', async () => {
    const s = await walletSnapshot(fakeFetch(['Base']), '0xabc', 'sol')
    expect(s.errors).toEqual(['Base'])
    expect(s.totalUsd).toBe(2005 + 203)
  })

  it('keeps stablecoins when prices are down, leaving volatile assets unpriced', async () => {
    const s = await walletSnapshot(fakeFetch(['prices']), '0xabc', 'sol')
    expect(s.errors).toEqual(['prices'])
    expect(s.totalUsd).toBe(13)
    expect(s.holdings.find((h) => h.asset === 'ETH')?.usd).toBeNull()
  })
})

describe('stream stats', () => {
  const session = (started_at: string, minutes: number): StreamSession => ({
    platform: 'youtube', video_id: null, title: null, started_at, ended_at: null,
    minutes, peak_viewers: null, avg_viewers: null, source: 'collector',
  })

  it('sums the hours of sessions that started on or after the challenge start', () => {
    const sessions = [session('2026-10-13T02:00:00Z', 90), session('2026-10-12T00:00:00Z', 30), session('2026-10-11T23:59:00Z', 600)]
    expect(hoursStreamed(sessions, '2026-10-12')).toBe(2)
  })

  it('counts a multistream once: overlapping sessions on different platforms are a union', () => {
    const sessions = [
      { ...session('2026-10-13T15:40:00Z', 60), platform: 'twitch' },
      { ...session('2026-10-13T15:41:00Z', 89), platform: 'kick' }, // ends 17:10
      { ...session('2026-10-13T15:40:00Z', 30), platform: 'youtube' },
      session('2026-10-14T02:00:00Z', 30), // separate stream
    ]
    expect(hoursStreamed(sessions, '2026-10-12')).toBe(2)
  })

  it('formats durations', () => {
    expect(formatDuration(45)).toBe('45 min')
    expect(formatDuration(135)).toBe('2 h 15 min')
    expect(formatDuration(180)).toBe('3 h')
  })

  it('returns null rather than throwing when the droplet is unreachable or returns junk', async () => {
    const down = (async () => { throw new Error('ECONNREFUSED') }) as unknown as typeof fetch
    expect(await streamStats(down, 'https://stats.test/x.json')).toBeNull()
    expect(await streamStats(down, undefined)).toBeNull()
    const junk = (async () => new Response('<html>', { status: 200 })) as typeof fetch
    expect(await streamStats(junk, 'https://stats.test/x.json')).toBeNull()
    const ok = (async () => Response.json({ generated_at: 'x', live: null, sessions: [], series: null, poll_error: null })) as typeof fetch
    expect(await streamStats(ok, 'https://stats.test/x.json')).toMatchObject({ sessions: [] })
  })
})
