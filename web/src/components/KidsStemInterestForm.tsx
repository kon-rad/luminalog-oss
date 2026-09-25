'use client'

import { useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/

/**
 * Kids STEM class interest form. Each submit is a new auto-id doc in
 * `forms/kidsStemInterest/submissions`, the Kids STEM form's own collection
 * under the shared `forms` collection. Create-only for clients; see the
 * matching rule in firestore.rules (the data holds PII, never publicly readable).
 */
export default function KidsStemInterestForm() {
  const [parentName, setParentName] = useState('')
  const [email, setEmail] = useState('')
  const [childAges, setChildAges] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')
  const [status, setStatus] = useState<'idle' | 'submitting' | 'success' | 'error'>('idle')
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const emailValue = email.trim().toLowerCase()
    if (!parentName.trim()) {
      setError('Please enter your name.')
      setStatus('error')
      return
    }
    if (!EMAIL_RE.test(emailValue)) {
      setError('Please enter a valid email address.')
      setStatus('error')
      return
    }
    setStatus('submitting')
    setError('')
    try {
      await addDoc(collection(db, 'forms', 'kidsStemInterest', 'submissions'), {
        parentName: parentName.trim(),
        email: emailValue,
        childAges: childAges.trim(),
        location: location.trim(),
        notes: notes.trim(),
        source: 'courses/kids-stem#schedule',
        createdAt: serverTimestamp(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      })
      setStatus('success')
    } catch (err) {
      console.error('kids stem interest submit failed', err)
      setError('Something went wrong. Please try again.')
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
          background: 'var(--accentSoft)',
          color: 'var(--accentDeep)',
          border: '1px solid var(--hairline)',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
        Thank you. We&apos;ll email you the class times as soon as they are set.
      </div>
    )
  }

  const inputStyle: React.CSSProperties = {
    width: '100%',
    padding: '12px 16px',
    fontSize: 16,
    borderRadius: 12,
    outline: 'none',
    background: 'var(--surface)',
    color: 'var(--text)',
    border: '1px solid var(--hairline2)',
  }
  const labelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: '0.04em',
    textTransform: 'uppercase',
    color: 'var(--text3)',
  }
  const clearError = () => {
    if (status === 'error') setStatus('idle')
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="card" style={{ padding: '22px 24px' }}>
      <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 16 }}>
        <label style={labelStyle}>
          Your name
          <input
            type="text"
            autoComplete="name"
            required
            maxLength={200}
            value={parentName}
            onChange={(e) => {
              setParentName(e.target.value)
              clearError()
            }}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Email
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            maxLength={320}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              clearError()
            }}
            placeholder="you@email.com"
            aria-invalid={status === 'error'}
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          Child&apos;s age (or ages)
          <input
            type="text"
            maxLength={200}
            value={childAges}
            onChange={(e) => setChildAges(e.target.value)}
            placeholder="e.g. 7 and 10"
            style={inputStyle}
          />
        </label>
        <label style={labelStyle}>
          City or time zone
          <input
            type="text"
            maxLength={200}
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Chicago, Singapore"
            style={inputStyle}
          />
        </label>
      </div>
      <label style={{ ...labelStyle, marginTop: 16 }}>
        Preferred days and times, or anything else we should know
        <textarea
          rows={3}
          maxLength={2000}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          style={{ ...inputStyle, resize: 'vertical', fontFamily: 'inherit' }}
        />
      </label>
      <button
        type="submit"
        disabled={status === 'submitting'}
        className="btn-amber"
        style={{
          marginTop: 18,
          border: 'none',
          cursor: status === 'submitting' ? 'default' : 'pointer',
          opacity: status === 'submitting' ? 0.7 : 1,
        }}
      >
        {status === 'submitting' ? 'Sending…' : 'Register interest'}
      </button>
      {status === 'error' && (
        <p style={{ marginTop: 8, fontSize: 13, color: '#C0532E' }}>{error}</p>
      )}
    </form>
  )
}
