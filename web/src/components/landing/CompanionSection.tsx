'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { INK, CREAM, MUTE, ACCENT } from './theme'

export default function CompanionSection() {
  const reduce = useReducedMotion()

  return (
    <section style={{ background: INK, color: CREAM, padding: '120px 0' }}>
      <div className="wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 48, alignItems: 'center' }}>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        >
          <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: ACCENT }}>
            An AI that has read every entry
          </span>
          <h2 className="serif" style={{ marginTop: 14, fontSize: 'clamp(30px, 4vw, 48px)', lineHeight: 1.12, fontWeight: 600 }}>
            It asks the question<br />you were not asking.
          </h2>
          <p style={{ marginTop: 18, fontSize: 17, lineHeight: 1.6, color: MUTE, maxWidth: 460 }}>
            Argo does not hand you answers. It draws on your actual history to ask the
            question that makes you say it more truly, and reads across months of entries to
            return a view of you that you could never construct from inside your own head.
          </p>
        </motion.div>

        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.15 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 16 }}
        >
          <Image
            src="/demo-day/shot-entry.png"
            alt="An Argo journal entry with an AI summary and a Chat about this entry button"
            width={320}
            height={692}
            style={{ width: '100%', height: 'auto', borderRadius: 24 }}
          />
          <Image
            src="/demo-day/shot-voice.jpeg"
            alt="A live voice conversation with the Argo AI companion"
            width={320}
            height={692}
            style={{ width: '100%', height: 'auto', borderRadius: 24, marginTop: 40 }}
          />
        </motion.div>
      </div>
    </section>
  )
}
