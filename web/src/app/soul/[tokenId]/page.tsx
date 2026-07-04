import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import SoulViewer from './SoulViewer'

const API_URL = process.env.API_URL ?? 'https://api.luminalog.com'

interface PublicSoul {
  tokenId: string
  stars: number
  points: { x: number; y: number; z: number; wordCount: number }[]
}

/** Fetch the public (coordinates-only) point-set for a token. Server-side, so no
 *  auth and no CORS. Returns null for a missing token or a malformed id. */
async function fetchSoul(tokenId: string): Promise<PublicSoul | null> {
  if (!/^\d+$/.test(tokenId)) return null
  try {
    const res = await fetch(`${API_URL}/v1/nft/${tokenId}/points`, { next: { revalidate: 60 } })
    if (!res.ok) return null
    return (await res.json()) as PublicSoul
  } catch {
    return null
  }
}

export async function generateMetadata({ params }: { params: { tokenId: string } }): Promise<Metadata> {
  const soul = await fetchSoul(params.tokenId)
  const title = soul ? `LuminaLog Soul #${soul.tokenId}` : 'LuminaLog Soul'
  const description = soul
    ? `A constellation of ${soul.stars} ${soul.stars === 1 ? 'star' : 'stars'}, grown from journaling.`
    : 'A soulbound constellation grown from journaling.'
  // OG image (the hero PNG) intentionally omitted until public S3 serving is confirmed.
  return {
    title,
    description,
    openGraph: { title, description, type: 'website' },
    twitter: { card: 'summary', title, description },
  }
}

const PAGE_BG =
  'radial-gradient(130% 120% at 50% 0%, #211d4a 0%, #16123a 26%, #0d0a24 52%, #06050f 82%, #030308 100%)'

export default async function SoulPage({ params }: { params: { tokenId: string } }) {
  const soul = await fetchSoul(params.tokenId)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: PAGE_BG,
        color: '#F3EEE4',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '40px 20px 56px',
      }}
    >
      {/* Wordmark */}
      <Link
        href="/"
        className="inline-flex items-center gap-2.5 serif"
        style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em', color: '#F3EEE4', opacity: 0.9 }}
      >
        <span style={{ width: 28, height: 28, borderRadius: 9, overflow: 'hidden', display: 'block' }}>
          <Image src="/logo.svg" width={28} height={28} alt="LuminaLog" />
        </span>
        LuminaLog
      </Link>

      <main style={{ width: '100%', maxWidth: 640, margin: '0 auto', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        {soul ? (
          <>
            <header style={{ textAlign: 'center', margin: '36px 0 24px' }}>
              <h1 className="serif" style={{ fontSize: 'clamp(30px, 7vw, 44px)', fontWeight: 600, letterSpacing: '-0.02em', lineHeight: 1.05 }}>
                LuminaLog Soul <span style={{ color: '#E8A44C' }}>#{soul.tokenId}</span>
              </h1>
              <p className="serif" style={{ marginTop: 12, fontSize: 17, fontStyle: 'italic', color: 'rgba(243,238,228,0.72)' }}>
                {soul.stars > 0
                  ? `A constellation of ${soul.stars.toLocaleString('en-US')} ${soul.stars === 1 ? 'star' : 'stars'}, grown from journaling.`
                  : 'A nascent soul, awaiting its first 750-word day.'}
              </p>
            </header>

            <SoulViewer points={soul.points} />

            <p style={{ textAlign: 'center', marginTop: 18, fontSize: 13, color: 'rgba(243,238,228,0.45)' }}>
              Drag to orbit · pinch or scroll to zoom · each star is one 750-word day
            </p>
          </>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 24px' }}>
            <div
              aria-hidden
              style={{
                width: 12, height: 12, borderRadius: '50%', margin: '0 auto 24px',
                background: '#F7E3C4', boxShadow: '0 0 20px 8px rgba(232,164,76,0.5)',
              }}
            />
            <h1 className="serif" style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em' }}>
              This soul isn&apos;t here
            </h1>
            <p className="serif" style={{ marginTop: 12, fontSize: 16, fontStyle: 'italic', color: 'rgba(243,238,228,0.6)' }}>
              No constellation has been minted for this token yet.
            </p>
          </div>
        )}
      </main>

      <footer style={{ marginTop: 40 }}>
        <Link href="/" style={{ fontSize: 13, color: 'rgba(243,238,228,0.5)', textDecoration: 'none' }}>
          Grow your own soul at luminalog.com →
        </Link>
      </footer>
    </div>
  )
}
