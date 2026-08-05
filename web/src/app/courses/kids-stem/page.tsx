import type { Metadata } from 'next'
import Image from 'next/image'
import { Sparkles, Clock } from 'lucide-react'
import { CourseLayout, Pill, SectionHeading } from '@/components/course'
import CourseQuiz from '@/components/CourseQuiz'
import {
  KIDS_CLASSES,
  KIDS_MCQ,
  KIDS_OPEN_QUESTIONS,
  MODULE_0_INTRO,
  MODULE_0_SEGMENTS,
  COMPUTER_BY_AGE,
  COMPUTER_LADDER,
} from '@/lib/kids-stem/course'

export const metadata: Metadata = {
  title: 'Kids Wholistic Creativity & STEM — Argo',
  description:
    'A free weekly class for kids 2–12: mindfulness and movement, free drawing and expressive writing, and playful STEM — starting with what a computer actually is, explained for every age.',
  openGraph: {
    title: 'Kids Wholistic Creativity & STEM — Argo',
    description:
      'A free weekly class for kids 2–12: mindfulness and movement, creativity, and playful STEM, sponsored by Argo.',
  },
}

export default function KidsStemPage() {
  return (
    <CourseLayout>
      {/* Hero */}
      <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
        <div className="wrap" style={{ padding: '72px 0 56px', textAlign: 'center' }}>
          <span className="eyebrow" style={{ marginBottom: 18, justifyContent: 'center' }}>
            <Sparkles style={{ width: 14, height: 14 }} /> Argo · Kids Course
          </span>
          <h1
            className="serif"
            style={{ fontSize: 48, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.06, color: 'var(--text)', marginBottom: 18 }}
          >
            Wholistic Creativity &amp; STEM
          </h1>
          <p style={{ fontSize: 19, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 640, margin: '0 auto' }}>
            A gentle, hands-on class for kids about 2 to 12. Mindfulness and movement,
            free drawing and expressive writing, and a playful first step into STEM.
          </p>
          <p style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--accentDeep)', marginTop: 20 }}>
            Free · Sponsored by Argo — a private AI journal
          </p>
        </div>
      </section>

      {/* Class list */}
      <section>
        <div className="wrap" style={{ padding: '48px 0 8px' }}>
          <SectionHeading>The classes</SectionHeading>
          <p style={{ fontSize: 16.5, lineHeight: 1.6, color: 'var(--text2)', margin: '12px 0 26px', maxWidth: 680 }}>
            The classes build on each other and compound. We start with Module 0 — more are on the way.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 20 }}>
            {KIDS_CLASSES.map((c) => {
              const live = c.status === 'live'
              const Wrapper: React.ElementType = live ? 'a' : 'div'
              return (
                <Wrapper
                  key={c.n}
                  {...(live ? { href: '#module-0' } : {})}
                  className="card flex flex-col"
                  style={{ padding: '22px 24px', textDecoration: 'none', opacity: live ? 1 : 0.62 }}
                >
                  <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
                    <Pill>Module {c.n}</Pill>
                    {!live && <span style={{ fontSize: 12.5, color: 'var(--text3)' }}>· Coming soon</span>}
                  </div>
                  <h3 className="serif" style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                    {c.title}
                  </h3>
                  <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--text2)' }}>{c.summary}</p>
                </Wrapper>
              )
            })}
          </div>
        </div>
      </section>

      {/* Module 0 — the class */}
      <section id="module-0" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '48px 0 8px', maxWidth: 820 }}>
          <div style={{ marginBottom: 14 }}>
            <Pill>Module 0 · The class</Pill>
          </div>
          <SectionHeading>Meet the Computer</SectionHeading>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--text2)', margin: '16px 0 30px' }}>
            {MODULE_0_INTRO}
          </p>
          <div className="flex flex-col" style={{ gap: 14 }}>
            {MODULE_0_SEGMENTS.map((s) => (
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
                  <h4 className="serif" style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)', marginBottom: 5 }}>
                    {s.title}
                  </h4>
                  <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--text2)' }}>{s.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How a computer works — by age */}
      <section id="how-a-computer-works" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 900 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>
            <Clock style={{ width: 13, height: 13 }} /> The STEM lesson
          </p>
          <SectionHeading>How a computer works — explained by age</SectionHeading>
          <p style={{ fontSize: 16.5, lineHeight: 1.65, color: 'var(--text2)', margin: '14px 0 30px', maxWidth: 700 }}>
            The same idea, told at the right depth for each child. Explain the youngest
            version to everyone, then add a layer for the older kids.
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
                      style={{ width: '100%', height: 'auto', borderRadius: 'var(--r-card)', border: '1px solid var(--hairline)' }}
                    />
                  )}
                  <div>
                    <Pill>{a.age}</Pill>
                    <h3 className="serif" style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)', margin: '12px 0 10px' }}>
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
            <h3 className="serif" style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
              The one-glance ladder
            </h3>
            <div className="flex flex-col" style={{ gap: 12 }}>
              {COMPUTER_LADDER.map((l) => (
                <div key={l.age} className="flex gap-3" style={{ fontSize: 15.5, lineHeight: 1.55 }}>
                  <span style={{ flexShrink: 0, width: 66, fontWeight: 700, color: 'var(--accentDeep)' }}>{l.age}</span>
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
          <p style={{ fontSize: 16.5, lineHeight: 1.65, color: 'var(--text2)', margin: '14px 0 30px', maxWidth: 700 }}>
            Five quick questions, then five to answer in your own words. Anyone can submit and
            see their results — sign in if you want your answers saved to come back to.
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
