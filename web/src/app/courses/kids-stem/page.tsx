import type { Metadata } from 'next'
import Link from 'next/link'
import { Sparkles, ArrowRight, Check } from 'lucide-react'
import { CourseLayout, Pill, SectionHeading } from '@/components/course'
import {
  KIDS_COURSE_BASE,
  KIDS_CLASSES,
  COURSE_PURPOSE,
  AGENDA_SUMMARY,
  ONLINE_CLASS_FACTS,
  ONLINE_CLASS_AGENDA,
  ONLINE_PORTAL_OUTPUT,
  ONLINE_PORTAL_NOTE,
  ONLINE_SCHEDULE_NOTE,
} from '@/lib/kids-stem/course'
import KidsStemInterestForm from '@/components/KidsStemInterestForm'

export const metadata: Metadata = {
  title: 'Kids Wholistic Creativity & STEM, Argo',
  description:
    'A live online class for kids in speaking, writing and the quality of their ideas. A small group of 5, once every two weeks on a video call. Also taught in person in Forest City.',
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
          <div
            className="flex flex-wrap items-center justify-center"
            style={{ gap: '10px 28px', marginTop: 26 }}
          >
            {ONLINE_CLASS_FACTS.map((f) => (
              <div key={f.label} className="flex gap-2" style={{ fontSize: 14.5, alignItems: 'baseline' }}>
                <span
                  style={{
                    fontSize: 11.5,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--text3)',
                  }}
                >
                  {f.label}
                </span>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{f.value}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3" style={{ marginTop: 28 }}>
            <Link href="#schedule" className="btn-amber">
              Register interest
              <ArrowRight style={{ width: 16, height: 16 }} />
            </Link>
            <Link
              href={`${KIDS_COURSE_BASE}/enroll`}
              className="inline-flex items-center gap-2 rounded-btn"
              style={{
                height: 52,
                padding: '0 26px',
                fontSize: 16,
                fontWeight: 600,
                color: 'var(--text)',
                border: '1px solid var(--hairline2)',
                background: 'var(--surface)',
              }}
            >
              Join in person in Forest City
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

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 16, marginTop: 32 }}>
            {ONLINE_CLASS_AGENDA.map((s) => (
              <div key={s.title} className="card flex gap-4" style={{ padding: '18px 22px' }}>
                <span
                  className="inline-flex items-center justify-center serif"
                  style={{
                    flexShrink: 0,
                    width: 52,
                    height: 52,
                    borderRadius: 14,
                    background: 'var(--accentSoft)',
                    color: 'var(--accentDeep)',
                    fontSize: 13,
                    fontWeight: 600,
                    textAlign: 'center',
                    lineHeight: 1.1,
                  }}
                >
                  {s.minutes}
                  <br />
                  min
                </span>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                    {s.title}
                  </h3>
                  <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--text2)' }}>{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* After every class */}
      <section>
        <div className="wrap" style={{ padding: '48px 0 8px', maxWidth: 760 }}>
          <SectionHeading>After every class</SectionHeading>
          <p style={{ fontSize: 16.5, lineHeight: 1.6, color: 'var(--text2)', margin: '12px 0 22px' }}>
            Everything below is in the parent portal as soon as the class ends.
          </p>
          <ul className="flex flex-col" style={{ gap: 12 }}>
            {ONLINE_PORTAL_OUTPUT.map((item) => (
              <li key={item} className="flex gap-3" style={{ alignItems: 'flex-start' }}>
                <span
                  className="inline-flex items-center justify-center"
                  style={{
                    flexShrink: 0,
                    width: 24,
                    height: 24,
                    borderRadius: 8,
                    marginTop: 2,
                    background: 'var(--accentSoft)',
                    color: 'var(--accentDeep)',
                  }}
                >
                  <Check style={{ width: 14, height: 14 }} />
                </span>
                <span style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--text2)' }}>{item}</span>
              </li>
            ))}
          </ul>
          <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--text3)', marginTop: 18 }}>
            {ONLINE_PORTAL_NOTE}
          </p>
        </div>
      </section>

      {/* Class times: schedule not set yet, so collect interest instead */}
      <section id="schedule">
        <div className="wrap" style={{ padding: '48px 0 8px', maxWidth: 760 }}>
          <SectionHeading>Class times</SectionHeading>
          <p style={{ fontSize: 16.5, lineHeight: 1.6, color: 'var(--text2)', margin: '12px 0 22px' }}>
            Every class is capped at 5 children and 1 teacher, so every child gets real time to speak,
            share and be heard. {ONLINE_SCHEDULE_NOTE}
          </p>
          <KidsStemInterestForm />
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
