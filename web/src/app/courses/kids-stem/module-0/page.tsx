import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Clock, ArrowLeft } from 'lucide-react'
import { CourseLayout, Pill, SectionHeading } from '@/components/course'
import CourseQuiz from '@/components/CourseQuiz'
import {
  KIDS_COURSE_BASE,
  KIDS_MCQ,
  KIDS_OPEN_QUESTIONS,
  MODULE_0_INTRO,
  CLASS_AGENDA,
  COMPUTER_BY_AGE,
  COMPUTER_LADDER,
} from '@/lib/kids-stem/course'

export const metadata: Metadata = {
  title: 'Module 0: Meet the Computer, Kids Wholistic Creativity & STEM',
  description:
    'What a computer actually is, explained for a three-year-old, a seven-year-old and a twelve-year-old, plus the shape of the class itself.',
}

export default function Module0Page() {
  return (
    <CourseLayout>
      {/* Hero */}
      <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
        <div className="wrap" style={{ padding: '56px 0 44px', maxWidth: 820 }}>
          <Link
            href={KIDS_COURSE_BASE}
            className="inline-flex items-center gap-2"
            style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--text2)', marginBottom: 18 }}
          >
            <ArrowLeft style={{ width: 15, height: 15 }} /> All classes
          </Link>
          <div style={{ marginBottom: 14 }}>
            <Pill>Module 0</Pill>
          </div>
          <h1
            className="serif"
            style={{
              fontSize: 42,
              fontWeight: 600,
              letterSpacing: '-0.03em',
              lineHeight: 1.08,
              color: 'var(--text)',
              marginBottom: 16,
            }}
          >
            Meet the Computer
          </h1>
          <p style={{ fontSize: 17.5, lineHeight: 1.65, color: 'var(--text2)' }}>{MODULE_0_INTRO}</p>
        </div>
      </section>

      {/* The class, minute by minute */}
      <section>
        <div className="wrap" style={{ padding: '48px 0 8px', maxWidth: 820 }}>
          <SectionHeading>The hour</SectionHeading>
          <div className="flex flex-col" style={{ gap: 14, marginTop: 24 }}>
            {CLASS_AGENDA.map((s) => (
              <div key={s.title} className="card flex gap-4" style={{ padding: '18px 22px' }}>
                <span
                  className="inline-flex items-center justify-center serif"
                  style={{
                    flexShrink: 0,
                    width: 58,
                    height: 58,
                    borderRadius: 14,
                    background: 'var(--accentSoft)',
                    color: 'var(--accentDeep)',
                    fontSize: 15,
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
                  <h4
                    className="serif"
                    style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 5 }}
                  >
                    {s.title}
                  </h4>
                  <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--text2)' }}>{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How a computer works, by age */}
      <section id="how-a-computer-works" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 900 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>
            <Clock style={{ width: 13, height: 13 }} /> The STEM lesson
          </p>
          <SectionHeading>How a computer works, explained by age</SectionHeading>
          <p
            style={{
              fontSize: 16.5,
              lineHeight: 1.65,
              color: 'var(--text2)',
              margin: '14px 0 30px',
              maxWidth: 700,
            }}
          >
            The same idea, told at the right depth for each child. Explain the youngest version to
            everyone, then add a layer for the older kids.
          </p>

          <div className="flex flex-col" style={{ gap: 26 }}>
            {COMPUTER_BY_AGE.map((a) => (
              <div key={a.age} className="card" style={{ padding: '24px 26px' }}>
                <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 24, alignItems: 'center' }}>
                  {a.image && (
                    <Image
                      src={a.image}
                      alt={a.alt ?? ''}
                      width={1200}
                      height={800}
                      style={{
                        width: '100%',
                        height: 'auto',
                        borderRadius: 'var(--r-card)',
                        border: '1px solid var(--hairline)',
                      }}
                    />
                  )}
                  <div>
                    <Pill>{a.age}</Pill>
                    <h3
                      className="serif"
                      style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: '12px 0 10px' }}
                    >
                      {a.headline}
                    </h3>
                    <p style={{ fontSize: 16, lineHeight: 1.65, color: 'var(--text2)' }}>{a.body}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* The full ladder */}
          <div className="card" style={{ padding: '24px 26px', marginTop: 26 }}>
            <h3
              className="serif"
              style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}
            >
              The one-glance ladder
            </h3>
            <div className="flex flex-col" style={{ gap: 12 }}>
              {COMPUTER_LADDER.map((l) => (
                <div key={l.age} className="flex gap-3" style={{ fontSize: 15.5, lineHeight: 1.55 }}>
                  <span style={{ flexShrink: 0, width: 66, fontWeight: 700, color: 'var(--accentDeep)' }}>
                    {l.age}
                  </span>
                  <span style={{ color: 'var(--text2)' }}>{l.idea}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Quiz */}
      <section id="quiz" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '52px 0 80px', maxWidth: 820 }}>
          <SectionHeading>Knowledge check</SectionHeading>
          <p
            style={{
              fontSize: 16.5,
              lineHeight: 1.65,
              color: 'var(--text2)',
              margin: '14px 0 30px',
              maxWidth: 700,
            }}
          >
            Five quick questions, then five to answer in your own words. Anyone can submit and see
            their results. Sign in if you want your answers saved to come back to.
          </p>
          <CourseQuiz
            quizId="kids-stem"
            quizTitle="Kids STEM · Class 0"
            mcq={KIDS_MCQ}
            openQuestions={KIDS_OPEN_QUESTIONS}
            submitLabel="Submit answers"
          />
        </div>
      </section>
    </CourseLayout>
  )
}
