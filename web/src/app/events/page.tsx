import type { Metadata } from 'next'
import Link from 'next/link'
import { EventsLayout, UpcomingEventCard } from '@/components/events'
import PastEvents from '@/components/PastEvents'
import { getUpcomingEvents, LUMA_CALENDAR_URL } from '@/lib/events/luma'
import { PAST_EVENTS } from '@/lib/events/pastEvents'

export const metadata: Metadata = {
  title: 'Events, Argo',
  description:
    'Workshops, training sessions, screenings and demo nights: run in person and open to anyone who wants to build, move, and think alongside others.',
  openGraph: {
    title: 'Events, Argo',
    description:
      'Workshops, training sessions, screenings and demo nights: run in person and open to anyone who wants to build, move, and think alongside others.',
  },
}

// Upcoming events are fetched live from Luma at request time (cached 30 min).
export const dynamic = 'force-dynamic'

export default async function EventsPage({
  searchParams,
}: {
  searchParams?: { show?: string }
}) {
  const showPast = searchParams?.show === 'past'
  const upcoming = await getUpcomingEvents()

  return (
    <EventsLayout>
      <section>
        <div className="wrap" style={{ padding: '40px 0 72px' }}>
          {/* Tabs — plain links so the view is shareable and needs no client JS. */}
          <div className="flex items-center gap-1" style={{ marginBottom: 30, borderBottom: '1px solid var(--hairline)' }}>
            <Tab href="/events" active={!showPast}>
              Upcoming ({upcoming.length})
            </Tab>
            <Tab href="/events?show=past" active={showPast}>
              Past ({PAST_EVENTS.length})
            </Tab>
          </div>

          {showPast ? (
            <PastEvents />
          ) : upcoming.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 22 }}>
              {upcoming.map((event) => (
                <UpcomingEventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <div style={{ padding: '56px 0', textAlign: 'center' }}>
              <p style={{ fontSize: 17, color: 'var(--text2)', marginBottom: 18 }}>
                Nothing on the calendar right now, new events appear here automatically.
              </p>
              <a href={LUMA_CALENDAR_URL} target="_blank" rel="noopener noreferrer" className="btn-amber">
                Follow the calendar on Luma
              </a>
            </div>
          )}
        </div>
      </section>
    </EventsLayout>
  )
}

function Tab({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      style={{
        fontSize: 15.5,
        fontWeight: 600,
        padding: '10px 16px',
        color: active ? 'var(--text)' : 'var(--text2)',
        borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
        marginBottom: -1,
        textDecoration: 'none',
      }}
    >
      {children}
    </Link>
  )
}
