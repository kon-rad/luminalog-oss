import Navbar from '@/components/Navbar'
import SiteFooter from '@/components/SiteFooter'
import type { UpcomingEvent } from '@/lib/events/luma'

/* ──────────────────────────────────────────────────────────────────────────
 * Shared presentational helpers for /events.
 * Mirrors the visual language of the blog and legal pages (see
 * components/blog.tsx): warm paper background, Newsreader serif headings,
 * hairline rules, amber accent. The past-events gallery is a client component
 * (components/PastEvents.tsx) because of its filter and lightbox.
 * ────────────────────────────────────────────────────────────────────────── */

/* Event categories, shared by the upcoming cards and the past archive. */
export const TYPE_LABELS: Record<string, string> = {
  WORKSHOP: 'Workshop',
  DEMO_DAY: 'Demo Day',
  ROBOTICS_CLUB: 'Robotics',
  PUBLIC_SPEAKERS: 'Speaking',
  MUAY_THAI: 'Muay Thai',
  WRITERS_CLUB: 'Writing',
  FILM_DISCUSSION: 'Film',
  HACKATHON: 'Hackathon',
  OTHER: 'Event',
}

/* One accent per category, drawn from the Argo dimension palette so the page
 * stays within the brand rather than importing the old club's colours. */
export const TYPE_COLORS: Record<string, string> = {
  WORKSHOP: 'var(--dim-intellect)',
  DEMO_DAY: 'var(--dim-art)',
  ROBOTICS_CLUB: 'var(--dim-spirit)',
  PUBLIC_SPEAKERS: 'var(--accentDeep)',
  MUAY_THAI: 'var(--dim-emotion)',
  WRITERS_CLUB: 'var(--dim-intellect)',
  FILM_DISCUSSION: 'var(--dim-spirit)',
  HACKATHON: 'var(--accent)',
  OTHER: 'var(--text2)',
}

export function formatEventDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

/* A small category pill — the paper-theme stand-in for the old Badge. */
export function TypePill({ type }: { type: string }) {
  const color = TYPE_COLORS[type] || TYPE_COLORS.OTHER
  return (
    <span
      className="inline-flex items-center rounded-full"
      style={{
        fontSize: 11.5,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        padding: '4px 10px',
        color,
        background: 'var(--surfaceAlt)',
        border: `1px solid ${color}33`,
      }}
    >
      {TYPE_LABELS[type] || TYPE_LABELS.OTHER}
    </span>
  )
}

function MetaRow({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2" style={{ fontSize: 14.5, color: 'var(--text2)' }}>
      <span style={{ color: 'var(--accent)', flexShrink: 0, display: 'flex' }}>{icon}</span>
      {children}
    </div>
  )
}

export function CalendarGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <rect x="3" y="5" width="18" height="16" rx="2" /><line x1="3" y1="10" x2="21" y2="10" />
      <line x1="8" y1="3" x2="8" y2="7" /><line x1="16" y1="3" x2="16" y2="7" />
    </svg>
  )
}

export function ClockGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 15 14" />
    </svg>
  )
}

export function PinGlyph() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" />
    </svg>
  )
}

export function CameraGlyph({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <path d="M3 8h3l2-3h8l2 3h3v12H3V8Z" /><circle cx="12" cy="13" r="3.5" />
    </svg>
  )
}

/* A single upcoming event, fetched live from Luma. */
export function UpcomingEventCard({ event }: { event: UpcomingEvent }) {
  return (
    <a
      href={event.lumaUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="card flex flex-col overflow-hidden"
      style={{ textDecoration: 'none' }}
    >
      {event.coverUrl && (
        // Luma covers are remote and change per event; a plain img avoids
        // whitelisting lumacdn in next.config for a purely decorative cover.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={event.coverUrl} alt="" loading="lazy" className="w-full object-cover" style={{ aspectRatio: '16 / 9' }} />
      )}

      <div className="flex flex-1 flex-col" style={{ padding: '22px 24px 24px' }}>
        <div style={{ marginBottom: 12 }}>
          <TypePill type={event.eventType} />
        </div>

        <h3
          className="serif"
          style={{ fontSize: 21, fontWeight: 600, lineHeight: 1.2, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: 12 }}
        >
          {event.title}
        </h3>

        <div className="flex flex-col gap-1.5" style={{ marginBottom: 14 }}>
          <MetaRow icon={<CalendarGlyph />}>{formatEventDate(event.date)}</MetaRow>
          <MetaRow icon={<ClockGlyph />}>{event.time}</MetaRow>
          <MetaRow icon={<PinGlyph />}>{event.location}</MetaRow>
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

        <span className="eyebrow" style={{ marginTop: 'auto' }}>
          Register on Luma →
        </span>
      </div>
    </a>
  )
}

/* Page chrome: Navbar, warm header, and the footer used across Argo pages. */
export function EventsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main style={{ background: 'var(--bg)' }}>
        <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
          <div className="wrap" style={{ padding: '72px 0 44px' }}>
            <span className="eyebrow" style={{ marginBottom: 14 }}>Gather</span>
            <h1
              className="serif"
              style={{ fontSize: 46, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.08, color: 'var(--text)', marginBottom: 14 }}
            >
              Events
            </h1>
            <p style={{ fontSize: 18.5, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 620 }}>
              Workshops, training sessions, screenings and demo nights: run in person
              and open to anyone who wants to build, move, and think alongside others.
            </p>
          </div>
        </section>

        {children}
      </main>
      <SiteFooter />
    </>
  )
}
