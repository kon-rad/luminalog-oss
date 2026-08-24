import type { Metadata } from 'next'
import Navbar from '@/components/Navbar'
import ColophonEndpiece from '@/components/ColophonEndpiece'
import SubscribeButton from '@/components/app/SubscribeButton'
import { APP_STORE_URL } from '@/lib/appStore'

// Public plans page (design §2). One price everywhere, web and iOS, per
// docs/PRICING.md: web sales keep the Apple-cut savings as margin rather than
// undercutting the App Store, so there is no "cheaper on the web" story to tell.
//
// The checkout buttons render only when NEXT_PUBLIC_BILLING_ENABLED is true (see
// SubscribeButton), so until the RevenueCat dashboard is configured this page
// reads as an honest description of the plans with an App Store link.

export const metadata: Metadata = {
  title: 'Pricing, Argo',
  description:
    'Argo Pro is $29.99/month or $299.99/year, the same price on the web and on iOS. Journaling is free. Pro adds the AI that reads your journal back to you.',
}

const FREE: string[] = [
  'Unlimited journal entries, on web and iOS',
  'Photos, video and audio, encrypted before they leave your device',
  'Keyword search across everything you have written',
  'Your On-Chain Soul: every 750-word day becomes a star',
]

const PRO: string[] = [
  'Chat with your whole journal',
  'Daily insights and reflections drawn from your entries',
  'Daily prompts written for where you actually are',
  'Semantic search: find it by what you meant, not what you typed',
  'The cognitive map of your themes over time',
]

function Check() {
  return (
    <span aria-hidden="true" style={{ color: 'var(--accent)', marginRight: 10 }}>
      &#10003;
    </span>
  )
}

export default function PricingPage() {
  return (
    <>
      <Navbar />

      <main style={{ maxWidth: 980, margin: '0 auto', padding: '64px 24px 96px' }}>
        <header style={{ textAlign: 'center', marginBottom: 48 }}>
          <h1 className="serif" style={{ fontSize: 44, fontWeight: 600, letterSpacing: '-0.02em' }}>
            One price, everywhere
          </h1>
          <p style={{ marginTop: 14, fontSize: 17, color: 'var(--text2)', maxWidth: 560, margin: '14px auto 0' }}>
            Argo Pro costs the same whether you subscribe on the web or in the app, and it
            unlocks the same thing in both places. Subscribe once, it follows you.
          </p>
        </header>

        <div
          style={{
            display: 'grid',
            gap: 24,
            gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
            alignItems: 'start',
          }}
        >
          {/* Free */}
          <section
            style={{
              borderRadius: 24,
              border: '1px solid var(--hairline2)',
              padding: '34px 30px',
            }}
          >
            <h2 className="serif" style={{ fontSize: 24, fontWeight: 600 }}>
              Free
            </h2>
            <p style={{ marginTop: 10, fontSize: 15, color: 'var(--text2)' }}>
              The journal itself, with no time limit and no entry cap.
            </p>
            <p className="serif" style={{ marginTop: 22, fontSize: 40, fontWeight: 600 }}>
              $0
            </p>
            <ul style={{ marginTop: 26, display: 'grid', gap: 12, fontSize: 15, lineHeight: 1.5 }}>
              {FREE.map((line) => (
                <li key={line} style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <Check />
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </section>

          {/* Pro */}
          <section
            style={{
              borderRadius: 24,
              border: '1px solid var(--accent)',
              padding: '34px 30px',
              position: 'relative',
            }}
          >
            <h2 className="serif" style={{ fontSize: 24, fontWeight: 600 }}>
              Argo Pro
            </h2>
            <p style={{ marginTop: 10, fontSize: 15, color: 'var(--text2)' }}>
              A private AI built from your own life, and it remembers all of it.
            </p>
            <p className="serif" style={{ marginTop: 22, fontSize: 40, fontWeight: 600 }}>
              $29.99
              <span style={{ fontSize: 17, fontWeight: 400, color: 'var(--text2)' }}> / month</span>
            </p>
            <p style={{ marginTop: 6, fontSize: 14, color: 'var(--text2)' }}>
              or $299.99 a year, which works out to two months free
            </p>

            <ul style={{ marginTop: 26, display: 'grid', gap: 12, fontSize: 15, lineHeight: 1.5 }}>
              {PRO.map((line) => (
                <li key={line} style={{ display: 'flex', alignItems: 'flex-start' }}>
                  <Check />
                  <span>{line}</span>
                </li>
              ))}
            </ul>

            <div style={{ marginTop: 30, display: 'grid', gap: 12, justifyItems: 'start' }}>
              <SubscribeButton plan="$rc_monthly" label="Subscribe monthly" />
              <SubscribeButton
                plan="$rc_annual"
                label="Subscribe yearly and save"
                className="text-sm underline"
              />
            </div>

            <p style={{ marginTop: 20, fontSize: 14, color: 'var(--text2)', lineHeight: 1.55 }}>
              Prefer the App Store?{' '}
              <a href={APP_STORE_URL} target="_blank" rel="noopener" style={{ textDecoration: 'underline' }}>
                Download Argo
              </a>{' '}
              and subscribe there. Either way it unlocks both.
            </p>
          </section>
        </div>

        <p
          style={{
            marginTop: 44,
            textAlign: 'center',
            fontSize: 14,
            color: 'var(--text2)',
            maxWidth: 620,
            marginLeft: 'auto',
            marginRight: 'auto',
            lineHeight: 1.6,
          }}
        >
          Cancel whenever you like. Your entries are yours: they stay readable, exportable and
          encrypted whether or not you subscribe.
        </p>

        <ColophonEndpiece />
      </main>
    </>
  )
}
