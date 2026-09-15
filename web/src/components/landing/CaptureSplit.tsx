'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { INK, CREAM, MUTE, ACCENT } from './theme'

const PANELS = [
  {
    src: '/demo-day/shot-capture.png',
    alt: 'The Argo entry composer, showing Record, Photo, Video, Dictate, and Upload',
    eyebrow: 'Capture in any format',
    headline: 'Write it. Speak it. Film it.',
    body: 'Voice, text, video, or a photo of a handwritten page. Argo transcribes it all and counts every word toward your day.',
  },
  {
    src: '/demo-day/shot-record.png',
    alt: 'A voice entry being recorded in Argo',
    eyebrow: 'Whatever the moment calls for',
    headline: 'Talk it out on a walk.',
    body: 'Recording is always one tap away. Come back later, or let Argo transcribe it the moment you stop.',
  },
]

export default function CaptureSplit() {
  const reduce = useReducedMotion()

  return (
    <section style={{ background: INK, color: CREAM, padding: '120px 0' }}>
      <div className="wrap" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 32 }}>
        {PANELS.map((panel, i) => (
          <motion.div
            key={panel.src}
            initial={reduce ? false : { opacity: 0, y: 28 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.4 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: i * 0.15 }}
            style={{ borderRadius: 28, overflow: 'hidden', background: 'rgba(255,255,255,0.03)' }}
          >
            <Image src={panel.src} alt={panel.alt} width={462} height={1000} style={{ width: '100%', height: 'auto', display: 'block' }} />
            <div style={{ padding: 28 }}>
              <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: ACCENT }}>
                {panel.eyebrow}
              </span>
              <h3 className="serif" style={{ marginTop: 10, fontSize: 24, fontWeight: 600 }}>{panel.headline}</h3>
              <p style={{ marginTop: 8, fontSize: 15, lineHeight: 1.55, color: MUTE }}>{panel.body}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  )
}
