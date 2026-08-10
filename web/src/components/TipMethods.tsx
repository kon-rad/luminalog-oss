'use client'

import { useState } from 'react'

/* Fields every card shares. `wide` makes the card span the full two-up row —
 * use it to keep an odd card out of a mismatched pair. */
type TipMethodBase = {
  id: string
  glyph: string
  title: string
  blurb: string
  wide?: boolean
}

export type TipLinkMethod = TipMethodBase & {
  kind: 'link'
  /* Empty string = not configured yet; the card renders as "coming soon". */
  url: string
  cta: string
}

export type TipAddressMethod = TipMethodBase & {
  kind: 'address'
  /* Empty string = not configured yet; the card renders as "coming soon". */
  address: string
}

export type TipMethod = TipLinkMethod | TipAddressMethod

const CARD_STYLE: React.CSSProperties = {
  padding: 24,
  textAlign: 'left',
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  /* Fill the grid cell so CTAs sit on a common baseline across a row. */
  height: '100%',
}

function Header({ glyph, title, blurb }: { glyph: string; title: string; blurb: string }) {
  return (
    <>
      <div style={{ fontSize: 22, lineHeight: 1 }} aria-hidden>{glyph}</div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)' }}>{title}</h3>
      <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.58 }}>{blurb}</p>
    </>
  )
}

function ComingSoon() {
  return (
    <span
      style={{
        marginTop: 'auto',
        display: 'inline-block',
        fontSize: 13,
        color: 'var(--text3)',
        border: '1px dashed var(--hairline2)',
        borderRadius: 11,
        padding: '9px 14px',
      }}
    >
      Link coming soon
    </span>
  )
}

function LinkCard({ method }: { method: TipLinkMethod }) {
  return (
    <div className="card" style={CARD_STYLE}>
      <Header glyph={method.glyph} title={method.title} blurb={method.blurb} />
      {method.url ? (
        <a
          href={method.url}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginTop: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            alignSelf: 'flex-start',
            background: 'var(--accent)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 700,
            padding: '11px 20px',
            borderRadius: 12,
            textDecoration: 'none',
          }}
        >
          {method.cta} →
        </a>
      ) : (
        <ComingSoon />
      )}
    </div>
  )
}

function AddressCard({ method }: { method: TipAddressMethod }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(method.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      /* Clipboard denied — the address is selectable on screen either way. */
    }
  }

  return (
    <div className="card" style={CARD_STYLE}>
      <Header glyph={method.glyph} title={method.title} blurb={method.blurb} />
      {method.address ? (
        <div style={{ marginTop: 'auto', display: 'flex', gap: 10, alignItems: 'stretch', flexWrap: 'wrap' }}>
          <code
            style={{
              flex: '1 1 200px',
              minWidth: 0,
              overflowWrap: 'anywhere',
              fontSize: 13,
              lineHeight: 1.5,
              color: 'var(--text)',
              background: 'var(--accentTint)',
              border: '1px solid var(--hairline)',
              borderRadius: 11,
              padding: '10px 12px',
            }}
          >
            {method.address}
          </code>
          <button
            type="button"
            onClick={copy}
            style={{
              flexShrink: 0,
              cursor: 'pointer',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--accentDeep)',
              background: 'transparent',
              border: '1px solid var(--hairline2)',
              borderRadius: 11,
              padding: '10px 16px',
            }}
          >
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      ) : (
        <ComingSoon />
      )}
    </div>
  )
}

export default function TipMethods({ methods }: { methods: TipMethod[] }) {
  return (
    <div className="unlock-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
      {methods.map((method) => (
        <div key={method.id} style={method.wide ? { gridColumn: '1 / -1' } : undefined}>
          {method.kind === 'link' ? <LinkCard method={method} /> : <AddressCard method={method} />}
        </div>
      ))}
    </div>
  )
}
