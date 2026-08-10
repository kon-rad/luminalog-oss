'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useCourseBadge, basescanBadgeUrl, type CourseBadge } from '@/lib/useCourseBadge'

// Next.js 14: a client page receives `params` as a plain prop object.
export default function BadgeClaimPage({ params }: { params: { classId: string } }) {
  const { classId } = params
  const { user, signInWithGoogle, signInWithApple } = useAuth()
  const { data, loading, error, reload, submit, mint } = useCourseBadge(classId)

  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)
  const [minted, setMinted] = useState<CourseBadge | null>(null)
  const [flowError, setFlowError] = useState<string | null>(null)

  const existingBadge = data?.participation?.badge?.tokenId ? data.participation.badge : null
  const badge = minted ?? existingBadge

  const quiz = data?.class.quiz ?? []
  const allAnswered = useMemo(
    () => quiz.length > 0 && quiz.every(q => (answers[q.id] ?? '').trim() !== ''),
    [quiz, answers],
  )

  if (!user) {
    return (
      <main style={{ maxWidth: 560, margin: '0 auto', padding: 24 }}>
        <h1>Claim your Argo Course Badge</h1>
        <p>Sign in to answer a couple of questions and mint your proof of participation.</p>
        <button onClick={() => void signInWithGoogle()}>Sign in with Google</button>
        <button onClick={() => void signInWithApple()} style={{ marginLeft: 12 }}>
          Sign in with Apple
        </button>
      </main>
    )
  }

  if (loading) return <main style={{ padding: 24 }}>Loading…</main>
  if (error || !data)
    return (
      <main style={{ padding: 24 }}>
        Could not load this class. <button onClick={() => void reload()}>Retry</button>
      </main>
    )

  const c = data.class

  if (badge) {
    return (
      <main style={{ maxWidth: 560, margin: '0 auto', padding: 24, textAlign: 'center' }}>
        <h1>Badge minted 🎉</h1>
        {/* eslint-disable-next-line @next/next/no-img-element -- Luma host is not in next.config images.domains */}
        {c.imageUrl ? (
          <img
            src={c.imageUrl}
            alt={c.name}
            style={{ borderRadius: 16, maxWidth: '100%', height: 'auto' }}
          />
        ) : null}
        <p>
          {c.name}, {c.date}
        </p>
        {badge.contract ? (
          <p>
            <a href={basescanBadgeUrl(badge)} target="_blank" rel="noreferrer">
              View on BaseScan
            </a>
          </p>
        ) : null}
      </main>
    )
  }

  if (!c.active)
    return (
      <main style={{ padding: 24 }}>
        <h1>{c.name}</h1>
        <p>Badge claiming for this class is closed.</p>
      </main>
    )

  async function onMint() {
    setBusy(true)
    setFlowError(null)
    try {
      await submit(answers)
      const b = await mint()
      setMinted(b)
    } catch (e: any) {
      setFlowError(e?.message ?? 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main style={{ maxWidth: 560, margin: '0 auto', padding: 24 }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- Luma host is not in next.config images.domains */}
      {c.imageUrl ? (
        <img
          src={c.imageUrl}
          alt={c.name}
          style={{ borderRadius: 16, maxWidth: '100%', height: 'auto' }}
        />
      ) : null}
      <h1>{c.name}</h1>
      <p>{[c.module, c.date, c.time, c.location].filter(Boolean).join(' · ')}</p>

      <form
        onSubmit={e => {
          e.preventDefault()
          void onMint()
        }}
      >
        {quiz.map(q => (
          <fieldset key={q.id} style={{ margin: '16px 0', border: 'none', padding: 0 }}>
            <legend style={{ fontWeight: 600 }}>{q.prompt}</legend>
            {q.type === 'mc' ? (
              (q.options ?? []).map(opt => (
                <label key={opt} style={{ display: 'block', margin: '4px 0' }}>
                  <input
                    type="radio"
                    name={q.id}
                    value={opt}
                    checked={answers[q.id] === opt}
                    onChange={() => setAnswers(a => ({ ...a, [q.id]: opt }))}
                  />{' '}
                  {opt}
                </label>
              ))
            ) : (
              <textarea
                rows={3}
                style={{ width: '100%' }}
                value={answers[q.id] ?? ''}
                onChange={e => setAnswers(a => ({ ...a, [q.id]: e.target.value }))}
              />
            )}
          </fieldset>
        ))}

        {flowError ? <p style={{ color: 'crimson' }}>{flowError}</p> : null}
        <button type="submit" disabled={!allAnswered || busy}>
          {busy ? 'Minting…' : 'Mint badge'}
        </button>
      </form>
    </main>
  )
}
