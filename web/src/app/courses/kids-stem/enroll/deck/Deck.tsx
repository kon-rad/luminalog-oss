'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Eye, EyeOff, Maximize2, Minimize2 } from 'lucide-react'
import { SLIDES, SLIDE_LINKS, VIDEO_SLIDE, VIDEO_SRC, VIDEO_SLOT, slideImage } from '@/lib/kids-stem/deck'
import './deck.css'

export default function Deck({ embedded = false }: { embedded?: boolean }) {
  const [index, setIndex] = useState(0)
  const [showNotes, setShowNotes] = useState(true)
  const [isFull, setIsFull] = useState(false)
  const rootRef = useRef<HTMLDivElement | null>(null)
  const videoRef = useRef<HTMLVideoElement | null>(null)

  const slide = SLIDES[index]
  const last = SLIDES.length - 1
  const links = SLIDE_LINKS[slide.n] ?? []

  const go = useCallback(
    (next: number) =>
      setIndex((cur) => {
        const clamped = Math.max(0, Math.min(last, next))
        return clamped === cur ? cur : clamped
      }),
    [last],
  )

  /* Never let the clip keep playing over a later slide. */
  useEffect(() => {
    if (slide.n !== VIDEO_SLIDE) videoRef.current?.pause()
  }, [slide.n])

  /* Preload the neighbouring slides so paging through feels instant. */
  useEffect(() => {
    for (const n of [index, index + 1, index + 2]) {
      if (n >= 0 && n <= last) {
        const img = new window.Image()
        img.src = slideImage(SLIDES[n].n)
      }
    }
  }, [index, last])

  /* Deep links, on the standalone page only. */
  useEffect(() => {
    if (embedded) return
    function fromHash() {
      const n = parseInt(window.location.hash.slice(1), 10)
      if (n >= 1 && n <= SLIDES.length) setIndex(n - 1)
    }
    fromHash()
    window.addEventListener('hashchange', fromHash)
    return () => window.removeEventListener('hashchange', fromHash)
  }, [embedded])

  useEffect(() => {
    if (embedded) return
    window.history.replaceState(null, '', `#${index + 1}`)
  }, [index, embedded])

  /* Fullscreen. Track the browser's own state so leaving with Escape, which we
   * never see as a click, still leaves the button label correct. */
  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen()
    else rootRef.current?.requestFullscreen?.()
  }, [])

  useEffect(() => {
    function onChange() {
      setIsFull(document.fullscreenElement === rootRef.current)
    }
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const el = e.target as HTMLElement | null
      const onControl = el && ['BUTTON', 'A', 'VIDEO', 'INPUT', 'TEXTAREA'].includes(el.tagName)
      if (e.key === 'ArrowRight' || e.key === 'PageDown') {
        e.preventDefault()
        go(index + 1)
      } else if (e.key === ' ' && !onControl) {
        e.preventDefault()
        go(index + 1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        go(index - 1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        go(0)
      } else if (e.key === 'End') {
        e.preventDefault()
        go(last)
      } else if (e.key === 'f' && !onControl) {
        e.preventDefault()
        toggleFull()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, index, last, toggleFull])

  const classes = ['deck']
  if (embedded) classes.push('deck-embedded')
  if (isFull) classes.push('deck-fullscreen')

  return (
    <div className={classes.join(' ')} ref={rootRef}>
      <div className="deck-stage">
        <div className="deck-slide" role="group" aria-label={`Slide ${slide.n} of ${SLIDES.length}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="deck-slide-img"
            src={slideImage(slide.n)}
            alt={slide.eyebrow || `Slide ${slide.n}`}
            draggable={false}
          />
          {slide.n === VIDEO_SLIDE && (
            <video
              ref={videoRef}
              className="deck-video"
              style={VIDEO_SLOT}
              src={VIDEO_SRC}
              controls
              preload="metadata"
              playsInline
            />
          )}
        </div>
      </div>

      <div className="deck-controls">
        <button className="deck-btn" onClick={() => go(index - 1)} disabled={index === 0}>
          <ChevronLeft aria-hidden="true" /> Previous
        </button>
        <span className="deck-count">
          {index + 1} / {SLIDES.length}
        </span>
        <button
          className="deck-btn deck-btn-primary"
          onClick={() => go(index + 1)}
          disabled={index === last}
        >
          Next <ChevronRight aria-hidden="true" />
        </button>
        <button className="deck-btn deck-btn-quiet" onClick={toggleFull}>
          {isFull ? <Minimize2 aria-hidden="true" /> : <Maximize2 aria-hidden="true" />}
          {isFull ? 'Exit full screen' : 'Full screen'}
        </button>
        <button className="deck-btn deck-btn-quiet" onClick={() => setShowNotes((v) => !v)}>
          {showNotes ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
          {showNotes ? 'Hide notes' : 'Show notes'}
        </button>
      </div>

      {showNotes && (slide.notes.length > 0 || links.length > 0) && (
        <div className="deck-notes">
          <p className="deck-notes-label">What is said on this slide</p>
          {slide.notes.map((n, i) => (
            <p key={`${slide.n}-${i}`} className="deck-note">
              {n}
            </p>
          ))}
          {links.length > 0 && (
            <p className="deck-note-links">
              {links.map((l) => (
                <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer">
                  {l.label}
                </a>
              ))}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
