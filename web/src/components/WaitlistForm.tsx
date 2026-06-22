'use client'

import { useState } from 'react'
import { doc, setDoc, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

type Variant = 'default' | 'onAccent'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Landing-page waitlist capture. Writes the email to the Firestore `waitlist`
 * collection (doc id = lowercased email, so re-submits upsert without dupes).
 * `onAccent` renders light controls for use on the dark/amber CTA blocks.
 */
export default function WaitlistForm({
  variant = 'default',
  source = 'landing',
}: {
  variant?: Variant
  source?: string
}) {
  const [email, setEmail] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  const onAccent = variant === 'onAccent'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const value = email.trim().toLowerCase()
    if (!EMAIL_RE.test(value)) {
      setError('Please enter a valid email address.')
      setStatus('error')
      return
    }
    setStatus('submitting')
    setError('')
    try {
      await setDoc(
        doc(db, 'waitlist', value),
        {
          email: value,
          source,
          createdAt: serverTimestamp(),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
        },
        { merge: true }
      )
      setStatus('success')
      setEmail('')
    } catch (err) {
      console.error('waitlist submit failed', err)
      setError('Something went wrong — please try again.')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div
        role="status"
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 10,
          padding: '14px 22px',
          borderRadius: 14,
          fontSize: 16,
          fontWeight: 600,
          background: onAccent ? 'rgba(255,255,255,0.18)' : 'var(--accentSoft)',
          color: onAccent ? '#fff' : 'var(--accentDeep)',
          border: onAccent ? '1px solid rgba(255,255,255,0.3)' : '1px solid var(--hairline)',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        You&apos;re on the list — we&apos;ll email you when LuminaLog opens.
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} style={{ width: '100%', maxWidth: 460 }} noValidate>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'stretch' }}>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => {
            setEmail(e.target.value)
            if (status === 'error') setStatus('idle')
          }}
          placeholder="you@email.com"
          aria-label="Email address"
          aria-invalid={status === 'error'}
          style={{
            flex: '1 1 220px',
            minWidth: 0,
            padding: '14px 18px',
            fontSize: 16,
            borderRadius: 14,
            outline: 'none',
            background: onAccent ? 'rgba(255,255,255,0.95)' : 'var(--surface)',
            color: 'var(--text)',
            border: onAccent ? '1px solid rgba(255,255,255,0.6)' : '1px solid var(--hairline2)',
          }}
        />
        <button
          type="submit"
          disabled={status === 'submitting'}
          style={{
            flex: '0 0 auto',
            padding: '14px 24px',
            fontSize: 16,
            fontWeight: 600,
            borderRadius: 14,
            cursor: status === 'submitting' ? 'default' : 'pointer',
            border: 'none',
            whiteSpace: 'nowrap',
            opacity: status === 'submitting' ? 0.7 : 1,
            background: onAccent ? '#fff' : 'var(--accent)',
            color: onAccent ? 'var(--accentDeep)' : '#fff',
            transition: 'transform .15s, opacity .15s',
          }}
        >
          {status === 'submitting' ? 'Joining…' : 'Join the waitlist'}
        </button>
      </div>
      {status === 'error' && (
        <p
          style={{
            marginTop: 8,
            fontSize: 13,
            textAlign: 'left',
            color: onAccent ? 'rgba(255,255,255,0.92)' : '#C0532E',
          }}
        >
          {error}
        </p>
      )}
    </form>
  )
}
