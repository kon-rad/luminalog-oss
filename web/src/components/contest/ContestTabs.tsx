'use client'

import { useCallback, useEffect, useState } from 'react'
import ContestForm from '@/components/ContestForm'
import RulesList from '@/components/contest/RulesList'
import PhotoGallery from '@/components/contest/PhotoGallery'
import MuseumEssay from '@/components/contest/MuseumEssay'
import KnowledgeBase from '@/components/contest/KnowledgeBase'
import BlockchainWeek from '@/components/contest/BlockchainWeek'
import {
  CONTEST_DEADLINE_LABEL,
  CONTEST_JUDGING,
  CONTEST_PRIZE,
  CONTEST_PROMPT,
  CONTEST_SKILL_URL,
  CONTEST_SUBMIT_API,
  CONTEST_WORDS_MAX,
  CONTEST_WORDS_MIN,
} from '@/lib/contest/config'
import { GALLERY_IMAGES } from '@/lib/contest/gallery'
import { KNOWLEDGE } from '@/lib/contest/knowledge'

const LUMA_URL = 'https://luma.com/iem7mv3u'
const MAPS_URL = 'https://maps.app.goo.gl/5fiRFmxNJpd8MQbu7?g_st=ic'
const KONRAD_LINKS = 'https://konradgnat.com/links'
const MYBW_URL = 'https://myblockchainweek.com/'

type Tab = 'event' | 'form' | 'museum' | 'mybw'
type MuseumSub = 'gallery' | 'notes' | 'wiki'

const TABS: { id: Tab; label: string; short: string }[] = [
  { id: 'event', label: 'Event', short: 'Event' },
  { id: 'form', label: 'Enter the contest', short: 'Form' },
  { id: 'museum', label: 'Bank Negara Malaysia Museum & Art Gallery', short: 'Museum' },
  { id: 'mybw', label: 'Malaysia Blockchain Week 2026', short: 'MYBW2026' },
]

const MUSEUM_SUBS: { id: MuseumSub; label: string }[] = [
  { id: 'gallery', label: 'Gallery' },
  { id: 'notes', label: 'Field notes' },
  { id: 'wiki', label: 'Knowledge base' },
]

const isTab = (v: string | null): v is Tab => TABS.some((t) => t.id === v)
const isSub = (v: string | null): v is MuseumSub => MUSEUM_SUBS.some((s) => s.id === v)

