import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import ColophonEndpiece from '@/components/ColophonEndpiece'

export const metadata: Metadata = {
  title: 'Thanks for your order — LuminaLog',
  description:
    'Thank you for becoming a LuminaLog Founding Member. We’ll email you the moment we launch, with your access.',
  robots: { index: false, follow: false },
}

export default function FoundingThanksPage() {
  return (
    <>
      <Navbar />

      <section className="relative overflow-hidden" style={{ background: 'var(--bg)' }}>
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 80% 70% at 70% -10%, rgba(206,127,68,0.16), transparent 55%)',
          }}
        />
        <div
          className="wrap"
          style={{ position: 'relative', zIndex: 1, padding: '96px 0 88px', textAlign: 'center' }}
        >
          <span className="eyebrow">✦ Founding Member</span>
          <h1
            className="serif"
            style={{ marginTop: 16, fontSize: 'clamp(38px,5vw,60px)', lineHeight: 1.05, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text)' }}
          >
            Thanks for your order.
          </h1>
          <p style={{ marginTop: 22, fontSize: 19, lineHeight: 1.65, color: 'var(--text2)', maxWidth: 540, margin: '22px auto 0' }}>
            You’re a LuminaLog Founding Member. We’ll email you the moment we launch,
            with your access — keep an eye on your inbox.
          </p>

          <div style={{ marginTop: 36 }}>
            <Link
              href="/"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 9,
                background: 'var(--accent)', color: '#fff', fontSize: 16, fontWeight: 700,
                padding: '14px 30px', borderRadius: 14, textDecoration: 'none', whiteSpace: 'nowrap',
              }}
            >
              Back to LuminaLog
            </Link>
          </div>

          <ColophonEndpiece marginTop={72} />
        </div>
      </section>

      {/* ── FOOTER ── */}
      <footer style={{ background: 'var(--bg)', borderTop: '1px solid var(--hairline)', padding: '40px 0 56px' }}>
        <div className="wrap">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <Link href="/" className="inline-flex items-center gap-2.5 serif" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>
              <span style={{ width: 28, height: 28, borderRadius: 9, overflow: 'hidden', boxShadow: '0 2px 10px rgba(185,107,51,0.4)', flexShrink: 0, display: 'block' }}>
                <Image src="/logo.svg" width={28} height={28} alt="" />
              </span>
              LuminaLog
            </Link>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', fontSize: 14 }}>
              <Link href="/privacy" style={{ color: 'var(--text2)' }}>Privacy Policy</Link>
              <Link href="/terms" style={{ color: 'var(--text2)' }}>Terms</Link>
              <a href="https://x.com/konrad_gnat" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text2)' }}>Send me a tweet</a>
              <a href="mailto:konradmgnat@gmail.com" style={{ color: 'var(--text2)' }}>Support</a>
              <a href="https://github.com/konradgnat/luminalog" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text2)' }}>GitHub</a>
            </div>
          </div>
          <p style={{ marginTop: 28, fontSize: 13, color: 'var(--text3)' }}>
            © 2026 LuminaLog · Built by{' '}
            <a href="https://x.com/konrad_gnat" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accentDeep)', fontWeight: 600 }}>Konrad Gnat</a>
          </p>
        </div>
      </footer>
    </>
  )
}
