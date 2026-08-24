'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Check, Link2, RotateCcw, XCircle } from 'lucide-react'
import styles from '@/components/card-game/cardGame.module.css'
import FlipCard from '@/components/card-game/FlipCard'
import AnswerRecorder from '@/components/card-game/AnswerRecorder'
import AnswerList from '@/components/card-game/AnswerList'
import { useAuth } from '@/lib/auth-context'
import type { Deck } from '@/lib/card-game/deck'
import { currentCard, isExhausted, type Answer, type Room } from '@/lib/card-game/room'
import {
  endRoom,
  flipCard,
  joinRoom,
  nextCard,
  restartRoom,
  watchAnswers,
  watchRoom,
} from '@/lib/card-game/client'

/** How long the discard animation runs before the next card is dealt. Kept in
 *  step with the .discarding keyframes in the module CSS. */
const DISCARD_MS = 420

export default function RoomTable({ deck, code }: { deck: Deck; code: string }) {
  const { user, loading } = useAuth()
  const [room, setRoom] = useState<Room | null | undefined>(undefined)
  const [answers, setAnswers] = useState<Answer[]>([])
  const [discarding, setDiscarding] = useState(false)
  const [copied, setCopied] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const joinedRef = useRef(false)

  useEffect(() => watchRoom(code, setRoom), [code])
  useEffect(() => watchAnswers(code, setAnswers), [code])

  // Take a seat once, after auth settles so a signed-in person is seated under
  // their real name rather than as a guest.
  useEffect(() => {
    if (loading || joinedRef.current || !room || room.status !== 'active') return
    joinedRef.current = true
    joinRoom(code, room, {
      uid: user?.uid ?? null,
      name: user?.displayName || user?.email?.split('@')[0] || 'Guest at the table',
      photoURL: user?.photoURL ?? null,
    }).catch((err) => console.error('[card-game] join failed', err))
  }, [code, room, user, loading])

  const handleNext = useCallback(async () => {
    if (!room) return
    setDiscarding(true)
    setTimeout(async () => {
      await nextCard(code, room).catch((err) => console.error('[card-game] next card failed', err))
      setDiscarding(false)
    }, DISCARD_MS)
  }, [code, room])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard permission denied. The code is on screen to read out anyway.
    }
  }

  if (room === undefined) {
    return <Shell><p style={muted}>Finding the table…</p></Shell>
  }

  if (room === null) {
    return (
      <Shell>
        <h1 className="serif" style={{ fontSize: 30, fontWeight: 600, color: '#F3EEE4' }}>
          No game with that code
        </h1>
        <p style={{ ...muted, marginTop: 12 }}>
          Check the six characters with whoever is hosting, or start a game of your own.
        </p>
        <Link href={`/card-game/${deck.slug}`} style={{ ...ghostButton, marginTop: 22 }}>
          Back to the deck
        </Link>
      </Shell>
    )
  }

  const card = currentCard(room, deck)
  const exhausted = isExhausted(room)
  const live = room.status === 'active'
  const cardAnswers = card ? answers.filter((a) => a.cardId === card.id) : []

  return (
    <section className={styles.table} style={{ minHeight: '100vh' }}>
      <div className={styles.tableInner}>
        {/* Header */}
        <div
          className="wrap"
          style={{
            paddingTop: 26,
            paddingBottom: 22,
            display: 'flex',
            alignItems: 'center',
            gap: 16,
            flexWrap: 'wrap',
            borderBottom: '1px solid rgba(255,240,220,0.08)',
          }}
        >
          <Link href={`/card-game/${deck.slug}`} style={{ fontSize: 13.5, color: 'rgba(243,238,228,0.5)' }}>
            {deck.title}
          </Link>

          <span style={{ flex: 1 }} />

          <button onClick={handleCopy} style={{ ...ghostButton, gap: 7 }}>
            {copied ? <Check size={14} /> : <Link2 size={14} />}
            <span
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                letterSpacing: '0.18em',
                fontWeight: 700,
              }}
            >
              {room.code}
            </span>
          </button>

          {live && (
            <>
              <button
                onClick={() => restartRoom(code, deck.cards.length)}
                style={{ ...ghostButton, gap: 7 }}
              >
                <RotateCcw size={14} />
                Restart
              </button>
              <button
                onClick={() => (confirmEnd ? endRoom(code) : setConfirmEnd(true))}
                onBlur={() => setConfirmEnd(false)}
                style={{ ...ghostButton, gap: 7, color: confirmEnd ? '#F0655C' : undefined }}
              >
                <XCircle size={14} />
                {confirmEnd ? 'Tap again to end' : 'End game'}
              </button>
            </>
          )}
        </div>

        {/* Players */}
        {room.players.length > 0 && (
          <div
            className="wrap"
            style={{ paddingTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}
          >
            {room.players.map((p, i) => (
              <span
                key={`${p.uid ?? 'guest'}-${p.name}-${i}`}
                style={{
                  fontSize: 12.5,
                  padding: '5px 11px',
                  borderRadius: 999,
                  background: 'rgba(255,240,220,0.06)',
                  border: '1px solid rgba(255,240,220,0.1)',
                  color: 'rgba(243,238,228,0.7)',
                }}
              >
                {p.name}
              </span>
            ))}
          </div>
        )}

        {/* The card */}
        <div className="wrap" style={{ paddingTop: 40, paddingBottom: 30 }}>
          {!live && (
            <p style={{ ...muted, textAlign: 'center', marginBottom: 26 }}>
              This game has ended. Everything the table recorded is below.
            </p>
          )}

          {card ? (
            <FlipCard
              card={card}
              deck={deck}
              revealed={room.revealed}
              discarding={discarding}
              onFlip={() => flipCard(code)}
              interactive={live}
            />
          ) : (
            <EmptyTable
              exhausted={exhausted}
              live={live}
              onDeal={() => nextCard(code, room)}
              onRestart={() => restartRoom(code, deck.cards.length)}
            />
          )}

          {/* Pile counter */}
          {room.drawn > 0 && (
            <p
              style={{
                textAlign: 'center',
                marginTop: 22,
                fontSize: 12,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'rgba(243,238,228,0.34)',
              }}
            >
              Card {room.drawn} of {room.order.length}
            </p>
          )}

          {/* Turn controls */}
          {live && card && room.revealed && (
            <div style={{ marginTop: 30, display: 'flex', flexDirection: 'column', gap: 26, alignItems: 'center' }}>
              <AnswerRecorder
                code={code}
                card={card}
                cardIndex={room.order[room.drawn - 1]}
                onSaved={() => undefined}
              />
              <button onClick={handleNext} disabled={exhausted || discarding} style={ghostButton}>
                {exhausted ? 'That was the last card' : 'Next card'}
              </button>
            </div>
          )}
        </div>

        {/* Answers for this card */}
        {cardAnswers.length > 0 && (
          <div className="wrap" style={{ paddingBottom: 46, maxWidth: 720 }}>
            <h2
              className="serif"
              style={{
                fontSize: 12.5,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: 'rgba(243,238,228,0.4)',
                marginBottom: 16,
              }}
            >
              Answers to this card
            </h2>
            <AnswerList answers={cardAnswers} />
          </div>
        )}

        {/* Everything else the table has recorded */}
        {answers.length > cardAnswers.length && (
          <div
            className="wrap"
            style={{ paddingTop: 34, paddingBottom: 80, borderTop: '1px solid rgba(255,240,220,0.08)' }}
          >
            <h2
              className="serif"
              style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.02em', color: '#F3EEE4' }}
            >
              Earlier at this table
            </h2>
            <div style={{ marginTop: 22, display: 'flex', flexDirection: 'column', gap: 30, maxWidth: 720 }}>
              {answers
                .filter((a) => !card || a.cardId !== card.id)
                .slice()
                .reverse()
                .map((answer) => (
                  <div key={answer.id}>
                    <p
                      className="serif"
                      style={{
                        fontSize: 17,
                        lineHeight: 1.4,
                        letterSpacing: '-0.015em',
                        color: 'rgba(242,203,76,0.8)',
                        marginBottom: 12,
                      }}
                    >
                      {answer.prompt}
                    </p>
                    <AnswerList answers={[answer]} />
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function EmptyTable({
  exhausted,
  live,
  onDeal,
  onRestart,
}: {
  exhausted: boolean
  live: boolean
  onDeal: () => void
  onRestart: () => void
}) {
  return (
    <div style={{ textAlign: 'center', padding: '50px 0' }}>
      <p className="serif" style={{ fontSize: 24, letterSpacing: '-0.02em', color: '#F3EEE4' }}>
        {exhausted ? 'The deck is spent.' : 'The deck is shuffled and face down.'}
      </p>
      <p style={{ ...muted, marginTop: 10, maxWidth: 440, marginInline: 'auto' }}>
        {exhausted
          ? 'Every card has been turned. Shuffle to go again.'
          : 'Whoever is ready deals the first card. Everyone at the table sees it at the same moment.'}
      </p>
      {live && (
        <button onClick={exhausted ? onRestart : onDeal} style={{ ...goldButton, marginTop: 24 }}>
          {exhausted ? 'Shuffle and play again' : 'Deal the first card'}
        </button>
      )}
    </div>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className={styles.table} style={{ minHeight: '100vh' }}>
      <div className={`${styles.tableInner} wrap`} style={{ paddingTop: 120, textAlign: 'center' }}>
        {children}
      </div>
    </section>
  )
}

const muted: React.CSSProperties = { fontSize: 15, lineHeight: 1.6, color: 'rgba(243,238,228,0.55)' }

const ghostButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '9px 16px',
  borderRadius: 12,
  border: '1px solid rgba(255,240,220,0.16)',
  background: 'rgba(255,240,220,0.04)',
  color: '#F3EEE4',
  fontSize: 13.5,
  fontWeight: 600,
}

const goldButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '12px 24px',
  borderRadius: 14,
  border: '1px solid rgba(242,203,76,0.45)',
  background: 'linear-gradient(180deg, #F2CB4C, #D9A72E)',
  color: '#16130E',
  fontSize: 15,
  fontWeight: 700,
}
