import { createCanvas, type SKRSContext2D } from '@napi-rs/canvas'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { s3 } from '../s3'
import { config } from '../../config'

export interface Point3D {
  x: number
  y: number
  z: number
}

const SIZE = 1200
const PAD = 140

const clamp = (v: number) => Math.max(-1, Math.min(1, v))

/** Radial glow "star" at (cx,cy). */
function drawStar(ctx: SKRSContext2D, cx: number, cy: number, r: number, alpha: number): void {
  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r * 3)
  g.addColorStop(0, `rgba(224,236,255,${alpha})`)
  g.addColorStop(0.35, `rgba(150,185,255,${alpha * 0.6})`)
  g.addColorStop(1, 'rgba(120,160,255,0)')
  ctx.fillStyle = g
  ctx.beginPath()
  ctx.arc(cx, cy, r * 3, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = `rgba(255,255,255,${Math.min(1, alpha + 0.2)})`
  ctx.beginPath()
  ctx.arc(cx, cy, Math.max(1.2, r * 0.5), 0, Math.PI * 2)
  ctx.fill()
}

/** Indices of the `k` nearest neighbours of point `i` (by 2D distance). */
function nearest(proj: { px: number; py: number }[], i: number, k: number): number[] {
  return proj
    .map((p, j) => ({ j, d: (p.px - proj[i].px) ** 2 + (p.py - proj[i].py) ** 2 }))
    .filter(o => o.j !== i)
    .sort((a, b) => a.d - b.d)
    .slice(0, k)
    .map(o => o.j)
}

/**
 * Deterministic hero image for the soul: a fixed-camera orthographic projection
 * of the point-set — (x,y) → canvas position, z → depth (glow size/brightness) —
 * with faint nearest-neighbour links on a dark starfield. No headless GL, no
 * randomness. An empty point-set renders a single "nascent soul" seed glow.
 */
export function renderSoulPng(points: Point3D[]): Buffer {
  const canvas = createCanvas(SIZE, SIZE)
  const ctx = canvas.getContext('2d')

  const bg = ctx.createRadialGradient(SIZE / 2, SIZE / 2, 0, SIZE / 2, SIZE / 2, SIZE / 1.3)
  bg.addColorStop(0, '#0b1022')
  bg.addColorStop(1, '#05070f')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, SIZE, SIZE)

  if (points.length === 0) {
    drawStar(ctx, SIZE / 2, SIZE / 2, 7, 0.45)
    return canvas.toBuffer('image/png')
  }

  const span = SIZE - 2 * PAD
  const proj = points.map(p => ({
    px: PAD + ((clamp(p.x) + 1) / 2) * span,
    py: PAD + ((clamp(p.y) + 1) / 2) * span,
    depth: (clamp(p.z) + 1) / 2, // 0..1
  }))

  ctx.lineWidth = 1
  for (let i = 0; i < proj.length; i++) {
    for (const j of nearest(proj, i, 2)) {
      if (j <= i) continue // draw each pair once
      ctx.strokeStyle = 'rgba(130,170,255,0.10)'
      ctx.beginPath()
      ctx.moveTo(proj[i].px, proj[i].py)
      ctx.lineTo(proj[j].px, proj[j].py)
      ctx.stroke()
    }
  }

  for (const p of proj) {
    drawStar(ctx, p.px, p.py, 4 + p.depth * 7, 0.5 + p.depth * 0.5)
  }

  return canvas.toBuffer('image/png')
}

export const heroKey = (tokenId: string) => `soul/${tokenId}/hero.png`

/** Public URL for the hero object. The bucket/CDN must serve this key publicly
 *  (marketplaces fetch it unauthenticated). */
export const heroUrl = (tokenId: string) =>
  `https://${config.AWS_S3_BUCKET}.s3.${config.AWS_REGION}.amazonaws.com/${heroKey(tokenId)}`

/** Render the point-set and upload the PNG to S3; return its public URL. */
export async function renderAndStoreSoulImage(tokenId: string, points: Point3D[]): Promise<string> {
  const png = renderSoulPng(points)
  await s3.send(
    new PutObjectCommand({
      Bucket: config.AWS_S3_BUCKET,
      Key: heroKey(tokenId),
      Body: png,
      ContentType: 'image/png',
      CacheControl: 'public, max-age=300',
    }),
  )
  return heroUrl(tokenId)
}
