'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { INK, CREAM, MUTE, ACCENT } from './theme'

export default function Hero() {
  const reduce = useReducedMotion()

  return (
    <section
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: INK,
        color: CREAM,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        textAlign: 'center',
        padding: '96px 24px',
      }}
    >
      {/* A single soft light source picking the emblem out of the dark,
       * before any headline settles in. Mirrors the Apple hero's spotlight
       * reveal (research doc, section 2.1). */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          top: '8%',
          left: '50%',
          width: 520,
          height: 520,
          transform: 'translateX(-50%)',
          background: 'radial-gradient(circle, rgba(229,160,99,0.35) 0%, rgba(229,160,99,0.08) 45%, rgba(229,160,99,0) 72%)',
          filter: 'blur(4px)',
          pointerEvents: 'none',
        }}
      />

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
        style={{ position: 'relative', width: 96, height: 120 }}
      >
        <Image src="/argo-emblem-alpha.png" alt="Argo" fill sizes="96px" style={{ objectFit: 'contain' }} priority />
      </motion.div>

      <motion.h1
        className="serif"
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: 'easeOut', delay: 0.25 }}
        style={{
          marginTop: 32,
          fontSize: 'clamp(40px, 6vw, 76px)',
          lineHeight: 1.04,
          fontWeight: 600,
          letterSpacing: '-0.03em',
        }}
      >
        Record, reflect,<br />and grow.
      </motion.h1>

      <motion.p
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: 'easeOut', delay: 0.45 }}
        style={{ marginTop: 22, fontSize: 19, lineHeight: 1.65, color: MUTE, maxWidth: 560 }}
      >
        Argo is an AI journaling app: a private container for your thoughts. Capture your
        days in voice, text, video, or handwriting, and talk to an AI that has read every
        entry you have written. Hit your daily 750-word goal, keep your streak alive, and
        grow more articulate and whole as it comes to know you.
      </motion.p>

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.9, ease: 'easeOut', delay: 0.65 }}
        style={{ marginTop: 34 }}
      >
        <a
          href="#journaling"
          style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: ACCENT, fontSize: 16, fontWeight: 600 }}
        >
          See how it works
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
        </a>
      </motion.div>
    </section>
  )
}
