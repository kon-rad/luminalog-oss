import type { Metadata } from 'next'
import Link from 'next/link'
import { ArrowRight, Sparkles, Cpu, Palette } from 'lucide-react'
import { CourseLayout } from '@/components/course'

export const metadata: Metadata = {
  title: 'Courses — Argo',
  description:
    'Free, hands-on courses from Argo: AI Power Users for adults, and a Wholistic Creativity & STEM class for kids.',
  openGraph: {
    title: 'Courses — Argo',
    description:
      'Free, hands-on courses from Argo: AI Power Users for adults, and a Wholistic Creativity & STEM class for kids.',
  },
}

const COURSES = [
  {
    href: '/courses/ai-power-users',
    icon: Cpu,
    eyebrow: 'For adults · one-week intensive',
    title: 'AI Power Users',
    blurb:
      'Go from “I’ve heard of ChatGPT” to picking the right tool for any task, prompting like a pro, chaining tools together, protecting your data, and running a private model on your own laptop.',
  },
  {
    href: '/courses/kids-stem',
    icon: Palette,
    eyebrow: 'For kids 2–12 · weekly class',
    title: 'Kids Wholistic Creativity & STEM',
    blurb:
      'Breathing and movement, free drawing and expressive writing, and playful STEM lessons — starting with what a computer actually is, explained for every age.',
  },
]

export default function CoursesPage() {
  return (
    <CourseLayout>
      <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
        <div className="wrap" style={{ padding: '72px 0 56px', textAlign: 'center' }}>
          <span className="eyebrow" style={{ marginBottom: 18, justifyContent: 'center' }}>
            <Sparkles style={{ width: 14, height: 14 }} /> Argo · Courses
          </span>
          <h1
            className="serif"
            style={{ fontSize: 52, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.05, color: 'var(--text)', marginBottom: 18 }}
          >
            Courses
          </h1>
          <p style={{ fontSize: 19, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 620, margin: '0 auto' }}>
            Free, hands-on learning from Argo — for grown-ups and for kids. Lifelong
            education, self-reliance, and private, creative use of technology.
          </p>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ padding: '56px 0 80px' }}>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 24 }}>
            {COURSES.map((c) => (
              <Link
                key={c.href}
                href={c.href}
                className="card flex flex-col"
                style={{ padding: '30px 32px', textDecoration: 'none' }}
              >
                <span
                  className="inline-flex items-center justify-center"
                  style={{ width: 48, height: 48, borderRadius: 14, background: 'var(--accentSoft)', color: 'var(--accentDeep)', marginBottom: 18 }}
                >
                  <c.icon style={{ width: 24, height: 24 }} />
                </span>
                <p className="eyebrow" style={{ marginBottom: 10 }}>{c.eyebrow}</p>
                <h2 className="serif" style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: 12 }}>
                  {c.title}
                </h2>
                <p style={{ fontSize: 16, lineHeight: 1.6, color: 'var(--text2)', flex: 1 }}>{c.blurb}</p>
                <span
                  className="inline-flex items-center gap-2"
                  style={{ marginTop: 20, fontSize: 15.5, fontWeight: 600, color: 'var(--accentDeep)' }}
                >
                  View course
                  <ArrowRight style={{ width: 16, height: 16 }} />
                </span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </CourseLayout>
  )
}
