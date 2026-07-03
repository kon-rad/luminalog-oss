'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useAuth } from '@/lib/auth-context'
import { useSoul } from '@/lib/useSoul'

const SoulGalaxy = dynamic(() => import('@/components/SoulGalaxy'), { ssr: false })

const fmt = (n: number | undefined) => (n ?? 0).toLocaleString('en-US')

export default function Dashboard() {
  const { user, loading, signOut } = useAuth()
  const router = useRouter()
  const { data: soul, loading: soulLoading, error: soulError } = useSoul()

  useEffect(() => {
    if (!loading && !user) {
      router.push('/')
    }
  }, [user, loading, router])

  if (loading || !user) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'var(--accentSoft)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>✦</div>
          <p style={{ color: 'var(--text2)', fontSize: 15 }}>Loading…</p>
        </div>
      </div>
    )
  }

  const initials = user.displayName
    ? user.displayName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : user.email?.[0]?.toUpperCase() || '?'

  const stats = [
    { icon: '✦', label: 'Stars', value: fmt(soul?.constellation.points.length ?? 0) },
    { icon: '✍️', label: 'Total words', value: fmt(soul?.stats.totalWords) },
    { icon: '🔥', label: 'Day streak', value: fmt(soul?.stats.streakCount) },
    { icon: '📓', label: 'Today', value: fmt(soul?.stats.goalDayWords), sub: 'toward 750' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      {/* Header */}
      <header style={{
        position: 'sticky', top: 0, zIndex: 200,
        background: 'rgba(244,240,233,0.92)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: '1px solid var(--hairline)',
      }}>
        <div className="wrap">
          <div className="flex items-center justify-between" style={{ height: 68 }}>
            <Link href="/" className="inline-flex items-center gap-2.5 serif" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>
              <span style={{ width: 32, height: 32, borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 10px rgba(185,107,51,0.4)', flexShrink: 0, display: 'block' }}>
                <Image src="/logo.svg" width={32} height={32} alt="LuminaLog" />
              </span>
              LuminaLog
            </Link>
            <button
              onClick={() => signOut()}
              style={{ fontSize: 14, fontWeight: 600, color: 'var(--text2)', padding: '8px 16px', borderRadius: 10, border: '1px solid var(--hairline2)', background: 'var(--surface)', boxShadow: 'var(--shadow)', transition: 'transform .15s' }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="wrap" style={{ paddingTop: 64, paddingBottom: 80 }}>
        <div style={{ maxWidth: 720, margin: '0 auto' }}>
          {/* Soul galaxy hero panel */}
          <div
            style={{
              position: 'relative',
              width: '100%',
              height: 'clamp(340px, 46vw, 420px)',
              borderRadius: 28,
              overflow: 'hidden',
              background: 'radial-gradient(120% 110% at 26% 18%, #2E2A5E 0%, #1B1740 32%, #100D28 58%, #07060F 82%, #030308 100%)',
              boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px rgba(8,6,20,0.45)',
            }}
          >
            {soulLoading ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <style>{`
                  @keyframes soul-panel-shimmer { 0%, 100% { opacity: 0.35; } 50% { opacity: 0.8; } }
                `}</style>
                <div
                  aria-hidden
                  style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: '#F7E3C4',
                    boxShadow: '0 0 16px 6px rgba(232,164,76,0.6)',
                    animation: 'soul-panel-shimmer 1.6s ease-in-out infinite',
                  }}
                />
              </div>
            ) : soulError ? (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 48px', textAlign: 'center' }}>
                <p className="serif" style={{ fontSize: 17, lineHeight: 1.5, fontStyle: 'italic', color: 'rgba(243,238,228,0.75)' }}>
                  Couldn&apos;t load your soul right now.
                </p>
              </div>
            ) : (
              <SoulGalaxy points={soul?.constellation.points ?? []} />
            )}
          </div>

          {/* Stat row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 14, marginTop: 20 }}>
            {stats.map(({ icon, label, value, sub }) => (
              <div key={label} style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 18, padding: '20px 22px', boxShadow: 'var(--shadow)' }}>
                <div style={{ fontSize: 22, marginBottom: 8 }}>{icon}</div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 4 }}>{label}</div>
                <div className="serif" style={{ fontSize: 32, fontWeight: 600, color: 'var(--text)', lineHeight: 1, letterSpacing: '-0.02em' }}>{value}</div>
                {sub && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4 }}>{sub}</div>}
              </div>
            ))}
          </div>

          {/* Profile card */}
          <div style={{ marginTop: 24, background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 28, padding: '40px 44px', boxShadow: 'var(--shadow)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 32 }}>
              {user.photoURL ? (
                <Image
                  src={user.photoURL}
                  width={80}
                  height={80}
                  alt={user.displayName || 'Profile'}
                  style={{ borderRadius: '50%', border: '3px solid var(--accentSoft)', boxShadow: '0 4px 16px rgba(185,107,51,0.2)' }}
                />
              ) : (
                <div style={{ width: 80, height: 80, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accentDeep))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 28, fontWeight: 700, flexShrink: 0, border: '3px solid var(--accentSoft)', boxShadow: '0 4px 16px rgba(185,107,51,0.2)' }}>
                  {initials}
                </div>
              )}
              <div>
                <h1 className="serif" style={{ fontSize: 28, fontWeight: 600, color: 'var(--text)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>
                  {user.displayName || 'Welcome'}
                </h1>
                <p style={{ fontSize: 15, color: 'var(--text2)', marginTop: 4 }}>{user.email}</p>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, background: 'var(--accentSoft)', color: 'var(--accentDeep)', padding: '3px 10px', borderRadius: 100, fontSize: 11, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                  ✦ Connected
                </span>
              </div>
            </div>

            {/* Bio placeholder */}
            <div style={{ padding: '20px 0', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)', marginBottom: 28 }}>
              <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 8 }}>Bio</div>
              <p className="serif" style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--text2)', fontStyle: 'italic' }}>
                Bio is set in the iOS app and will appear here once available.
              </p>
            </div>
          </div>

          {/* Download CTA */}
          <div style={{ marginTop: 24, background: 'linear-gradient(155deg, var(--accent), var(--accentDeep))', borderRadius: 24, padding: '28px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, color: '#fff', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: -40, right: -20, width: 140, height: 140, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', filter: 'blur(12px)' }} />
            <div style={{ position: 'relative', zIndex: 1 }}>
              <h3 className="serif" style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.2 }}>Get the iOS app</h3>
              <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.8)', marginTop: 4, lineHeight: 1.5 }}>Start journaling and your stats will appear here.</p>
            </div>
            <a href={process.env.NEXT_PUBLIC_APP_STORE_URL || '#'} style={{ flexShrink: 0, position: 'relative', zIndex: 1, display: 'inline-flex', alignItems: 'center', gap: 10, background: '#fff', color: 'var(--accentDeep)', padding: '12px 22px', borderRadius: 14, fontWeight: 700, fontSize: 14, boxShadow: '0 4px 16px rgba(0,0,0,0.15)', whiteSpace: 'nowrap', transition: 'transform .15s' }}
              onMouseEnter={e => (e.currentTarget.style.transform = 'translateY(-2px)')}
              onMouseLeave={e => (e.currentTarget.style.transform = 'translateY(0)')}>
              <svg width="14" height="17" viewBox="0 0 20 24" fill="var(--accentDeep)"><path d="M16.4 12.7c0-2.6 2.1-3.9 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.1 2.5-1.8 3-.5 7.5 1.2 9.9.8 1.2 1.8 2.5 3.1 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.5-1-2.5-3.7zM13.9 3.5c.7-.8 1.1-2 1-3.2-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.3z"/></svg>
              App Store
            </a>
          </div>

          <p style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text3)' }}>
            Account ID: {user.uid.slice(0, 8)}…
          </p>
        </div>
      </main>
    </div>
  )
}
