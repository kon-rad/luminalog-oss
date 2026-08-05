import type { Metadata } from 'next'
import Link from 'next/link'
import { Check, ArrowRight, Package, Rocket, Users, Repeat } from 'lucide-react'
import { CourseHero, CourseLayout, DaySchedule, Pill, SectionHeading, ValuesGrid } from '@/components/course'
import { COURSE_BASE, DAYS, OUTCOMES, TOOLKIT, GRADING, CAPSTONE } from '@/lib/ai-power-users/course'

export const metadata: Metadata = {
  title: 'AI Power Users — Argo',
  description:
    'A one-week, hands-on intensive that turns anyone into a confident, safe power user of modern AI — from prompting to RAG to running a private model locally.',
  openGraph: {
    title: 'AI Power Users — Argo',
    description:
      'A one-week, hands-on intensive that turns anyone into a confident, safe power user of modern AI — from prompting to RAG to running a private model locally.',
  },
}

const HOW_IT_WORKS = [
  {
    icon: Repeat,
    title: 'Hands-on every session',
    description:
      'No session is lecture-only. Every day ends with something you built.',
  },
  {
    icon: Users,
    title: 'Peers teach peers',
    description:
      "You explain concepts to your group and evaluate each other's work — the best test of understanding.",
  },
  {
    icon: Rocket,
    title: 'Tool-agnostic thinking',
    description:
      'We teach the concept, not the clicks, so your skills survive the next model release.',
  },
]

