'use client'

import { useState } from 'react'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  validateContestSubmission,
  type ContestField,
  type ContestSubmissionInput,
} from '@/lib/contest/validate'
import {
  CONTEST_DEADLINE_LABEL,
  CONTEST_EVENT_ID,
  CONTEST_JUDGING,
  CONTEST_PROMPT,
  CONTEST_SUBTITLE,
} from '@/lib/contest/config'

type Status = 'idle' | 'submitting' | 'success' | 'error'

const EMPTY: ContestSubmissionInput = {
  name: '',
  email: '',
  company: '',
  role: '',
  xAccount: '',
  essayUrl: '',
  ethAddress: '',
  agreedToTerms: false,
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '13px 16px',
  fontSize: 16,
  borderRadius: 12,
  outline: 'none',
  background: 'var(--surface)',
  color: 'var(--text)',
  border: '1px solid var(--hairline2)',
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 14,
  fontWeight: 600,
  color: 'var(--text)',
  marginBottom: 7,
}

const errStyle: React.CSSProperties = { marginTop: 6, fontSize: 13, color: '#C0532E' }

const TEXT_FIELDS: {
  key: Exclude<ContestField, 'agreedToTerms'>
  label: string
  placeholder: string
  type?: string
  autoComplete?: string
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']
}[] = [
  { key: 'name', label: 'Full name', placeholder: 'Ada Lovelace', autoComplete: 'name' },
  { key: 'email', label: 'Email', placeholder: 'you@email.com', type: 'email', autoComplete: 'email', inputMode: 'email' },
  { key: 'company', label: 'Company you work for', placeholder: 'Where you work', autoComplete: 'organization' },
  { key: 'role', label: 'Your role', placeholder: 'e.g. Founder, Engineer, Investor', autoComplete: 'organization-title' },
  { key: 'xAccount', label: 'X (Twitter) account', placeholder: '@yourhandle' },
  { key: 'essayUrl', label: 'Link to your published essay', placeholder: 'https://…', type: 'url', inputMode: 'url' },
  { key: 'ethAddress', label: 'Ethereum mainnet address for the prize', placeholder: '0x…' },
]

/**
 * MYBW 2026 essay-contest submission form. Anonymous public write to the Firestore
 * `contestSubmissions` collection (auto id), mirroring the WaitlistForm pattern.
 */
export default function ContestForm() {
  const [values, setValues] = useState<ContestSubmissionInput>(EMPTY)
  const [errors, setErrors] = useState<Partial<Record<ContestField, string>>>({})
  const [status, setStatus] = useState<Status>('idle')
  const [submitError, setSubmitError] = useState('')

  const set = (key: ContestField, value: string | boolean) => {
    setValues((v) => ({ ...v, [key]: value }))
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }))
    if (status === 'error') setStatus('idle')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const result = validateContestSubmission(values)
    if (!result.ok) {
      setErrors(result.errors)
      setStatus('error')
      return
    }
    setErrors({})
    setStatus('submitting')
    setSubmitError('')
    try {
      await addDoc(collection(db, 'contestSubmissions'), {
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        company: values.company.trim(),
        role: values.role.trim(),
        xAccount: values.xAccount.trim(),
        essayUrl: values.essayUrl.trim(),
        ethAddress: values.ethAddress.trim(),
        agreedToTerms: true,
        event: CONTEST_EVENT_ID,
        createdAt: serverTimestamp(),
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      })
      setStatus('success')
    } catch (err) {
      console.error('contest submit failed', err)
      setSubmitError('Something went wrong submitting your entry. Please try again.')
      setStatus('error')
    }
  }

  if (status === 'success') {
    return (
      <div
        role="status"
        style={{
          padding: '28px 26px',
          borderRadius: 18,
          background: 'var(--accentSoft)',
          border: '1px solid var(--hairline)',
          color: 'var(--text)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--accentDeep)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <span className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--accentDeep)' }}>
            Entry received!
          </span>
        </div>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text2)' }}>
          Thanks for submitting your essay. {CONTEST_JUDGING} Good luck!
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: 18 }}>
      {TEXT_FIELDS.map((f) => (
        <div key={f.key}>
          <label htmlFor={`contest-${f.key}`} style={labelStyle}>
            {f.label}
          </label>
          <input
            id={`contest-${f.key}`}
            type={f.type ?? 'text'}
            inputMode={f.inputMode}
            autoComplete={f.autoComplete}
            value={values[f.key]}
            onChange={(ev) => set(f.key, ev.target.value)}
            placeholder={f.placeholder}
            aria-invalid={Boolean(errors[f.key])}
            style={{
              ...inputStyle,
              borderColor: errors[f.key] ? '#C0532E' : 'var(--hairline2)',
            }}
          />
          {errors[f.key] && <p style={errStyle}>{errors[f.key]}</p>}
        </div>
      ))}

      <div>
        <label
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
            padding: '16px 18px',
            borderRadius: 14,
            background: 'var(--surface)',
            border: `1px solid ${errors.agreedToTerms ? '#C0532E' : 'var(--hairline)'}`,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={values.agreedToTerms}
            onChange={(ev) => set('agreedToTerms', ev.target.checked)}
            aria-invalid={Boolean(errors.agreedToTerms)}
            style={{ width: 20, height: 20, marginTop: 2, flexShrink: 0, accentColor: 'var(--accent)', cursor: 'pointer' }}
          />
          <span style={{ fontSize: 14, lineHeight: 1.6, color: 'var(--text2)' }}>
            I confirm my essay is <b style={{ color: 'var(--text)' }}>not 100% AI-generated</b> —
            I may have used AI tastefully, but the thinking and writing are my own. I have{' '}
            <b style={{ color: 'var(--text)' }}>read my essay in full</b> before submitting, it is my
            honest best effort at answering{' '}
            <i>&ldquo;{CONTEST_PROMPT}&rdquo;</i>, it is{' '}
            <b style={{ color: 'var(--text)' }}>published publicly under my real name</b>, and it
            carries the subtitle <b style={{ color: 'var(--text)' }}>&ldquo;{CONTEST_SUBTITLE}&rdquo;</b>{' '}
            and my Ethereum mainnet address.
          </span>
        </label>
        {errors.agreedToTerms && <p style={errStyle}>{errors.agreedToTerms}</p>}
      </div>

      {status === 'error' && submitError && <p style={errStyle}>{submitError}</p>}

      <button
        type="submit"
        disabled={status === 'submitting'}
        style={{
          padding: '15px 24px',
          fontSize: 16,
          fontWeight: 600,
          borderRadius: 14,
          border: 'none',
          cursor: status === 'submitting' ? 'default' : 'pointer',
          background: 'var(--accent)',
          color: '#fff',
          opacity: status === 'submitting' ? 0.7 : 1,
          transition: 'opacity .15s',
        }}
      >
        {status === 'submitting' ? 'Submitting…' : 'Submit my essay'}
      </button>

      <p style={{ fontSize: 13, lineHeight: 1.55, color: 'var(--text3)', textAlign: 'center' }}>
        Submissions close at {CONTEST_DEADLINE_LABEL}.
      </p>
    </form>
  )
}
