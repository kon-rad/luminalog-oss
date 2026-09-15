'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'
import { motion, useScroll, useTransform, useMotionValueEvent, useReducedMotion, type MotionValue } from 'framer-motion'
import { wordsForProgress } from '@/lib/landing/motion'
import { INK, CREAM, MUTE, ACCENT } from './theme'

function WordCounter({ progress, reduce }: { progress: MotionValue<number>; reduce: boolean | null }) {
  const [words, setWords] = useState(0)
  useMotionValueEvent(progress, 'change', (latest) => setWords(wordsForProgress(latest)))

  return (
    <div style={{ marginTop: 30, display: 'flex', alignItems: 'baseline', gap: 10 }}>
      <span className="serif" style={{ fontSize: 48, fontWeight: 600, color: ACCENT }}>
        {reduce ? 750 : words}
      </span>
      <span style={{ fontSize: 15, color: MUTE }}>words today</span>
    </div>
  )
}

export default function JournalingSection() {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] })

  const scale = useTransform(scrollYProgress, [0, 1], [0.86, 1])
  const opacity = useTransform(scrollYProgress, [0, 0.15, 0.85, 1], [0, 1, 1, 0.4])
  const rotate = useTransform(scrollYProgress, [0, 1], [-6, 0])

  return (
    <section id="journaling" ref={ref} style={{ position: 'relative', height: reduce ? 'auto' : '300vh', background: INK }}>
      <div
        style={{
          position: reduce ? 'relative' : 'sticky',
          top: reduce ? undefined : 69,
          height: reduce ? 'auto' : 'calc(100vh - 69px)',
          display: 'flex',
          alignItems: 'center',
          color: CREAM,
        }}
      >
        <div className="wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 56, alignItems: 'center' }}>
          <div>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: ACCENT }}>
              Daily journaling
            </span>
            <h2 className="serif" style={{ marginTop: 14, fontSize: 'clamp(32px, 4.4vw, 52px)', lineHeight: 1.08, fontWeight: 600 }}>
              Three pages a day.<br />That is the whole ask.
            </h2>
            <p style={{ marginTop: 18, fontSize: 17, lineHeight: 1.6, color: MUTE, maxWidth: 440 }}>
              Write it, speak it on a walk, or film it before bed. Argo transcribes it all and
              counts every word toward your day. Cross 750 words and the day is yours: your
              streak grows, and it stays grown. No streak you have earned is ever taken back.
            </p>
            <WordCounter progress={scrollYProgress} reduce={reduce} />
          </div>
          <motion.div style={reduce ? {} : { scale, opacity, rotate }} initial={false}>
            <Image
              src="/demo-day/shot-journal.png"
              alt="The Argo Journal list, filterable by All, Text, Voice, Video, and Image"
              width={320}
              height={692}
              style={{ borderRadius: 32, boxShadow: '0 30px 80px rgba(0,0,0,0.5)', margin: '0 auto', display: 'block', maxWidth: '100%', height: 'auto' }}
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
