'use client'

import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { INK, CREAM, MUTE, ACCENT, HAIRLINE } from './theme'

const ITEMS: { glyph: ReactNode; wont: string; because: string }[] = [
  {
    glyph: (
      <>
        <circle cx="12" cy="12" r="7" />
        <path d="M6 12h12" />
      </>
    ),
    wont: 'Sell your data',
    because:
      "The architecture can't — your key never leaves your device. Our servers hold noise, not your words.",
  },
  {
    glyph: (
      <>
        <rect x="4" y="4" width="16" height="16" rx="2" />
        <path d="M8 10h8v4M12 10v4" />
      </>
    ),
    wont: 'Train on your entries',
    because:
      'Speech-to-text and handwriting recognition run on your device. AI inference is anonymised. Your writing is never training data — not ours, not anyone\u2019s.',
  },
  {
    glyph: (
      <>
        <circle cx="12" cy="9" r="5" />
        <path d="M12 14v6M13 20h7" />
        <circle cx="16" cy="14" r="1.5" />
      </>
    ),
    wont: 'Lock your history',
    because:
      'Delete everything, permanently, in one tap. Your soulbound token stays on Base \u2014 the journal is yours to keep or erase.',
  },
]

function ItemIcon({ children }: { children: ReactNode }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke={ACCENT}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export default function WontDoSection() {
  const reduce = useReducedMotion()

  return (
    <section
      id="wont-do"
      style={{ background: INK, color: CREAM, padding: '140px 0' }}
    >
      <div className="wrap" style={{ textAlign: 'center' }}>
        <motion.h2
          className="serif"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{
            fontSize: 'clamp(30px, 4.2vw, 50px)',
            fontWeight: 600,
            maxWidth: 720,
            margin: '0 auto',
          }}
        >
          What Argo Won't Do
        </motion.h2>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          style={{
            marginTop: 40,
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 32,
          }}
        >
          {ITEMS.map((item) => (
            <div
              key={item.wont}
              style={{
                borderRadius: 24,
                border: `1px solid ${HAIRLINE}`,
                background: 'rgba(255,255,255,0.03)',
                padding: '28px 24px',
                textAlign: 'left',
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  marginBottom: 14,
                }}
              >
                <ItemIcon>{item.glyph}</ItemIcon>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: '0.1em',
                    textTransform: 'uppercase',
                    color: ACCENT,
                  }}
                >
                  Won&apos;t
                </span>
              </div>
              <h3
                className="serif"
                style={{ fontSize: 22, fontWeight: 600, marginTop: 0 }}
              >
                {item.wont}
              </h3>
              <p
                style={{
                  marginTop: 10,
                  fontSize: 15,
                  lineHeight: 1.5,
                  color: MUTE,
                }}
              >
                <span
                  style={{
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    color: ACCENT,
                  }}
                >
                  Because{' '}
                </span>
                {item.because}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  )
}