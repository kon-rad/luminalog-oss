import type { GalaxyPoint } from '@/components/SoulGalaxy'

/**
 * A deterministic, marketing-safe constellation for the landing page's Soul
 * section. Not real user data. Built from a golden-angle spiral (no
 * Math.random) so the point set is identical on every render, server and
 * client, which avoids a hydration mismatch.
 */
export function generateSoulDemoPoints(count = 48): GalaxyPoint[] {
  const points: GalaxyPoint[] = []
  const goldenAngle = Math.PI * (3 - Math.sqrt(5))
  for (let i = 0; i < count; i++) {
    const t = i / Math.max(count - 1, 1)
    const radius = 0.3 + t * 1.6
    const angle = i * goldenAngle
    const x = Math.cos(angle) * radius
    const y = Math.sin(angle) * radius * 0.6
    const z = Math.sin(i * 0.7) * 0.5
    // Word counts ramp gently with the spiral so later stars read larger,
    // consistent with a growing practice, never exceeding a plausible day.
    const wordCount = 200 + Math.round(t * 1400)
    points.push({ x, y, z, wordCount })
  }
  return points
}
