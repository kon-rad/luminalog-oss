'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  GALLERY_IMAGES,
  GALLERY_ROOMS,
  fullSrc,
  thumbSrc,
  videoSrc,
  type GalleryImage,
  type GalleryRoom,
} from '@/lib/contest/gallery'
import { knowledgeBySlug } from '@/lib/contest/knowledge'

type RoomFilter = GalleryRoom | 'all'

const SWIPE_COMMIT_RATIO = 0.18
const SWIPE_COMMIT_VELOCITY = 0.45

/* ─────────────────────────────── Lightbox ─────────────────────────────── */

function Lightbox({
  images,
  index,
  onIndex,
  onClose,
  onOpenTopic,
}: {
  images: GalleryImage[]
  index: number
  onIndex: (next: number) => void
  onClose: () => void
  onOpenTopic?: (slug: string) => void
}) {
  const [drag, setDrag] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [showInfo, setShowInfo] = useState(true)
  const trackRef = useRef<HTMLDivElement>(null)
  const gesture = useRef<{ x: number; y: number; t: number; axis: 'x' | 'y' | null } | null>(null)

  const image = images[index]
  const width = () => trackRef.current?.clientWidth ?? 1

  // Slide to a neighbour with a transition, then commit the index once it lands.
  const slideTo = useCallback(
    (dir: -1 | 1) => {
      const next = index + dir
      if (next < 0 || next >= images.length) {
        setDrag(0)
        return
      }
      setAnimating(true)
      setDrag(-dir * width())
      window.setTimeout(() => {
        setAnimating(false)
        setDrag(0)
        onIndex(next)
      }, 260)
    },
    [index, images.length, onIndex],
  )

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') slideTo(1)
      else if (e.key === 'ArrowLeft') slideTo(-1)
      else if (e.key === 'i' || e.key === 'I') setShowInfo((v) => !v)
    }
    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose, slideTo])

  const onTouchStart = (e: React.TouchEvent) => {
    if (animating) return
    const t = e.touches[0]
    gesture.current = { x: t.clientX, y: t.clientY, t: Date.now(), axis: null }
  }

  const onTouchMove = (e: React.TouchEvent) => {
    const g = gesture.current
    if (!g || animating) return
    const t = e.touches[0]
    const dx = t.clientX - g.x
    const dy = t.clientY - g.y
    // Lock the axis once the gesture has clearly committed to one direction.
    if (!g.axis) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
      g.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y'
    }
    if (g.axis !== 'x') return
    // Rubber-band at the ends instead of letting the track run off.
    const atEdge = (dx > 0 && index === 0) || (dx < 0 && index === images.length - 1)
    setDrag(atEdge ? dx * 0.28 : dx)
  }

  const onTouchEnd = () => {
    const g = gesture.current
    gesture.current = null
    if (!g || g.axis !== 'x' || animating) {
      setDrag(0)
      return
    }
    const elapsed = Math.max(1, Date.now() - g.t)
    const velocity = Math.abs(drag) / elapsed
    const passed = Math.abs(drag) > width() * SWIPE_COMMIT_RATIO || velocity > SWIPE_COMMIT_VELOCITY
    if (passed && drag < 0) slideTo(1)
    else if (passed && drag > 0) slideTo(-1)
    else setDrag(0)
  }

  const slides: { img: GalleryImage; offset: number }[] = []
  for (let d = -1; d <= 1; d++) {
    const img = images[index + d]
    if (img) slides.push({ img, offset: d })
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`${image.title} — image ${index + 1} of ${images.length}`}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: '#0B0908',
        display: 'flex',
        flexDirection: 'column',
        touchAction: 'pan-y',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          padding: '14px 16px',
          color: 'rgba(255,250,240,0.75)',
          fontSize: 13,
          fontWeight: 600,
          letterSpacing: '0.03em',
          flexShrink: 0,
        }}
      >
        <span>
          {index + 1} / {images.length}
        </span>
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            onClick={() => setShowInfo((v) => !v)}
            aria-pressed={showInfo}
            style={lightboxChip}
          >
            {showInfo ? 'Hide info' : 'Show info'}
          </button>
          <button type="button" onClick={onClose} aria-label="Close viewer" style={lightboxChip}>
            Close ✕
          </button>
        </div>
      </div>

      {/* Image track */}
      <div
        ref={trackRef}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}
      >
        {slides.map(({ img, offset }) => (
          <div
            key={img.id}
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 8px',
              transform: `translateX(calc(${offset * 100}% + ${drag}px))`,
              transition: animating ? 'transform .26s cubic-bezier(.22,.61,.36,1)' : 'none',
              willChange: 'transform',
            }}
          >
            {img.kind === 'video' ? (
              <video
                key={img.id}
                src={videoSrc(img.id)}
                poster={fullSrc(img.id)}
                controls
                loop
                muted
                playsInline
                preload={offset === 0 ? 'auto' : 'none'}
                autoPlay={offset === 0}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: 8,
                  background: '#000',
                }}
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={fullSrc(img.id)}
                alt={img.caption}
                draggable={false}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  objectFit: 'contain',
                  borderRadius: 8,
                  userSelect: 'none',
                }}
              />
            )}
          </div>
        ))}

        {/* Desktop arrows */}
        {index > 0 && (
          <button type="button" onClick={() => slideTo(-1)} aria-label="Previous image" style={{ ...arrowStyle, left: 12 }}>
            ‹
          </button>
        )}
        {index < images.length - 1 && (
          <button type="button" onClick={() => slideTo(1)} aria-label="Next image" style={{ ...arrowStyle, right: 12 }}>
            ›
          </button>
        )}
      </div>

      {/* Caption panel */}
      {showInfo && (
        <div
          style={{
            flexShrink: 0,
            maxHeight: '38vh',
            overflowY: 'auto',
            padding: '18px 20px 26px',
            borderTop: '1px solid rgba(255,240,220,0.10)',
            background: 'rgba(18,14,10,0.9)',
          }}
        >
          <div style={{ maxWidth: 760, margin: '0 auto' }}>
            <h3 className="serif" style={{ fontSize: 20, fontWeight: 600, color: '#F3EEE4', marginBottom: 6 }}>
              {image.title}
            </h3>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: 'rgba(243,238,228,0.78)' }}>{image.caption}</p>

            {image.text && (
              <details style={{ marginTop: 14 }}>
                <summary
                  style={{
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: '#E5A063',
                  }}
                >
                  Text in this photo
                </summary>
                <p
                  style={{
                    marginTop: 10,
                    fontSize: 14,
                    lineHeight: 1.65,
                    color: 'rgba(243,238,228,0.62)',
                    fontStyle: 'italic',
                  }}
                >
                  {image.text}
                </p>
              </details>
            )}

            {image.topics.length > 0 && (
              <div style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'rgba(243,238,228,0.45)' }}>Read more:</span>
                {image.topics.map((slug) => {
                  const entry = knowledgeBySlug(slug)
                  if (!entry) return null
                  return (
                    <button
                      key={slug}
                      type="button"
                      onClick={() => {
                        onOpenTopic?.(slug)
                        onClose()
                      }}
                      style={{
                        padding: '5px 11px',
                        borderRadius: 999,
                        fontSize: 12.5,
                        fontWeight: 600,
                        color: '#E5A063',
                        border: '1px solid rgba(229,160,99,0.35)',
                        background: 'rgba(229,160,99,0.10)',
                      }}
                    >
                      {entry.title}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const lightboxChip: React.CSSProperties = {
  padding: '6px 12px',
  borderRadius: 999,
  fontSize: 12.5,
  fontWeight: 600,
  color: 'rgba(255,250,240,0.85)',
  border: '1px solid rgba(255,240,220,0.18)',
  background: 'rgba(255,240,220,0.06)',
}

const arrowStyle: React.CSSProperties = {
  position: 'absolute',
  top: '50%',
  transform: 'translateY(-50%)',
  width: 44,
  height: 44,
  borderRadius: 999,
  fontSize: 26,
  lineHeight: 1,
  color: 'rgba(255,250,240,0.9)',
  background: 'rgba(30,24,18,0.55)',
  border: '1px solid rgba(255,240,220,0.14)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
}

/* ────────────────────────────── Tile gallery ───────────────────────────── */

/** Two tiles across on a phone, three from tablet up (the page wrap caps at 780px). */
const columnsForWidth = (width: number) => (width < 430 ? 2 : 3)

export default function PhotoGallery({ onOpenTopic }: { onOpenTopic?: (slug: string) => void }) {
  const [room, setRoom] = useState<RoomFilter>('all')
  const [openIndex, setOpenIndex] = useState<number | null>(null)
  const [columnCount, setColumnCount] = useState(3)
  const gridRef = useRef<HTMLDivElement>(null)

  const images = useMemo(
    () => (room === 'all' ? GALLERY_IMAGES : GALLERY_IMAGES.filter((i) => i.room === room)),
    [room],
  )

  // Measure the grid rather than the viewport so the count is right inside any container.
  useEffect(() => {
    const el = gridRef.current
    if (!el) return
    const measure = () => {
      const width = el.clientWidth
      if (width) setColumnCount(columnsForWidth(width))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const columns = useMemo(() => {
    const cols: { img: GalleryImage; index: number }[][] = Array.from({ length: columnCount }, () => [])
    images.forEach((img, index) => cols[index % columnCount].push({ img, index }))
    return cols
  }, [images, columnCount])

  const activeRoom = GALLERY_ROOMS.find((r) => r.id === room)
  const photoCount = GALLERY_IMAGES.filter((i) => i.kind === 'image').length
  const videoCount = GALLERY_IMAGES.length - photoCount

  return (
    <div>
      {/* Room filter */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <FilterChip active={room === 'all'} onClick={() => setRoom('all')}>
          All {GALLERY_IMAGES.length}
        </FilterChip>
        {GALLERY_ROOMS.map((r) => (
          <FilterChip key={r.id} active={room === r.id} onClick={() => setRoom(r.id)}>
            {r.label}
          </FilterChip>
        ))}
      </div>

      <p style={{ fontSize: 15, lineHeight: 1.62, color: 'var(--text2)', marginBottom: 22 }}>
        {activeRoom
          ? activeRoom.blurb
          : `Everything we shot on the morning of 30 July 2026, in the order it was taken — ${photoCount} photographs and ${videoCount} short video${videoCount === 1 ? '' : 's'}. Tap any tile to open it full-screen; swipe or use the arrow keys to move between them.`}
      </p>

      {/* Masonry tiles. Round-robin across columns rather than CSS `columns`, so the
          visual reading order stays left-to-right / top-to-bottom, matching the order
          the lightbox pages through. */}
      <div ref={gridRef} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        {columns.map((col, c) => (
          <div key={c} style={{ flex: 1, minWidth: 0, display: 'grid', gap: 12, alignContent: 'start' }}>
            {col.map(({ img, index }) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setOpenIndex(index)}
                aria-label={`Open ${img.title}`}
                style={{
                  display: 'block',
                  width: '100%',
                  borderRadius: 12,
                  overflow: 'hidden',
                  position: 'relative',
                  background: 'var(--surfaceAlt)',
                  border: '1px solid var(--hairline)',
                  lineHeight: 0,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbSrc(img.id)}
                  alt={img.caption}
                  width={img.width}
                  height={img.height}
                  loading="lazy"
                  decoding="async"
                  style={{ width: '100%', height: 'auto', display: 'block' }}
                />
                {img.text && <TileBadge title="Contains transcribed text">TEXT</TileBadge>}
                {img.kind === 'video' && (
                  <>
                    <TileBadge title="Video" left>
                      ▶ {formatDuration(img.durationSec)}
                    </TileBadge>
                    <span
                      aria-hidden
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background:
                          'linear-gradient(to bottom, rgba(0,0,0,0.18), transparent 38%, transparent 70%, rgba(0,0,0,0.22))',
                        pointerEvents: 'none',
                      }}
                    />
                  </>
                )}
              </button>
            ))}
          </div>
        ))}
      </div>

      {openIndex !== null && images[openIndex] && (
        <Lightbox
          images={images}
          index={openIndex}
          onIndex={setOpenIndex}
          onClose={() => setOpenIndex(null)}
          onOpenTopic={onOpenTopic}
        />
      )}
    </div>
  )
}

/** "0:04" from a duration in seconds. */
function formatDuration(seconds?: number): string {
  const total = Math.max(1, Math.round(seconds ?? 0))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}

function TileBadge({
  children,
  title,
  left = false,
}: {
  children: React.ReactNode
  title?: string
  left?: boolean
}) {
  return (
    <span
      aria-hidden
      title={title}
      style={{
        position: 'absolute',
        top: 8,
        ...(left ? { left: 8 } : { right: 8 }),
        padding: '2px 7px',
        borderRadius: 999,
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: '0.06em',
        color: '#fff',
        background: 'rgba(20,16,12,0.55)',
        backdropFilter: 'blur(6px)',
        lineHeight: 1.7,
        zIndex: 1,
      }}
    >
      {children}
    </span>
  )
}

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        padding: '7px 14px',
        borderRadius: 999,
        fontSize: 13.5,
        fontWeight: 600,
        color: active ? '#fff' : 'var(--text2)',
        background: active ? 'var(--accent)' : 'var(--surfaceAlt)',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--hairline2)'}`,
        transition: 'background .15s, color .15s',
      }}
    >
      {children}
    </button>
  )
}
