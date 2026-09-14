'use client'

import Image from 'next/image'
import { INK, CREAM, MUTE, ACCENT, HAIRLINE } from './theme'

const SPOKES = [
  {
    title: 'The Argo Podcast',
    stat: '12+ guests',
    body: 'Verified voices from crypto, AI, and startups, in conversation about the practice of building in public.',
  },
  {
    title: 'The kids class',
    stat: '3 classes, 10 paying subscribers',
    body: '10 to 12 kids per class, learning AI and STEM hands-on.',
  },
  {
    title: 'The AI Power Users course',
    stat: '$100+ per head',
    body: 'Free online. Paid in person, in Singapore, and now Cambodia.',
  },
  {
    title: 'The community',
    stat: '100,000+ views, about $0 ad spend',
    body: 'AI education, the kids programme, yoga livestreams, and DJ livestreams. A subscription is not an app. It is a membership.',
  },
]

export default function FlywheelCarousel() {
  return (
    <section style={{ background: INK, color: CREAM, padding: '120px 0' }}>
      <div className="wrap">
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: ACCENT }}>
          The flywheel
        </span>
        <h2 className="serif" style={{ marginTop: 14, fontSize: 'clamp(30px, 4vw, 46px)', fontWeight: 600 }}>
          Four spokes, one wheel.
        </h2>
        <div style={{ marginTop: 40, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 48, alignItems: 'center' }}>
          <Image
            src="/kuching/flywheel-diagram.png"
            alt="The Argo flywheel: podcast, AI course, kids class, and community feeding one another"
            width={960}
            height={800}
            style={{ width: '100%', height: 'auto', borderRadius: 24 }}
          />
          <div style={{ display: 'flex', gap: 20, overflowX: 'auto', scrollSnapType: 'x mandatory', padding: '4px 4px 12px' }}>
            {SPOKES.map((s) => (
              <div
                key={s.title}
                style={{
                  scrollSnapAlign: 'start',
                  flex: '0 0 min(80vw, 280px)',
                  borderRadius: 24,
                  border: `1px solid ${HAIRLINE}`,
                  background: 'rgba(255,255,255,0.03)',
                  padding: 24,
                }}
              >
                <h3 className="serif" style={{ fontSize: 19, fontWeight: 600 }}>{s.title}</h3>
                <p style={{ marginTop: 8, fontSize: 15, fontWeight: 700, color: ACCENT }}>{s.stat}</p>
                <p style={{ marginTop: 10, fontSize: 14, lineHeight: 1.55, color: MUTE }}>{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
