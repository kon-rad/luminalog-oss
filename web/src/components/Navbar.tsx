'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { FirebaseError } from 'firebase/app'
import { useAuth } from '@/lib/auth-context'

// Popup cancellations aren't errors — the user just dismissed the sheet.
const CANCEL_CODES = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])

// The section anchors shared by the desktop bar and the mobile drawer.
const NAV_LINKS: [label: string, href: string][] = [
  ['Reflect', '/#reflect'],
  ['Practice', '/#practice'],
  ['Privacy', '/#privacy'],
  ['Pricing', '/#pricing'],
  ['Blog', '/blog'],
]

export default function Navbar() {
  const router = useRouter()
  const [scrolled, setScrolled] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const { user, loading, signInWithApple, signInWithGoogle, signOut } = useAuth()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  // Close the sign-in menu on an outside click.
  useEffect(() => {
    if (!menuOpen) return
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    window.addEventListener('mousedown', onDown)
    return () => window.removeEventListener('mousedown', onDown)
  }, [menuOpen])

  // Close the mobile drawer on outside-click or Escape.
  useEffect(() => {
    if (!drawerOpen) return
    const onDown = (e: MouseEvent) => {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) setDrawerOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false)
    window.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [drawerOpen])

  const signInWith = async (provider: 'apple' | 'google') => {
    setSigningIn(true)
    try {
      await (provider === 'apple' ? signInWithApple() : signInWithGoogle())
      setMenuOpen(false)
      setDrawerOpen(false)
      router.push('/home') // into the app; the (app) gate takes over from here
    } catch (err) {
      if (!(err instanceof FirebaseError && CANCEL_CODES.has(err.code))) {
        console.error('[navbar] sign-in failed:', err)
      }
    } finally {
      setSigningIn(false)
    }
  }

  return (
    <header
      id="nav"
      style={{
        position: 'sticky', top: 0, zIndex: 200,
        background: 'rgba(244,240,233,0.82)',
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        borderBottom: scrolled ? '1px solid var(--hairline)' : '1px solid transparent',
        transition: 'border-color .25s, background .25s',
      }}
    >
      <div className="wrap">
        <div className="flex items-center justify-between" style={{ height: 68 }}>
          {/* Brand */}
          <Link href="/" className="inline-flex items-center gap-2.5 serif" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>
            <span style={{ width: 32, height: 32, borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 10px rgba(185,107,51,0.4)', flexShrink: 0, display: 'block' }}>
              <Image src="/logo.svg" width={32} height={32} alt="LuminaLog" />
            </span>
            LuminaLog
          </Link>

          {/* Right */}
          <div className="flex items-center gap-6">
            {NAV_LINKS.map(([label, href]) => (
              <Link key={label} href={href} className="nav-link hidden md:block">{label}</Link>
            ))}

            {!loading && (
              user ? (
                <div className="hidden md:flex items-center gap-3">
                  <Link href="/home" className="flex items-center gap-2" style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text2)', transition: 'color .15s' }}>
                    {user.photoURL ? (
                      <Image src={user.photoURL} width={28} height={28} alt={user.displayName || 'User'} className="rounded-full" />
                    ) : (
                      <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accentSoft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 12, fontWeight: 700 }}>
                        {user.displayName?.[0] || user.email?.[0] || '?'}
                      </span>
                    )}
                    <span>Open app</span>
                  </Link>
                  <button onClick={() => signOut()} className="nav-link text-sm" style={{ fontSize: 13 }}>Sign out</button>
                </div>
              ) : (
                <div className="hidden md:flex items-center gap-3">
                  <div ref={menuRef} className="relative">
                    <button
                      onClick={() => setMenuOpen((v) => !v)}
                      disabled={signingIn}
                      className="nav-link"
                      style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text2)' }}
                      aria-haspopup="menu"
                      aria-expanded={menuOpen}
                    >
                      {signingIn ? 'Signing in…' : 'Sign in'}
                    </button>
                    {menuOpen && (
                      <div
                        role="menu"
                        className="absolute right-0 mt-2 flex w-56 flex-col gap-1 rounded-2xl p-1.5"
                        style={{ background: 'var(--surface)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadowHover)' }}
                      >
                        <button
                          role="menuitem"
                          onClick={() => signInWith('apple')}
                          disabled={signingIn}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold"
                          style={{ color: 'var(--text)' }}
                        >
                          <AppleGlyph />
                          Sign in with Apple
                        </button>
                        <button
                          role="menuitem"
                          onClick={() => signInWith('google')}
                          disabled={signingIn}
                          className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-semibold"
                          style={{ color: 'var(--text)' }}
                        >
                          <GoogleGlyph />
                          Continue with Google
                        </button>
                      </div>
                    )}
                  </div>
                  <a href="#waitlist" className="nav-cta">
                    Join waitlist
                  </a>
                </div>
              )
            )}

            {/* Mobile controls: always-visible Blog + hamburger */}
            <Link href="/blog" className="nav-link md:hidden">Blog</Link>
            <button
              onClick={() => setDrawerOpen((v) => !v)}
              className="md:hidden inline-flex items-center justify-center"
              style={{ width: 40, height: 40, marginRight: -8, color: 'var(--text)' }}
              aria-label="Menu"
              aria-haspopup="menu"
              aria-expanded={drawerOpen}
              aria-controls="mobile-drawer"
            >
              {drawerOpen ? <CloseGlyph /> : <MenuGlyph />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <div ref={drawerRef} id="mobile-drawer" role="menu" className="md:hidden" style={{ borderTop: '1px solid var(--hairline)' }}>
          <div className="wrap" style={{ paddingTop: 12, paddingBottom: 18, display: 'flex', flexDirection: 'column', gap: 2 }}>
            {NAV_LINKS.map(([label, href]) => (
              <Link
                key={label}
                href={href}
                role="menuitem"
                onClick={() => setDrawerOpen(false)}
                className="nav-link"
                style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', padding: '11px 4px' }}
              >
                {label}
              </Link>
            ))}

            <div style={{ height: 1, background: 'var(--hairline)', margin: '8px 0' }} />

            {!loading && (
              user ? (
                <>
                  <Link
                    href="/home"
                    role="menuitem"
                    onClick={() => setDrawerOpen(false)}
                    className="nav-link"
                    style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', padding: '11px 4px' }}
                  >
                    Open app
                  </Link>
                  <button
                    onClick={() => { setDrawerOpen(false); signOut() }}
                    role="menuitem"
                    className="nav-link text-left"
                    style={{ fontSize: 16, fontWeight: 600, color: 'var(--text2)', padding: '11px 4px' }}
                  >
                    Sign out
                  </button>
                </>
              ) : (
                <>
                  <button
                    role="menuitem"
                    onClick={() => signInWith('apple')}
                    disabled={signingIn}
                    className="flex items-center gap-2.5 text-left"
                    style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', padding: '11px 4px' }}
                  >
                    <AppleGlyph />
                    Sign in with Apple
                  </button>
                  <button
                    role="menuitem"
                    onClick={() => signInWith('google')}
                    disabled={signingIn}
                    className="flex items-center gap-2.5 text-left"
                    style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', padding: '11px 4px' }}
                  >
                    <GoogleGlyph />
                    Continue with Google
                  </button>
                  <a
                    href="#waitlist"
                    onClick={() => setDrawerOpen(false)}
                    className="btn-amber-full"
                    style={{ marginTop: 10 }}
                  >
                    Join waitlist
                  </a>
                </>
              )
            )}
          </div>
        </div>
      )}
    </header>
  )
}

function MenuGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <line x1="4" y1="7" x2="20" y2="7" /><line x1="4" y1="12" x2="20" y2="12" /><line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  )
}

function CloseGlyph() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  )
}

function AppleGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M17.05 12.53c-.02-2.2 1.8-3.26 1.88-3.31-1.02-1.5-2.62-1.7-3.19-1.72-1.36-.14-2.65.8-3.34.8-.68 0-1.75-.78-2.88-.76-1.48.02-2.85.86-3.61 2.19-1.54 2.67-.39 6.62 1.11 8.79.73 1.06 1.6 2.25 2.74 2.21 1.1-.05 1.52-.71 2.85-.71 1.33 0 1.7.71 2.86.69 1.18-.02 1.93-1.08 2.65-2.15.84-1.23 1.19-2.42 1.2-2.48-.03-.01-2.3-.88-2.32-3.5zM14.9 6.3c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.64-1.05 1.68-.92 2.67.97.08 1.96-.49 2.56-1.22z" />
    </svg>
  )
}

function GoogleGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" aria-hidden style={{ flexShrink: 0 }}>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.76c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.11a6.6 6.6 0 0 1 0-4.22V7.05H2.18a11 11 0 0 0 0 9.9l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.05l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}
