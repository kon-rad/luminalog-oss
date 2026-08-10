import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight } from 'lucide-react'
import { CourseLayout, CourseModuleList, ValuesGrid } from '@/components/course'
import { COURSE_BASE } from '@/lib/ai-power-users/course'

export const metadata: Metadata = {
  title: 'Values, AI Power Users, Argo',
  description:
    'The three values that set the culture of the AI Power Users course: win and help win, the four agreements, and praise in public, criticise in private.',
}

export default function CourseValuesPage() {
  return (
    <CourseLayout>
      <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
        <div className="wrap" style={{ padding: '72px 0 48px', textAlign: 'center' }}>
          <h1
            className="serif"
            style={{ fontSize: 46, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.08, color: 'var(--text)', marginBottom: 16 }}
          >
            How we work together
          </h1>
          <p style={{ fontSize: 18.5, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 620, margin: '0 auto' }}>
            Skills make you capable. Culture makes the room worth being in. These three values
            shape every lab, every critique, and every feedback circle in the AI Power Users
            course.
          </p>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ padding: '56px 0' }}>
          <ValuesGrid showInClass />
        </div>
      </section>

      <section>
        <div className="wrap" style={{ padding: '0 0 72px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 30 }}>
          <CourseModuleList currentSlug="values" />
          <Link href={`${COURSE_BASE}/module-1`} className="btn-amber">
            Start Module 1
            <ArrowRight style={{ width: 16, height: 16 }} />
          </Link>
        </div>
      </section>
    </CourseLayout>
  )
}
