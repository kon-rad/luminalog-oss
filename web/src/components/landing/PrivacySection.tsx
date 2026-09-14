'use client'

import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { INK, CREAM, MUTE, ACCENT, HAIRLINE } from './theme'

const MARKS: { label: string; glyph: ReactNode }[] = [
  {
    label: 'Zero-knowledge',
    glyph: (
      <>
        <rect x="4" y="10.5" width="16" height="10.5" rx="2.5" />
        <path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" />
      </>
    ),
  },
  { label: 'Open source', glyph: <path d="M9 7 4.5 12 9 17M15 7l4.5 5-4.5 5" /> },
  { label: 'Confidential AI', glyph: <path d="M12 3 4.5 6v6c0 4.4 3.1 7.9 7.5 9 4.4-1.1 7.5-4.6 7.5-9V6L12 3Z" /> },
]

function MarkIcon({ children }: { children: ReactNode }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  )
}

export default function PrivacySection() {
  const reduce = useReducedMotion()

  return (
    <section style={{ background: INK, color: CREAM, padding: '140px 0' }}>
      <div className="wrap" style={{ textAlign: 'center' }}>
        <motion.h2
          className="serif"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ fontSize: 'clamp(30px, 4.2vw, 50px)', fontWeight: 600, maxWidth: 720, margin: '0 auto' }}
        >
          Nobody can read it. Not even us.
        </motion.h2>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          style={{ marginTop: 40, display: 'flex', justifyContent: 'center', gap: 40, flexWrap: 'wrap' }}
        >
          {MARKS.map((m) => (
            <div key={m.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
              <MarkIcon>{m.glyph}</MarkIcon>
              <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: MUTE }}>
                {m.label}
              </span>
            </div>
          ))}
        </motion.div>

        <motion.p
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.4 }}
          style={{ marginTop: 46, fontSize: 15, color: MUTE, borderTop: `1px solid ${HAIRLINE}`, paddingTop: 24, maxWidth: 480, marginLeft: 'auto', marginRight: 'auto' }}
        >
          The key never leaves your device. Our servers hold noise. Transcription and OCR
          happen on-device; AI insights use private, encrypted, anonymized cloud processing.
        </motion.p>
      </div>
    </section>
  )
}
