import type { Metadata } from 'next'
import Image from 'next/image'
import Navbar from '@/components/Navbar'
import ColophonEndpiece from '@/components/ColophonEndpiece'
import ContestTabs from '@/components/contest/ContestTabs'
import {
  CONTEST_DEADLINE_SHORT,
  CONTEST_PRIZE,
  CONTEST_PROMPT,
  CONTEST_WORDS_MAX,
  CONTEST_WORDS_MIN,
} from '@/lib/contest/config'

const LUMA_URL = 'https://luma.com/iem7mv3u'

export const metadata: Metadata = {
  title: 'Malaysia Blockchain Week 2026 Essay Contest — Argo',
  description:
    `Write a ${CONTEST_WORDS_MIN}–${CONTEST_WORDS_MAX} word essay on "${CONTEST_PROMPT}" and win ${CONTEST_PRIZE}. ` +
    `Open to everyone; entries close ${CONTEST_DEADLINE_SHORT}. Includes a photo gallery and knowledge base ` +
    `from the Bank Negara Malaysia Museum & Art Gallery.`,
}

export default function ContestPage() {
  return (
    <>
      <Navbar />

      <section className="relative overflow-hidden" style={{ background: 'var(--bg)' }}>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 0,
            pointerEvents: 'none',
            background: 'radial-gradient(ellipse 80% 60% at 50% -10%, rgba(206,127,68,0.16), transparent 55%)',
          }}
        />
        <div className="wrap" style={{ position: 'relative', zIndex: 1, padding: '56px 0 32px', maxWidth: 780 }}>
          {/* Event poster → Luma */}
          <a
            href={LUMA_URL}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="View the event on Luma"
            style={{ display: 'block' }}
          >
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: 460,
                margin: '0 auto',
                aspectRatio: '1 / 1',
                borderRadius: 24,
                overflow: 'hidden',
                boxShadow: '0 8px 30px rgba(70,50,30,0.14)',
                border: '1px solid var(--hairline)',
              }}
            >
              <Image
                src="/contest/mybw2026-contest.PNG"
                alt="Malaysia Blockchain Week 2026 · Argo Essay Contest at the Bank Negara Malaysia Museum"
                fill
                priority
                sizes="(max-width: 500px) 100vw, 460px"
                style={{ objectFit: 'cover' }}
              />
            </div>
          </a>

          <div style={{ textAlign: 'center', marginTop: 32 }}>
            <span className="eyebrow">Malaysia Blockchain Week 2026 · Argo Essay Contest</span>
            <h1
              className="serif"
              style={{
                marginTop: 14,
                fontSize: 'clamp(32px, 4.4vw, 52px)',
                lineHeight: 1.08,
                fontWeight: 600,
                letterSpacing: '-0.03em',
                color: 'var(--text)',
              }}
            >
              How can blockchain
              <br />
              technology be used to
              <br />
              benefit Malaysia?
            </h1>
            <p
              style={{
                marginTop: 20,
                fontSize: 18,
                lineHeight: 1.65,
                color: 'var(--text2)',
                maxWidth: 620,
                margin: '20px auto 0',
              }}
            >
              Write {CONTEST_WORDS_MIN}–{CONTEST_WORDS_MAX} words answering that question, publish it under
              your real name, and win{' '}
              <b style={{ color: 'var(--text)' }}>{CONTEST_PRIZE}</b>. Open to anyone, anywhere. Entries
              close <b style={{ color: 'var(--text)' }}>{CONTEST_DEADLINE_SHORT}</b>.
            </p>
          </div>
        </div>
      </section>

      <section style={{ background: 'var(--bg)', paddingBottom: 80 }}>
        <div className="wrap" style={{ maxWidth: 780 }}>
          <ContestTabs />
          <ColophonEndpiece marginTop={64} />
        </div>
      </section>
    </>
  )
}