export default function ContestTabs() {
  const [tab, setTab] = useState<Tab>('event')
  const [sub, setSub] = useState<MuseumSub>('gallery')
  const [kbSlug, setKbSlug] = useState<string | null>(null)
  const [ready, setReady] = useState(false)

  // Read deep-link state from the URL on mount (avoids useSearchParams, which would
  // force a Suspense boundary around this whole subtree).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const t = params.get('tab')
    const s = params.get('sub')
    const k = params.get('topic')
    if (isTab(t)) setTab(t)
    if (isSub(s)) setSub(s)
    if (k) setKbSlug(k)
    setReady(true)
  }, [])

  // Keep the URL shareable without pushing history entries for every tab click.
  useEffect(() => {
    if (!ready) return
    const params = new URLSearchParams(window.location.search)
    params.set('tab', tab)
    if (tab === 'museum') params.set('sub', sub)
    else params.delete('sub')
    if (tab === 'museum' && sub === 'wiki' && kbSlug) params.set('topic', kbSlug)
    else params.delete('topic')
    window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`)
  }, [tab, sub, kbSlug, ready])

  /** Jump straight to a knowledge-base entry from anywhere on the page. */
  const openTopic = useCallback((slug: string) => {
    setTab('museum')
    setSub('wiki')
    setKbSlug(slug)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [])

  const selectTab = (next: Tab) => {
    setTab(next)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <>
      {/* ── Tab bar ── */}
      <div
        role="tablist"
        aria-label="Contest sections"
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 30,
          display: 'flex',
          gap: 6,
          overflowX: 'auto',
          padding: '10px 0',
          marginBottom: 8,
          background: 'var(--bg)',
          borderBottom: '1px solid var(--hairline)',
          scrollbarWidth: 'none',
        }}
      >
        {TABS.map((t) => {
          const active = tab === t.id
          return (
            <button
              key={t.id}
              role="tab"
              aria-selected={active}
              onClick={() => selectTab(t.id)}
              style={{
                flexShrink: 0,
                padding: '9px 16px',
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 600,
                whiteSpace: 'nowrap',
                color: active ? '#fff' : 'var(--text2)',
                background: active ? 'var(--accent)' : 'var(--surfaceAlt)',
                border: `1px solid ${active ? 'var(--accent)' : 'var(--hairline2)'}`,
                transition: 'background .15s, color .15s',
              }}
            >
              <span className="hidden sm:inline">{t.label}</span>
              <span className="sm:hidden">{t.short}</span>
            </button>
          )
        })}
      </div>

      <div role="tabpanel" style={{ paddingTop: 26 }}>
        {tab === 'event' && <EventPanel onOpenTopic={openTopic} onEnter={() => selectTab('form')} />}
        {tab === 'form' && <FormPanel />}
        {tab === 'museum' && (
          <MuseumPanel
            sub={sub}
            onSub={setSub}
            kbSlug={kbSlug}
            onKbSlug={setKbSlug}
            onOpenTopic={openTopic}
          />
        )}
        {tab === 'mybw' && <BlockchainWeek onOpenTopic={openTopic} />}
      </div>
    </>
  )
}

/* ──────────────────────────────── Event ───────────────────────────────── */

const AGENDA: string[] = [
  '11:00am — meet at the museum front entrance.',
  'Spend 40 minutes touring the museum, in pairs, individually, or in smaller groups.',
  'Network, bond, discuss, exchange ideas, pitch decks, degen strategies and contacts, make content, and enjoy the museum exhibits and art galleries.',
  'Spend 40 minutes having coffee, talking, and writing about the experience — ideas about technology, crypto, money, Malaysia, governance, and the evolution of humanity.',
  'Opt in to appear in a banger of a group drone photo and video in front of the museum.',
  '12:30pm — event concludes; make your way back to the venue walking or otherwise.',
]

function EventPanel({
  onOpenTopic,
  onEnter,
}: {
  onOpenTopic: (slug: string) => void
  onEnter: () => void
}) {
  return (
    <div>
      <Section title="What happened">
        <p style={proseStyle}>
          On the morning of Thursday 30 July 2026 — day two of{' '}
          <a href={MYBW_URL} target="_blank" rel="noopener noreferrer" style={linkStyle}>
            Malaysia Blockchain Week 2026
          </a>{' '}
          — a group of crypto natives left the conference floor and toured the Bank Negara Malaysia
          Museum &amp; Art Gallery together. We came back with{' '}
          <button type="button" onClick={() => onOpenTopic('museum-galleries')} style={inlineLinkStyle}>
            {GALLERY_IMAGES.filter((i) => i.kind === 'image').length} photographs
          </button>
          , a lot of transcribed wall text, and an essay contest.
        </p>
        <p style={{ ...proseStyle, marginTop: 14 }}>
          The contest is still open, and it is now open to <b style={{ color: 'var(--text)' }}>everyone</b> —
          you did not have to be there.
        </p>
      </Section>

      <Section title="The deadline">
        <div
          style={{
            padding: '20px 22px',
            borderRadius: 18,
            background: 'var(--accentSoft)',
            border: '1px solid var(--hairline)',
          }}
        >
          <div className="eyebrow" style={{ fontSize: 11, marginBottom: 8 }}>
            Submissions close
          </div>
          <p className="serif" style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>
            {CONTEST_DEADLINE_LABEL}
          </p>
          <p style={{ marginTop: 12, fontSize: 15.5, lineHeight: 1.6, color: 'var(--text2)' }}>
            {CONTEST_JUDGING}
          </p>
        </div>
      </Section>

      <Section title="The prompt">
        <blockquote
          className="serif"
          style={{
            fontSize: 24,
            lineHeight: 1.35,
            fontWeight: 600,
            letterSpacing: '-0.01em',
            color: 'var(--text)',
            borderLeft: '3px solid var(--accent)',
            paddingLeft: 18,
          }}
        >
          &ldquo;{CONTEST_PROMPT}&rdquo;
        </blockquote>
        <p style={{ ...proseStyle, marginTop: 16 }}>
          {CONTEST_WORDS_MIN}–{CONTEST_WORDS_MAX} words. {CONTEST_PRIZE} to the winner.
        </p>
      </Section>

      <Section title="Contest rules">
        <RulesList />
        <div style={{ marginTop: 24 }}>
          <button type="button" onClick={onEnter} style={primaryButton}>
            Enter the contest →
          </button>
        </div>
      </Section>

      <Section title="Research we did for you">
        <p style={proseStyle}>
          We transcribed every readable sign, label and wall panel we photographed at the museum and turned
          it into a cross-linked knowledge base of{' '}
          <button type="button" onClick={() => onOpenTopic('islamic-finance')} style={inlineLinkStyle}>
            {KNOWLEDGE.length} entries
          </button>
          , enriched with public sources. It covers the{' '}
          <button type="button" onClick={() => onOpenTopic('trade-dollars')} style={inlineLinkStyle}>
            trade dollars
          </button>{' '}
          that gave the ringgit its name, the{' '}
          <button type="button" onClick={() => onOpenTopic('ledgers')} style={inlineLinkStyle}>
            1354 manuscript
          </button>{' '}
          requiring debt contracts to be written down and witnessed,{' '}
          <button type="button" onClick={() => onOpenTopic('dual-system')} style={inlineLinkStyle}>
            Malaysia&apos;s statutory dual financial system
          </button>
          , and where{' '}
          <button type="button" onClick={() => onOpenTopic('regulation')} style={inlineLinkStyle}>
            digital assets currently sit with BNM and the SC
          </button>
          . Use all of it.
        </p>
        <p style={{ ...proseStyle, marginTop: 14 }}>
          If you work with an AI agent, point it at{' '}
          <a href="/mybw2026-contest/skill.md" style={linkStyle}>
            /mybw2026-contest/skill.md
          </a>{' '}
          — a machine-readable skill file with the rules, the research and the submission API.
        </p>
      </Section>

      <Section title="The agenda we ran on the day">
        <ul style={listStyle}>
          {AGENDA.map((item, i) => (
            <Bullet key={i}>{item}</Bullet>
          ))}
        </ul>
        <p style={{ ...proseStyle, marginTop: 16 }}>
          <a href={LUMA_URL} target="_blank" rel="noopener noreferrer" style={linkStyle}>
            View the original event on Luma ↗
          </a>
        </p>
      </Section>

      <Section title="Visiting the museum yourself">
        <ul style={listStyle}>
          <Bullet>Admission is free and requires no advance booking.</Bullet>
          <Bullet>
            Bags are strictly not allowed inside — they are only kept in an unlocked store area, so leave
            valuables at your hotel.
          </Bullet>
          <Bullet>
            <b style={{ color: 'var(--text)' }}>Bank Negara Malaysia Museum and Art Gallery</b>
            <br />
            Sasana Kijang, 2 Jalan Dato Onn, 50480 Kuala Lumpur, Wilayah Persekutuan Kuala Lumpur, Malaysia
            <br />
            <a href={MAPS_URL} target="_blank" rel="noopener noreferrer" style={linkStyle}>
              Open in Google Maps ↗
            </a>
          </Bullet>
        </ul>
      </Section>

      <Section title="About the host: Konrad Gnat">
        <p style={proseStyle}>
          Konrad has been a software engineer for the last ten years, a content creator, an AI and crypto
          hackathoner, and a digital nomad. He is the founder of Argo.com and host of the Argo
          Podcast. Find all his work at{' '}
          <a href={KONRAD_LINKS} target="_blank" rel="noopener noreferrer" style={linkStyle}>
            konradgnat.com/links
          </a>
          .
        </p>
      </Section>

      <Section title="About the sponsor: Argo">
        <p style={proseStyle}>
          Argo is a private AI journaling companion and soulbound NFT credential on Base mainnet. It
          lets you record, reflect, and grow using voice, text, video, or handwriting. Once you hit your
          daily 750-word goal, it rewards you with a streak count and a beautiful, shareable photo card
          featuring a custom haiku. Behind the scenes, an all-knowing personal mentor is available 24/7 to
          help you think differently, turn your experiences into words, and develop your creative powers.
        </p>
        <p style={{ marginTop: 20, fontSize: 15, fontWeight: 700, letterSpacing: '0.5px', color: 'var(--accent)' }}>
          #myBW2026
        </p>
      </Section>
    </div>
  )
}

/* ───────────────────────────────── Form ───────────────────────────────── */

function FormPanel() {
  return (
    <div>
      <div
        id="submit"
        style={{
          background: 'var(--surfaceAlt)',
          border: '1px solid var(--hairline)',
          borderRadius: 24,
          padding: 'clamp(22px, 4vw, 36px)',
        }}
      >
        <h2 className="serif" style={{ fontSize: 28, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: 8 }}>
          Submit your essay
        </h2>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text2)', marginBottom: 8 }}>
          Anyone may enter. Submissions close at <b style={{ color: 'var(--text)' }}>{CONTEST_DEADLINE_LABEL}</b>.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text2)', marginBottom: 26 }}>
          Your essay must already be published online under your real name and include a public Ethereum
          mainnet wallet address.
        </p>
        <ContestForm />
      </div>

      <Section title="Contest rules">
        <RulesList />
        <p style={{ ...proseStyle, marginTop: 18 }}>{CONTEST_JUDGING}</p>
      </Section>

      <Section title="Submitting programmatically">
        <p style={proseStyle}>
          You can submit without using this form. <code style={codeStyle}>POST</code> a JSON body to{' '}
          <code style={codeStyle}>{CONTEST_SUBMIT_API}</code>. The full request schema, the rules in
          machine-readable form, and the museum research are published as an agent skill at{' '}
          <a href="/mybw2026-contest/skill.md" style={linkStyle}>
            {CONTEST_SKILL_URL}
          </a>
          .
        </p>
      </Section>
    </div>
  )
}

/* ──────────────────────────────── Museum ──────────────────────────────── */

function MuseumPanel({
  sub,
  onSub,
  kbSlug,
  onKbSlug,
  onOpenTopic,
}: {
  sub: MuseumSub
  onSub: (s: MuseumSub) => void
  kbSlug: string | null
  onKbSlug: (s: string | null) => void
  onOpenTopic: (slug: string) => void
}) {
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 26 }}>
        {MUSEUM_SUBS.map((s) => {
          const active = sub === s.id
          return (
            <button
              key={s.id}
              onClick={() => onSub(s.id)}
              aria-pressed={active}
              style={{
                padding: '8px 15px',
                borderRadius: 10,
                fontSize: 14,
                fontWeight: 600,
                color: active ? 'var(--text)' : 'var(--text3)',
                background: active ? 'var(--surface)' : 'transparent',
                border: `1px solid ${active ? 'var(--hairline2)' : 'transparent'}`,
                boxShadow: active ? 'var(--shadow)' : 'none',
              }}
            >
              {s.label}
            </button>
          )
        })}
      </div>

      {sub === 'gallery' && <PhotoGallery onOpenTopic={onOpenTopic} />}
      {sub === 'notes' && <MuseumEssay onOpenTopic={onOpenTopic} />}
      {sub === 'wiki' && <KnowledgeBase slug={kbSlug} onSlugChange={onKbSlug} />}
    </div>
  )
}

/* ──────────────────────────────── Shared ──────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginTop: 44 }}>
      <h2
        className="serif"
        style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: 16 }}
      >
        {title}
      </h2>
      {children}
    </section>
  )
}

function Bullet({ children }: { children: React.ReactNode }) {
  return (
    <li style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span aria-hidden style={{ color: 'var(--accent)', fontWeight: 700, lineHeight: 1.62, flexShrink: 0 }}>
        ◆
      </span>
      <span>{children}</span>
    </li>
  )
}

const listStyle: React.CSSProperties = {
  display: 'grid',
  gap: 12,
  paddingLeft: 0,
  listStyle: 'none',
  fontSize: 16,
  lineHeight: 1.62,
  color: 'var(--text2)',
}

const proseStyle: React.CSSProperties = { fontSize: 16.5, lineHeight: 1.68, color: 'var(--text2)' }

const linkStyle: React.CSSProperties = { color: 'var(--accentDeep)', fontWeight: 600 }

const inlineLinkStyle: React.CSSProperties = {
  color: 'var(--accentDeep)',
  fontWeight: 600,
  fontSize: 'inherit',
  fontFamily: 'inherit',
  lineHeight: 'inherit',
  borderBottom: '1px solid rgba(185,107,51,0.32)',
}

const codeStyle: React.CSSProperties = {
  padding: '2px 6px',
  borderRadius: 6,
  fontSize: '0.9em',
  background: 'var(--accentTint)',
  color: 'var(--accentDeep)',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
  wordBreak: 'break-all',
}

const primaryButton: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '13px 22px',
  borderRadius: 14,
  fontSize: 15,
  fontWeight: 600,
  background: 'var(--accent)',
  color: '#fff',
  textDecoration: 'none',
}
