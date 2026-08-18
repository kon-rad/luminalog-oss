'use client'

import Image from 'next/image'
import styles from './cardGame.module.css'
import { THEME_LABELS, type Card, type Deck } from '@/lib/card-game/deck'

/* One card on the table. Face down it is the ink plate with the Argo emblem;
 * tapping it turns it over in 3D to the question. Under prefers-reduced-motion
 * the rotation becomes a crossfade (see the module CSS). */
export default function FlipCard({
  card,
  deck,
  revealed,
  discarding,
  onFlip,
  interactive,
}: {
  card: Card
  deck: Deck
  revealed: boolean
  discarding: boolean
  onFlip: () => void
  interactive: boolean
}) {
  const direction = deck.directions[card.direction]

  return (
    <div className={styles.scene}>
      <button
        type="button"
        // Keyed on the card id so every newly dealt card replays the deal-in.
        key={card.id}
        onClick={interactive && !revealed ? onFlip : undefined}
        disabled={!interactive || revealed}
        aria-label={revealed ? card.prompt : 'Turn over the card'}
        className={[
          styles.card,
          revealed ? styles.revealed : '',
          discarding ? styles.discarding : styles.dealing,
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* Back */}
        <span className={`${styles.face} ${styles.back}`}>
          <span className={styles.backFrame} aria-hidden />
          <Image src="/argo-emblem-alpha.png" width={112} height={140} alt="" priority />
          {interactive && (
            <span
              style={{
                position: 'absolute',
                bottom: 28,
                fontSize: 11.5,
                fontWeight: 700,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
                color: 'rgba(242,203,76,0.55)',
              }}
            >
              Tap to turn
            </span>
          )}
        </span>

        {/* Front */}
        <span className={`${styles.face} ${styles.front}`}>
          <span style={{ textAlign: 'left' }}>
            <span
              style={{
                display: 'block',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
                color: '#B96B33',
              }}
            >
              {direction.label}
            </span>
          </span>

          <span
            className="serif"
            style={{
              display: 'block',
              textAlign: 'left',
              fontSize: 'clamp(19px, 2.4vw, 24px)',
              lineHeight: 1.28,
              letterSpacing: '-0.02em',
              color: '#2B2722',
              textWrap: 'balance',
            }}
          >
            {card.prompt}
          </span>

          <span
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
              paddingTop: 14,
              borderTop: '1px solid rgba(60,50,40,0.10)',
              fontSize: 11.5,
              letterSpacing: '0.1em',
              textTransform: 'uppercase',
              color: '#A89F92',
            }}
          >
            <span>{THEME_LABELS[card.theme]}</span>
            <span>{card.id}</span>
          </span>
        </span>
      </button>
    </div>
  )
}
