'use client'

import { useEffect, useRef, useState } from 'react'

/* Concurrent viewers over one stream, summed across platforms: a single-series
 * line with a light area, a recessive grid, and a crosshair tooltip on hover or
 * touch that breaks the total down by platform. One series, so no legend. */

interface Point { t: string; v: number; by?: Record<string, number> }

const H = 200
const PAD = { top: 14, right: 16, bottom: 26, left: 40 }

function niceMax(v: number): number {
  if (v <= 4) return 4
  const pow = 10 ** Math.floor(Math.log10(v))
  for (const m of [1, 2, 2.5, 5, 10]) if (m * pow >= v) return m * pow
  return 10 * pow
}

const time = (iso: string) => new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

export default function ViewersChart({ points, live, labels = {} }: { points: Point[]; live: boolean; labels?: Record<string, string> }) {
  const box = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  const [hover, setHover] = useState<number | null>(null)

  useEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(240, Math.round(e.contentRect.width))))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  if (points.length === 0) return null

  const t0 = Date.parse(points[0].t)
  const t1 = Math.max(Date.parse(points[points.length - 1].t), t0 + 60_000)
  const yMax = niceMax(Math.max(...points.map((p) => p.v)))
  const plotW = width - PAD.left - PAD.right
  const plotH = H - PAD.top - PAD.bottom
  const x = (iso: string) => PAD.left + ((Date.parse(iso) - t0) / (t1 - t0)) * plotW
  const y = (v: number) => PAD.top + plotH - (v / yMax) * plotH

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`).join('')
  const area = `${line}L${x(points[points.length - 1].t).toFixed(1)},${y(0)}L${x(points[0].t).toFixed(1)},${y(0)}Z`
  const ticks = [0, yMax / 2, yMax]

  const nearest = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect()
    if (!rect) return null
    const px = clientX - rect.left
    let best = 0
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(x(points[i].t) - px) < Math.abs(x(points[best].t) - px)) best = i
    }
    return best
  }

  const shown = hover ?? (live ? points.length - 1 : null)
  const hp = shown === null ? null : points[shown]
  const peak = Math.max(...points.map((p) => p.v))

  return (
    <div ref={box} style={{ position: 'relative', width: '100%' }}>
      <svg
        width={width}
        height={H}
        role="img"
        aria-label={`Concurrent viewers from ${time(points[0].t)} to ${time(points[points.length - 1].t)}, peak ${peak}`}
        style={{ display: 'block', touchAction: 'pan-y' }}
        onPointerMove={(e) => setHover(nearest(e.clientX))}
        onPointerLeave={() => setHover(null)}
      >
        {ticks.map((v) => (
          <g key={v}>
            <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--hairline2)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(v) + 4} textAnchor="end" fontSize={12} fill="var(--text3)">{v.toLocaleString('en-US')}</text>
          </g>
        ))}
        <path d={area} fill="var(--accent)" fillOpacity={0.12} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        <text x={PAD.left} y={H - 6} fontSize={12} fill="var(--text3)" suppressHydrationWarning>{time(points[0].t)}</text>
        <text x={width - PAD.right} y={H - 6} textAnchor="end" fontSize={12} fill="var(--text3)" suppressHydrationWarning>
          {live ? 'now' : time(points[points.length - 1].t)}
        </text>
        {hp && (
          <g>
            <line x1={x(hp.t)} x2={x(hp.t)} y1={PAD.top} y2={y(0)} stroke="var(--text3)" strokeWidth={1} strokeDasharray="3 3" />
            <circle cx={x(hp.t)} cy={y(hp.v)} r={5} fill="var(--accent)" stroke="var(--bg)" strokeWidth={2} />
          </g>
        )}
      </svg>
      {hp && (
        <div
          style={{
            position: 'absolute', top: 0, pointerEvents: 'none',
            left: Math.min(Math.max(x(hp.t) - 90, 0), width - 180), width: 180, whiteSpace: 'nowrap',
            padding: '4px 8px', borderRadius: 8, fontSize: 12, textAlign: 'center',
            background: 'var(--surface)', border: '1px solid var(--hairline2)', color: 'var(--text)',
          }}
          suppressHydrationWarning
        >
          <strong>{hp.v.toLocaleString('en-US')}</strong> watching · {time(hp.t)}
          {hp.by && Object.keys(hp.by).length > 1 && (
            <div style={{ color: 'var(--text2)' }}>
              {Object.entries(hp.by).map(([p, n]) => `${labels[p] ?? p} ${n.toLocaleString('en-US')}`).join(' · ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
