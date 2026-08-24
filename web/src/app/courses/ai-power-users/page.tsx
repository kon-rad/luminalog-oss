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
