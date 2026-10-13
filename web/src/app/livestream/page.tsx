import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import SiteFooter from '@/components/SiteFooter'
import AutoRefresh from '@/components/AutoRefresh'
import TipMethods, { type TipMethod } from '@/components/TipMethods'
import ViewersChart from '@/components/ViewersChart'
import {
  CHALLENGE_DAYS,
  EVM_ADDRESS,
  MANUAL,
  MANUAL_UPDATED_AT,
  MISSION,
  PLATFORM_LABEL,
  SOLANA_ADDRESS,
  STREAM_LINKS,
  challengeWindow,
  formatDuration,
  formatValue,
  goal,
  hoursStreamed,
  streamStats,
  walletSnapshot,
  type Goal,
  type StreamStats,
} from '@/lib/livestream'

/* Rebuilt at most once a minute (ISR): every visitor and the stream overlay
 * share one round of RPC and price calls. */
export const revalidate = 60

export const metadata: Metadata = {
  title: 'Livestream, Argo',
  description: `Argo builds in public, live every day. ${CHALLENGE_DAYS}-day goals, tracked live: revenue, followers on X, hours streamed.`,
}

const DONATE: TipMethod[] = [
  {
    kind: 'address',
    id: 'evm',
    glyph: '⟠',
    title: 'Ethereum & Base',
    blurb: 'Same address on Ethereum mainnet and Base. ETH or USDC are counted live toward the goal.',
    address: EVM_ADDRESS,
  },
  {
    kind: 'address',
    id: 'solana',
    glyph: '◎',
    title: 'Solana',
    blurb: 'SOL or USDC on Solana mainnet. Counted live toward the goal.',
    address: SOLANA_ADDRESS,
  },
]

function fmtAmount(n: number): string {
  if (n === 0) return '0'
  return n.toLocaleString('en-US', { maximumFractionDigits: n < 1 ? 6 : 4 })
}

function GoalCard({ g, index }: { g: Goal; index: number }) {
  const met = g.pct >= 100
  return (
    <div className="card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accentDeep)' }}>
        GOAL {index + 1}
      </div>
      <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', lineHeight: 1.35 }}>{g.title}</h3>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <span className="serif" style={{ fontSize: 36, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em' }}>
          {g.unavailable ? '-' : formatValue(g.current, g.unit)}
        </span>
        <span style={{ fontSize: 15, color: 'var(--text3)' }}>of {formatValue(g.target, g.unit)}</span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(g.pct)}
        aria-label={`${g.title}: ${Math.round(g.pct)}%`}
        style={{ height: 10, borderRadius: 999, background: 'var(--surfaceAlt)', overflow: 'hidden' }}
      >
        <div style={{ width: `${Math.max(g.pct, g.current > 0 ? 1.5 : 0)}%`, height: '100%', background: 'var(--accent)', borderRadius: 999 }} />
      </div>
      <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.5 }}>
        {g.unavailable ? 'Unavailable just now' : met ? 'Goal met.' : `${g.pct.toFixed(g.pct < 10 ? 1 : 0)}%`}
        {!g.unavailable && g.perDayNeeded !== null && ` · ${formatValue(g.perDayNeeded, g.unit)} a day to finish on time`}
      </div>
      <div style={{ marginTop: 'auto', fontSize: 12, color: 'var(--text3)' }}>{g.source}</div>
    </div>
  )
}

function fmtDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

