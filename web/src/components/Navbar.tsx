'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useAuth } from '@/lib/auth-context'

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [signingIn, setSigningIn] = useState(false)
  const { user, loading, signInWithGoogle, signOut } = useAuth()

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', handler, { passive: true })
    return () => window.removeEventListener('scroll', handler)
  }, [])

  const handleSignIn = async () => {
    setSigningIn(true)
    try {
      await signInWithGoogle()
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
            <Link href="#reflect" className="nav-link hidden md:block">Reflect</Link>
            <Link href="#privacy" className="nav-link hidden md:block">Privacy</Link>
            <Link href="#pricing" className="nav-link hidden md:block">Pricing</Link>

            {!loading && (
              user ? (
                <div className="flex items-center gap-3">
                  <Link href="/dashboard" className="flex items-center gap-2" style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text2)', transition: 'color .15s' }}>
                    {user.photoURL ? (
                      <Image src={user.photoURL} width={28} height={28} alt={user.displayName || 'User'} className="rounded-full" />
                    ) : (
                      <span style={{ width: 28, height: 28, borderRadius: '50%', background: 'var(--accentSoft)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent)', fontSize: 12, fontWeight: 700 }}>
                        {user.displayName?.[0] || user.email?.[0] || '?'}
                      </span>
                    )}
                    <span className="hidden md:block">Dashboard</span>
                  </Link>
                  <button onClick={() => signOut()} className="nav-link text-sm" style={{ fontSize: 13 }}>Sign out</button>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleSignIn}
                    disabled={signingIn}
                    className="nav-link hidden md:block"
                    style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text2)' }}
                  >
                    {signingIn ? 'Signing in…' : 'Sign in'}
                  </button>
                  <a href={process.env.NEXT_PUBLIC_APP_STORE_URL || '#download'} className="nav-cta hidden md:inline-flex">
                    <svg width="14" height="16" viewBox="0 0 20 24" fill="currentColor"><path d="M16.4 12.7c0-2.6 2.1-3.9 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.3-.9-1.7 0-3.3 1-4.1 2.5-1.8 3-.5 7.5 1.2 9.9.8 1.2 1.8 2.5 3.1 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8-.1 0-2.5-1-2.5-3.7zM13.9 3.5c.7-.8 1.1-2 1-3.2-1 0-2.2.7-2.9 1.5-.6.7-1.2 1.9-1 3 1.1.1 2.2-.6 2.9-1.3z"/></svg>
                    Download
                  </a>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
