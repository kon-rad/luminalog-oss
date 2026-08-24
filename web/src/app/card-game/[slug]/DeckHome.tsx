'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { ArrowRight, Loader2, Mic } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { Eyebrow } from '@/components/card-game/PageChrome'
import { THEME_LABELS, type Deck } from '@/lib/card-game/deck'
import { normalizeRoomCode, type Room } from '@/lib/card-game/room'
import { createRoom, watchRooms } from '@/lib/card-game/client'

/* The deck's home: what the deck is, how to start a table, and every game
 * anyone has ever played with it. */
export default function DeckHome({ deck }: { deck: Deck }) {
  const router = useRouter()
  const { user, loading, signInWithGoogle } = useAuth()
  const [rooms, setRooms] = useState<Room[] | null>(null)
  const [creating, setCreating] = useState(false)
  const [joinCode, setJoinCode] = useState('')
  const [title, setTitle] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => watchRooms(deck.id, setRooms), [deck.id])

  // Two sample cards, one per direction, so the deck page shows what a real
  // question looks like rather than describing one.
  const samples = useMemo(
    () => [
      deck.cards.find((c) => c.direction === 'younger-to-elder'),
      deck.cards.find((c) => c.direction === 'elder-to-younger'),
    ],
    [deck.cards],
  )

  const handleCreate = async () => {
    setError(null)
    setCreating(true)
    try {
      if (!user) await signInWithGoogle()
      const code = await createRoom(deck.id, deck.cards.length, title.trim())
      router.push(`/card-game/${deck.slug}/${code}`)
    } catch (err) {
      console.error('[card-game] create failed', err)
      setError('Could not start the game. Please try again.')
      setCreating(false)
    }
  }

  const handleJoin = (e: React.FormEvent) => {
    e.preventDefault()
    const code = normalizeRoomCode(joinCode)
    if (code.length === 6) router.push(`/card-game/${deck.slug}/${code}`)
  }

  const active = rooms?.filter((r) => r.status === 'active') ?? []
  const ended = rooms?.filter((r) => r.status !== 'active') ?? []

  return (
    <>
      {/* Hero */}
      <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
        <div
          className="wrap"
          style={{
            padding: '68px 0 58px',
            display: 'grid',
            gap: 44,
            gridTemplateColumns: 'minmax(0, 1.35fr) minmax(0, 1fr)',
            alignItems: 'center',
          }}
        >
          <div>
            <Link
              href="/card-game"
              style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--text3)' }}
            >
              Card Games
            </Link>
            <h1
              className="serif"
              style={{
                fontSize: 'clamp(34px, 5vw, 50px)',
                fontWeight: 600,
                letterSpacing: '-0.03em',
                lineHeight: 1.06,
                marginTop: 14,
                color: 'var(--text)',
              }}
            >
              {deck.title}
            </h1>
            <p style={{ fontSize: 18, lineHeight: 1.65, color: 'var(--text2)', marginTop: 20 }}>
              {deck.description}
            </p>
          </div>

          {/* A small fanned stack, to show what the table looks like. */}
          <div style={{ position: 'relative', height: 250, display: 'flex', justifyContent: 'center' }}>
            {[-13, 0, 13].map((deg, i) => (
              <span
                key={deg}
                style={{
                  position: 'absolute',
                  top: 18 + Math.abs(deg) * 0.5,
                  width: 152,
                  height: 213,
                  borderRadius: 16,
                  transform: `rotate(${deg}deg) translateX(${deg * 2.4}px)`,
                  background: 'linear-gradient(160deg, #221C14, #14110C)',
                  border: '1px solid rgba(242,203,76,0.24)',
                  boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  zIndex: i === 1 ? 2 : 1,
                }}
              >
                {i === 1 && <Image src="/argo-emblem-alpha.png" width={76} height={95} alt="" />}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Start a table */}
      <section className="wrap" style={{ padding: '52px 0 0' }}>
        <div
          style={{
            display: 'grid',
            gap: 22,
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          }}
        >
          <div
            style={{
              padding: '28px 26px',
              borderRadius: 'var(--r-card)',
              background: 'var(--surface)',
              border: '1px solid var(--hairline)',
              boxShadow: 'var(--shadow)',
            }}
          >
            <Eyebrow>Host</Eyebrow>
            <h2
              className="serif"
              style={{ fontSize: 23, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)', marginTop: 14 }}
            >
              Start a new game
            </h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--text2)', marginTop: 8 }}>
              Shuffles all {deck.cards.length} cards and gives you a code to share with the table.
            </p>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Name this table (optional)"
              maxLength={60}
              style={{
                width: '100%',
                marginTop: 16,
                padding: '11px 14px',
                borderRadius: 'var(--r-btn)',
                border: '1px solid var(--hairline2)',
                background: 'var(--bgElev)',
                color: 'var(--text)',
                fontSize: 15,
              }}
            />
            <button
              onClick={handleCreate}
              disabled={creating || loading}
              className="btn-amber"
              style={{ marginTop: 12, width: '100%', justifyContent: 'center', display: 'inline-flex', alignItems: 'center', gap: 8 }}
            >
              {creating ? <Loader2 size={16} className="animate-spin" /> : null}
              {creating ? 'Shuffling…' : user ? 'Create game' : 'Sign in and create'}
            </button>
            {error && (
              <p style={{ marginTop: 10, fontSize: 13.5, color: 'var(--danger)' }}>{error}</p>
            )}
          </div>

          <div
            style={{
              padding: '28px 26px',
              borderRadius: 'var(--r-card)',
              background: 'var(--surface)',
              border: '1px solid var(--hairline)',
              boxShadow: 'var(--shadow)',
            }}
          >
            <Eyebrow>Join</Eyebrow>
            <h2
              className="serif"
              style={{ fontSize: 23, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)', marginTop: 14 }}
            >
              Join a game
            </h2>
            <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--text2)', marginTop: 8 }}>
              Type the six-character code from the host. You do not need an account to join and turn
              cards, only to record an answer.
            </p>
            <form onSubmit={handleJoin} style={{ marginTop: 16, display: 'flex', gap: 10 }}>
              <input
                value={joinCode}
                onChange={(e) => setJoinCode(normalizeRoomCode(e.target.value))}
                placeholder="ABC234"
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: '11px 14px',
                  borderRadius: 'var(--r-btn)',
                  border: '1px solid var(--hairline2)',
                  background: 'var(--bgElev)',
                  color: 'var(--text)',
                  fontSize: 18,
                  fontWeight: 700,
                  letterSpacing: '0.22em',
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                }}
              />
              <button type="submit" disabled={joinCode.length !== 6} className="btn-ghost">
                Join
              </button>
            </form>
          </div>
        </div>
      </section>

      {/* The two directions, with a real card each */}
      <section className="wrap" style={{ padding: '56px 0 0' }}>
        <h2
          className="serif"
          style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--text)' }}
        >
          Questions run both ways
        </h2>
        <div
          style={{
            display: 'grid',
            gap: 22,
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            marginTop: 24,
          }}
        >
          {samples.map((card) =>
            card ? (
              <div
                key={card.id}
                style={{
                  padding: '26px 26px 28px',
                  borderRadius: 'var(--r-card)',
                  background: 'var(--bgElev)',
                  border: '1px solid var(--hairline)',
                }}
              >
                <span
                  className="serif"
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'var(--accentDeep)',
                  }}
                >
                  {deck.directions[card.direction].label}
                </span>
                <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--text2)', marginTop: 10 }}>
                  {deck.directions[card.direction].blurb}
                </p>
                <p
                  className="serif"
                  style={{
                    fontSize: 20,
                    lineHeight: 1.35,
                    letterSpacing: '-0.015em',
                    color: 'var(--text)',
                    marginTop: 18,
                    paddingTop: 18,
                    borderTop: '1px solid var(--hairline)',
                  }}
                >
                  “{card.prompt}”
                </p>
                <span style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 12, display: 'block' }}>
                  {THEME_LABELS[card.theme]}
                </span>
              </div>
            ) : null,
          )}
        </div>
      </section>

      {/* Every table ever played */}
      <section className="wrap" style={{ padding: '56px 0 84px' }}>
        <h2
          className="serif"
          style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--text)' }}
        >
          Tables
        </h2>

        {rooms === null ? (
          <p style={{ fontSize: 15, color: 'var(--text3)', marginTop: 18 }}>Loading games…</p>
        ) : rooms.length === 0 ? (
          <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text2)', marginTop: 18, maxWidth: 620 }}>
            Nobody has played this deck yet. Start the first game and it will show up here, along with
            every answer your table records.
          </p>
        ) : (
          <>
            {active.length > 0 && <RoomGroup label="In play" rooms={active} slug={deck.slug} live />}
            {ended.length > 0 && <RoomGroup label="Finished" rooms={ended} slug={deck.slug} />}
          </>
        )}
      </section>
    </>
  )
}

