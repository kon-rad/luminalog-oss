'use client'

// The Soul / soulbound-NFT block at the TOP of Home (mirrors the iOS Home
// screen, screenshot #3): the live constellation on its cosmic panel, an
// "expand" affordance in the corner that opens the fullscreen SoulModal, then
// the wallet address + "View NFT on BaseScan" link beneath it.
//
// Data comes from the shared `useSoul()` hook (GET /api/soul) — the same source
// the /dashboard page uses. Resilient by design: a loading shimmer, a quiet
// error line, and a "nascent soul" hint when the user hasn't minted yet all
// keep Home from ever being blocked by this card.

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Maximize2 } from 'lucide-react'
import { useSoul, basescanNftUrl } from '@/lib/useSoul'
import SoulModal from '@/components/app/SoulModal'

// SoulGalaxy is client-only (react-three-fiber touches window/WebGL); no SSR.
const SoulGalaxy = dynamic(() => import('@/components/SoulGalaxy'), { ssr: false })

/** Cosmic gradient shared with SoulGalaxy's own panel, used for the loading
 *  placeholder so the shimmer reads as the same surface. */
const COSMIC_PANEL =
  'radial-gradient(120% 110% at 26% 18%, #2E2A5E 0%, #1B1740 32%, #100D28 58%, #07060F 82%, #030308 100%)'

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 'clamp(300px, 44vw, 400px)',
        borderRadius: 28,
        overflow: 'hidden',
        background: COSMIC_PANEL,
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px rgba(8,6,20,0.45)',
      }}
    >
      {children}
    </div>
  )
}

export default function SoulCard() {
  const { data: soul, loading, error } = useSoul()
  const [expanded, setExpanded] = useState(false)

  const points = soul?.constellation.points ?? []
  const nft = soul?.nft ?? null

  return (
    <section aria-label="Your Soul" className="flex flex-col gap-3">
      {/* Constellation panel + expand affordance. */}
      <div className="relative">
        {loading ? (
          <PanelShell>
            <div className="absolute inset-0 flex items-center justify-center">
              <style>{`@keyframes soul-card-shimmer{0%,100%{opacity:.35}50%{opacity:.85}}`}</style>
              <span
                aria-hidden
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: '#F7E3C4',
                  boxShadow: '0 0 16px 6px rgba(232,164,76,0.6)',
                  animation: 'soul-card-shimmer 1.6s ease-in-out infinite',
                }}
              />
            </div>
          </PanelShell>
        ) : error ? (
          <PanelShell>
            <div className="absolute inset-0 flex items-center justify-center px-10 text-center">
              <p className="serif text-base italic" style={{ color: 'rgba(243,238,228,0.72)' }}>
                Couldn&apos;t load your soul right now.
              </p>
            </div>
          </PanelShell>
        ) : (
          <SoulGalaxy points={points} />
        )}

        {/* Expand → fullscreen (mirrors the iOS Home expand button). */}
        {!loading && !error && (
          <button
            type="button"
            onClick={() => setExpanded(true)}
            aria-label="Expand your soul"
            className="absolute bottom-3 right-3 flex h-10 w-10 items-center justify-center rounded-xl transition-transform duration-150 hover:-translate-y-0.5"
            style={{
              background: 'rgba(0,0,0,0.35)',
              color: '#F3EEE4',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
              border: '1px solid rgba(255,255,255,0.12)',
            }}
          >
            <Maximize2 size={18} strokeWidth={2} />
          </button>
        )}
      </div>

      {/* Wallet address + BaseScan link (only once a soul has been minted). */}
      {nft ? (
        <div className="flex flex-col gap-1.5">
          <span
            className="max-w-full truncate font-mono text-xs"
            style={{ color: 'var(--text3)' }}
            title={nft.walletAddress}
          >
            {nft.walletAddress}
          </span>
          <a
            href={basescanNftUrl(nft)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-sm font-semibold"
            style={{ color: 'var(--accent)' }}
          >
            View NFT on BaseScan ↗
          </a>
        </div>
      ) : (
        !loading &&
        !error && (
          <p className="font-sans text-sm" style={{ color: 'var(--text3)' }}>
            Your soul mints after your first 750-word day.
          </p>
        )
      )}

      <SoulModal open={expanded} onClose={() => setExpanded(false)} points={points} nft={nft} />
    </section>
  )
}
