/* Livestream dashboard v1 (myargoquest.com/livestream).
 *
 * Everything you edit by hand lives at the top of this file: the challenge
 * window, the goals, the hand-updated numbers and the stream links. The
 * donation total is read live from the chain, so nobody types it in.
 * Plan: vault Areas/argo/livestream/argo-livestream-plan.md */

export const MISSION = 'Build Argo in public, every day, and turn that work into a sustainable business.'

/* The 30-day challenge. Day 1 is CHALLENGE_START (local date of the first stream). */
export const CHALLENGE_START = '2026-10-12'
export const CHALLENGE_DAYS = 30

/* Same address on Ethereum mainnet and Base (and every other EVM chain). */
export const EVM_ADDRESS = '0x9Ca2D4F1d1313dD12D7DAE0CD701A061EE6383aa'
export const SOLANA_ADDRESS = 'AKvvQMBZWjG3EJbAB1Q9RmVBaaSNAncF3bS66T3891NU'

/* Hand-updated until each source is automated. Bump MANUAL_UPDATED_AT with them. */
export const MANUAL = {
  /* Revenue that doesn't reach the wallets above: Venmo, PayPal, product sales, subscriptions (USD). */
  otherRevenueUsd: 0,
  /* Followers gained on X since CHALLENGE_START. */
  xFollowersGained: 0,
}
export const MANUAL_UPDATED_AT = '2026-10-12'

export const STREAM_LINKS = [
  { id: 'youtube', label: 'YouTube', url: 'https://www.youtube.com/@myargoquest/live' },
  { id: 'twitch', label: 'Twitch', url: 'https://www.twitch.tv/synducer' },
  { id: 'kick', label: 'Kick', url: 'https://kick.com/konradgnat' },
  { id: 'x', label: 'X', url: 'https://x.com/myargoquest' },
] as const

/* ── Challenge window ─────────────────────────────────────────────────────── */

const DAY_MS = 86_400_000

export interface ChallengeWindow {
  start: string
  end: string
  /* 1-based day of the challenge, clamped to [0, days]; 0 = not started. */
  day: number
  daysLeft: number
}

export function challengeWindow(now: Date, start = CHALLENGE_START, days = CHALLENGE_DAYS): ChallengeWindow {
  const startMs = Date.parse(`${start}T00:00:00Z`)
  const endMs = startMs + days * DAY_MS
  // Compare calendar days in UTC so the result doesn't depend on the server's zone.
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
  const elapsed = Math.floor((today - startMs) / DAY_MS)
  const day = elapsed < 0 ? 0 : Math.min(days, elapsed + 1)
  return {
    start,
    end: new Date(endMs - DAY_MS).toISOString().slice(0, 10),
    day,
    daysLeft: Math.max(0, days - Math.max(0, elapsed)),
  }
}

/* ── Goals ────────────────────────────────────────────────────────────────── */

export interface Goal {
  id: string
  title: string
  current: number
  target: number
  unit: 'usd' | 'followers' | 'hours'
  source: string
  pct: number
  /* What's still needed per remaining day to finish on time; null once met or over. */
  perDayNeeded: number | null
  /* The source couldn't be read this round: show a dash, not a wrong number. */
  unavailable?: boolean
}

export function goal(
  g: Omit<Goal, 'pct' | 'perDayNeeded'>,
  daysLeft: number,
): Goal {
  const remaining = Math.max(0, g.target - g.current)
  return {
    ...g,
    pct: g.target > 0 ? Math.min(100, (g.current / g.target) * 100) : 0,
    perDayNeeded: remaining > 0 && daysLeft > 0 ? remaining / daysLeft : null,
  }
}

export function formatValue(value: number, unit: Goal['unit']): string {
  if (unit === 'usd') {
    return value.toLocaleString('en-US', {
      style: 'currency', currency: 'USD',
      maximumFractionDigits: value < 100 ? 2 : 0,
    })
  }
  if (unit === 'hours') {
    // Tenths while the total is small, so the first hours of streaming visibly move.
    return `${value < 10 ? (Math.round(value * 10) / 10).toString() : Math.round(value).toLocaleString('en-US')} h`
  }
  return Math.round(value).toLocaleString('en-US')
}

/* ── Live wallet balances ─────────────────────────────────────────────────── */

const RPC = {
  ethereum: 'https://ethereum-rpc.publicnode.com',
  base: 'https://base-rpc.publicnode.com',
  solana: 'https://api.mainnet-beta.solana.com',
}
const USDC = {
  ethereum: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
  base: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
  solana: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
}

export interface Holding {
  chain: 'Ethereum' | 'Base' | 'Solana'
  asset: 'ETH' | 'SOL' | 'USDC'
  amount: number
  usd: number | null
}

export interface WalletSnapshot {
  holdings: Holding[]
  totalUsd: number
  /* Sources that failed this round; their holdings are missing from the total. */
  errors: string[]
  fetchedAt: string
}

type Fetch = typeof fetch

/* Revalidated with the page (ISR), so visitors never hit the RPCs directly. */
const CACHE = { next: { revalidate: 60 } } as RequestInit