function RoomGroup({
  label,
  rooms,
  slug,
  live = false,
}: {
  label: string
  rooms: Room[]
  slug: string
  live?: boolean
}) {
  return (
    <div style={{ marginTop: 26 }}>
      <h3
        className="serif"
        style={{
          fontSize: 12.5,
          fontWeight: 700,
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          color: 'var(--text3)',
        }}
      >
        {label}
      </h3>
      <div style={{ marginTop: 12, borderTop: '1px solid var(--hairline)' }}>
        {rooms.map((room) => (
          <Link
            key={room.code}
            href={`/card-game/${slug}/${room.code}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 16,
              padding: '16px 4px',
              borderBottom: '1px solid var(--hairline)',
            }}
          >
            <span
              style={{
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: '0.14em',
                color: 'var(--text)',
                flexShrink: 0,
              }}
            >
              {room.code}
            </span>
            {live && (
              <span
                aria-hidden
                style={{ width: 7, height: 7, borderRadius: '50%', background: '#4CAF7D', flexShrink: 0 }}
              />
            )}
            <span style={{ flex: 1, minWidth: 0, fontSize: 15, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {room.title || room.players.map((p) => p.name).join(', ') || `Hosted by ${room.hostName}`}
            </span>
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                fontSize: 13.5,
                color: 'var(--text3)',
                flexShrink: 0,
              }}
            >
              <Mic size={13} />
              {room.answerCount}
            </span>
            <ArrowRight size={15} style={{ color: 'var(--text3)', flexShrink: 0 }} />
          </Link>
        ))}
      </div>
    </div>
  )
}
