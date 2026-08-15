import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  Sparkles,
  Clock,
  ArrowLeft,
  Check,
  X,
  Rocket,
  Users,
  Pencil,
  NotebookPen,
  ImageIcon,
  ArrowRight,
  GraduationCap,
} from 'lucide-react'
import { CourseLayout, Pill, SectionHeading } from '@/components/course'
import CourseQuiz from '@/components/CourseQuiz'
import { KIDS_COURSE_BASE } from '@/lib/kids-stem/course'
import {
  MODULE_3_TITLE,
  MODULE_3_INTRO,
  MODULE_3_HOOK,
  MODULE_3_ORDER_NOTE,
  MODULE_3_ORDER_STEPS,
  MODULE_3_DOORS,
  MODULE_3_DRAWING_PROMPT,
  MODULE_3_DRAWING_BY_LEVEL,
  MODULE_3_DRAWING_SHARING_QUESTION,
  MODULE_3_JOURNALING_PROMPT,
  MODULE_3_JOURNALING_BY_LEVEL,
  MODULE_3_JOURNALING_SHARING_QUESTION,
  MODULE_3_JOURNALING_NOTE,
  INTERNET_BY_AGE,
  INTERNET_PIECES,
  INTERNET_ENCRYPTION_NOTE,
  INTERNET_MISCONCEPTIONS,
  INTERNET_HONEST_PART,
  INTERNET_LADDER,
  INTERNET_HISTORY,
  INTERNET_PEOPLE,
  INTERNET_CAN,
  INTERNET_CANNOT,
  INTERNET_SOON,
  INTERNET_LATER,
  INTERNET_OPEN_ARGUMENT,
  INTERNET_STAYS_HUMAN,
  MODULE_3_TEACHBACK_PROMPT,
  MODULE_3_TEACHBACK_BY_LEVEL,
  MODULE_3_TEACHBACK_NOTE,
  MODULE_3_RUNNING_ORDER,
  MODULE_3_GAME,
  MODULE_3_MCQ,
  MODULE_3_OPEN_QUESTIONS,
} from '@/lib/kids-stem/module-3'

export const metadata: Metadata = {
  title: 'Class 3 · What Is the Internet? Kids Wholistic Creativity & STEM, Argo',
  description:
    'How the internet works, explained for ages 3, 7 and 12, plus a drawing prompt and a journaling prompt the children do before the concept is named, the hundred-year story behind it, and an honest look at what it cannot do.',
  openGraph: {
    title: 'What Is the Internet? Kids Wholistic Creativity & STEM, Argo',
    description:
      'Millions of computers passing notes, explained for every age, with the history, the people, and what comes next.',
  },
}

const listItem: React.CSSProperties = {
  fontSize: 15.5,
  lineHeight: 1.6,
  color: 'var(--text2)',
}

const byLevelRow: React.CSSProperties = {
  fontSize: 15.5,
  lineHeight: 1.55,
}

