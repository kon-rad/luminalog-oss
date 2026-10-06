'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { SURFACE, CREAM, MUTE, ACCENT, HAIRLINE } from './theme'

/**
 * Set like a page from a 19th-century paper, matching the iOS Story outline:
 * roman-numeral articles, italic serif heads, a run-in small-caps "Because",
 * hairline rules, and no cards or icons. Every claim here has to be true of
 * the shipped product; account deletion is not on the list until the server
 * purge route exists.
 */
const ITEMS: { wont: string; because: string }[] = [
  {
    wont: 'Sell your data',
    because:
      "the architecture can't. Your key never leaves your device. Our servers hold noise, not your words.",
  },
  {
    wont: 'Train on your entries',
    because:
      'speech-to-text and handwriting recognition run on your device, and AI inference is anonymised. Your writing is never training data, not ours and not anyone’s.',
  },
  {
    wont: 'Show you ads',
    because:
      'Argo is paid for by its members. There is no advertiser to serve, so there is nothing about you to sell.',
  },
]

const NUMERALS = ['I', 'II', 'III']

export default function WontDoSection() {
  const reduce = useReducedMotion()

  return (
    <section
      id="wont-do"
      style={{
        background: SURFACE,
        color: CREAM,
        padding: 'clamp(88px, 12vw, 140px) 0',
        borderTop: `1px solid ${HAIRLINE}`,
        borderBottom: `1px solid ${HAIRLINE}`,
      }}
    >
      <div className="wrap" style={{ maxWidth: 1040 }}>
        <motion.h2
          className="serif"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ fontSize: 'clamp(30px, 4.2vw, 50px)', fontWeight: 600, textAlign: 'center', margin: 0 }}
        >
          What Argo Won&apos;t Do
        </motion.h2>

        {/* Double rule under the title, as on a paper's title block. */}
        <div
          aria-hidden
          style={{
            width: 96,
            height: 4,
            margin: '22px auto 0',
            borderTop: `1px solid ${ACCENT}`,
            borderBottom: `1px solid ${ACCENT}`,
            opacity: 0.55,
          }}
        />

        <motion.ol
          initial={reduce ? false : { opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.1 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '56px 0 0',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            columnGap: 48,
            rowGap: 40,
          }}
        >
          {ITEMS.map((item, i) => (
            <li key={item.wont} style={{ borderTop: `1px solid ${HAIRLINE}`, paddingTop: 22 }}>
              <span
                className="serif"
                style={{ fontSize: 17, fontVariant: 'small-caps', letterSpacing: '0.08em', color: ACCENT }}
              >
                Art. {NUMERALS[i]}.
              </span>
              <h3
                className="serif"
                style={{ marginTop: 6, fontSize: 26, fontStyle: 'italic', fontWeight: 500, lineHeight: 1.2 }}
              >
                {item.wont}
              </h3>
              <p
                className="serif"
                style={{ marginTop: 12, fontSize: 17, lineHeight: 1.6, color: MUTE, hyphens: 'auto' }}
              >
                <span style={{ fontVariant: 'small-caps', letterSpacing: '0.06em', color: CREAM }}>Because </span>
                {item.because}
              </p>
            </li>
          ))}
        </motion.ol>
      </div>
    </section>
  )
}
