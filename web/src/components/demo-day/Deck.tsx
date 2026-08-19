'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SLIDES } from './slides'
import { C, SANS, SERIF, STAGE_H, STAGE_W } from './theme'

/* ──────────────────────────────────────────────────────────────────────────
 * Deck viewer for the final demo day presentation.
 *
 * Slides are authored at a fixed 1280×720 and scaled to fit with a transform,
 * so what shows in the browser is exactly what the PowerPoint export lays out.
 * No responsive reflow inside a slide: a deck that rewraps on a projector is a
 * deck you cannot rehearse against.
 *
 *   ← → space   move            G  overview grid
 *   Home End    first / last    F  fullscreen
 *   Esc         close overview
 *
 * The deck carries no speaker notes, on purpose. Konrad presents from his own
 * script kept outside this repo, and a .pptx that ships a rehearsal script in
 * its notes pane is one forward to the wrong person away from being a problem.
 * The text that used to live here is in the vault at
 * Areas/argo/protocol-camp/final-demo-day/final-demo-day/speaker-notes.md.
 * ────────────────────────────────────────────────────────────────────────── */

/* Breathing room between the scaled stage and the chrome around it. */
const STAGE_PAD = 20

export default function Deck() {
  const [i, setI] = useState(0)
  const [gridOpen, setGridOpen] = useState(false)
  const [scale, setScale] = useState(1)
  const stageWrapRef = useRef<HTMLDivElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)

  const go = useCallback((n: number) => setI((prev) => Math.min(SLIDES.length - 1, Math.max(0, n))), [])

  /* Fit the fixed stage into whatever room the layout leaves it.
   *
   * The stage is positioned absolutely inside the wrapper on purpose. A
   * transform does not change layout size, so an in-flow 1280x720 stage would
   * push the wrapper out to its own size, the measurement would come back as
   * "it fits", and the scale would stay at 1 while the slide overflowed the
   * screen. Out of flow, the wrapper is sized by the flex row alone and the
   * measurement is the space actually available.
   *
   * ResizeObserver rather than a resize listener: the room changes when the
   * chrome around the stage reflows, not only when the window moves. */
  useLayoutEffect(() => {
    const box = stageWrapRef.current
    if (!box) return
    const fit = () => {
      const { width, height } = box.getBoundingClientRect()
      const pad = 2 * STAGE_PAD
      setScale(Math.max(0.1, Math.min((width - pad) / STAGE_W, (height - pad) / STAGE_H)))
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(box)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      switch (e.key) {
        case 'ArrowRight':
        case 'PageDown':
        case ' ':
          e.preventDefault()
          go(i + 1)
          break
        case 'ArrowLeft':
        case 'PageUp':
          e.preventDefault()
          go(i - 1)
          break
        case 'Home':
          go(0)
          break
        case 'End':
          go(SLIDES.length - 1)
          break
        case 'g':
        case 'G':
          setGridOpen((v) => !v)
          break
        case 'Escape':
          setGridOpen(false)
          break
        case 'f':
        case 'F':
          if (document.fullscreenElement) document.exitFullscreen()
          else rootRef.current?.requestFullscreen()
          break
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [i, go])

  const slide = SLIDES[i]

  return (
    <div
      ref={rootRef}
      style={{
        background: '#0B0906',
        height: '100vh',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        color: C.cream,
      }}
    >
      <TopBar
        index={i}
        onPrev={() => go(i - 1)}
        onNext={() => go(i + 1)}
        gridOpen={gridOpen}
        onToggleGrid={() => setGridOpen((v) => !v)}
      />

      <div ref={stageWrapRef} style={{ flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' }}>
        <div
          style={{
            width: STAGE_W,
            height: STAGE_H,
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: `translate(-50%, -50%) scale(${scale})`,
            boxShadow: '0 30px 90px rgba(0,0,0,0.6)',
          }}
        >
          {slide.body}
          {/* Click zones: left third goes back, the rest advances. */}
          <button
            aria-label="Previous slide"
            onClick={() => go(i - 1)}
            style={{ position: 'absolute', inset: '0 66% 0 0', background: 'transparent' }}
          />
          <button
            aria-label="Next slide"
            onClick={() => go(i + 1)}
            style={{ position: 'absolute', inset: '0 0 0 34%', background: 'transparent' }}
          />
        </div>
      </div>

      <ProgressRail index={i} onPick={go} />

      {gridOpen && (
        <Overview
          index={i}
          onPick={(n) => {
            go(n)
            setGridOpen(false)
          }}
          onClose={() => setGridOpen(false)}
        />
      )}
    </div>
  )
}

/* ── chrome ─────────────────────────────────────────────────────────────── */

const btn: React.CSSProperties = {
  fontFamily: SANS,
  fontSize: 14,
  fontWeight: 600,
  color: C.creamMuted,
  border: `1px solid ${C.hairInk}`,
  borderRadius: 10,
  padding: '7px 14px',
  background: 'transparent',
}
/* Full border shorthand rather than overriding borderColor: React warns when a
 * shorthand and a longhand for the same property both change across a rerender,
 * which is exactly what toggling this button does. */
const btnOn: React.CSSProperties = { ...btn, color: C.ink, background: C.accent, border: `1px solid ${C.accent}` }

function TopBar({
  index,
  onPrev,
  onNext,
  gridOpen,
  onToggleGrid,
}: {
  index: number
  onPrev: () => void
  onNext: () => void
  gridOpen: boolean
  onToggleGrid: () => void
}) {
  return (
    <header
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '14px 22px',
        borderBottom: `1px solid ${C.hairInk}`,
      }}
    >
      <p style={{ fontFamily: SERIF, fontSize: 20 }}>
        Argo <span style={{ color: C.creamMuted }}>· Final Demo Day</span>
      </p>
      <p style={{ fontFamily: SANS, fontSize: 14, color: C.creamMuted }}>{SLIDES[index].label}</p>
      <div style={{ flex: 1 }} />
      <p style={{ fontFamily: SANS, fontSize: 14, color: C.creamMuted, marginRight: 4 }}>
        {index + 1} / {SLIDES.length}
      </p>
      <button style={btn} onClick={onPrev}>
        Prev
      </button>
      <button style={btn} onClick={onNext}>
        Next
      </button>
      <button style={gridOpen ? btnOn : btn} onClick={onToggleGrid}>
        Overview
      </button>
      <PptxLink />
    </header>
  )
}

const PPTX_HREF = '/demo-day/argo-final-demo-day.pptx'

/* Download the PowerPoint export.
 *
 * The size is worth stating rather than hiding. With both clips embedded the
 * file is around 41 MB, and the difference between that and a 2 MB one is
 * exactly the difference between a deck that plays the films on a machine with
 * no network and a deck that shows two still frames. Reading it off the actual
 * response means the label cannot drift away from what is really on disk.
 *
 * A HEAD is enough — no need to pull 41 MB just to label the button. */
function PptxLink() {
  const [size, setSize] = useState<number | null>(null)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let live = true
    fetch(PPTX_HREF, { method: 'HEAD' })
      .then((r) => {
        if (!live) return
        if (!r.ok) return setMissing(true)
        const len = Number(r.headers.get('content-length'))
        setSize(Number.isFinite(len) && len > 0 ? len : null)
      })
      .catch(() => live && setMissing(true))
    return () => {
      live = false
    }
  }, [])

  if (missing) {
    return (
      <span style={{ ...btn, color: C.hairInk }} title="Run node scripts/demo-day-pptx/build.js">
        PPTX not built
      </span>
    )
  }

  return (
    <a style={{ ...btn, display: 'inline-block' }} href={PPTX_HREF} download>
      PPTX{size ? ` · ${Math.round(size / 1e6)} MB` : ''}
    </a>
  )
}

