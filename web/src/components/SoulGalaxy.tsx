'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
/** Minimal shape the galaxy renders. The authed `ConstellationPoint` is a
 *  superset (extra date/dayIndex/streak), and the PUBLIC point-set is exactly
 *  this (coords + size only) — so one component serves both surfaces. */
export interface GalaxyPoint {
  x: number
  y: number
  z: number
  wordCount: number
}

const AMBER = '#E8A44C'
const AMBER_WARM = 'rgba(232,164,76,'

/** Procedural soft radial-glow sprite texture — warm amber core fading to nothing. No image assets needed. */
function makeGlowTexture(): THREE.Texture {
  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')!
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  g.addColorStop(0, 'rgba(255,247,232,1)')
  g.addColorStop(0.16, AMBER_WARM + '0.95)')
  g.addColorStop(0.42, AMBER_WARM + '0.32)')
  g.addColorStop(1, AMBER_WARM + '0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, size, size)
  const tex = new THREE.CanvasTexture(canvas)
  tex.needsUpdate = true
  return tex
}

/** Gentle, clamped size mapping so no single journal entry can dominate the sky. */
function starScale(wordCount: number): number {
  const min = 0.05
  const max = 0.15
  const norm = Math.sqrt(Math.min(Math.max(wordCount, 0), 3000) / 3000)
  return min + norm * (max - min)
}

function Star({ point, texture }: { point: GalaxyPoint; texture: THREE.Texture }) {
  const ref = useRef<THREE.Sprite>(null)
  const phase = useMemo(() => Math.random() * Math.PI * 2, [])
  const speed = useMemo(() => 0.5 + Math.random() * 0.7, [])
  const base = useMemo(() => starScale(point.wordCount), [point.wordCount])

  useFrame(({ clock }) => {
    const sprite = ref.current
    if (!sprite) return
    const t = clock.getElapsedTime()
    const twinkle = 0.85 + 0.15 * Math.sin(t * speed + phase)
    sprite.scale.setScalar(base * twinkle)
    const mat = sprite.material as THREE.SpriteMaterial
    mat.opacity = 0.78 + 0.22 * Math.sin(t * speed * 1.4 + phase)
  })

  return (
    <sprite ref={ref} position={[point.x, point.y, point.z]} scale={base}>
      <spriteMaterial
        attach="material"
        map={texture}
        color={AMBER}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </sprite>
  )
}

/** A few hundred faint, static, distant points for depth — not the real constellation. */
function Backdrop({ count = 260 }: { count?: number }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i++) {
      const r = 2.6 + Math.random() * 3.4
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      arr[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      arr[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      arr[i * 3 + 2] = r * Math.cos(phi) - 1.2
    }
    return arr
  }, [count])

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={count} array={positions} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial color="#c7cdf5" size={0.014} sizeAttenuation transparent opacity={0.4} depthWrite={false} />
    </points>
  )
}

/** Connect each star to its single nearest neighbor so the sky reads as a constellation. */
function useNearestNeighborLines(points: GalaxyPoint[], maxLines = 220): Float32Array | null {
  return useMemo(() => {
    const n = points.length
    if (n < 2) return null
    const seen = new Set<string>()
    const segments: number[] = []
    for (let i = 0; i < n; i++) {
      let bestJ = -1
      let bestDist = Infinity
      for (let j = 0; j < n; j++) {
        if (i === j) continue
        const dx = points[i].x - points[j].x
        const dy = points[i].y - points[j].y
        const dz = points[i].z - points[j].z
        const d = dx * dx + dy * dy + dz * dz
        if (d < bestDist) {
          bestDist = d
          bestJ = j
        }
      }
      if (bestJ === -1) continue
      const key = i < bestJ ? `${i}-${bestJ}` : `${bestJ}-${i}`
      if (seen.has(key)) continue
      seen.add(key)
      segments.push(points[i].x, points[i].y, points[i].z, points[bestJ].x, points[bestJ].y, points[bestJ].z)
      if (seen.size >= maxLines) break
    }
    return segments.length ? new Float32Array(segments) : null
  }, [points, maxLines])
}

function ConstellationLines({ points }: { points: GalaxyPoint[] }) {
  const positions = useNearestNeighborLines(points)
  if (!positions) return null
  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={positions.length / 3} array={positions} itemSize={3} />
      </bufferGeometry>
      <lineBasicMaterial color={AMBER} transparent opacity={0.22} depthWrite={false} />
    </lineSegments>
  )
}

/** OrbitControls' subset we drive imperatively to frame the constellation. */
interface FramableControls {
  target: THREE.Vector3
  minDistance: number
  maxDistance: number
  update: () => void
}

/** Frames the whole constellation: positions the camera so the point cloud's
 *  bounding sphere fits the viewport with a margin — zooms OUT for a large, wide
 *  soul and IN for a small one — and points OrbitControls' target at its center.
 *  Re-runs whenever the points or the canvas size change, so the structure stays
 *  captured on resize. autoRotate then orbits around that fitted center. */
