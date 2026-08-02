'use client'

import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import {
  KNOWLEDGE,
  KNOWLEDGE_CATEGORIES,
  backlinksFor,
  knowledgeBySlug,
  knowledgeInCategory,
  type KnowledgeEntry,
} from '@/lib/contest/knowledge'
import { imagesForTopic, thumbSrc, fullSrc, videoSrc, type GalleryImage } from '@/lib/contest/gallery'

/**
 * Renders knowledge-base prose: resolves [[slug]] / [[slug|label]] wiki links into
 * navigation buttons, **bold** into <b>, and *italic* into <i>.
 */
function RichText({ text, onNavigate }: { text: string; onNavigate: (slug: string) => void }) {
  // Split on wiki links first so link targets are never re-processed for emphasis.
  const parts = text.split(/(\[\[[a-z0-9-]+(?:\|[^\]]+)?\]\])/g)
  return (
    <>
      {parts.map((part, i) => {
        const link = part.match(/^\[\[([a-z0-9-]+)(?:\|([^\]]+))?\]\]$/)
        if (link) {
          const slug = link[1]
          const entry = knowledgeBySlug(slug)
          const label = link[2] ?? entry?.title ?? slug
          if (!entry) return <Fragment key={i}>{label}</Fragment>
          return (
            <button
              key={i}
              type="button"
              onClick={() => onNavigate(slug)}
              title={entry.summary}
              style={{
                color: 'var(--accentDeep)',
                fontWeight: 600,
                borderBottom: '1px solid rgba(185,107,51,0.32)',
                lineHeight: 'inherit',
                fontSize: 'inherit',
                fontFamily: 'inherit',
              }}
            >
              {label}
            </button>
          )
        }
        return <Emphasis key={i} text={part} />
      })}
    </>
  )
}

function Emphasis({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g)
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('**') && part.endsWith('**')) {
          return (
            <b key={i} style={{ color: 'var(--text)', fontWeight: 600 }}>
              {part.slice(2, -2)}
            </b>
          )
        }
        if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
          return <i key={i}>{part.slice(1, -1)}</i>
        }
        return <Fragment key={i}>{part}</Fragment>
      })}
    </>
  )
}

/* ────────────────────────────── Entry view ─────────────────────────────── */

