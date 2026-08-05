'use client'

import { useState } from 'react'
import { Check, X, HelpCircle, Cloud, CloudOff } from 'lucide-react'
import { auth } from '@/lib/firebase'
import { useAuth } from '@/lib/auth-context'
import { saveQuizAttempt, type QuizMCQ } from '@/lib/firestore/quizAttempts'

const LETTERS = ['A', 'B', 'C', 'D']

type SaveState = 'idle' | 'saving' | 'saved' | 'error'

interface CourseQuizProps {
  /** Stable id for the quiz, e.g. 'module-1' or 'kids-stem'. */
  quizId: string
  /** Human label shown in the saved-quiz history, e.g. 'AI Power Users · Module 1'. */
  quizTitle: string
  mcq: QuizMCQ[]
  openQuestions: string[]
  /** Label for the check/submit button. */
  submitLabel?: string
}

/**
 * Shared course knowledge check: multiple-choice questions the visitor can
 * answer and check, plus short-answer boxes. Anyone can take it and see their
 * score; results are only PERSISTED when the visitor signs in (each submit is a
 * new attempt, so the quiz can be retaken and the history is kept — shown on
 * /dashboard). Used by both the AI Power Users and Kids STEM courses.
 */
export default function CourseQuiz({
  quizId,
  quizTitle,
  mcq,
  openQuestions,
  submitLabel = 'Check answers',
}: CourseQuizProps) {
  const { user, signInWithGoogle } = useAuth()

  const [selected, setSelected] = useState<Record<number, number>>({})
  const [openAnswers, setOpenAnswers] = useState<Record<number, string>>({})
  const [checked, setChecked] = useState(false)
  const [saveState, setSaveState] = useState<SaveState>('idle')
  const [saveError, setSaveError] = useState<string | null>(null)

  const answeredCount = Object.keys(selected).length
  const score = mcq.reduce((acc, q, i) => (selected[i] === q.answer ? acc + 1 : acc), 0)

  async function handleSave() {
    setSaveState('saving')
    setSaveError(null)
    try {
      let uid = user?.uid
      if (!uid) {
        await signInWithGoogle()
        uid = auth.currentUser?.uid
      }
      if (!uid) {
        // Sign-in was dismissed — nothing saved.
        setSaveState('idle')
        return
      }
      await saveQuizAttempt(uid, { quizId, quizTitle, mcq, selected, openQuestions, openAnswers })
      setSaveState('saved')
    } catch (e) {
      setSaveState('error')
      setSaveError(e instanceof Error ? e.message : 'Could not save your results.')
    }
  }

  function handleReset() {
    setChecked(false)
    setSelected({})
    setOpenAnswers({})
    setSaveState('idle')
    setSaveError(null)
  }

  return (
    <div className="flex flex-col" style={{ gap: 44 }}>
      {/* Multiple choice */}
      <div className="flex flex-col" style={{ gap: 22 }}>
        {mcq.map((q, qi) => (
          <div key={q.question} className="card" style={{ padding: '24px 26px' }}>
            <p style={{ fontSize: 16.5, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
              <span style={{ color: 'var(--accent)', marginRight: 8 }}>{qi + 1}.</span>
              {q.question}
            </p>
            <div className="flex flex-col gap-2">
              {q.options.map((opt, oi) => {
                const isSelected = selected[qi] === oi
                const isCorrect = q.answer === oi
                const showCorrect = checked && isCorrect
                const showWrong = checked && isSelected && !isCorrect

                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => !checked && setSelected((s) => ({ ...s, [qi]: oi }))}
                    disabled={checked}
                    className="w-full text-left flex items-start gap-3 transition-colors"
                    style={{
                      fontSize: 15,
                      lineHeight: 1.5,
                      padding: '12px 16px',
                      borderRadius: 'var(--r-btn)',
                      color: 'var(--text)',
                      background: showCorrect
                        ? 'rgba(125,191,114,0.12)'
                        : showWrong
                          ? 'rgba(229,84,75,0.10)'
                          : isSelected
                            ? 'var(--accentTint)'
                            : 'transparent',
                      border: `1px solid ${
                        showCorrect
                          ? 'var(--dim-art)'
                          : showWrong
                            ? 'var(--danger)'
                            : isSelected
                              ? 'var(--accent)'
                              : 'var(--hairline2)'
                      }`,
                      cursor: checked ? 'default' : 'pointer',
                    }}
                  >
                    <span style={{ flexShrink: 0, fontWeight: 700, color: 'var(--text3)' }}>{LETTERS[oi]}</span>
                    <span style={{ flex: 1 }}>{opt}</span>
                    {showCorrect && <Check style={{ width: 16, height: 16, color: 'var(--dim-art)', flexShrink: 0 }} />}
                    {showWrong && <X style={{ width: 16, height: 16, color: 'var(--danger)', flexShrink: 0 }} />}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Open-ended */}
      <div>
        <div className="flex items-center gap-2" style={{ marginBottom: 10 }}>
          <HelpCircle style={{ width: 18, height: 18, color: 'var(--accent)' }} />
          <h3 className="serif" style={{ fontSize: 21, fontWeight: 600, color: 'var(--text)' }}>
            Explain in your own words
          </h3>
        </div>
        <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--text2)', marginBottom: 26 }}>
          Answer these in your own words. Explaining a concept is the best test that you understand
          it.{' '}
          {user
            ? 'Because you are signed in, your results are saved to your account when you save.'
            : 'You can check your results now; sign in when you save to keep them in your account.'}
        </p>
        <ol className="flex flex-col" style={{ gap: 24 }}>
          {openQuestions.map((q, i) => (
            <li key={q}>
              <label style={{ display: 'block', fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
                <span style={{ color: 'var(--accent)', marginRight: 8 }}>{i + 1}.</span>
                {q}
              </label>
              <textarea
                rows={3}
                value={openAnswers[i] ?? ''}
                onChange={(e) => setOpenAnswers((a) => ({ ...a, [i]: e.target.value }))}
                placeholder="Your answer…"
                className="w-full"
                style={{
                  fontSize: 15,
                  lineHeight: 1.55,
                  padding: '12px 16px',
                  borderRadius: 'var(--r-btn)',
                  border: '1px solid var(--hairline2)',
                  background: 'var(--surface)',
                  color: 'var(--text)',
                  resize: 'vertical',
                }}
              />
            </li>
          ))}
        </ol>
      </div>

      {/* Submit / results / save */}
      <div className="flex flex-col" style={{ gap: 16 }}>
        <div className="flex flex-wrap items-center gap-4">
          {!checked ? (
            <button
              type="button"
              onClick={() => setChecked(true)}
              disabled={answeredCount < mcq.length}
              className="btn-amber"
              style={{
                opacity: answeredCount < mcq.length ? 0.45 : 1,
                cursor: answeredCount < mcq.length ? 'not-allowed' : 'pointer',
              }}
            >
              {submitLabel}
            </button>
          ) : (
            <>
              <span className="serif" style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)' }}>
                You scored {score} / {mcq.length}
              </span>
              {saveState !== 'saved' && (
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={saveState === 'saving'}
                  className="btn-amber"
                  style={{ opacity: saveState === 'saving' ? 0.6 : 1 }}
                >
                  {saveState === 'saving' ? 'Saving…' : 'Save my results'}
                </button>
              )}
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-2 rounded-btn"
                style={{
                  height: 44,
                  padding: '0 20px',
                  fontSize: 15,
                  fontWeight: 600,
                  color: 'var(--text)',
                  border: '1px solid var(--hairline2)',
                  background: 'var(--surface)',
                }}
              >
                Try again
              </button>
            </>
          )}
          {!checked && answeredCount < mcq.length && (
            <span style={{ fontSize: 14.5, color: 'var(--text2)' }}>
              Answer all {mcq.length} to check.
            </span>
          )}
        </div>

        {/* Save status */}
        {checked && (
          <div
            className="flex flex-wrap items-center gap-2"
            style={{
              fontSize: 14.5,
              color: 'var(--text2)',
              background: 'var(--surfaceAlt)',
              border: '1px solid var(--hairline)',
              borderRadius: 'var(--r-btn)',
              padding: '12px 16px',
            }}
          >
            {saveState === 'saved' ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                <Cloud style={{ width: 16, height: 16, color: 'var(--accent)' }} />
                Saved to your account. See all your quizzes on your{' '}
                <a href="/dashboard" style={{ color: 'var(--accentDeep)', fontWeight: 600 }}>
                  dashboard
                </a>
                .
              </span>
            ) : saveState === 'error' ? (
              <span className="inline-flex flex-wrap items-center gap-2">
                <CloudOff style={{ width: 16, height: 16, color: 'var(--danger)' }} />
                Could not save{saveError ? `: ${saveError}` : '.'}{' '}
                <button type="button" onClick={() => void handleSave()} style={{ color: 'var(--accentDeep)', fontWeight: 600 }}>
                  Retry
                </button>
              </span>
            ) : (
              <span className="inline-flex flex-wrap items-center gap-2">
                <CloudOff style={{ width: 16, height: 16, color: 'var(--text3)' }} />
                {user
                  ? 'Save your results to keep this attempt in your account.'
                  : 'Sign in when you save to keep this attempt in your account.'}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
