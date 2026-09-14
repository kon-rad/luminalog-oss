'use client'

import Image from 'next/image'
import { INK, CREAM, MUTE, ACCENT } from './theme'

const PHOTOS = [
  { src: '/demo-day/testimonial-chong.jpg', alt: 'A testimonial for Argo, shared publicly' },
  { src: '/demo-day/testimonial-johnston.jpg', alt: 'A testimonial for Argo, shared publicly' },
  { src: '/demo-day/testimonial-im.jpg', alt: 'A testimonial for Argo, shared publicly' },
  { src: '/demo-day/first-customer.jpg', alt: "A photo marking Argo's first paying customer" },
]

export default function TestimonialsSection() {
  return (
    <section style={{ background: INK, color: CREAM, padding: '120px 0' }}>
      <div className="wrap">
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: ACCENT }}>
          Real results
        </span>
        <h2 className="serif" style={{ marginTop: 14, fontSize: 'clamp(30px, 4vw, 46px)', fontWeight: 600, maxWidth: 640 }}>
          What early readers, guests, and subscribers are saying.
        </h2>
        <p style={{ marginTop: 14, fontSize: 15, color: MUTE, maxWidth: 560 }}>
          12+ podcast guests. 10 paying kids-class subscribers. Live on the App Store today.
        </p>
        <div style={{ marginTop: 44, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 20 }}>
          {PHOTOS.map((p) => (
            <div key={p.src} style={{ borderRadius: 20, overflow: 'hidden' }}>
              <Image src={p.src} alt={p.alt} width={400} height={500} style={{ width: '100%', height: 'auto', display: 'block' }} />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
