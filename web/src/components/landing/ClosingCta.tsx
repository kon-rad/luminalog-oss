'use client'

import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import AppStoreButton from '@/components/AppStoreButton'
import { INK, CREAM, MUTE } from './theme'

export default function ClosingCta() {
  const reduce = useReducedMotion()

  return (
    <section
      id="download"
      style={{
        background: `linear-gradient(180deg, ${INK} 0%, #221E18 60%, var(--bg) 100%)`,
        color: CREAM,
        padding: '140px 0 100px',
        textAlign: 'center',
      }}
    >
      <div className="wrap">
        <motion.h2
          className="serif"
          initial={reduce ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.5 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ fontSize: 'clamp(32px, 4.6vw, 56px)', fontWeight: 600, maxWidth: 680, margin: '0 auto' }}
        >
          Merge with AI. One conversation at a time.
        </motion.h2>
        <p style={{ marginTop: 16, fontSize: 17, color: MUTE }}>
          Free to download. Requires iPhone with iOS 17 or later.
        </p>
        <div style={{ marginTop: 32, display: 'flex', justifyContent: 'center' }}>
          <AppStoreButton variant="white" />
        </div>
        <div style={{ marginTop: 40, display: 'flex', justifyContent: 'center' }}>
          <Image src="/demo-day/qr-launch-ad.png" alt="QR code to download Argo on the App Store" width={140} height={140} style={{ borderRadius: 16 }} />
        </div>
      </div>
    </section>
  )
}
