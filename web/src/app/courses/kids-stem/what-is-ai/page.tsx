import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { Sparkles, Clock, ArrowLeft, Check, X, Rocket, Users } from 'lucide-react'
import { CourseLayout, Pill, SectionHeading } from '@/components/course'
import CourseQuiz from '@/components/CourseQuiz'
import { KIDS_COURSE_BASE } from '@/lib/kids-stem/course'
import {
  MODULE_1_TITLE,
  MODULE_1_INTRO,
  MODULE_1_HOOK,
  AI_BY_AGE,
  AI_PIECES,
  AI_LADDER,
  AI_HISTORY,
  AI_PEOPLE,
  AI_CAN,
  AI_CANNOT,
  AI_SOON,
  AI_LATER,
  AI_OPEN_ARGUMENT,
  AI_STAYS_HUMAN,
  MODULE_1_RUNNING_ORDER,
  MODULE_1_GAME,
  MODULE_1_MCQ,
  MODULE_1_OPEN_QUESTIONS,
} from '@/lib/kids-stem/module-1'

export const metadata: Metadata = {
  title: 'Class 1 · What Is AI? Kids Wholistic Creativity & STEM, Argo',
  description:
    'How AI learns, explained for ages 3, 7 and 12, plus the story of artificial intelligence, the people who built it, where it is today, and what might happen next.',
  openGraph: {
    title: 'What Is AI? Kids Wholistic Creativity & STEM, Argo',
    description:
      'How AI learns, explained for ages 3, 7 and 12, plus the history, the key people, and what comes next.',
  },
}

const listItem: React.CSSProperties = {
  fontSize: 15.5,
  lineHeight: 1.6,
  color: 'var(--text2)',
}

