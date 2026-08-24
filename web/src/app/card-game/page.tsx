import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowRight, Mic, Users, Layers } from 'lucide-react'
import PageChrome, { Eyebrow } from '@/components/card-game/PageChrome'
import { DECKS } from '@/lib/card-game/deck'

export const metadata: Metadata = {
  title: 'Card Games, Argo',
  description:
    'Prompt decks for small groups. Turn over a card, answer out loud, and leave the answer behind. Every game is public and every answer is attributed.',
  openGraph: {
    title: 'Card Games, Argo',
    description:
      'Prompt decks for small groups. Turn over a card, answer out loud, and leave the answer behind.',
  },
}

const STEPS = [
  {
    icon: Users,
    title: 'Sit down, three to seven of you',
    body: 'One person creates a game and shares the code or the QR. Everyone else joins on their own phone. All the screens stay in sync, so the card that turns over turns over for everyone.',
  },
  {
    icon: Layers,
    title: 'Turn a card, answer out loud',
    body: 'The card says who is asking whom. Answer it properly, two or three minutes, the way you would tell it to a friend. Then everyone else gets one follow-up.',
  },
  {
    icon: Mic,
    title: 'Record it before you move on',
    body: 'Tap record and say it again for the archive. We transcribe it and attach it to your name. The next table to play this deck can hear what you said.',
  },
]

export default function CardGameLanding() {
  return (
    <PageChrome>
      {/* Hero */}
      <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
        <div className="wrap" style={{ padding: '76px 0 60px' }}>
          <div style={{ maxWidth: 720 }}>
            <Eyebrow>Play together</Eyebrow>
            <h1
              className="serif"
              style={{
                fontSize: 'clamp(38px, 6vw, 58px)',
                fontWeight: 600,
                letterSpacing: '-0.03em',
                lineHeight: 1.05,
                marginTop: 20,
                color: 'var(--text)',
              }}
            >
              Card games for people who would rather ask a real question.
            </h1>
            <p style={{ fontSize: 19, lineHeight: 1.6, color: 'var(--text2)', marginTop: 22 }}>
              A deck of prompts, a small table, and a record button. You turn over a card, answer it
              out loud, and the answer stays behind with your name on it. Every game is public, so a
              table that sits down next month can hear what your table said tonight.
            </p>
          </div>
        </div>
      </section>

      {/* Decks */}
      <section className="wrap" style={{ padding: '64px 0 16px' }}>
        <h2
          className="serif"
          style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--text)' }}
        >
          The decks
        </h2>
        <div
          style={{
            display: 'grid',
            gap: 20,
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 400px))',
            marginTop: 28,
          }}
        >
          {DECKS.map((deck) => (
            <Link
              key={deck.slug}
              href={`/card-game/${deck.slug}`}
              className="card"
              style={{
                display: 'block',
                padding: 0,
                overflow: 'hidden',
                borderRadius: 'var(--r-card)',
                background: 'var(--surface)',
                border: '1px solid var(--hairline)',
                boxShadow: 'var(--shadow)',
              }}
            >
              {/* Deck face: the ink table language, previewed. */}
              <div
                style={{
                  position: 'relative',
                  background:
                    'radial-gradient(90% 120% at 50% 0%, #241E16 0%, #16130E 70%)',
                  padding: '38px 28px 34px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 20,
                }}
              >
                <span
                  style={{
                    width: 62,
                    height: 86,
                    borderRadius: 10,
                    border: '1px solid rgba(242,203,76,0.28)',
                    background: 'linear-gradient(160deg, #221C14, #14110C)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 10px 26px rgba(0,0,0,0.45)',
                  }}
                >
                  <Image src="/logo.png" width={30} height={30} alt="" style={{ borderRadius: 9 }} />
                </span>
                <span
                  className="serif"
                  style={{ fontSize: 13, letterSpacing: '0.14em', textTransform: 'uppercase', color: '#B98A1E' }}
                >
                  {deck.cards.length} cards
                </span>
              </div>

              <div style={{ padding: '24px 26px 28px' }}>
                <h3
                  className="serif"
                  style={{ fontSize: 23, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)' }}
                >
                  {deck.title}
                </h3>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text2)', marginTop: 10 }}>
                  {deck.tagline}
                </p>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    marginTop: 18,
                    fontSize: 14.5,
                    fontWeight: 600,
                    color: 'var(--accentDeep)',
                  }}
                >
                  Open the deck <ArrowRight size={16} />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* How a table works */}
      <section className="wrap" style={{ padding: '54px 0 84px' }}>
        <h2
          className="serif"
          style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--text)' }}
        >
          How a table works
        </h2>
        <div
          style={{
            display: 'grid',
            gap: 30,
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            marginTop: 30,
          }}
        >
          {STEPS.map(({ icon: Icon, title, body }, i) => (
            <div key={title}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 11,
                    background: 'var(--accentSoft)',
                    color: 'var(--accentDeep)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon size={17} />
                </span>
                <span
                  className="serif"
                  style={{ fontSize: 13, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text3)' }}
                >
                  Step {i + 1}
                </span>
              </div>
              <h3
                className="serif"
                style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)', marginTop: 14 }}
              >
                {title}
              </h3>
              <p style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--text2)', marginTop: 8 }}>{body}</p>
            </div>
          ))}
        </div>

        <p
          style={{
            marginTop: 40,
            paddingTop: 24,
            borderTop: '1px solid var(--hairline)',
            fontSize: 14.5,
            lineHeight: 1.65,
            color: 'var(--text3)',
            maxWidth: 700,
          }}
        >
          A note on privacy, because Argo is otherwise built the other way around. Your journal is
          encrypted and only you hold the key. The card games are the opposite on purpose: the games,
          the recordings, and the transcripts are public and carry your name. Say that out loud
          before the first card, and record only what you are happy for anyone to hear.
        </p>
      </section>
    </PageChrome>
  )
}
