import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'
import { CourseLayout, Pill, SectionHeading } from '@/components/course'
import { KIDS_COURSE_BASE, KIDS_CLASSES, COURSE_PURPOSE, AGENDA_SUMMARY } from '@/lib/kids-stem/course'

export const metadata: Metadata = {
  title: 'Kids Wholistic Creativity & STEM, Argo',
  description:
    'A class for kids 2 to 12 in speaking, writing and the quality of their ideas. Drawing, journaling and one STEM concept per class. Follow along online, taught in person in Forest City.',
  openGraph: {
    title: 'Kids Wholistic Creativity & STEM, Argo',
    description:
      'A class for kids 2 to 12 in speaking, writing and the quality of their ideas, sponsored by Argo.',
  },
}

export default function KidsStemPage() {
  return (
    <CourseLayout>
      {/* Hero */}
      <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
        <div className="wrap" style={{ padding: '64px 0 52px', textAlign: 'center' }}>
          <span className="eyebrow" style={{ marginBottom: 18, justifyContent: 'center' }}>
            <Sparkles style={{ width: 14, height: 14 }} /> Argo · Kids Course
          </span>
          <h1
            className="serif"
            style={{
              fontSize: 48,
              fontWeight: 600,
              letterSpacing: '-0.03em',
              lineHeight: 1.06,
              color: 'var(--text)',
              marginBottom: 18,
            }}
          >
            Wholistic Creativity &amp; STEM
          </h1>
          <p style={{ fontSize: 19, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 680, margin: '0 auto' }}>
            {COURSE_PURPOSE}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3" style={{ marginTop: 28 }}>
            <Link href={`${KIDS_COURSE_BASE}/enroll`} className="btn-amber">
              Join the class in Forest City
              <ArrowRight style={{ width: 16, height: 16 }} />
            </Link>
          </div>
        </div>
      </section>

      {/* How a class runs */}
      <section>
        <div className="wrap" style={{ padding: '48px 0 8px', maxWidth: 760 }}>
          <SectionHeading>How a class runs</SectionHeading>
          <ol className="flex flex-col" style={{ gap: 12, marginTop: 22 }}>
            {AGENDA_SUMMARY.map((step, i) => (
              <li key={step} className="flex gap-3" style={{ alignItems: 'baseline' }}>
                <span
                  style={{
                    flexShrink: 0,
                    width: 26,
                    fontSize: 12.5,
                    fontWeight: 700,
                    color: 'var(--accentDeep)',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span style={{ fontSize: 16.5, lineHeight: 1.6, color: 'var(--text2)' }}>{step}</span>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Class list */}
      <section>
        <div className="wrap" style={{ padding: '48px 0 80px' }}>
          <SectionHeading>The classes</SectionHeading>
          <p
            style={{
              fontSize: 16.5,
              lineHeight: 1.6,
              color: 'var(--text2)',
              margin: '12px 0 26px',
              maxWidth: 680,
            }}
          >
            They build on each other and compound.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 20 }}>
            {KIDS_CLASSES.map((c) => (
              <Link
                key={c.n}
                href={c.href ?? KIDS_COURSE_BASE}
                className="card flex flex-col"
                style={{ padding: '22px 24px', textDecoration: 'none' }}
              >
                <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                  <Pill>Module {c.n}</Pill>
                </div>
                <h3
                  className="serif"
                  style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}
                >
                  {c.title}
                </h3>
                <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--text2)' }}>{c.summary}</p>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </CourseLayout>
  )
}