function ProgressRail({ index, onPick }: { index: number; onPick: (n: number) => void }) {
  return (
    <div style={{ display: 'flex', gap: 3, padding: '0 22px 12px' }}>
      {SLIDES.map((s, n) => (
        <button
          key={s.id}
          title={`${n + 1}. ${s.label}`}
          onClick={() => onPick(n)}
          style={{
            flex: 1,
            height: 4,
            borderRadius: 2,
            background: n === index ? C.accent : n < index ? 'rgba(206,127,68,0.4)' : C.hairInk,
          }}
        />
      ))}
    </div>
  )
}

const THUMB_W = 300

function Overview({ index, onPick, onClose }: { index: number; onPick: (n: number) => void; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: '#0B0906',
        zIndex: 50,
        overflowY: 'auto',
        padding: '68px 30px 30px',
      }}
    >
      {/* Clicking the backdrop closes too, but that is not discoverable, so
       * the overlay carries its own control and says what the key is. */}
      <button
        onClick={onClose}
        aria-label="Close overview"
        style={{
          ...btn,
          position: 'fixed',
          top: 18,
          right: 22,
          zIndex: 51,
          color: C.cream,
          background: C.inkElev,
        }}
      >
        Close ✕ <span style={{ color: C.creamMuted, fontWeight: 400 }}>Esc</span>
      </button>
      <p
        style={{
          fontFamily: SANS,
          fontSize: 13,
          color: C.creamMuted,
          position: 'fixed',
          top: 26,
          left: 30,
        }}
      >
        Pick a slide, or press G to go back
      </p>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(4, ${THUMB_W}px)`,
          justifyContent: 'center',
          gap: 18,
        }}
      >
        {SLIDES.map((s, n) => (
          <button
            key={s.id}
            onClick={() => onPick(n)}
            style={{ textAlign: 'left', outline: n === index ? `2px solid ${C.accent}` : 'none', borderRadius: 10 }}
          >
            <div
              style={{
                width: THUMB_W,
                height: THUMB_W * (STAGE_H / STAGE_W),
                overflow: 'hidden',
                borderRadius: 10,
                border: `1px solid ${C.hairInk}`,
                position: 'relative',
              }}
            >
              <div
                style={{
                  width: STAGE_W,
                  height: STAGE_H,
                  transform: `scale(${THUMB_W / STAGE_W})`,
                  transformOrigin: 'top left',
                  position: 'absolute',
                  pointerEvents: 'none',
                }}
              >
                {s.body}
              </div>
            </div>
            <p style={{ fontFamily: SANS, fontSize: 13, color: C.creamMuted, marginTop: 8 }}>
              {n + 1}. {s.label}
              {s.todo && <span style={{ color: C.accent }}> ·  needs work</span>}
            </p>
          </button>
        ))}
      </div>
    </div>
  )
}