async function rpc(f: Fetch, url: string, method: string, params: unknown[]): Promise<unknown> {
  const res = await f(url, {
    ...CACHE,
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) throw new Error(`${method} HTTP ${res.status}`)
  const body = (await res.json()) as { result?: unknown; error?: { message?: string } }
  if (body.error) throw new Error(`${method}: ${body.error.message ?? 'error'}`)
  return body.result
}

/* hex wei / token base units → a decimal amount. */
export function fromHexUnits(hex: string, decimals: number): number {
  return Number(BigInt(hex)) / 10 ** decimals
}

async function evmHoldings(f: Fetch, chain: 'ethereum' | 'base', address: string) {
  const label = chain === 'ethereum' ? 'Ethereum' : 'Base'
  const owner = address.toLowerCase().replace(/^0x/, '').padStart(64, '0')
  const [wei, usdc] = await Promise.all([
    rpc(f, RPC[chain], 'eth_getBalance', [address, 'latest']),
    rpc(f, RPC[chain], 'eth_call', [{ to: USDC[chain], data: `0x70a08231${owner}` }, 'latest']),
  ])
  return [
    { chain: label, asset: 'ETH', amount: fromHexUnits(wei as string, 18) },
    { chain: label, asset: 'USDC', amount: fromHexUnits(usdc as string, 6) },
  ] as const
}

async function solanaHoldings(f: Fetch, address: string) {
  const [lamports, tokens] = await Promise.all([
    rpc(f, RPC.solana, 'getBalance', [address]),
    rpc(f, RPC.solana, 'getTokenAccountsByOwner', [address, { mint: USDC.solana }, { encoding: 'jsonParsed' }]),
  ])
  const usdc = ((tokens as { value: { account: { data: { parsed: { info: { tokenAmount: { uiAmount: number | null } } } } } }[] }).value ?? [])
    .reduce((sum, t) => sum + (t.account.data.parsed.info.tokenAmount.uiAmount ?? 0), 0)
  return [
    { chain: 'Solana', asset: 'SOL', amount: (lamports as { value: number }).value / 1e9 },
    { chain: 'Solana', asset: 'USDC', amount: usdc },
  ] as const
}

async function prices(f: Fetch): Promise<{ ETH: number; SOL: number }> {
  const res = await f('https://api.coingecko.com/api/v3/simple/price?ids=ethereum,solana&vs_currencies=usd', {
    ...CACHE,
    signal: AbortSignal.timeout(6000),
  })
  if (!res.ok) throw new Error(`prices HTTP ${res.status}`)
  const body = (await res.json()) as { ethereum?: { usd?: number }; solana?: { usd?: number } }
  const ETH = body.ethereum?.usd
  const SOL = body.solana?.usd
  if (!ETH || !SOL) throw new Error('prices: missing ETH or SOL')
  return { ETH, SOL }
}

/* Every source fails on its own: one RPC being down hides only its holdings,
 * and the page says which ones are missing instead of showing a wrong total. */
export async function walletSnapshot(
  f: Fetch = fetch,
  evm = EVM_ADDRESS,
  sol = SOLANA_ADDRESS,
  now = new Date(),
): Promise<WalletSnapshot> {
  const errors: string[] = []
  const settle = async <T,>(name: string, p: Promise<T>): Promise<T | null> => {
    try {
      return await p
    } catch {
      errors.push(name)
      return null
    }
  }
  const [eth, base, solana, px] = await Promise.all([
    settle('Ethereum', evmHoldings(f, 'ethereum', evm)),
    settle('Base', evmHoldings(f, 'base', evm)),
    settle('Solana', solanaHoldings(f, sol)),
    settle('prices', prices(f)),
  ])

  const holdings: Holding[] = [...(eth ?? []), ...(base ?? []), ...(solana ?? [])].map((h) => ({
    ...h,
    usd: h.asset === 'USDC' ? h.amount : px ? h.amount * px[h.asset] : null,
  }))
  return {
    holdings,
    totalUsd: holdings.reduce((sum, h) => sum + (h.usd ?? 0), 0),
    errors,
    fetchedAt: now.toISOString(),
  }
}

/* ── Stream stats: viewers and hours ──────────────────────────────────────── */

/* A JSON file written every minute by a private collector that reads the public
 * YouTube /live page (no API key) into its own database. Hours streamed come
 * from here, not from a constant. The URL is a server-only env var, so the host
 * stays out of this public repo; unset means "no stats" and the page says so. */
const STREAM_STATS_URL = process.env.LIVESTREAM_STATS_URL

export interface StreamSession {
  platform: string
  video_id: string | null
  title: string | null
  started_at: string
  ended_at: string | null
  minutes: number
  peak_viewers: number | null
  avg_viewers: number | null
  source: 'collector' | 'manual'
}

export interface StreamStats {
  generated_at: string
  live: { platform: string; video_id: string; title: string | null; viewers: number; since: string; url: string } | null
  sessions: StreamSession[]
  series: { platform: string; video_id: string; points: { t: string; v: number }[] } | null
  poll_error: string | null
}

/* null when the droplet can't be reached: the page then says so instead of showing 0 h. */
export async function streamStats(f: Fetch = fetch, url = STREAM_STATS_URL): Promise<StreamStats | null> {
  if (!url) return null
  try {
    const res = await f(url, { ...CACHE, signal: AbortSignal.timeout(6000) })
    if (!res.ok) return null
    const body = (await res.json()) as StreamStats
    return Array.isArray(body.sessions) ? body : null
  } catch {
    return null
  }
}

/* Hours of every session that started on or after the challenge's first day (UTC, like challengeWindow). */
export function hoursStreamed(sessions: StreamSession[], start = CHALLENGE_START): number {
  const from = Date.parse(`${start}T00:00:00Z`)
  return sessions
    .filter((s) => Date.parse(s.started_at) >= from)
    .reduce((sum, s) => sum + s.minutes, 0) / 60
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  if (h === 0) return `${m} min`
  return m === 0 ? `${h} h` : `${h} h ${m} min`
}
