'use client'

import { useRef } from 'react'
import Image from 'next/image'
import { motion, useScroll, useTransform, useReducedMotion } from 'framer-motion'
import SoulGalaxy from '@/components/SoulGalaxy'
import { generateSoulDemoPoints } from '@/lib/landing/soulDemoPoints'
import { INK, CREAM, MUTE, ACCENT } from './theme'

const DEMO_POINTS = generateSoulDemoPoints(48)

export default function SoulSection() {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })

  const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.3, 1, 1, 0.5])
  const scale = useTransform(scrollYProgress, [0, 0.3], [0.9, 1])

  return (
    <section ref={ref} style={{ position: 'relative', height: reduce ? 'auto' : '260vh', background: INK }}>
      <div
        style={{
          position: reduce ? 'relative' : 'sticky',
          top: 0,
          height: '100vh',
          display: 'flex',
          alignItems: 'center',
          color: CREAM,
        }}
      >
        <div className="wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 56, alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: ACCENT }}>
              Own your practice
            </span>
            <h2 className="serif" style={{ marginTop: 14, fontSize: 'clamp(30px, 4vw, 48px)', lineHeight: 1.1, fontWeight: 600 }}>
              Every day becomes a star.
            </h2>
            <p style={{ marginTop: 16, fontSize: 16, lineHeight: 1.6, color: MUTE, maxWidth: 420 }}>
              Every day you cross your 750-word goal becomes a star in your On-Chain Soul: a
              soulbound token on Base, public, provably earned, impossible to fake, and
              permanently yours.
            </p>
            {reduce && (
              <Image
                src="/demo-day/shot-constellation.png"
                alt="A constellation of journaling stars in the Argo app"
                width={280}
                height={606}
                style={{ marginTop: 24, borderRadius: 24 }}
              />
            )}
          </div>
          {!reduce && (
            <motion.div style={{ opacity, scale }}>
              <SoulGalaxy points={DEMO_POINTS} />
            </motion.div>
          )}
        </div>
      </div>
    </section>
  )
}
