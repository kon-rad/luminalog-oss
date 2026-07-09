'use client'

// Fullscreen Soul viewer — opened by the SoulCard's expand affordance (mirrors
// the iOS Home "expand" button, screenshot #3). Fills the viewport with the
// constellation on the cosmic backdrop, with the wallet address + BaseScan
// link at the bottom. Escape / backdrop / close-button all dismiss. Points are
// passed in (already loaded by SoulCard) — this component never fetches.

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { X } from 'lucide-react'
import type { GalaxyPoint } from '@/components/SoulGalaxy'
import { basescanNftUrl, type SoulNft } from '@/lib/useSoul'

// SoulGalaxy is client-only (react-three-fiber touches window/WebGL); no SSR.
const SoulGalaxy = dynamic(() => import('@/components/SoulGalaxy'), { ssr: false })

const COSMIC_BG =
  'radial-gradient(130% 120% at 50% 0%, #211d4a 0%, #16123a 26%, #0d0a24 52%, #06050f 82%, #030308 100%)'

interface SoulModalProps {
  open: boolean
  onClose: () => void
  points: GalaxyPoint[]
  nft: SoulNft | null
}

export default function SoulModal({ open, onClose, points, nft }: SoulModalProps) {
  // Escape closes — client-only listener, attached only while open.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col"
      style={{ background: COSMIC_BG }}
      role="dialog"
      aria-modal="true"
      aria-label="Your Soul"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-full"
        style={{ background: 'rgba(255,255,255,0.08)', color: '#F3EEE4' }}
      >
        <X size={20} strokeWidth={2} />
      </button>

      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
        <div className="w-full max-w-3xl">
          <SoulGalaxy points={points} />
        </div>
      </div>

      {nft && (
        <div className="flex flex-col items-center gap-2 px-6 pb-[max(24px,env(safe-area-inset-bottom))] pt-2 text-center">
          <span
            className="max-w-full truncate font-mono text-xs"
            style={{ color: 'rgba(243,238,228,0.55)' }}
            title={nft.walletAddress}
          >
            {nft.walletAddress}
          </span>
          <a
            href={basescanNftUrl(nft)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-sans text-sm font-semibold"
            style={{ color: '#E8A44C' }}
          >
            View NFT on BaseScan ↗
          </a>
        </div>
      )}
    </div>
  )
}