function EntryView({
  entry,
  onNavigate,
  onBack,
  canGoBack,
}: {
  entry: KnowledgeEntry
  onNavigate: (slug: string) => void
  onBack: () => void
  canGoBack: boolean
}) {
  const images = useMemo(() => imagesForTopic(entry.slug), [entry.slug])
  const backlinks = useMemo(() => backlinksFor(entry.slug), [entry.slug])
  const [zoom, setZoom] = useState<GalleryImage | null>(null)
  const categoryLabel = KNOWLEDGE_CATEGORIES.find((c) => c.id === entry.category)?.label

  return (
    <article>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
        {canGoBack && (
          <button type="button" onClick={onBack} style={softChip}>
            ← Back
          </button>
        )}
        <span className="eyebrow" style={{ fontSize: 11 }}>
          {categoryLabel}
        </span>
      </div>

      <h2 className="serif" style={{ fontSize: 32, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)', lineHeight: 1.15 }}>
        {entry.title}
      </h2>
      <p style={{ marginTop: 10, fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', fontStyle: 'italic' }}>
        {entry.summary}
      </p>

      <div style={{ marginTop: 22, display: 'grid', gap: 16 }}>
        {entry.body.map((para, i) => (
          <p key={i} style={{ fontSize: 16.5, lineHeight: 1.68, color: 'var(--text2)' }}>
            <RichText text={para} onNavigate={onNavigate} />
          </p>
        ))}
      </div>

      {entry.angle && (
        <aside
          style={{
            marginTop: 26,
            padding: '18px 20px',
            borderRadius: 16,
            background: 'var(--accentSoft)',
            border: '1px solid var(--hairline)',
          }}
        >
          <div className="eyebrow" style={{ fontSize: 11, marginBottom: 8 }}>
            Angle for the essay
          </div>
          <p style={{ fontSize: 15.5, lineHeight: 1.62, color: 'var(--text)' }}>
            <RichText text={entry.angle} onNavigate={onNavigate} />
          </p>
        </aside>
      )}

      {images.length > 0 && (
        <section style={{ marginTop: 30 }}>
          <h3 style={sectionHeading}>From the gallery ({images.length})</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 10 }}>
            {images.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => setZoom(img)}
                title={img.title}
                style={{
                  position: 'relative',
                  borderRadius: 10,
                  overflow: 'hidden',
                  border: '1px solid var(--hairline)',
                  background: 'var(--surfaceAlt)',
                  lineHeight: 0,
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={thumbSrc(img.id)}
                  alt={img.caption}
                  loading="lazy"
                  decoding="async"
                  style={{ width: '100%', aspectRatio: '3 / 4', objectFit: 'cover', display: 'block' }}
                />
                {img.kind === 'video' && (
                  <span
                    aria-hidden
                    style={{
                      position: 'absolute',
                      top: 6,
                      left: 6,
                      padding: '1px 6px',
                      borderRadius: 999,
                      fontSize: 10,
                      fontWeight: 700,
                      color: '#fff',
                      background: 'rgba(20,16,12,0.55)',
                      lineHeight: 1.7,
                    }}
                  >
                    ▶
                  </span>
                )}
              </button>
            ))}
          </div>
        </section>
      )}

      {entry.seeAlso.length > 0 && (
        <section style={{ marginTop: 28 }}>
          <h3 style={sectionHeading}>See also</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {entry.seeAlso.map((slug) => {
              const target = knowledgeBySlug(slug)
              if (!target) return null
              return (
                <button key={slug} type="button" onClick={() => onNavigate(slug)} style={linkChip} title={target.summary}>
                  {target.title}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {backlinks.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h3 style={sectionHeading}>Linked from</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {backlinks.map((b) => (
              <button key={b.slug} type="button" onClick={() => onNavigate(b.slug)} style={softChip} title={b.summary}>
                {b.title}
              </button>
            ))}
          </div>
        </section>
      )}

      {entry.sources && entry.sources.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h3 style={sectionHeading}>Sources</h3>
          <ul style={{ display: 'grid', gap: 7 }}>
            {entry.sources.map((s) => (
              <li key={s.url} style={{ fontSize: 14.5, lineHeight: 1.55 }}>
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: 'var(--accentDeep)', fontWeight: 600 }}
                >
                  {s.label} ↗
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={zoom.title}
          onClick={() => setZoom(null)}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 100,
            background: '#0B0908',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 20,
            gap: 16,
          }}
        >
          {zoom.kind === 'video' ? (
            <video
              src={videoSrc(zoom.id)}
              poster={fullSrc(zoom.id)}
              controls
              autoPlay
              loop
              muted
              playsInline
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', borderRadius: 8, background: '#000' }}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={fullSrc(zoom.id)}
              alt={zoom.caption}
              style={{ maxWidth: '100%', maxHeight: '72vh', objectFit: 'contain', borderRadius: 8 }}
            />
          )}
          <p style={{ maxWidth: 640, textAlign: 'center', fontSize: 14.5, lineHeight: 1.6, color: 'rgba(243,238,228,0.78)' }}>
            <b style={{ color: '#F3EEE4' }}>{zoom.title}.</b> {zoom.caption}
          </p>
          <span style={{ fontSize: 12.5, color: 'rgba(243,238,228,0.45)' }}>Tap anywhere to close</span>
        </div>
      )}
    </article>
  )
}

/* ────────────────────────────── Index view ─────────────────────────────── */

export default function KnowledgeBase({
  slug,
  onSlugChange,
}: {
  slug: string | null
  onSlugChange: (slug: string | null) => void
}) {
  const [query, setQuery] = useState('')
  const [history, setHistory] = useState<string[]>([])
  const topRef = useRef<HTMLDivElement>(null)

  const entry = slug ? knowledgeBySlug(slug) : undefined

  const navigate = (next: string) => {
    if (slug) setHistory((h) => [...h, slug])
    onSlugChange(next)
  }

  const goBack = () => {
    setHistory((h) => {
      const prev = h[h.length - 1]
      onSlugChange(prev ?? null)
      return h.slice(0, -1)
    })
  }

  useEffect(() => {
    if (slug) topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [slug])

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return null
    return KNOWLEDGE.filter(
      (e) =>
        e.title.toLowerCase().includes(q) ||
        e.summary.toLowerCase().includes(q) ||
        e.body.some((p) => p.toLowerCase().includes(q)),
    )
  }, [query])

  return (
    <div ref={topRef} style={{ scrollMarginTop: 90 }}>
      {entry ? (
        <>
          <button
            type="button"
            onClick={() => {
              setHistory([])
              onSlugChange(null)
            }}
            style={{ ...softChip, marginBottom: 18 }}
          >
            ☰ All entries
          </button>
          <EntryView entry={entry} onNavigate={navigate} onBack={goBack} canGoBack={history.length > 0} />
        </>
      ) : (
        <>
          <p style={{ fontSize: 16, lineHeight: 1.65, color: 'var(--text2)', marginBottom: 20 }}>
            Everything we could read off the walls on 30 July 2026, transcribed and cross-linked, then
            enriched with public sources and background. {KNOWLEDGE.length} entries. Each one links to the
            photographs it came from, and most carry a note on how it bears on the essay prompt.
          </p>

          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search the knowledge base…"
            aria-label="Search the knowledge base"
            style={{
              width: '100%',
              padding: '12px 16px',
              fontSize: 16,
              borderRadius: 12,
              outline: 'none',
              background: 'var(--surface)',
              color: 'var(--text)',
              border: '1px solid var(--hairline2)',
              marginBottom: 26,
            }}
          />

          {results ? (
            <div>
              <h3 style={sectionHeading}>
                {results.length} {results.length === 1 ? 'match' : 'matches'}
              </h3>
              <EntryList entries={results} onOpen={(s) => onSlugChange(s)} />
            </div>
          ) : (
            KNOWLEDGE_CATEGORIES.map((cat) => {
              const entries = knowledgeInCategory(cat.id)
              if (!entries.length) return null
              return (
                <section key={cat.id} style={{ marginBottom: 30 }}>
                  <h3 style={sectionHeading}>{cat.label}</h3>
                  <EntryList entries={entries} onOpen={(s) => onSlugChange(s)} />
                </section>
              )
            })
          )}
        </>
      )}
    </div>
  )
}

function EntryList({ entries, onOpen }: { entries: KnowledgeEntry[]; onOpen: (slug: string) => void }) {
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      {entries.map((e) => {
        const count = imagesForTopic(e.slug).length
        return (
          <button
            key={e.slug}
            type="button"
            onClick={() => onOpen(e.slug)}
            style={{
              textAlign: 'left',
              padding: '14px 16px',
              borderRadius: 14,
              background: 'var(--surfaceAlt)',
              border: '1px solid var(--hairline)',
              display: 'block',
              width: '100%',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
              <span className="serif" style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>
                {e.title}
              </span>
              {count > 0 && (
                <span style={{ fontSize: 11.5, color: 'var(--text3)', whiteSpace: 'nowrap', fontWeight: 600 }}>
                  {count} photo{count === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <p style={{ marginTop: 5, fontSize: 14.5, lineHeight: 1.55, color: 'var(--text2)' }}>{e.summary}</p>
          </button>
        )
      })}
    </div>
  )
}

const sectionHeading: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.1em',
  textTransform: 'uppercase',
  color: 'var(--text3)',
  marginBottom: 12,
}

const linkChip: React.CSSProperties = {
  padding: '7px 13px',
  borderRadius: 999,
  fontSize: 13.5,
  fontWeight: 600,
  color: 'var(--accentDeep)',
  background: 'var(--accentTint)',
  border: '1px solid rgba(185,107,51,0.25)',
}

const softChip: React.CSSProperties = {
  padding: '7px 13px',
  borderRadius: 999,
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--text2)',
  background: 'var(--surfaceAlt)',
  border: '1px solid var(--hairline2)',
}
