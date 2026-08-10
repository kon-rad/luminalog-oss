import type { Metadata } from 'next'
import Image from 'next/image'
import Navbar from '@/components/Navbar'
import SiteFooter from '@/components/SiteFooter'
import ColophonEndpiece from '@/components/ColophonEndpiece'
import TipMethods, { type TipMethod } from '@/components/TipMethods'

/* ─────────────────────────────────────────────────────────────
 * TIP DESTINATIONS — the only thing you need to edit.
 * Leave a value as '' and its card renders a "Link coming soon"
 * placeholder instead of a dead link.
 * ───────────────────────────────────────────────────────────── */
const VENMO_HANDLE = '@Konrad-Gnat'
const VENMO_URL = 'https://venmo.com/u/Konrad-Gnat'
const PAYPAL_URL = 'https://paypal.me/konradgnat'
const ZELLE_EMAIL = 'konradmgnat@gmail.com'
/* Same address on every EVM chain — Ethereum mainnet, Base, Arbitrum, Optimism, Polygon. */
const EVM_ADDRESS = '0x9Ca2D4F1d1313dD12D7DAE0CD701A061EE6383aa'
const SOLANA_ADDRESS = 'AKvvQMBZWjG3EJbAB1Q9RmVBaaSNAncF3bS66T3891NU'

/* The robot photo, served from web/public/robot/robot-1.jpeg. */
const ROBOT_PHOTO = '/robot/robot-1.jpeg'

const METHODS: TipMethod[] = [
  {
    kind: 'link',
    id: 'venmo',
    glyph: '💸',
    title: 'Venmo',
    blurb: `Quickest option if you are in the US. Any amount, no note required: ${VENMO_HANDLE}.`,
    url: VENMO_URL,
    cta: 'Tip on Venmo',
  },
  {
    kind: 'link',
    id: 'paypal',
    glyph: '🌍',
    title: 'PayPal',
    blurb: 'Works from anywhere, in your own currency.',
    url: PAYPAL_URL,
    cta: 'Tip on PayPal',
  },
  {
    kind: 'address',
    id: 'zelle',
    glyph: '🏦',
    title: 'Zelle',
    blurb: 'Bank-to-bank in the US, no fees. Send to this email address from your banking app.',
    address: ZELLE_EMAIL,
    wide: true,
  },
  {
    kind: 'address',
    id: 'evm',
    glyph: '⟠',
    title: 'Ethereum & EVM chains',
    blurb: 'The same address on Ethereum mainnet, Base, Arbitrum, Optimism and Polygon. ETH or stablecoins both work.',
    address: EVM_ADDRESS,
  },
  {
    kind: 'address',
    id: 'solana',
    glyph: '◎',
    title: 'Solana',
    blurb: 'SOL or USDC on Solana mainnet, fast and near-free to send.',
    address: SOLANA_ADDRESS,
  },
]

export const metadata: Metadata = {
  title: 'Tip the Robot, Argo',
  description:
    'Send a tip to Argo. Friendly Helpful, our robot, accepts Venmo, PayPal, Ethereum and EVM chains, and Solana. Tips make him dance.',
}

export default function TipPage() {
  return (
    <>
      <Navbar />

      {/* ── HERO ── */}
      <section className="relative overflow-hidden" style={{ background: 'var(--bg)' }}>
        <div
          style={{
            position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 80% 70% at 50% -10%, rgba(206,127,68,0.16), transparent 55%)',
          }}
        />
        <div className="wrap" style={{ position: 'relative', zIndex: 1, padding: '80px 0 32px', textAlign: 'center' }}>
          <span className="eyebrow">✦ Tip jar</span>

          <figure style={{ margin: '26px auto 0', maxWidth: 340 }}>
            <div
              style={{
                position: 'relative',
                width: '100%',
                /* Matches the photo's own 3:4 — a square crop would cut off the sign. */
                aspectRatio: '3 / 4',
                borderRadius: 26,
                overflow: 'hidden',
                background: 'var(--bgElev)',
                border: '1px solid var(--hairline)',
                boxShadow: '0 18px 44px rgba(185,107,51,0.18)',
              }}
            >
              <Image
                src={ROBOT_PHOTO}
                alt="Friendly Helpful, a small white sticker-covered robot, holding a handwritten sign that reads: Hi! I'm Friendly. My last name is Helpful! Tips make me dance."
                fill
                sizes="340px"
                style={{ objectFit: 'cover' }}
                priority
              />
            </div>
            <figcaption style={{ marginTop: 14, fontSize: 14, color: 'var(--text3)', lineHeight: 1.55 }}>
              Friendly Helpful, the Argo robot.
            </figcaption>
          </figure>

          <h1
            className="serif"
            style={{
              marginTop: 30, fontSize: 'clamp(34px,4.6vw,54px)', lineHeight: 1.06,
              fontWeight: 600, letterSpacing: '-0.03em', color: 'var(--text)',
            }}
          >
            Tip the Robot
          </h1>
          <p style={{ marginTop: 20, fontSize: 19, lineHeight: 1.62, color: 'var(--text2)', maxWidth: 560, margin: '20px auto 0' }}>
            Hi, I&apos;m Friendly. My last name is Helpful. Tips make me dance.
          </p>
        </div>
      </section>

      {/* ── TIP METHODS ── */}
      <section style={{ background: 'var(--bg)', paddingBottom: 96 }}>
        <div className="wrap">
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <TipMethods methods={METHODS} />

            <p style={{ marginTop: 28, textAlign: 'center', fontSize: 14, color: 'var(--text3)', lineHeight: 1.6 }}>
              Tips are a gift, not a purchase: they don&apos;t unlock features and aren&apos;t
              refundable. They keep the servers warm and the robot dancing. Thank you.
            </p>

            <ColophonEndpiece marginTop={64} />
          </div>
        </div>
      </section>

      <SiteFooter />
    </>
  )
}
