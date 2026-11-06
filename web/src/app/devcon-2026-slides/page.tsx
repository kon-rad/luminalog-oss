import type { Metadata } from 'next'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import SiteFooter from '@/components/SiteFooter'
import DevconDeckSlideshow from '@/components/DevconDeckSlideshow'

/* The public copy of the Devcon 8 Mumbai workshop deck (v11, 45 slides).
 * The page shows the deck as page images (public/devcon-2026-slides/pages/),
 * so the cover paints in one small request, and offers the two PDFs:
 * argo-deck-v11.pdf (web, 6 MB) and argo-deck-v11-print.pdf (full quality).
 * Source: Areas/argo/speaking/devcon-mumbai-2026/v11/ in the vault. */

const PDF = '/devcon-2026-slides/argo-deck-v11.pdf'
const PDF_FULL = '/devcon-2026-slides/argo-deck-v11-print.pdf'

export const metadata: Metadata = {
  title: 'Set up your company of agents, Devcon 8 Mumbai 2026',
  description:
    'The slide deck from the Agentic Hub workshop at Devcon 8 Mumbai, 6 November 2026: a company of agents running on your own machine, over a second brain you own.',
}

export const dynamic = 'force-static'

export default function Devcon2026SlidesPage() {
  return (
    <>
      <Navbar />
      <main style={{ background: 'var(--bg)' }}>
        <div className="wrap" style={{ padding: '26px 0 40px' }}>
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'baseline',
              gap: '10px 18px',
              marginBottom: 18,
            }}
          >
            <span className="eyebrow">Devcon 8 Mumbai · 6 November 2026</span>
            <h1
              className="serif"
              style={{
                fontSize: 'clamp(22px,2.6vw,30px)',
                fontWeight: 600,
                letterSpacing: '-0.02em',
                lineHeight: 1.15,
                color: 'var(--text)',
                margin: 0,
              }}
            >
              Set up your company of agents
            </h1>
            <span style={{ color: 'var(--text2)', fontSize: 14 }}>45 slides</span>
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 16 }}>
              <Link href={PDF} target="_blank" rel="noopener noreferrer" className="eyebrow">
                Open the PDF
              </Link>
              <a href={PDF_FULL} download className="eyebrow">
                Download the PDF
              </a>
            </span>
          </div>

          <DevconDeckSlideshow />

          <p style={{ color: 'var(--text2)', fontSize: 15, lineHeight: 1.6, marginTop: 26 }}>
            The workshop ran at the Agentic Hub, Devcon 8 Mumbai, 6 November 2026. The deck is Marp
            markdown, and the engine and its setup skill are open source at{' '}
            <a
              href="https://github.com/kon-rad/argo"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)' }}
            >
              github.com/kon-rad/argo
            </a>
            .
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  )
}
