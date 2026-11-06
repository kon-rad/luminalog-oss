'use client'

import { useCallback, useEffect, useState } from 'react'

/* The deck as page images: the cover paints in one small request, and the
 * arrow keys page through. The PDFs stay the download and print artefacts. */

const TOTAL = 45

const pageSrc = (n: number) => `/devcon-2026-slides/pages/page-${String(n).padStart(2, '0')}.jpg`

export default function DevconDeckSlideshow() {
  const [page, setPage] = useState(1)

  const go = useCallback((delta: number) => {
    setPage((p) => Math.min(TOTAL, Math.max(1, p + delta)))
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === 'PageDown' || e.key === ' ') {
        e.preventDefault()
        go(1)
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        go(-1)
      } else if (e.key === 'Home') {
        setPage(1)
      } else if (e.key === 'End') {
        setPage(TOTAL)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  // warm the neighbours so a click or an arrow key never waits
  useEffect(() => {
    for (const n of [page - 1, page + 1]) {
      if (n >= 1 && n <= TOTAL) {
        const img = new window.Image()
        img.src = pageSrc(n)
      }
    }
  }, [page])

  const button = (label: string, onClick: () => void, disabled = false) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="eyebrow"
      style={{
        background: 'transparent',
        border: '1px solid var(--hairline)',
        borderRadius: 8,
        padding: '9px 16px',
        color: disabled ? 'var(--text2)' : 'var(--text)',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.45 : 1,
      }}
    >
      {label}
    </button>
  )

  return (
    <div>
      <div
        style={{
          border: '1px solid var(--hairline)',
          borderRadius: 10,
          overflow: 'hidden',
          background: '#0d0b08',
          lineHeight: 0,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={pageSrc(page)}
          alt={`Slide ${page} of ${TOTAL}`}
          width={1280}
          height={720}
          style={{ display: 'block', width: '100%', height: 'auto' }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginTop: 14,
          flexWrap: 'wrap',
        }}
      >
        {button('← Previous', () => go(-1), page === 1)}
        {button('Next →', () => go(1), page === TOTAL)}
        <span style={{ color: 'var(--text2)', fontSize: 14, fontVariantNumeric: 'tabular-nums' }}>
          {page} / {TOTAL}
        </span>
        <span style={{ color: 'var(--text2)', fontSize: 14, marginLeft: 'auto' }}>
          Arrow keys page through the deck
        </span>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(104px, 1fr))',
          gap: 8,
          marginTop: 20,
        }}
      >
        {Array.from({ length: TOTAL }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => setPage(n)}
            title={`Slide ${n}`}
            style={{
              padding: 0,
              border: n === page ? '2px solid var(--accent)' : '1px solid var(--hairline)',
              borderRadius: 6,
              background: 'transparent',
              overflow: 'hidden',
              cursor: 'pointer',
              lineHeight: 0,
            }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={pageSrc(n)}
              alt=""
              loading="lazy"
              width={1280}
              height={720}
              style={{ display: 'block', width: '100%', height: 'auto' }}
            />
          </button>
        ))}
      </div>
    </div>
  )
}
