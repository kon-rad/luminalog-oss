'use client'

import { useState } from 'react'
import Image from 'next/image'
import { FirebaseError } from 'firebase/app'
import { useAuth } from '@/lib/auth-context'

// Sign-in gate screen (design B.4): centered aperture wordmark + serif
// tagline, "Sign in with Apple" (black HIG-style) + "Continue with Google"
// (ghost, "G" badge). States: idle / loading (buttons dim + spinner) / inline
// error — popup-cancellation errors are silently ignored (the user just
// closed the popup, not a real failure).
const IGNORED_ERROR_CODES = new Set(['auth/popup-closed-by-user', 'auth/cancelled-popup-request'])

type Provider = 'apple' | 'google'

export default function SignIn() {
  const { signInWithApple, signInWithGoogle } = useAuth()
  const [loadingProvider, setLoadingProvider] = useState<Provider | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handle = async (provider: Provider) => {
    setError(null)
    setLoadingProvider(provider)
    try {
      if (provider === 'apple') {
        await signInWithApple()
      } else {
        await signInWithGoogle()
      }
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : undefined
      if (code && IGNORED_ERROR_CODES.has(code)) {
        // User closed the popup — not an error worth surfacing.
      } else {
        setError('Sign-in failed. Please try again.')
      }
    } finally {
      setLoadingProvider(null)
    }
  }

  const busy = loadingProvider !== null

  return (
    <div
      className="flex min-h-screen flex-col items-center justify-center gap-10 px-6"
      style={{ background: 'var(--bg)' }}
    >
      <div className="flex flex-col items-center gap-4 text-center">
        <Image src="/logo.svg" alt="LuminaLog" width={56} height={56} />
        <p className="serif text-2xl font-semibold" style={{ color: 'var(--text)' }}>
          LuminaLog
        </p>
        <p className="serif italic text-lg" style={{ color: 'var(--text2)' }}>
          Your journal, with a memory.
        </p>
      </div>

      <div className="flex w-full max-w-xs flex-col gap-3">
        <button
          type="button"
          onClick={() => handle('apple')}
          disabled={busy}
          className="btn-store w-full justify-center transition-opacity duration-150"
          style={{ opacity: busy && loadingProvider !== 'apple' ? 0.5 : 1 }}
        >
          {loadingProvider === 'apple' ? (
            <Spinner />
          ) : (
            <>
              <AppleGlyph />
              <span>Sign in with Apple</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={() => handle('google')}
          disabled={busy}
          className="btn-ghost w-full justify-center transition-opacity duration-150"
          style={{ opacity: busy && loadingProvider !== 'google' ? 0.5 : 1 }}
        >
          {loadingProvider === 'google' ? (
            <Spinner />
          ) : (
            <>
              <GoogleGlyph />
              <span>Continue with Google</span>
            </>
          )}
        </button>

        {error && (
          <p className="text-center text-sm" style={{ color: 'var(--danger)' }}>
            {error}
          </p>
        )}
      </div>
    </div>
  )
}

function Spinner() {
  return (
    <span
      className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/40"
      style={{ borderTopColor: '#fff' }}
    />
  )
}

function AppleGlyph() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.463 2.146-1.223 2.899-.83.822-2.014 1.457-3.033 1.376a3.51 3.51 0 0 1-.036-.463c0-1.096.535-2.19 1.244-2.914C14.13.79 15.55.024 16.33 0c.023.144.035.29.035.43zm4.14 16.13c-.484 1.116-.714 1.615-1.334 2.605-.866 1.383-2.088 3.107-3.605 3.122-1.348.014-1.694-.876-3.524-.867-1.829.01-2.209.881-3.558.867-1.517-.015-2.674-1.568-3.54-2.951-2.428-3.87-2.68-8.41-1.184-10.828 1.062-1.716 2.741-2.72 4.32-2.72 1.604 0 2.616.883 3.943.883 1.286 0 2.075-.884 3.933-.884 1.406 0 2.895.766 3.958 2.09-3.478 1.906-2.913 6.858.591 8.683z" />
    </svg>
  )
}

function GoogleGlyph() {
  return (
    <span
      className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[11px] font-bold"
      style={{ background: 'var(--accentSoft)', color: 'var(--accentDeep)' }}
      aria-hidden="true"
    >
      G
    </span>
  )
}
