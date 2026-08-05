'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CameraGlyph,
  CalendarGlyph,
  ClockGlyph,
  PinGlyph,
  TypePill,
  formatEventDate,
} from '@/components/events'
import { PAST_EVENTS, type PastEvent } from '@/lib/events/pastEvents'

interface LightboxState {
  event: PastEvent
  index: number
}

export default function PastEvents() {
  const [onlyPhotos, setOnlyPhotos] = useState(false)
  const [lightbox, setLightbox] = useState<LightboxState | null>(null)

  const events = onlyPhotos ? PAST_EVENTS.filter((e) => e.photos.length > 0) : PAST_EVENTS
  const withPhotos = PAST_EVENTS.filter((e) => e.photos.length > 0).length

  const close = useCallback(() => setLightbox(null), [])
  const step = useCallback((dir: number) => {
    setLightbox((lb) => {
      if (!lb) return lb
      const n = lb.event.photos.length
      return { ...lb, index: (lb.index + dir + n) % n }
    })
  }, [])

  useEffect(() => {
    if (!lightbox) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') step(1)
      if (e.key === 'ArrowLeft') step(-1)
    }
    window.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [lightbox, close, step])

  return (
    <div>
      {/* Filter */}
      <div className="flex items-center gap-2.5" style={{ marginBottom: 26 }}>
        <FilterChip active={!onlyPhotos} onClick={() => setOnlyPhotos(false)}>
          All ({PAST_EVENTS.length})
        </FilterChip>
        <FilterChip active={onlyPhotos} onClick={() => setOnlyPhotos(true)}>
          <CameraGlyph /> With photos ({withPhotos})
        </FilterChip>
      </div>

      {/* Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 22 }}>
        {events.map((event) => (
          <article key={event.slug} className="card flex flex-col overflow-hidden">
            {event.coverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={event.coverUrl} alt="" loading="lazy" className="w-full object-cover" style={{ aspectRatio: '16 / 9' }} />
            )}

            <div className="flex flex-1 flex-col" style={{ padding: '22px 24px 24px' }}>
              <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                <TypePill type={event.eventType} />
                {event.photos.length > 0 && (
                  <span className="inline-flex items-center gap-1" style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)' }}>
                    <CameraGlyph size={12} /> {event.photos.length}
                  </span>
                )}
              </div>

              <h3
                className="serif"
                style={{ fontSize: 21, fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: 12 }}
              >
                {event.title}
              </h3>

              <div className="flex flex-col gap-1.5" style={{ marginBottom: 14 }}>
                <Meta icon={<CalendarGlyph />}>{formatEventDate(event.date)}</Meta>
                <Meta icon={<ClockGlyph />}>{event.time}</Meta>
                <Meta icon={<PinGlyph />}>{event.location}</Meta>
              </div>

              {event.description && (
                <p
                  style={{
                    fontSize: 15,
                    lineHeight: 1.55,
                    color: 'var(--text2)',
                    marginBottom: 16,
                    whiteSpace: 'pre-line',
                    display: '-webkit-box',
                    WebkitLineClamp: 3,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                >
                  {event.description}
                </p>
              )}

              {event.photos.length > 0 && (
                <div className="flex flex-wrap gap-2" style={{ marginBottom: 16 }}>
                  {event.photos.map((p, i) => (
                    <button
                      key={p.thumb}
                      type="button"
                      onClick={() => setLightbox({ event, index: i })}
                      aria-label={`Open photo ${i + 1} of ${event.title}`}
                      className="overflow-hidden"
                      style={{ width: 56, height: 56, borderRadius: 10, border: '1px solid var(--hairline2)' }}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              <a
                href={event.lumaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="eyebrow"
                style={{ marginTop: 'auto', textDecoration: 'none' }}
              >
                View on Luma →
              </a>
            </div>
          </article>
        ))}
      </div>

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 300, background: 'rgba(22,19,14,0.92)', padding: 16 }}
          onClick={close}
        >
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="absolute"
            style={{ top: 16, right: 16, color: 'var(--creamGlow, #FFF6E9)', padding: 8 }}
          >
            <CloseGlyph />
          </button>

          {lightbox.event.photos.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); step(-1) }}
                aria-label="Previous photo"
                className="absolute"
                style={{ left: 8, color: '#FFF6E9', padding: 8 }}
              >
                <ChevronGlyph dir="left" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); step(1) }}
                aria-label="Next photo"
                className="absolute"
                style={{ right: 8, color: '#FFF6E9', padding: 8 }}
              >
                <ChevronGlyph dir="right" />
              </button>
            </>
          )}

          <figure className="flex flex-col items-center" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 1000 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.event.photos[lightbox.index].full}
              alt={`${lightbox.event.title} photo ${lightbox.index + 1}`}
              className="w-auto object-contain"
              style={{ maxHeight: '78vh', borderRadius: 14 }}
            />
            <figcaption className="serif" style={{ marginTop: 14, fontSize: 15, color: 'rgba(255,246,233,0.75)', textAlign: 'center' }}>
              {lightbox.event.title} · {formatEventDate(lightbox.event.date)}
              {lightbox.event.photos.length > 1 && ` · ${lightbox.index + 1}/${lightbox.event.photos.length}`}
            </figcaption>
          </figure>
        </div>
      )}
    </div>
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
      className="inline-flex items-center gap-1.5 rounded-full transition-colors"
      style={{
        fontSize: 14,
        fontWeight: 600,
        padding: '7px 15px',
        color: active ? 'var(--accentDeep)' : 'var(--text2)',
        background: active ? 'var(--accentTint)' : 'transparent',
        border: `1px solid ${active ? 'var(--accent)' : 'var(--hairline2)'}`,
      }}
    >
      {children}
    </button>
  )
}

function Meta({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2" style={{ fontSize: 14.5, color: 'var(--text2)' }}>
      <span style={{ color: 'var(--accent)', flexShrink: 0, display: 'flex' }}>{icon}</span>
      {children}
    </div>
  )
}

function CloseGlyph() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" />
    </svg>
  )
}

function ChevronGlyph({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polyline points={dir === 'left' ? '15 5 8 12 15 19' : '9 5 16 12 9 19'} />
    </svg>
  )
}