function FitCamera({ points }: { points: GalaxyPoint[] }) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const controls = useThree((s) => s.controls) as unknown as FramableControls | null
  const width = useThree((s) => s.size.width)
  const height = useThree((s) => s.size.height)

  useEffect(() => {
    if (!points.length || !controls) return

    const box = new THREE.Box3()
    const v = new THREE.Vector3()
    for (const p of points) box.expandByPoint(v.set(p.x, p.y, p.z))
    const sphere = box.getBoundingSphere(new THREE.Sphere())
    const center = sphere.center.clone()
    // Pad by the largest possible star half-size (0.15) so edge glow sprites
    // aren't clipped, and floor it so a single-star soul still frames sensibly.
    const radius = Math.max(sphere.radius + 0.15, 0.35)

    // Fit against whichever axis is tighter (portrait → vertical FOV, landscape
    // → horizontal FOV) so no part of the structure spills off-screen.
    const vFov = (camera.fov * Math.PI) / 180
    const aspect = width / Math.max(height, 1)
    const hFov = 2 * Math.atan(Math.tan(vFov / 2) * aspect)
    const fitFov = Math.min(vFov, hFov)
    const margin = 1.25
    const distance = (radius * margin) / Math.sin(fitFov / 2)

    controls.target.copy(center)
    camera.position.set(center.x, center.y, center.z + distance)
    camera.near = Math.max(distance * 0.02, 0.01)
    camera.far = Math.max(distance * 8, 40)
    camera.updateProjectionMatrix()

    // Let the user pinch/scroll a little past the auto-fit either way.
    controls.minDistance = distance * 0.4
    controls.maxDistance = distance * 3
    controls.update()
  }, [points, camera, controls, width, height])

  return null
}

function Scene({ points, texture }: { points: GalaxyPoint[]; texture: THREE.Texture }) {
  return (
    <>
      <Backdrop />
      <ConstellationLines points={points} />
      {points.map((p, i) => (
        <Star key={`star-${i}`} point={p} texture={texture} />
      ))}
      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom
        autoRotate
        autoRotateSpeed={0.5}
        rotateSpeed={0.5}
      />
      <FitCamera points={points} />
    </>
  )
}

function EmptyState() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: '0 48px',
      }}
    >
      <style>{`
        @keyframes soul-seed-pulse {
          0%, 100% { transform: scale(1); opacity: 0.55; }
          50% { transform: scale(1.12); opacity: 0.85; }
        }
      `}</style>
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 180,
          height: 180,
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(232,164,76,0.55) 0%, rgba(232,164,76,0.18) 45%, rgba(232,164,76,0) 72%)',
          filter: 'blur(6px)',
          animation: 'soul-seed-pulse 3.6s ease-in-out infinite',
        }}
      />
      <div
        aria-hidden
        style={{
          position: 'absolute',
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: '#F7E3C4',
          boxShadow: '0 0 16px 6px rgba(232,164,76,0.85)',
        }}
      />
      <p
        className="serif"
        style={{
          position: 'relative',
          maxWidth: 320,
          fontSize: 18,
          lineHeight: 1.5,
          fontStyle: 'italic',
          color: 'rgba(243,238,228,0.88)',
        }}
      >
        Your constellation begins with your first 750-word day.
      </p>
    </div>
  )
}

export interface SoulGalaxyProps {
  points: GalaxyPoint[]
}

export default function SoulGalaxy({ points }: SoulGalaxyProps) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const texture = useMemo(() => (mounted ? makeGlowTexture() : null), [mounted])
  useEffect(() => {
    return () => {
      texture?.dispose()
    }
  }, [texture])

  // r3f v8's <Canvas> only boots its root once react-use-measure reports a
  // non-zero container size, and that very first measurement is delivered by a
  // ResizeObserver. If the initial ResizeObserver callback is delayed or
  // suppressed (the tab is backgrounded at mount, certain test harnesses,
  // layout-timing races), the boot gate never fires: the root never mounts and
  // the <canvas> is stuck at its intrinsic 300x150. react-use-measure ALSO
  // re-measures synchronously on a window 'resize' event, so nudging one right
  // after the Canvas mounts forces a deterministic boot without waiting on the
  // observer's first async delivery. Harmless when the observer fires normally.
  useEffect(() => {
    if (!mounted || !texture) return
    const id = window.setTimeout(() => window.dispatchEvent(new Event('resize')), 0)
    return () => window.clearTimeout(id)
  }, [mounted, texture])

  const isEmpty = points.length === 0

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: 'clamp(340px, 46vw, 420px)',
        borderRadius: 28,
        overflow: 'hidden',
        background:
          'radial-gradient(120% 110% at 26% 18%, #2E2A5E 0%, #1B1740 32%, #100D28 58%, #07060F 82%, #030308 100%)',
        boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.06), 0 20px 60px rgba(8,6,20,0.45)',
      }}
    >
      {isEmpty ? (
        <EmptyState />
      ) : mounted && texture ? (
        <Canvas
          camera={{ position: [0, 0, 3.4], fov: 50 }}
          gl={{ antialias: true, alpha: true }}
          dpr={[1, 2]}
          style={{ touchAction: 'none' }}
        >
          <Scene points={points} texture={texture} />
        </Canvas>
      ) : null}

      {/* Soft vignette for depth, sits above the canvas */}
      <div
        aria-hidden
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          background: 'radial-gradient(120% 120% at 50% 50%, rgba(0,0,0,0) 55%, rgba(3,3,8,0.55) 100%)',
        }}
      />
    </div>
  )
}
