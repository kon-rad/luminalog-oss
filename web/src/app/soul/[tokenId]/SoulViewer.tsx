'use client'

import dynamic from 'next/dynamic'
import type { GalaxyPoint } from '@/components/SoulGalaxy'

// SoulGalaxy is client-only (react-three-fiber touches window); load it with no SSR.
const SoulGalaxy = dynamic(() => import('@/components/SoulGalaxy'), { ssr: false })

export default function SoulViewer({ points }: { points: GalaxyPoint[] }) {
  return <SoulGalaxy points={points} />
}