/* Viewers over the live (or last) stream across every platform, plus every stream of the challenge as a table. */
function ViewersSection({ stats, since }: { stats: StreamStats; since: string }) {
  const from = Date.parse(`${since}T00:00:00Z`)
  const sessions = stats.sessions.filter((s) => Date.parse(s.started_at) >= from)
  if (sessions.length === 0 && !stats.series) return null
  const series = stats.series
  const peak = series ? Math.max(...series.points.map((p) => p.v)) : 0
  const minutes = series ? (Date.parse(series.end) - Date.parse(series.start)) / 60_000 : 0

  return (
    <section style={{ background: 'var(--bg)', paddingBottom: 56 }}>
      <div className="wrap">
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          <h2 className="serif" style={{ fontSize: 28, fontWeight: 600, color: 'var(--text)', textAlign: 'center', marginBottom: 20 }}>
            Viewers
          </h2>
          {series && series.points.length > 0 && (
            <div className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', color: 'var(--accentDeep)' }}>
                    {stats.live ? 'WATCHING NOW' : 'LAST STREAM'}
                  </div>
                  <span className="serif" style={{ fontSize: 36, fontWeight: 600, color: 'var(--text)' }}>
                    {(stats.live ? stats.live.viewers : peak).toLocaleString('en-US')}
                  </span>
                  {!stats.live && <span style={{ marginLeft: 8, fontSize: 15, color: 'var(--text3)' }}>peak</span>}
                </div>
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>
                  {fmtDay(series.start)} · {formatDuration(minutes)} · peak {peak.toLocaleString('en-US')}
                  {' · '}{series.platforms.map((p) => PLATFORM_LABEL[p] ?? p).join(' + ')}
                </span>
              </div>
              <ViewersChart points={series.points} live={Boolean(stats.live)} labels={PLATFORM_LABEL} />
            </div>
          )}
          {sessions.length > 0 && (
            <div className="card" style={{ marginTop: 16, padding: 20, overflowX: 'auto' }}>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Every stream this challenge</h3>
              <table style={{ width: '100%', marginTop: 12, fontSize: 14, borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ color: 'var(--text3)', fontSize: 12, textAlign: 'left' }}>
                    <th style={{ padding: '6px 0', fontWeight: 600 }}>Date (UTC)</th>
                    <th style={{ padding: '6px 0', fontWeight: 600 }}>Platform</th>
                    <th style={{ padding: '6px 0', fontWeight: 600 }}>Length</th>
                    <th style={{ padding: '6px 0', fontWeight: 600, textAlign: 'right' }}>Peak</th>
                    <th style={{ padding: '6px 0', fontWeight: 600, textAlign: 'right' }}>Average</th>
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s) => (
                    <tr key={`${s.platform}-${s.started_at}`} style={{ borderTop: '1px solid var(--hairline)' }}>
                      <td style={{ padding: '8px 0', color: 'var(--text2)' }}>
                        {fmtDay(s.started_at)}{s.ended_at === null && s.source === 'collector' ? ' (live)' : ''}
                      </td>
                      <td style={{ padding: '8px 0', color: 'var(--text2)' }}>{PLATFORM_LABEL[s.platform] ?? s.platform}</td>
                      <td style={{ padding: '8px 0', color: 'var(--text)' }}>{formatDuration(s.minutes)}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--text2)' }}>{s.peak_viewers?.toLocaleString('en-US') ?? 'not tracked'}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--text2)' }}>{s.avg_viewers?.toLocaleString('en-US') ?? 'not tracked'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)', lineHeight: 1.55 }}>
                Concurrent viewers are sampled once a minute from the public YouTube, Twitch and Kick pages; the chart adds them up. Streams before tracking started show their length only.
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

export default async function LivestreamPage() {
  const now = new Date()
  const period = challengeWindow(now)
  const [wallet, stats] = await Promise.all([walletSnapshot(), streamStats()])

  const goals = [
    goal({
      id: 'revenue',
      title: `Make $1,000 in ${CHALLENGE_DAYS} days`,
      current: wallet.totalUsd + MANUAL.otherRevenueUsd,
      target: 1000,
      unit: 'usd',
      source: `Donation wallets: live on-chain${MANUAL.otherRevenueUsd > 0 ? `, plus other revenue (updated ${MANUAL_UPDATED_AT})` : ''}`,
    }, period.daysLeft),
    goal({
      id: 'x-followers',
      title: `Gain 1,000 followers on X in ${CHALLENGE_DAYS} days`,
      current: MANUAL.xFollowersGained,
      target: 1000,
      unit: 'followers',
      source: `Updated by hand, ${MANUAL_UPDATED_AT}`,
    }, period.daysLeft),
    goal({
      id: 'hours',
      title: `Stream for over 120 hours in ${CHALLENGE_DAYS} days`,
      current: stats ? hoursStreamed(stats.sessions) : 0,
      target: 120,
      unit: 'hours',
      source: stats ? 'Logged automatically from YouTube, Twitch and Kick, every minute. A multistream counts once.' : 'Stream log unreachable just now; retries every minute',
      unavailable: !stats,
    }, period.daysLeft),
  ]

  const updated = new Date(wallet.fetchedAt).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', timeZone: 'UTC', timeZoneName: 'short',
  })

  return (
    <>
      <AutoRefresh seconds={60} />
      <Navbar />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden" style={{ background: 'var(--bg)' }}>
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 80% 70% at 50% -10%, rgba(206,127,68,0.16), transparent 55%)',
          }}
        />
        <div className="wrap" style={{ position: 'relative', zIndex: 1, padding: '72px 0 28px', textAlign: 'center' }}>
          <span className="eyebrow">
            ● Live dashboard · {period.day === 0 ? `Starts ${period.start}` : `Day ${period.day} of ${CHALLENGE_DAYS}`}
          </span>
          <h1
            className="serif"
            style={{
              marginTop: 24, fontSize: 'clamp(34px,4.6vw,54px)', lineHeight: 1.06,
              fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text)',
            }}
          >
            Argo Livestream
          </h1>
          <p style={{ fontSize: 19, lineHeight: 1.62, color: 'var(--text2)', maxWidth: 600, margin: '20px auto 0' }}>
            {MISSION}
          </p>
          <p style={{ marginTop: 14, fontSize: 14, color: 'var(--text3)' }}>
            {period.start} to {period.end} · {period.daysLeft} {period.daysLeft === 1 ? 'day' : 'days'} left
          </p>
          {stats?.live && (
            <a
              href={stats.live.url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-ghost"
              style={{ marginTop: 20, display: 'inline-flex', gap: 8, alignItems: 'center' }}
            >
              <span aria-hidden style={{ width: 8, height: 8, borderRadius: 999, background: 'var(--danger)' }} />
              Live now · {stats.live.viewers.toLocaleString('en-US')} watching
              {stats.live.platforms.length > 1 && (
                <span style={{ color: 'var(--text3)' }}>
                  ({stats.live.platforms.map((p) => `${PLATFORM_LABEL[p.platform] ?? p.platform} ${p.viewers.toLocaleString('en-US')}`).join(', ')})
                </span>
              )}
              {stats.live.platforms.length === 1 && ` on ${PLATFORM_LABEL[stats.live.platforms[0].platform] ?? stats.live.platforms[0].platform}`}
            </a>
          )}
        </div>
      </section>

      {/* ── GOALS ── */}
      <section style={{ background: 'var(--bg)', paddingBottom: 56 }}>
        <div className="wrap">
          <div className="unlock-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
            {goals.map((g, i) => <GoalCard key={g.id} g={g} index={i} />)}
          </div>
        </div>
      </section>

      {stats && <ViewersSection stats={stats} since={period.start} />}

      {/* ── WATCH ── */}
      <section style={{ background: 'var(--bg)', paddingBottom: 56 }}>
        <div className="wrap" style={{ textAlign: 'center' }}>
          <h2 className="serif" style={{ fontSize: 28, fontWeight: 600, color: 'var(--text)' }}>Watch live</h2>
          <div style={{ marginTop: 20, display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            {STREAM_LINKS.map((l) => (
              <a key={l.id} href={l.url} target="_blank" rel="noopener noreferrer" className="btn-ghost">
                {l.label}
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* ── DONATE ── */}
      <section style={{ background: 'var(--bg)', paddingBottom: 96 }}>
        <div className="wrap">
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <h2 className="serif" style={{ fontSize: 28, fontWeight: 600, color: 'var(--text)', textAlign: 'center', marginBottom: 20 }}>
              Support the stream
            </h2>
            <TipMethods methods={DONATE} />

            <div className="card" style={{ marginTop: 16, padding: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, flexWrap: 'wrap' }}>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Wallet balances, live</h3>
                <span style={{ fontSize: 12, color: 'var(--text3)' }}>Updated {updated}</span>
              </div>
              <table style={{ width: '100%', marginTop: 12, fontSize: 14, borderCollapse: 'collapse' }}>
                <tbody>
                  {wallet.holdings.map((h) => (
                    <tr key={`${h.chain}-${h.asset}`} style={{ borderTop: '1px solid var(--hairline)' }}>
                      <td style={{ padding: '8px 0', color: 'var(--text2)' }}>{h.chain}</td>
                      <td style={{ padding: '8px 0', color: 'var(--text)' }}>{fmtAmount(h.amount)} {h.asset}</td>
                      <td style={{ padding: '8px 0', textAlign: 'right', color: 'var(--text2)' }}>
                        {h.usd === null ? 'price unavailable' : formatValue(h.usd, 'usd')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {wallet.errors.length > 0 && (
                <p style={{ marginTop: 10, fontSize: 13, color: 'var(--danger)' }}>
                  Couldn&apos;t read {wallet.errors.join(', ')} just now, so the total leaves it out. It retries every minute.
                </p>
              )}
              <p style={{ marginTop: 10, fontSize: 12, color: 'var(--text3)', lineHeight: 1.55 }}>
                Read straight from the chain. Check it yourself on{' '}
                <a href={`https://etherscan.io/address/${EVM_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accentDeep)' }}>Etherscan</a>,{' '}
                <a href={`https://basescan.org/address/${EVM_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accentDeep)' }}>Basescan</a> and{' '}
                <a href={`https://solscan.io/account/${SOLANA_ADDRESS}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accentDeep)' }}>Solscan</a>.
                Other tokens and chains aren&apos;t counted yet.
              </p>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
