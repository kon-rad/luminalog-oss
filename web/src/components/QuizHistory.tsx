'use client'

// "Your quizzes" — the signed-in user's saved course quiz attempts, newest
// first, each row expandable to show per-question MCQ correctness and the full
// short-answer text. Rendered on /dashboard. Reads are owner-scoped by uid.
import { useState } from 'react'
import { Check, X, ChevronDown, ChevronRight } from 'lucide-react'
import { useQuizAttempts } from '@/lib/useQuizAttempts'

function fmtDate(d: Date | null): string {
  if (!d) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

const cardStyle: React.CSSProperties = {
  marginTop: 24,
  background: 'var(--surface)',
  border: '1px solid var(--hairline)',
  borderRadius: 24,
  padding: '28px 32px',
  boxShadow: 'var(--shadow)',
}

export default function QuizHistory() {
  const { attempts, loading, error } = useQuizAttempts()
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const toggle = (id: string) => setExpanded((e) => ({ ...e, [id]: !e[id] }))

  return (
    <section style={cardStyle}>
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: 'var(--text3)',
          marginBottom: 16,
        }}
      >
        ✎ Your quizzes
      </div>

      {loading ? (
        <p style={{ fontSize: 14, color: 'var(--text3)' }}>Loading your quizzes…</p>
      ) : error ? (
        <p style={{ fontSize: 14, color: 'var(--text3)' }}>Couldn&apos;t load your quizzes right now.</p>
      ) : attempts.length === 0 ? (
        <p className="serif" style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--text2)', fontStyle: 'italic' }}>
          You haven&apos;t saved any quiz results yet. Take a course knowledge check and save it to
          see your attempts here.
        </p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {attempts.map((a) => {
            const isOpen = !!expanded[a.id]
            return (
              <div
                key={a.id}
                style={{ border: '1px solid var(--hairline)', borderRadius: 14, overflow: 'hidden', background: 'var(--bg)' }}
              >
                <button
                  type="button"
                  onClick={() => toggle(a.id)}
                  className="w-full text-left flex items-center gap-3"
                  style={{ padding: '14px 16px', background: 'transparent', cursor: 'pointer' }}
                  aria-expanded={isOpen}
                >
                  {isOpen ? (
                    <ChevronDown style={{ width: 16, height: 16, color: 'var(--text3)', flexShrink: 0 }} />
                  ) : (
                    <ChevronRight style={{ width: 16, height: 16, color: 'var(--text3)', flexShrink: 0 }} />
                  )}
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontWeight: 600, color: 'var(--text)', fontSize: 15 }}>
                      {a.quizTitle}
                    </span>
                    <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>
                      {fmtDate(a.submittedAt)}
                    </span>
                  </span>
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 13,
                      fontWeight: 700,
                      color: 'var(--accentDeep)',
                      background: 'var(--accentSoft)',
                      borderRadius: 100,
                      padding: '4px 12px',
                    }}
                  >
                    {a.score} / {a.total}
                  </span>
                </button>

                {isOpen && (
                  <div style={{ padding: '4px 16px 18px 16px', borderTop: '1px solid var(--hairline)' }}>
                    {/* MCQ correctness */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, margin: '14px 0 4px' }}>
                      {a.mcqAnswers.map((m) => (
                        <span
                          key={m.questionIndex}
                          className="inline-flex items-center gap-1"
                          style={{
                            fontSize: 12.5,
                            fontWeight: 600,
                            padding: '4px 10px',
                            borderRadius: 100,
                            color: m.correct ? 'var(--dim-art)' : 'var(--danger)',
                            background: m.correct ? 'rgba(125,191,114,0.12)' : 'rgba(229,84,75,0.10)',
                          }}
                        >
                          {m.correct ? (
                            <Check style={{ width: 12, height: 12 }} />
                          ) : (
                            <X style={{ width: 12, height: 12 }} />
                          )}
                          Q{m.questionIndex + 1}
                        </span>
                      ))}
                    </div>

                    {/* Short answers */}
                    {a.shortAnswers.length > 0 && (
                      <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 14 }}>
                        {a.shortAnswers.map((s, i) => (
                          <div key={i}>
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                              {i + 1}. {s.question}
                            </div>
                            <p
                              className="serif"
                              style={{
                                fontSize: 14.5,
                                lineHeight: 1.55,
                                color: s.answer ? 'var(--text2)' : 'var(--text3)',
                                fontStyle: s.answer ? 'normal' : 'italic',
                                whiteSpace: 'pre-wrap',
                              }}
                            >
                              {s.answer || 'No answer'}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
