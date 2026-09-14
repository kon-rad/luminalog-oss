'use client'

import Image from 'next/image'
import Navbar from '@/components/Navbar'
import SocialLinks from '@/components/SocialLinks'
import Hero from '@/components/landing/Hero'
import JournalingSection from '@/components/landing/JournalingSection'
import InsightsCarousel from '@/components/landing/InsightsCarousel'
import CaptureSplit from '@/components/landing/CaptureSplit'
import CompanionSection from '@/components/landing/CompanionSection'
import PrivacySection from '@/components/landing/PrivacySection'
import SoulSection from '@/components/landing/SoulSection'
import FlywheelCarousel from '@/components/landing/FlywheelCarousel'
import TestimonialsSection from '@/components/landing/TestimonialsSection'
import ClosingCta from '@/components/landing/ClosingCta'

export default function Home() {
  return (
    <>
      <Navbar immersive />
      <span id="top" />

      <Hero />
      <JournalingSection />
      <InsightsCarousel />
      <CaptureSplit />
      <CompanionSection />
      <PrivacySection />
      <SoulSection />
      <FlywheelCarousel />
      <TestimonialsSection />
      <ClosingCta />

      <footer style={{ background: 'var(--bg)', borderTop: '1px solid var(--hairline)', padding: '52px 0 60px' }}>
        <div className="wrap">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <a href="#top" className="inline-flex items-center gap-2.5 serif" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>
                <span style={{ width: 32, height: 32, borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 10px rgba(185,107,51,0.4)', flexShrink: 0, display: 'block' }}>
                  <Image src="/logo.png" width={32} height={32} alt="" />
                </span>
                Argo
              </a>
              <p className="serif" style={{ fontStyle: 'italic', fontSize: 16, color: 'var(--text2)', marginTop: 14, maxWidth: 280 }}>
                Record, reflect, and grow with your private AI journaling app.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', paddingTop: 6 }}>
              {[['Events', '/events'], ['Blog', '/blog'], ['Card Game', '/card-game'], ['Privacy Policy', '/privacy'], ['Terms', '/terms'], ['Support', 'mailto:konradmgnat@gmail.com']].map(([label, href]) => (
                <a key={label} href={href} style={{ fontSize: 14, color: 'var(--text2)' }}>{label}</a>
              ))}
            </div>
          </div>
          <SocialLinks marginTop={34} />
          <p style={{ marginTop: 28, fontSize: 13, color: 'var(--text3)' }}>
            &copy; 2026 Argo. Built by{' '}
            <a href="https://x.com/konrad_gnat" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accentDeep)', fontWeight: 600 }}>Konrad Gnat</a>
          </p>
        </div>
      </footer>
    </>
  )
}
