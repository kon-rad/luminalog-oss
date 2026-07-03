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
            <Link href="/#reflect" className="nav-link hidden md:block">Reflect</Link>
            <Link href="/#practice" className="nav-link hidden md:block">Practice</Link>
            <Link href="/#privacy" className="nav-link hidden md:block">Privacy</Link>
            <Link href="/#pricing" className="nav-link hidden md:block">Pricing</Link>
            <Link href="/blog" className="nav-link hidden md:block">Blog</Link>

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
                  <a href="#waitlist" className="nav-cta hidden md:inline-flex">
                    Join waitlist
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
