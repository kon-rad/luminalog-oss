import type { Metadata } from 'next'
import { Check, Package, Lightbulb } from 'lucide-react'
import {
  CourseDayList,
  CourseLayout,
  CourseNav,
  Pill,
  RubricTable,
  SectionHeading,
} from '@/components/course'
import { CAPSTONE } from '@/lib/ai-power-users/course'

export const metadata: Metadata = {
  title: 'Capstone — AI Power Users — Argo',
  description:
    'Solve one real problem using at least three capabilities from the week, present a working demo, and be evaluated by your peers against a shared rubric.',
}

export default function CapstonePage() {
  return (
    <CourseLayout>
      {/* Header */}
      <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
        <div className="wrap" style={{ padding: '56px 0 40px', maxWidth: 800 }}>
          <div style={{ marginBottom: 22 }}>
            <CourseDayList currentSlug="capstone" />
          </div>
          <div style={{ marginBottom: 16 }}>
            <Pill>Capstone</Pill>
          </div>
          <h1
            className="serif"
            style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1, color: 'var(--text)', marginBottom: 14 }}
          >
            Ship something real
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--text2)' }}>{CAPSTONE.prompt}</p>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ padding: '48px 0', maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 48 }}>
          {/* Capabilities */}
          <div>
            <SectionHeading>Use at least three of these</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', margin: '12px 0 24px' }}>
              The point is to combine what you learned, not to use everything. Pick the three (or
              more) that fit your problem.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 16 }}>
              {CAPSTONE.capabilities.map((capability) => (
                <div key={capability} className="card flex gap-3" style={{ padding: '20px 22px' }}>
                  <Check style={{ width: 18, height: 18, color: 'var(--accent)', flexShrink: 0, marginTop: 3 }} />
                  <span style={{ fontSize: 16, lineHeight: 1.55, color: 'var(--text2)' }}>{capability}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Deliverable */}
          <div>
            <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
              <Package style={{ width: 20, height: 20, color: 'var(--accent)' }} />
              <SectionHeading>Deliverable</SectionHeading>
            </div>
            <div className="card" style={{ padding: '24px 26px', fontSize: 17, lineHeight: 1.6, color: 'var(--text2)' }}>
              {CAPSTONE.deliverable}
            </div>
          </div>

          {/* Examples */}
          <div>
            <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
              <Lightbulb style={{ width: 20, height: 20, color: 'var(--accent)' }} />
              <SectionHeading>Example projects</SectionHeading>
            </div>
            <ul className="flex flex-col gap-2.5">
              {CAPSTONE.examples.map((example) => (
                <li key={example} className="flex gap-3" style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)' }}>
                  <span style={{ color: 'var(--accent)' }}>·</span>
                  {example}
                </li>
              ))}
            </ul>
          </div>

          {/* Rubric */}
          <div>
            <SectionHeading>How your peers evaluate it</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', margin: '12px 0 24px' }}>
              Each peer scores your project 1–5 on every criterion and leaves one written strength
              and one written suggestion. Remember the values: criticise in private, praise in
              public.
            </p>
            <RubricTable />
          </div>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ padding: '0 0 72px', maxWidth: 800 }}>
          <CourseNav currentSlug="capstone" />
        </div>
      </section>
    </CourseLayout>
  )
}
