import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import ColophonEndpiece from '@/components/ColophonEndpiece'

// Founding checkout — a Stripe Payment Link for the one-time $29.99 / 3-month
// founding pass. Update this single constant to point at a new link.
const FOUNDING_CHECKOUT_URL = 'https://buy.stripe.com/28E6oH5bP6Kr6xV7zf2Ry02'

export const metadata: Metadata = {
  title: 'Founding Member — LuminaLog',
  description:
    'Become a LuminaLog Founding Member: a one-time $29.99 for your first 3 months (50% off the $19.99/month price). No auto-renew — renew if you choose. One price everywhere, web and iOS.',
}

const PERKS: [string, string][] = [
  ['Half price, up front', 'A one-time $29.99 covers your first 3 months — 50% off the regular $19.99/month. No auto-renew: after 3 months you simply renew if you want to keep going.'],
  ['First through the door', 'Start the moment we open: full access on the web immediately, and on iOS the day we launch. Your access carries over.'],
  ['A permanent Founding mark', 'Founding Members carry a lasting badge — you were here at the beginning, before anyone else.'],
  ['Your On-Chain Soul from day one', 'Every day you cross your 750-word goal becomes a star in your Soul — a soulbound token on Base, provably earned, yours alone.'],
]

export default function FoundingPage() {
  return (
    <>
      <Navbar />

      {/* ── HERO / OFFER ── */}
      <section className="relative overflow-hidden" style={{ background: 'var(--bg)' }}>
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 80% 70% at 70% -10%, rgba(206,127,68,0.16), transparent 55%)',
          }}
        />
        <div className="wrap" style={{ position: 'relative', zIndex: 1, padding: '88px 0 40px', textAlign: 'center' }}>
          <span className="eyebrow">✦ Founding Member</span>
          <h1
            className="serif"
            style={{ marginTop: 16, fontSize: 'clamp(36px,4.8vw,58px)', lineHeight: 1.06, fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text)' }}
          >
            Private AI Journaling<br />Companion.
          </h1>
          <p style={{ marginTop: 22, fontSize: 19, lineHeight: 1.62, color: 'var(--text2)', maxWidth: 600, margin: '22px auto 0' }}>
            Write 750 words a day and keep your daily streak alive. Each day generates a
            shareable social card, and every goal you hit is minted as provable proof in your
            Soulbound NFT — all guided by human-in-the-loop AI that reflects with you, never for you.
          </p>
        </div>
      </section>

      {/* ── OFFER CARD ── */}
      <section style={{ background: 'var(--bg)', paddingBottom: 96 }}>
        <div className="wrap">
          <div style={{ maxWidth: 620, margin: '0 auto' }}>
            <div
              style={{
                position: 'relative', overflow: 'hidden', borderRadius: 28,
                background: 'linear-gradient(150deg, var(--accent), var(--accentDeep))',
                color: '#fff', padding: '44px 40px', textAlign: 'center',
                boxShadow: '0 24px 60px rgba(185,107,51,0.30)',
              }}
            >
              <div style={{ position: 'absolute', top: -80, right: -50, width: 240, height: 240, borderRadius: '50%', background: 'rgba(255,255,255,0.12)', filter: 'blur(10px)', pointerEvents: 'none' }} />
              <div style={{ position: 'relative', zIndex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.8)' }}>Founding offer</div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', flexWrap: 'wrap', gap: '0 12px', marginTop: 16 }}>
                  <span className="serif" style={{ fontSize: 52, fontWeight: 600, letterSpacing: '-0.03em' }}>$29.99</span>
                  <span style={{ fontSize: 18, color: 'rgba(255,255,255,0.9)' }}>for your first 3 months</span>
                </div>
                <div style={{ marginTop: 8, fontSize: 15, color: 'rgba(255,255,255,0.78)' }}>
                  <s>$59.97</s> · 50% off · one-time payment · no auto-renew
                </div>

                <div style={{ marginTop: 30 }}>
                  <a
                    href={FOUNDING_CHECKOUT_URL}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 9,
                      background: '#fff', color: 'var(--accentDeep)', fontSize: 17, fontWeight: 700,
                      padding: '15px 34px', borderRadius: 15, textDecoration: 'none', whiteSpace: 'nowrap',
                    }}
                  >
                    Become a Founding Member →
                  </a>
                  <p style={{ marginTop: 18, fontSize: 14, color: 'rgba(255,255,255,0.78)', lineHeight: 1.55 }}>
                    A one-time charge for your first 3 months. It does not auto-renew —
                    after 3 months you renew only if you choose to.
                  </p>
                </div>
              </div>
            </div>

            {/* Perks */}
            <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }} className="unlock-grid">
              {PERKS.map(([title, desc]) => (
                <div key={title} className="card" style={{ padding: 24, textAlign: 'left' }}>
                  <div style={{ color: 'var(--accent)', fontSize: 18, marginBottom: 12 }}>✦</div>
                  <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{title}</h3>
                  <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.58 }}>{desc}</p>
                </div>
              ))}
            </div>

            <p style={{ marginTop: 28, textAlign: 'center', fontSize: 14, color: 'var(--text3)', lineHeight: 1.6 }}>
              One price, everywhere — $19.99/month or $199.99/year, the same on the web and in
              the app. Live voice calls run on add-on Voice Credits.
            </p>

            <ColophonEndpiece marginTop={64} />
          </div>
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
