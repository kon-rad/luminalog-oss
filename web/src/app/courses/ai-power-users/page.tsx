import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { CourseHero, CourseLayout, Pill, SectionHeading, ValuesGrid } from '@/components/course'
import { COURSE_BASE, MODULES } from '@/lib/ai-power-users/course'

export const metadata: Metadata = {
  title: 'AI Power Users, Argo',
  description:
    'A hands-on course that turns anyone into a confident, safe power user of modern AI: from prompting to agents to running a private model locally.',
  openGraph: {
    title: 'AI Power Users, Argo',
    description:
      'A hands-on course that turns anyone into a confident, safe power user of modern AI: from prompting to agents to running a private model locally.',
  },
}

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
                <span style={{ fontSize: 13, color: 'var(--text3)' }}>Module 1</span>
              </div>
              <h3 className="serif" style={{ fontSize: 21, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                Build Your Private AI Second Brain
              </h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.55, color: 'var(--text2)' }}>
                The free live opener, set up a private AI agent inside your own notes in 45 minutes.
              </p>
            </div>
            <span className="eyebrow" style={{ flexShrink: 0 }}>
              Go to Module 1 <ArrowRight style={{ width: 14, height: 14 }} />
            </span>
          </Link>
        </div>
      </section>

      {/* Values */}
      <section style={{ background: 'var(--surfaceAlt)', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)' }}>
        <div className="wrap" style={{ padding: '64px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>How we work together</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 560, margin: '12px auto 0' }}>
              Three values set the culture of the room. They shape every lab, critique, and
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

      {/* Modules */}
      <section>
        <div className="wrap" style={{ padding: '64px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>The modules</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 560, margin: '12px auto 0' }}>
              Five modules, plus a Module 0 for anyone starting from zero on Windows 11. Each one
              is a standalone hands-on session, you leave with something working. New modules are
              announced as they are scheduled.
            </p>
          </div>
          <div className="flex flex-col" style={{ gap: 16 }}>
            {MODULES.map((mod) => {
              const inner = (
                <>
                  <span
                    className="inline-flex items-center justify-center"
                    style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--accentSoft)', color: 'var(--accentDeep)', flexShrink: 0 }}
                  >
                    <mod.icon style={{ width: 22, height: 22 }} />
                  </span>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="flex flex-wrap items-center gap-3" style={{ marginBottom: 6 }}>
                      <Pill>Module {mod.n}</Pill>
                      <h3 className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)' }}>
                        {mod.title}
                      </h3>
                      {mod.optional && (
                        <span
                          className="inline-flex items-center rounded-full"
                          style={{
                            fontSize: 12,
                            fontWeight: 600,
                            padding: '4px 11px',
                            color: 'var(--text2)',
                            border: '1px solid var(--hairline2)',
                          }}
                        >
                          Optional, Windows only
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 15.5, lineHeight: 1.55, color: 'var(--text2)' }}>{mod.summary}</p>
                  </div>
                  {!mod.tbd && <ArrowRight style={{ width: 18, height: 18, color: 'var(--text3)', flexShrink: 0 }} />}
                </>
              )
              return mod.tbd ? (
                <div
                  key={mod.slug}
                  className="card flex gap-5 items-center"
                  style={{ padding: '24px 26px', opacity: 0.65 }}
                >
                  {inner}
                </div>
              ) : (
                <Link
                  key={mod.slug}
                  href={`${COURSE_BASE}/${mod.slug}`}
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

      {/* CTA */}
      <section>
        <div className="wrap" style={{ padding: '72px 0', textAlign: 'center', maxWidth: 640 }}>
          <SectionHeading>Ready to start?</SectionHeading>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', margin: '14px 0 30px' }}>
            Every module is open, start with Module 1 and work through at your own pace.
          </p>
          <Link href={`${COURSE_BASE}/module-1`} className="btn-amber">
            Start Module 1
            <ArrowRight style={{ width: 16, height: 16 }} />
          </Link>
        </div>
      </section>
    </CourseLayout>
  )
}