export default function WhatIsAiPage() {
  return (
    <CourseLayout>
      {/* Hero */}
      <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
        <div className="wrap" style={{ padding: '72px 0 56px', textAlign: 'center' }}>
          <span className="eyebrow" style={{ marginBottom: 18, justifyContent: 'center' }}>
            <Sparkles style={{ width: 14, height: 14 }} /> Argo · Kids Course · Class 1
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
            What Is AI?
          </h1>
          <p style={{ fontSize: 19, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 660, margin: '0 auto' }}>
            Learning from examples, explained for every age, with the story of how we
            got here and where it might go next.
          </p>
          <p style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--accentDeep)', marginTop: 20 }}>
            Sponsored by Argo, a private AI journal
          </p>
        </div>
      </section>

      {/* Intro + hook */}
      <section>
        <div className="wrap" style={{ padding: '48px 0 8px', maxWidth: 820 }}>
          <Link
            href={KIDS_COURSE_BASE}
            className="inline-flex items-center gap-2"
            style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--accentDeep)', textDecoration: 'none', marginBottom: 22 }}
          >
            <ArrowLeft style={{ width: 15, height: 15 }} /> All classes
          </Link>

          <div style={{ marginBottom: 14 }}>
            <Pill>Class 1 · The lesson</Pill>
          </div>
          <SectionHeading>{MODULE_1_TITLE}</SectionHeading>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--text2)', margin: '16px 0 26px' }}>
            {MODULE_1_INTRO}
          </p>

          <blockquote
            className="card"
            style={{
              padding: '24px 28px',
              borderLeft: '3px solid var(--accentDeep)',
              background: 'var(--accentSoft)',
            }}
          >
            <p className="serif" style={{ fontSize: 20, lineHeight: 1.5, color: 'var(--text)', fontStyle: 'italic' }}>
              “{MODULE_1_HOOK}”
            </p>
            <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 12 }}>
              Say this first, to the whole room. Every age level below is a deeper version of it.
            </p>
          </blockquote>
        </div>
      </section>

      {/* Explained by age */}
      <section id="by-age" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 900 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>
            <Clock style={{ width: 13, height: 13 }} /> The STEM lesson
          </p>
          <SectionHeading>What is AI, explained by age</SectionHeading>
          <p style={{ fontSize: 16.5, lineHeight: 1.65, color: 'var(--text2)', margin: '14px 0 30px', maxWidth: 700 }}>
            The same idea, told at the right depth for each child. Explain the youngest
            version to everyone, then add a layer for the older kids while the little
            ones start drawing.
          </p>

          <div className="flex flex-col" style={{ gap: 26 }}>
            {AI_BY_AGE.map((a) => (
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

          {/* The four pieces */}
          <div className="card" style={{ padding: '24px 26px', marginTop: 26 }}>
            <h3 className="serif" style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
              The four pieces
            </h3>
            <p style={{ fontSize: 14.5, color: 'var(--text3)', marginBottom: 18 }}>
              What the oldest kids should be able to name by the end.
            </p>
            <div className="flex flex-col" style={{ gap: 12 }}>
              {AI_PIECES.map((p) => (
                <div key={p.piece} className="flex gap-3" style={{ fontSize: 15.5, lineHeight: 1.55 }}>
                  <span style={{ flexShrink: 0, width: 130, fontWeight: 700, color: 'var(--accentDeep)' }}>
                    {p.piece}
                  </span>
                  <span style={{ color: 'var(--text2)' }}>{p.what}</span>
                </div>
              ))}
            </div>
          </div>

          {/* The ladder */}
          <div className="card" style={{ padding: '24px 26px', marginTop: 20 }}>
            <h3 className="serif" style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
              The one-glance ladder
            </h3>
            <div className="flex flex-col" style={{ gap: 12 }}>
              {AI_LADDER.map((l) => (
                <div key={l.age} className="flex gap-3" style={{ fontSize: 15.5, lineHeight: 1.55 }}>
                  <span style={{ flexShrink: 0, width: 66, fontWeight: 700, color: 'var(--accentDeep)' }}>{l.age}</span>
                  <span style={{ color: 'var(--text2)' }}>{l.idea}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* The story of AI */}
      <section id="history" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 820 }}>
          <SectionHeading>The story of AI</SectionHeading>
          <p style={{ fontSize: 16.5, lineHeight: 1.65, color: 'var(--text2)', margin: '14px 0 30px' }}>
            Tell this as a story with characters, not a list of dates. The kids remember
            the people. Three or four beats is plenty for the little ones; the older kids
            can take the whole arc.
          </p>

          <div className="flex flex-col" style={{ gap: 14 }}>
            {AI_HISTORY.map((h) => (
              <div key={h.year} className="card flex gap-4" style={{ padding: '18px 22px' }}>
                <span
                  className="inline-flex items-center justify-center serif"
                  style={{
                    flexShrink: 0,
                    minWidth: 78,
                    padding: '0 8px',
                    height: 42,
                    borderRadius: 12,
                    background: 'var(--accentSoft)',
                    color: 'var(--accentDeep)',
                    fontSize: 14.5,
                    fontWeight: 700,
                  }}
                >
                  {h.year}
                </span>
                <div>
                  <h4
                    className="serif"
                    style={{ fontSize: 17.5, fontWeight: 600, color: 'var(--text)', marginBottom: 5 }}
                  >
                    {h.title}
                  </h4>
                  <p style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--text2)' }}>{h.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The people */}
      <section id="people" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 820 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>
            <Users style={{ width: 13, height: 13 }} /> Who built it
          </p>
          <SectionHeading>The people to name</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 14, marginTop: 26 }}>
            {AI_PEOPLE.map((p) => (
              <div key={p.name} className="card" style={{ padding: '18px 22px' }}>
                <h4 className="serif" style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                  {p.name}
                </h4>
                <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--text2)' }}>{p.why}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Where AI is now */}
      <section id="now" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 820 }}>
          <SectionHeading>Where AI is right now</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 20, marginTop: 26 }}>
            <div className="card" style={{ padding: '24px 26px' }}>
              <h3 className="serif" style={{ fontSize: 18.5, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
                What it can do today
              </h3>
              <ul className="flex flex-col" style={{ gap: 11, listStyle: 'none', padding: 0, margin: 0 }}>
                {AI_CAN.map((c) => (
                  <li key={c} className="flex gap-2.5" style={listItem}>
                    <Check
                      style={{ width: 16, height: 16, flexShrink: 0, marginTop: 4, color: 'var(--accentDeep)' }}
                    />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card" style={{ padding: '24px 26px' }}>
              <h3 className="serif" style={{ fontSize: 18.5, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
                What it still cannot do
              </h3>
              <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 14 }}>Say this part clearly.</p>
              <ul className="flex flex-col" style={{ gap: 11, listStyle: 'none', padding: 0, margin: 0 }}>
                {AI_CANNOT.map((c) => (
                  <li key={c} className="flex gap-2.5" style={listItem}>
                    <X style={{ width: 16, height: 16, flexShrink: 0, marginTop: 4, color: 'var(--danger)' }} />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* What happens next */}
      <section id="future" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 820 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>
            <Rocket style={{ width: 13, height: 13 }} /> Looking forward
          </p>
          <SectionHeading>What might happen next</SectionHeading>
          <p style={{ fontSize: 16.5, lineHeight: 1.65, color: 'var(--text2)', margin: '14px 0 26px' }}>
            Frame this honestly: nobody knows, and the experts genuinely disagree. That is
            not a cop-out. It is the most scientifically accurate thing you can tell them,
            and it invites them to have an opinion of their own.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 20 }}>
            <div className="card" style={{ padding: '24px 26px' }}>
              <h3 className="serif" style={{ fontSize: 18.5, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
                Fairly likely, soon
              </h3>
              <ul className="flex flex-col" style={{ gap: 11, listStyle: 'none', padding: 0, margin: 0 }}>
                {AI_SOON.map((s) => (
                  <li key={s} style={listItem}>
                    • {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card" style={{ padding: '24px 26px' }}>
              <h3 className="serif" style={{ fontSize: 18.5, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
                Plausible, further out
              </h3>
              <ul className="flex flex-col" style={{ gap: 11, listStyle: 'none', padding: 0, margin: 0 }}>
                {AI_LATER.map((s) => (
                  <li key={s} style={listItem}>
                    • {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="card" style={{ padding: '24px 26px', marginTop: 20 }}>
            <h3 className="serif" style={{ fontSize: 18.5, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
              The big open argument
            </h3>
            <p style={{ fontSize: 16, lineHeight: 1.65, color: 'var(--text2)' }}>{AI_OPEN_ARGUMENT}</p>
          </div>

          <div
            className="card"
            style={{
              padding: '24px 28px',
              marginTop: 20,
              borderLeft: '3px solid var(--accentDeep)',
              background: 'var(--accentSoft)',
            }}
          >
            <h3 className="serif" style={{ fontSize: 18.5, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}>
              The part that stays human
            </h3>
            <p style={{ fontSize: 16, lineHeight: 1.65, color: 'var(--text2)' }}>{AI_STAYS_HUMAN}</p>
            <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 12 }}>
              Close on this. It is what the whole class is actually about.
            </p>
          </div>
        </div>
      </section>

      {/* Running order */}
      <section id="running-order" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 820 }}>
          <SectionHeading>The 15-minute STEM block</SectionHeading>
          <p style={{ fontSize: 16.5, lineHeight: 1.65, color: 'var(--text2)', margin: '14px 0 26px' }}>
            How the STEM lesson runs inside the sixty-minute class.
          </p>
          <div className="flex flex-col" style={{ gap: 14 }}>
            {MODULE_1_RUNNING_ORDER.map((s) => (
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

          <div className="card" style={{ padding: '22px 26px', marginTop: 20 }}>
            <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--text2)' }}>{MODULE_1_GAME}</p>
          </div>
        </div>
      </section>

      {/* Quiz */}
      <section id="quiz" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '52px 0 80px', maxWidth: 820 }}>
          <SectionHeading>Knowledge check</SectionHeading>
          <p style={{ fontSize: 16.5, lineHeight: 1.65, color: 'var(--text2)', margin: '14px 0 30px', maxWidth: 700 }}>
            Five quick questions, then five to answer in your own words. Anyone can submit and
            see their results, sign in if you want your answers saved to come back to.
          </p>
          <CourseQuiz
            quizId="kids-stem-what-is-ai"
            quizTitle="Kids STEM · Class 1, What Is AI?"
            mcq={MODULE_1_MCQ}
            openQuestions={MODULE_1_OPEN_QUESTIONS}
            submitLabel="Submit answers"
          />
        </div>
      </section>
    </CourseLayout>
  )
}