export default function WhatIsTheInternetPage() {
  return (
    <CourseLayout>
      {/* Hero */}
      <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
        <div className="wrap" style={{ padding: '72px 0 56px', textAlign: 'center' }}>
          <span className="eyebrow" style={{ marginBottom: 18, justifyContent: 'center' }}>
            <Sparkles style={{ width: 14, height: 14 }} /> Argo · Kids Course · Class 3
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
            What Is the Internet?
          </h1>
          <p
            style={{ fontSize: 19, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 660, margin: '0 auto' }}
          >
            Millions of computers passing notes, explained for every age, with the story of how we got here
            and an honest look at what it cannot do.
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
            style={{
              fontSize: 14.5,
              fontWeight: 600,
              color: 'var(--accentDeep)',
              textDecoration: 'none',
              marginBottom: 22,
            }}
          >
            <ArrowLeft style={{ width: 15, height: 15 }} /> All classes
          </Link>

          <div style={{ marginBottom: 14 }}>
            <Pill>Class 3 · The lesson</Pill>
          </div>
          <SectionHeading>{MODULE_3_TITLE}</SectionHeading>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--text2)', margin: '16px 0 26px' }}>
            {MODULE_3_INTRO}
          </p>

          <blockquote
            className="card"
            style={{
              padding: '24px 28px',
              borderLeft: '3px solid var(--accentDeep)',
              background: 'var(--accentSoft)',
            }}
          >
            <p
              className="serif"
              style={{ fontSize: 20, lineHeight: 1.5, color: 'var(--text)', fontStyle: 'italic' }}
            >
              “{MODULE_3_HOOK}”
            </p>
            <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 12 }}>
              Say this once the drawing and the writing are done, not before. Every age level below is a
              deeper version of it.
            </p>
          </blockquote>
        </div>
      </section>

      {/* How this class runs */}
      <section id="order" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 900 }}>
          <SectionHeading>How this class runs, and why the order matters</SectionHeading>
          <p
            style={{
              fontSize: 16.5,
              lineHeight: 1.65,
              color: 'var(--text2)',
              margin: '14px 0 26px',
              maxWidth: 720,
            }}
          >
            {MODULE_3_ORDER_NOTE}
          </p>

          <div className="card flex flex-wrap items-center" style={{ padding: '20px 24px', gap: 10 }}>
            {MODULE_3_ORDER_STEPS.map((s, i) => (
              <span key={s} className="inline-flex items-center" style={{ gap: 10 }}>
                <span
                  style={{
                    fontSize: 15,
                    fontWeight: 600,
                    color: i === 4 ? 'var(--accentDeep)' : 'var(--text2)',
                  }}
                >
                  {s}
                </span>
                {i < MODULE_3_ORDER_STEPS.length - 1 && (
                  <ArrowRight style={{ width: 14, height: 14, color: 'var(--text3)' }} />
                )}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 20, marginTop: 20 }}>
            {MODULE_3_DOORS.map((d) => (
              <div key={d.prompt} className="card" style={{ padding: '22px 26px' }}>
                <Pill>{d.prompt} prompt</Pill>
                <p
                  className="serif"
                  style={{ fontSize: 17, lineHeight: 1.5, color: 'var(--text)', margin: '14px 0 10px' }}
                >
                  {d.experience}
                </p>
                <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--text3)' }}>
                  Opens onto: {d.opensOnto}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The two prompts */}
      <section id="prompts" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 900 }}>
          <SectionHeading>The two prompts, before the concept is named</SectionHeading>
          <p
            style={{
              fontSize: 16.5,
              lineHeight: 1.65,
              color: 'var(--text2)',
              margin: '14px 0 30px',
              maxWidth: 700,
            }}
          >
            One for the hands, one for the head. Neither one mentions the internet. Read each prompt out
            whole, then give each child the version that fits them. Every level is doing the same thing, just
            at a different depth.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 20 }}>
            {/* Drawing */}
            <div className="card" style={{ padding: '24px 26px' }}>
              <p className="eyebrow" style={{ marginBottom: 12 }}>
                <Pencil style={{ width: 13, height: 13 }} /> Drawing prompt
              </p>
              <p
                className="serif"
                style={{
                  fontSize: 18,
                  lineHeight: 1.55,
                  color: 'var(--text)',
                  fontStyle: 'italic',
                  marginBottom: 18,
                }}
              >
                “{MODULE_3_DRAWING_PROMPT}”
              </p>
              <div className="flex flex-col" style={{ gap: 12 }}>
                {MODULE_3_DRAWING_BY_LEVEL.map((l) => (
                  <div key={l.level} style={byLevelRow}>
                    <span style={{ fontWeight: 700, color: 'var(--accentDeep)' }}>{l.level}, </span>
                    <span style={{ color: 'var(--text2)' }}>{l.what}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 16, lineHeight: 1.55 }}>
                {MODULE_3_DRAWING_SHARING_QUESTION}
              </p>
            </div>

            {/* Journaling */}
            <div className="card" style={{ padding: '24px 26px' }}>
              <p className="eyebrow" style={{ marginBottom: 12 }}>
                <NotebookPen style={{ width: 13, height: 13 }} /> Journaling prompt
              </p>
              <p
                className="serif"
                style={{
                  fontSize: 18,
                  lineHeight: 1.55,
                  color: 'var(--text)',
                  fontStyle: 'italic',
                  marginBottom: 18,
                }}
              >
                “{MODULE_3_JOURNALING_PROMPT}”
              </p>
              <div className="flex flex-col" style={{ gap: 12 }}>
                {MODULE_3_JOURNALING_BY_LEVEL.map((l) => (
                  <div key={l.level} style={byLevelRow}>
                    <span style={{ fontWeight: 700, color: 'var(--accentDeep)' }}>{l.level}, </span>
                    <span style={{ color: 'var(--text2)' }}>{l.what}</span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 16, lineHeight: 1.55 }}>
                {MODULE_3_JOURNALING_SHARING_QUESTION}
              </p>
              <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 10, lineHeight: 1.55 }}>
                {MODULE_3_JOURNALING_NOTE}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Explained by age */}
      <section id="by-age" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 900 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>
            <Clock style={{ width: 13, height: 13 }} /> The STEM lesson
          </p>
          <SectionHeading>What is the internet, explained by age</SectionHeading>
          <p
            style={{
              fontSize: 16.5,
              lineHeight: 1.65,
              color: 'var(--text2)',
              margin: '14px 0 30px',
              maxWidth: 700,
            }}
          >
            Now name it. The same idea, told at the right depth for each child. Explain the youngest version
            to everyone, then add a layer for the older kids.
          </p>

          <div className="flex flex-col" style={{ gap: 26 }}>
            {INTERNET_BY_AGE.map((a) => (
              <div key={a.age} className="card" style={{ padding: '24px 26px' }}>
                <div
                  className={a.image ? 'grid grid-cols-1 md:grid-cols-2' : ''}
                  style={a.image ? { gap: 24, alignItems: 'center' } : undefined}
                >
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

                {!a.image && a.imagePrompt && (
                  <details
                    style={{
                      marginTop: 18,
                      padding: '14px 16px',
                      borderRadius: 'var(--r-card)',
                      background: 'var(--surfaceAlt)',
                      border: '1px solid var(--hairline)',
                    }}
                  >
                    <summary
                      className="inline-flex items-center gap-2"
                      style={{ fontSize: 14, fontWeight: 600, color: 'var(--accentDeep)', cursor: 'pointer' }}
                    >
                      <ImageIcon style={{ width: 14, height: 14 }} /> Infographic prompt for {a.age}
                    </summary>
                    <p style={{ fontSize: 14.5, lineHeight: 1.6, color: 'var(--text2)', marginTop: 12 }}>
                      {a.imagePrompt}
                    </p>
                  </details>
                )}
              </div>
            ))}
          </div>

          {/* The five pieces */}
          <div className="card" style={{ padding: '24px 26px', marginTop: 26 }}>
            <h3
              className="serif"
              style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}
            >
              The five pieces
            </h3>
            <p style={{ fontSize: 14.5, color: 'var(--text3)', marginBottom: 18 }}>
              What the oldest kids should be able to name by the end.
            </p>
            <div className="flex flex-col" style={{ gap: 12 }}>
              {INTERNET_PIECES.map((p) => (
                <div key={p.piece} className="flex gap-3" style={{ fontSize: 15.5, lineHeight: 1.55 }}>
                  <span style={{ flexShrink: 0, width: 110, fontWeight: 700, color: 'var(--accentDeep)' }}>
                    {p.piece}
                  </span>
                  <span style={{ color: 'var(--text2)' }}>{p.what}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text2)', marginTop: 18 }}>
              {INTERNET_ENCRYPTION_NOTE}
            </p>
          </div>

          {/* Two things everybody gets wrong */}
          <div className="card" style={{ padding: '24px 26px', marginTop: 20 }}>
            <h3
              className="serif"
              style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}
            >
              Two things everybody gets wrong
            </h3>
            <p style={{ fontSize: 14.5, color: 'var(--text3)', marginBottom: 18 }}>Say both out loud.</p>
            <div className="flex flex-col" style={{ gap: 16 }}>
              {INTERNET_MISCONCEPTIONS.map((m) => (
                <div key={m.wrong}>
                  <p
                    className="inline-flex items-center gap-2"
                    style={{ fontSize: 15.5, fontWeight: 700, color: 'var(--text)', marginBottom: 6 }}
                  >
                    <X style={{ width: 15, height: 15, color: 'var(--danger)' }} /> “{m.wrong}”
                  </p>
                  <p style={{ fontSize: 15.5, lineHeight: 1.55, color: 'var(--text2)' }}>{m.right}</p>
                </div>
              ))}
            </div>
          </div>

          {/* The honest part */}
          <div
            className="card"
            style={{
              padding: '24px 28px',
              marginTop: 20,
              borderLeft: '3px solid var(--accentDeep)',
              background: 'var(--accentSoft)',
            }}
          >
            <h3
              className="serif"
              style={{ fontSize: 18.5, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}
            >
              The honest part
            </h3>
            <p style={{ fontSize: 16, lineHeight: 1.65, color: 'var(--text2)' }}>{INTERNET_HONEST_PART}</p>
            <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 12 }}>
              The most important thing you will say all class.
            </p>
          </div>

          {/* The ladder */}
          <div className="card" style={{ padding: '24px 26px', marginTop: 20 }}>
            <h3
              className="serif"
              style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}
            >
              The one-glance ladder
            </h3>
            <div className="flex flex-col" style={{ gap: 12 }}>
              {INTERNET_LADDER.map((l) => (
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

      {/* The story */}
      <section id="history" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 820 }}>
          <SectionHeading>The story of the internet</SectionHeading>
          <p style={{ fontSize: 16.5, lineHeight: 1.65, color: 'var(--text2)', margin: '14px 0 30px' }}>
            Tell it as a story about a problem: how do you get a message from here to there when the road
            might be broken, and nobody is in charge of the road? The answer took about a hundred years, and
            almost every step was somebody refusing to accept “you cannot.”
          </p>

          <div className="flex flex-col" style={{ gap: 14 }}>
            {INTERNET_HISTORY.map((h) => (
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
            {INTERNET_PEOPLE.map((p) => (
              <div key={p.name} className="card" style={{ padding: '18px 22px' }}>
                <h4
                  className="serif"
                  style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}
                >
                  {p.name}
                </h4>
                <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--text2)' }}>{p.why}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Where it is now */}
      <section id="now" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 820 }}>
          <SectionHeading>Where the internet is right now</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 20, marginTop: 26 }}>
            <div className="card" style={{ padding: '24px 26px' }}>
              <h3
                className="serif"
                style={{ fontSize: 18.5, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}
              >
                What it is genuinely good at
              </h3>
              <ul className="flex flex-col" style={{ gap: 11, listStyle: 'none', padding: 0, margin: 0 }}>
                {INTERNET_CAN.map((c) => (
                  <li key={c} className="flex gap-2.5" style={listItem}>
                    <Check
                      style={{
                        width: 16,
                        height: 16,
                        flexShrink: 0,
                        marginTop: 4,
                        color: 'var(--accentDeep)',
                      }}
                    />
                    <span>{c}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="card" style={{ padding: '24px 26px' }}>
              <h3
                className="serif"
                style={{ fontSize: 18.5, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}
              >
                What it cannot do
              </h3>
              <p style={{ fontSize: 14, color: 'var(--text3)', marginBottom: 14 }}>Say this part clearly.</p>
              <ul className="flex flex-col" style={{ gap: 11, listStyle: 'none', padding: 0, margin: 0 }}>
                {INTERNET_CANNOT.map((c) => (
                  <li key={c} className="flex gap-2.5" style={listItem}>
                    <X
                      style={{ width: 16, height: 16, flexShrink: 0, marginTop: 4, color: 'var(--danger)' }}
                    />
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
            Frame it the same way as the last three classes: nobody knows, and the experts genuinely
            disagree. That is not a cop-out. It is the most accurate thing you can tell them, and it invites
            them to have an opinion of their own.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 20 }}>
            <div className="card" style={{ padding: '24px 26px' }}>
              <h3
                className="serif"
                style={{ fontSize: 18.5, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}
              >
                Fairly likely, soon
              </h3>
              <ul className="flex flex-col" style={{ gap: 11, listStyle: 'none', padding: 0, margin: 0 }}>
                {INTERNET_SOON.map((s) => (
                  <li key={s} style={listItem}>
                    • {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="card" style={{ padding: '24px 26px' }}>
              <h3
                className="serif"
                style={{ fontSize: 18.5, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}
              >
                Plausible, further out
              </h3>
              <ul className="flex flex-col" style={{ gap: 11, listStyle: 'none', padding: 0, margin: 0 }}>
                {INTERNET_LATER.map((s) => (
                  <li key={s} style={listItem}>
                    • {s}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="card" style={{ padding: '24px 26px', marginTop: 20 }}>
            <h3
              className="serif"
              style={{ fontSize: 18.5, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}
            >
              The big open argument
            </h3>
            <p style={{ fontSize: 16, lineHeight: 1.65, color: 'var(--text2)' }}>
              {INTERNET_OPEN_ARGUMENT}
            </p>
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
            <h3
              className="serif"
              style={{ fontSize: 18.5, fontWeight: 600, color: 'var(--text)', marginBottom: 12 }}
            >
              The part that stays human
            </h3>
            <p style={{ fontSize: 16, lineHeight: 1.65, color: 'var(--text2)' }}>{INTERNET_STAYS_HUMAN}</p>
            <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 12 }}>
              Close on this. It is what the whole class is actually about.
            </p>
          </div>
        </div>
      </section>

      {/* Teach-back */}
      <section id="teach-back" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 820 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>
            <GraduationCap style={{ width: 13, height: 13 }} /> After the concept
          </p>
          <SectionHeading>The teach-back page</SectionHeading>
          <div className="card" style={{ padding: '24px 26px', marginTop: 26 }}>
            <p
              className="serif"
              style={{
                fontSize: 18,
                lineHeight: 1.55,
                color: 'var(--text)',
                fontStyle: 'italic',
                marginBottom: 18,
              }}
            >
              “{MODULE_3_TEACHBACK_PROMPT}”
            </p>
            <div className="flex flex-col" style={{ gap: 12 }}>
              {MODULE_3_TEACHBACK_BY_LEVEL.map((l) => (
                <div key={l.level} style={byLevelRow}>
                  <span style={{ fontWeight: 700, color: 'var(--accentDeep)' }}>{l.level}, </span>
                  <span style={{ color: 'var(--text2)' }}>{l.what}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 16, lineHeight: 1.55 }}>
              {MODULE_3_TEACHBACK_NOTE}
            </p>
          </div>
        </div>
      </section>

      {/* Running order */}
      <section id="running-order" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 820 }}>
          <SectionHeading>The class, running order</SectionHeading>
          <p style={{ fontSize: 16.5, lineHeight: 1.65, color: 'var(--text2)', margin: '14px 0 26px' }}>
            Drawing and writing come first. The concept is not named until both shares are done.
          </p>
          <div className="flex flex-col" style={{ gap: 14 }}>
            {MODULE_3_RUNNING_ORDER.map((s) => (
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

          <div className="card" style={{ padding: '22px 26px', marginTop: 20 }}>
            <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--text2)' }}>{MODULE_3_GAME}</p>
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
            Five quick questions, then five to answer in your own words. Anyone can submit and see their
            results, sign in if you want your answers saved to come back to.
          </p>
          <CourseQuiz
            quizId="kids-stem-what-is-the-internet"
            quizTitle="Kids STEM · Class 3, What Is the Internet?"
            mcq={MODULE_3_MCQ}
            openQuestions={MODULE_3_OPEN_QUESTIONS}
            submitLabel="Submit answers"
          />
        </div>
      </section>
    </CourseLayout>
  )
}