export default function CourseOverviewPage() {
  return (
    <CourseLayout>
      <CourseHero />

      {/* Live cohort banner */}
      <section>
        <div className="wrap" style={{ padding: '32px 0 0' }}>
          <Link
            href={`${COURSE_BASE}/module-1`}
            className="card flex flex-wrap items-center justify-between gap-4"
            style={{ padding: '24px 28px', textDecoration: 'none' }}
          >
            <div>
              <div className="flex items-center gap-2.5" style={{ marginBottom: 6 }}>
                <span className="inline-flex items-center gap-1.5" style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--danger)' }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--danger)', display: 'block' }} />
                  Live cohort
                </span>
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>Day 1 · Module 1</span>
              </div>
              <h3 className="serif" style={{ fontSize: 21, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                Build Your Private AI Second Brain
              </h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.55, color: 'var(--text2)' }}>
                The free live opener — set up a private AI agent inside your own notes in 45 minutes.
              </p>
            </div>
            <span className="eyebrow" style={{ flexShrink: 0 }}>
              Go to Module 1 <ArrowRight style={{ width: 14, height: 14 }} />
            </span>
          </Link>
        </div>
      </section>

      {/* Outcomes */}
      <section>
        <div className="wrap" style={{ padding: '64px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 34 }}>
            <SectionHeading>By Friday, you can</SectionHeading>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 16 }}>
            {OUTCOMES.map((outcome) => (
              <div key={outcome} className="card flex gap-3" style={{ padding: '20px 22px' }}>
                <Check style={{ width: 18, height: 18, color: 'var(--accent)', flexShrink: 0, marginTop: 3 }} />
                <span style={{ fontSize: 16, lineHeight: 1.55, color: 'var(--text2)' }}>{outcome}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section style={{ background: 'var(--surfaceAlt)', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)' }}>
        <div className="wrap" style={{ padding: '64px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>How we work together</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 560, margin: '12px auto 0' }}>
              Six values set the culture of the room. They shape every lab, critique, and
              feedback circle.
            </p>
          </div>
          <ValuesGrid />
          <div style={{ textAlign: 'center', marginTop: 30 }}>
            <Link href={`${COURSE_BASE}/values`} className="eyebrow" style={{ textDecoration: 'none' }}>
              Read the values in full <ArrowRight style={{ width: 14, height: 14 }} />
            </Link>
          </div>
        </div>
      </section>

      {/* Syllabus at a glance */}
      <section>
        <div className="wrap" style={{ padding: '64px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>The week at a glance</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 560, margin: '12px auto 0' }}>
              Five days, Monday to Friday. One topic a day, each run as a 45-minute workshop and a
              45-minute hands-on mentoring session — with a 15-minute break after each.
            </p>
            <div
              className="card"
              style={{ maxWidth: 380, margin: '20px auto 0', padding: '18px 22px', textAlign: 'left' }}
            >
              <DaySchedule />
            </div>
          </div>
          <div className="flex flex-col" style={{ gap: 16 }}>
            {DAYS.map((day) => {
              const inner = (
                <>
                  <span
                    className="inline-flex items-center justify-center"
                    style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--accentSoft)', color: 'var(--accentDeep)', flexShrink: 0 }}
                  >
                    <day.icon style={{ width: 22, height: 22 }} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="flex flex-wrap items-center gap-3" style={{ marginBottom: 6 }}>
                      <Pill>
                        Day {day.day} · {day.weekday}
                      </Pill>
                      <h3 className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>
                        {day.title}
                      </h3>
                    </div>
                    <p style={{ fontSize: 15.5, lineHeight: 1.55, color: 'var(--text2)' }}>{day.summary}</p>
                  </div>
                  {!day.tbd && <ArrowRight style={{ width: 18, height: 18, color: 'var(--text3)', flexShrink: 0 }} />}
                </>
              )
              return day.tbd ? (
                <div
                  key={day.slug}
                  className="card flex gap-5 items-center"
                  style={{ padding: '24px 26px', opacity: 0.65 }}
                >
                  {inner}
                </div>
              ) : (
                <Link
                  key={day.slug}
                  href={`${COURSE_BASE}/${day.slug}`}
                  className="card flex gap-5 items-center"
                  style={{ padding: '24px 26px', textDecoration: 'none' }}
                >
                  {inner}
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section style={{ background: 'var(--surfaceAlt)', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)' }}>
        <div className="wrap" style={{ padding: '64px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>How the class works</SectionHeading>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 22 }}>
            {HOW_IT_WORKS.map((item) => (
              <div key={item.title} className="card" style={{ padding: '26px 28px', textAlign: 'center' }}>
                <span
                  className="inline-flex items-center justify-center"
                  style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--accentSoft)', color: 'var(--accentDeep)', marginBottom: 16 }}
                >
                  <item.icon style={{ width: 22, height: 22 }} />
                </span>
                <h3 className="serif" style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                  {item.title}
                </h3>
                <p style={{ fontSize: 15.5, lineHeight: 1.55, color: 'var(--text2)' }}>{item.description}</p>
              </div>
            ))}
          </div>

          {/* Grading */}
          <div className="card" style={{ marginTop: 22, padding: '26px 28px' }}>
            <h3 className="serif" style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
              How you’re assessed
            </h3>
            <div className="flex flex-col gap-2.5">
              {GRADING.map((g) => (
                <div key={g.component} className="flex items-center justify-between gap-4" style={{ fontSize: 15.5 }}>
                  <span style={{ color: 'var(--text2)' }}>{g.component}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text)', flexShrink: 0 }}>{g.weight}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Capstone teaser */}
      <section>
        <div className="wrap" style={{ padding: '64px 0' }}>
          <div
            style={{
              background: 'var(--accentSoft)',
              border: '1px solid var(--accentTint)',
              borderRadius: 'var(--r-card)',
              padding: '38px 40px',
            }}
          >
            <div style={{ marginBottom: 16 }}>
              <Pill>Capstone</Pill>
            </div>
            <SectionHeading>Ship something real</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 620, margin: '14px 0 24px' }}>
              {CAPSTONE.prompt} Present a working demo, evaluated by your peers against a shared
              rubric.
            </p>
            <Link href={`${COURSE_BASE}/capstone`} className="eyebrow" style={{ textDecoration: 'none' }}>
              See the capstone brief <ArrowRight style={{ width: 14, height: 14 }} />
            </Link>
          </div>
        </div>
      </section>

      {/* Toolkit */}
      <section style={{ background: 'var(--surfaceAlt)', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)' }}>
        <div className="wrap" style={{ padding: '64px 0' }}>
          <div className="flex items-center justify-center gap-3" style={{ marginBottom: 34 }}>
            <Package style={{ width: 22, height: 22, color: 'var(--accent)' }} />
            <SectionHeading>Take-home toolkit</SectionHeading>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 16 }}>
            {TOOLKIT.map((item) => (
              <div key={item} className="card flex gap-3" style={{ padding: '20px 22px' }}>
                <Check style={{ width: 18, height: 18, color: 'var(--accent)', flexShrink: 0, marginTop: 3 }} />
                <span style={{ fontSize: 16, lineHeight: 1.55, color: 'var(--text2)' }}>{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="wrap" style={{ padding: '72px 0', textAlign: 'center', maxWidth: 640 }}>
          <SectionHeading>Ready to start?</SectionHeading>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', margin: '14px 0 30px' }}>
            Every lesson is open — start with Day 1 and work through at your own pace.
          </p>
          <Link href={`${COURSE_BASE}/day-1`} className="btn-amber">
            Start Day 1
            <ArrowRight style={{ width: 16, height: 16 }} />
          </Link>
        </div>
      </section>
    </CourseLayout>
  )
}
