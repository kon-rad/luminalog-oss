'use client'

import { useState } from 'react'
import {
  MYBW,
  MYBW_ESSAY_PICKS,
  MYBW_LOCAL_ECOSYSTEM,
  MYBW_MARKET_FACTS,
  MYBW_SCALE,
  MYBW_SESSIONS,
  MYBW_SOURCES,
  MYBW_STAGES,
  sessionsFor,
  type MybwSession,
  type MybwStage,
} from '@/lib/contest/mybw'

const KIND_LABEL: Record<MybwSession['kind'], string> = {
  keynote: 'Keynote',
  panel: 'Panel',
  fireside: 'Fireside',
}

export default function BlockchainWeek({ onOpenTopic }: { onOpenTopic?: (slug: string) => void }) {
  const [day, setDay] = useState<1 | 2>(1)
  const [stage, setStage] = useState<MybwStage>('retail')

  return (
    <div>
      {/* ── Header ── */}
      <span className="eyebrow">{MYBW.hashtag} · {MYBW.dates}</span>
      <h2
        className="serif"
        style={{
          marginTop: 12,
          fontSize: 'clamp(28px, 4vw, 40px)',
          lineHeight: 1.14,
          fontWeight: 600,
          letterSpacing: '-0.03em',
          color: 'var(--text)',
        }}
      >
        {MYBW.theme}
      </h2>
      <p style={{ marginTop: 16, fontSize: 17.5, lineHeight: 1.68, color: 'var(--text2)' }}>
        Malaysia Blockchain Week 2026 ran on {MYBW.dates} at the {MYBW.venue}, {MYBW.hours}. It is
        organised by {MYBW.organiser} and backed by {MYBW.backing}. General admission started from{' '}
        {MYBW.ticketsFrom}. The museum trip that produced the gallery and knowledge base on this site
        happened on the morning of day two.
      </p>
      <blockquote
        style={{
          marginTop: 20,
          paddingLeft: 18,
          borderLeft: '3px solid var(--accent)',
          fontSize: 17,
          lineHeight: 1.6,
          color: 'var(--text2)',
        }}
      >
        <i>&ldquo;{MYBW.organiserQuote.text}&rdquo;</i>
        <span style={{ display: 'block', marginTop: 8, fontSize: 14, color: 'var(--text3)' }}>
          — {MYBW.organiserQuote.by}
        </span>
      </blockquote>

      {/* ── Scale ── */}
      <div
        style={{
          marginTop: 26,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(132px, 1fr))',
          gap: 10,
        }}
      >
        {MYBW_SCALE.map((s) => (
          <div
            key={s.label}
            style={{
              padding: '14px 16px',
              borderRadius: 14,
              background: 'var(--surfaceAlt)',
              border: '1px solid var(--hairline)',
            }}
          >
            <div className="serif" style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>
              {s.value}
            </div>
            <div style={{ marginTop: 3, fontSize: 12.5, lineHeight: 1.45, color: 'var(--text3)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 18, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        <a href={MYBW.website} target="_blank" rel="noopener noreferrer" style={primaryButton}>
          myblockchainweek.com ↗
        </a>
        <a href={MYBW.sideEvents} target="_blank" rel="noopener noreferrer" style={ghostButton}>
          Side events ↗
        </a>
        <a href={MYBW.x} target="_blank" rel="noopener noreferrer" style={ghostButton}>
          @MalaysiaBCW ↗
        </a>
      </div>

      {/* ── Essay picks ── */}
      <Section title="If you are writing the essay, start here">
        <p style={prose}>
          {MYBW_ESSAY_PICKS.length} sessions from the programme bear directly on{' '}
          <i>&ldquo;How can blockchain technology be used to benefit Malaysia?&rdquo;</i> — because they
          were about Malaysia specifically, not blockchain in general. Naming one of these, and what it
          was actually about, is the fastest way to make an essay concrete.
        </p>
        <div style={{ marginTop: 18, display: 'grid', gap: 12 }}>
          {MYBW_ESSAY_PICKS.map((s) => (
            <div
              key={s.title}
              style={{
                padding: '16px 18px',
                borderRadius: 16,
                background: 'var(--accentSoft)',
                border: '1px solid var(--hairline)',
              }}
            >
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 7 }}>
                <Tag>{KIND_LABEL[s.kind]}</Tag>
                <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>
                  Day {s.day} · {s.time} · {MYBW_STAGES.find((x) => x.id === s.stage)?.label}
                </span>
              </div>
              <div className="serif" style={{ fontSize: 18.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>
                {s.title}
              </div>
              <div style={{ marginTop: 6, fontSize: 14, color: 'var(--text2)' }}>
                {s.speakers.join(' · ')}
                {s.moderator && <span style={{ color: 'var(--text3)' }}> · moderated by {s.moderator}</span>}
              </div>
              <p style={{ marginTop: 10, fontSize: 15, lineHeight: 1.6, color: 'var(--text2)' }}>{s.whyItMatters}</p>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Market backdrop ── */}
      <Section title="The market the conference was talking about">
        <p style={prose}>
          These are the facts that came up repeatedly across the two days. Several of them connect
          straight back to the{' '}
          <TopicLink slug="islamic-finance" onOpenTopic={onOpenTopic}>
            Islamic Finance Gallery
          </TopicLink>{' '}
          at the museum — Malaysia is not starting from zero on tokenised assets, it is starting from{' '}
          <TopicLink slug="sukuk" onOpenTopic={onOpenTopic}>
            the deepest sukuk market in the world
          </TopicLink>
          .
        </p>
        <ul style={{ marginTop: 18, display: 'grid', gap: 14, listStyle: 'none', padding: 0 }}>
          {MYBW_MARKET_FACTS.map((f) => (
            <li key={f.fact} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <span aria-hidden style={{ color: 'var(--accent)', fontWeight: 700, lineHeight: 1.55, flexShrink: 0 }}>
                ◆
              </span>
              <span>
                <b style={{ color: 'var(--text)', fontWeight: 600, fontSize: 16, lineHeight: 1.55 }}>{f.fact}</b>
                <span style={{ display: 'block', marginTop: 3, fontSize: 15, lineHeight: 1.58, color: 'var(--text2)' }}>
                  {f.note}
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p style={{ ...prose, marginTop: 18 }}>
          For the regulatory picture underneath all of this — Bank Negara&apos;s 2026 ringgit stablecoin
          and tokenised-deposit pilots, and the Securities Commission&apos;s revised digital asset exchange
          framework — see{' '}
          <TopicLink slug="regulation" onOpenTopic={onOpenTopic}>
            the knowledge base entry on supervision and digital assets
          </TopicLink>
          .
        </p>
      </Section>

      {/* ── Agenda ── */}
      <Section title="The full agenda">
        <p style={prose}>
          All {MYBW_SESSIONS.length} sessions across two days and two stages, as published.
        </p>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '18px 0 6px' }}>
          {([1, 2] as const).map((d) => (
            <Chip key={d} active={day === d} onClick={() => setDay(d)}>
              Day {d} · {d === 1 ? '29 July' : '30 July'}
            </Chip>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 20 }}>
          {MYBW_STAGES.map((s) => (
            <Chip key={s.id} active={stage === s.id} onClick={() => setStage(s.id)} subtle>
              {s.label}
            </Chip>
          ))}
        </div>

        <ol style={{ display: 'grid', gap: 2, listStyle: 'none', padding: 0 }}>
          {sessionsFor(day, stage).map((s) => (
            <li
              key={`${s.time}-${s.title}`}
              style={{
                display: 'grid',
                gridTemplateColumns: '58px 1fr',
                gap: 14,
                padding: '14px 0',
                borderTop: '1px solid var(--hairline)',
              }}
            >
              <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text3)', paddingTop: 2 }}>{s.time}</span>
              <span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <Tag>{KIND_LABEL[s.kind]}</Tag>
                  <span style={{ fontSize: 16.5, fontWeight: 600, color: 'var(--text)', lineHeight: 1.4 }}>
                    {s.title}
                  </span>
                </div>
                <div style={{ marginTop: 5, fontSize: 14, lineHeight: 1.55, color: 'var(--text2)' }}>
                  {s.speakers.join(' · ')}
                  {s.moderator && <span style={{ color: 'var(--text3)' }}> · mod. {s.moderator}</span>}
                </div>
              </span>
            </li>
          ))}
        </ol>
        <p style={{ marginTop: 18, fontSize: 13.5, color: 'var(--text3)' }}>
          Lunch 13:00–14:00 both days. Closing keynotes at 17:45 on day two.
        </p>
      </Section>

      {/* ── Local ecosystem ── */}
      <Section title="The Malaysian names on the programme">
        <p style={prose}>
          Global protocols get the headlines, but the domestic ecosystem is the part an essay about
          Malaysia can actually build on. These all appeared on stage:
        </p>
        <div style={{ marginTop: 18, display: 'grid', gap: 10 }}>
          {MYBW_LOCAL_ECOSYSTEM.map((e) => (
            <div
              key={e.name}
              style={{
                display: 'flex',
                gap: 12,
                alignItems: 'baseline',
                flexWrap: 'wrap',
                padding: '11px 14px',
                borderRadius: 12,
                background: 'var(--surfaceAlt)',
                border: '1px solid var(--hairline)',
              }}
            >
              <b style={{ fontSize: 15.5, color: 'var(--text)', fontWeight: 600 }}>{e.name}</b>
              <span style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--text2)' }}>{e.what}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* ── Sources ── */}
      <Section title="Sources">
        <p style={prose}>
          Everything above is compiled from public material. Nothing here is a transcript — check the
          primary sources before quoting a speaker, and treat session titles as published billing rather
          than as claims that were necessarily made on stage.
        </p>
        <ul style={{ marginTop: 16, display: 'grid', gap: 8, listStyle: 'none', padding: 0 }}>
          {MYBW_SOURCES.map((s) => (
            <li key={s.url} style={{ fontSize: 14.5, lineHeight: 1.55 }}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accentDeep)', fontWeight: 600 }}>
                {s.label} ↗
              </a>
            </li>
          ))}
        </ul>
      </Section>
    </div>
  )
}

/* ─────────────────────────────── bits ─────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 46 }}>
      <h3
        className="serif"
        style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: 14 }}
      >
        {title}
      </h3>
      {children}
    </section>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      style={{
        flexShrink: 0,
        padding: '2px 8px',
        borderRadius: 999,
        fontSize: 10.5,
        fontWeight: 700,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        color: 'var(--accentDeep)',
        background: 'var(--accentTint)',
      }}
    >
      {children}
    </span>
  )
}

function Chip({
  active,
  onClick,
  children,
  subtle = false,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
  subtle?: boolean
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
        color: active ? (subtle ? 'var(--text)' : '#fff') : 'var(--text2)',
        background: active ? (subtle ? 'var(--surface)' : 'var(--accent)') : 'var(--surfaceAlt)',
        border: `1px solid ${active ? (subtle ? 'var(--hairline2)' : 'var(--accent)') : 'var(--hairline2)'}`,
      }}
    >
      {children}
    </button>
  )
}

function TopicLink({
  slug,
  onOpenTopic,
  children,
}: {
  slug: string
  onOpenTopic?: (slug: string) => void
  children: React.ReactNode
}) {
  if (!onOpenTopic) return <>{children}</>
  return (
    <button
      type="button"
      onClick={() => onOpenTopic(slug)}
      style={{
        color: 'var(--accentDeep)',
        fontWeight: 600,
        fontSize: 'inherit',
        fontFamily: 'inherit',
        lineHeight: 'inherit',
        borderBottom: '1px solid rgba(185,107,51,0.32)',
      }}
    >
      {children}
    </button>
  )
}

const prose: React.CSSProperties = { fontSize: 16.5, lineHeight: 1.68, color: 'var(--text2)' }

const primaryButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '11px 20px',
  borderRadius: 14,
  fontSize: 14.5,
  fontWeight: 600,
  background: 'var(--accent)',
  color: '#fff',
  textDecoration: 'none',
}

const ghostButton: React.CSSProperties = {
  ...primaryButton,
  background: 'var(--surfaceAlt)',
  color: 'var(--text2)',
  border: '1px solid var(--hairline2)',
}
