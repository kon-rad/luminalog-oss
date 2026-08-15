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
  Lightbulb,
  Gamepad2,
} from 'lucide-react'
import { CourseLayout, Pill, SectionHeading } from '@/components/course'
import CourseQuiz from '@/components/CourseQuiz'
import { KIDS_COURSE_BASE } from '@/lib/kids-stem/course'
import {
  MODULE_4_TITLE,
  MODULE_4_INTRO,
  MODULE_4_HOOK,
  MODULE_4_ORDER_NOTE,
  MODULE_4_ORDER_STEPS,
  MODULE_4_DOORS,
  MODULE_4_DRAWING_TIP,
  MODULE_4_DRAWING_PROMPTS,
  MODULE_4_DRAWING_SHARING_QUESTION,
  MODULE_4_JOURNALING_PROMPTS,
  MODULE_4_JOURNALING_SHARING_QUESTION,
  MODULE_4_JOURNALING_NOTE,
  ENCRYPTION_BY_AGE,
  ENCRYPTION_PIECES,
  ENCRYPTION_HASHING_NOTE,
  ENCRYPTION_MISCONCEPTIONS,
  ENCRYPTION_HONEST_PART,
  ENCRYPTION_LADDER,
  ENCRYPTION_HISTORY,
  ENCRYPTION_PEOPLE,
  ENCRYPTION_CAN,
  ENCRYPTION_CANNOT,
  ENCRYPTION_SOON,
  ENCRYPTION_LATER,
  ENCRYPTION_OPEN_ARGUMENT,
  ENCRYPTION_STAYS_HUMAN,
  MODULE_4_TEACHBACK_PROMPT,
  MODULE_4_TEACHBACK_BY_LEVEL,
  MODULE_4_TEACHBACK_NOTE,
  MODULE_4_GAME,
  MODULE_4_MAKE_IT_REAL,
  MODULE_4_MCQ,
  MODULE_4_OPEN_QUESTIONS,
} from '@/lib/kids-stem/module-4'

export const metadata: Metadata = {
  title: 'Class 4 · What Is Encryption? Kids Wholistic Creativity & STEM, Argo',
  description:
    'How encryption works, explained for ages 3, 7 and 12. Draw first, learn second: kids meet keys, ciphers and public key cryptography through their own secrets.',
  openGraph: {
    title: 'What Is Encryption? Kids Wholistic Creativity & STEM, Argo',
    description:
      'How a message can be carried by thousands of strangers, read by any of them, and still be a secret. Explained for every age, with the four-thousand-year story behind it.',
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

export default function WhatIsEncryptionPage() {
  return (
    <CourseLayout>
      {/* Hero */}
      <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
        <div className="wrap" style={{ padding: '72px 0 56px', textAlign: 'center' }}>
          <span className="eyebrow" style={{ marginBottom: 18, justifyContent: 'center' }}>
            <Sparkles style={{ width: 14, height: 14 }} /> Argo · Kids Course · Class 4
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
            What Is Encryption?
          </h1>
          <p
            style={{ fontSize: 19, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 660, margin: '0 auto' }}
          >
            How a message can be carried by thousands of strangers, read by any of them, and still be a
            secret. Explained for every age, with the story of how we got here and an honest look at what it
            cannot do.
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
            <Pill>Class 4 · The lesson</Pill>
          </div>
          <SectionHeading>{MODULE_4_TITLE}</SectionHeading>
          <p style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--text2)', margin: '16px 0 26px' }}>
            {MODULE_4_INTRO}
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
              “{MODULE_4_HOOK}”
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
            {MODULE_4_ORDER_NOTE}
          </p>

          <div className="card flex flex-wrap items-center" style={{ padding: '20px 24px', gap: 10 }}>
            {MODULE_4_ORDER_STEPS.map((s, i) => (
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
                {i < MODULE_4_ORDER_STEPS.length - 1 && (
                  <ArrowRight style={{ width: 14, height: 14, color: 'var(--text3)' }} />
                )}
              </span>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 20, marginTop: 20 }}>
            {MODULE_4_DOORS.map((d) => (
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

      {/* The drawing tip */}
      <section id="drawing-tip" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 900 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>
            <Lightbulb style={{ width: 13, height: 13 }} /> Before you draw
          </p>
          <SectionHeading>One drawing tip</SectionHeading>
          <div className="card" style={{ padding: '24px 26px', marginTop: 26 }}>
            <p
              className="serif"
              style={{
                fontSize: 20,
                lineHeight: 1.5,
                color: 'var(--text)',
                fontStyle: 'italic',
                marginBottom: 12,
              }}
            >
              “{MODULE_4_DRAWING_TIP.rule}”
            </p>
            <p style={{ fontSize: 16, lineHeight: 1.65, color: 'var(--text2)', marginBottom: 18 }}>
              {MODULE_4_DRAWING_TIP.why}
            </p>
            <div className="flex flex-col" style={{ gap: 12 }}>
              {MODULE_4_DRAWING_TIP.byLevel.map((l) => (
                <div key={l.level} style={byLevelRow}>
                  <span style={{ fontWeight: 700, color: 'var(--accentDeep)' }}>{l.level}, </span>
                  <span style={{ color: 'var(--text2)' }}>{l.what}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 16, lineHeight: 1.55 }}>
              A tip about drawing, not about the concept. It is the only thing said before the pencils move.
            </p>
          </div>
        </div>
      </section>

      {/* The prompts, one per age */}
      <section id="prompts" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 900 }}>
          <SectionHeading>The prompts, before the concept is named</SectionHeading>
          <p
            style={{
              fontSize: 16.5,
              lineHeight: 1.65,
              color: 'var(--text2)',
              margin: '14px 0 30px',
              maxWidth: 700,
            }}
          >
            One set for the hands, one for the head. Not one of them mentions encryption. From this class on,
            each age gets its own prompt rather than one prompt stretched across a ten-year span. Give each
            child the one written for them.
          </p>

          <div className="card" style={{ padding: '24px 26px' }}>
            <p className="eyebrow" style={{ marginBottom: 16 }}>
              <Pencil style={{ width: 13, height: 13 }} /> Drawing prompts
            </p>
            <div className="flex flex-col" style={{ gap: 20 }}>
              {MODULE_4_DRAWING_PROMPTS.map((p) => (
                <div key={p.age}>
                  <Pill>{p.age}</Pill>
                  <p
                    className="serif"
                    style={{
                      fontSize: 17.5,
                      lineHeight: 1.55,
                      color: 'var(--text)',
                      fontStyle: 'italic',
                      marginTop: 12,
                    }}
                  >
                    “{p.prompt}”
                  </p>
                  {p.note && (
                    <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 8, lineHeight: 1.55 }}>
                      {p.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 20, lineHeight: 1.55 }}>
              Sharing question: {MODULE_4_DRAWING_SHARING_QUESTION}
            </p>
          </div>

          <div className="card" style={{ padding: '24px 26px', marginTop: 20 }}>
            <p className="eyebrow" style={{ marginBottom: 16 }}>
              <NotebookPen style={{ width: 13, height: 13 }} /> Journaling prompts
            </p>
            <div className="flex flex-col" style={{ gap: 20 }}>
              {MODULE_4_JOURNALING_PROMPTS.map((p) => (
                <div key={p.age}>
                  <Pill>{p.age}</Pill>
                  <p
                    className="serif"
                    style={{
                      fontSize: 17.5,
                      lineHeight: 1.55,
                      color: 'var(--text)',
                      fontStyle: 'italic',
                      marginTop: 12,
                    }}
                  >
                    “{p.prompt}”
                  </p>
                  {p.note && (
                    <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 8, lineHeight: 1.55 }}>
                      {p.note}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 20, lineHeight: 1.55 }}>
              Sharing question: {MODULE_4_JOURNALING_SHARING_QUESTION}
            </p>
            <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 10, lineHeight: 1.55 }}>
              {MODULE_4_JOURNALING_NOTE}
            </p>
          </div>
        </div>
      </section>

      {/* Explained by age */}
      <section id="by-age" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 900 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>
            <Clock style={{ width: 13, height: 13 }} /> The STEM lesson
          </p>
          <SectionHeading>What is encryption, explained by age</SectionHeading>
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
            {ENCRYPTION_BY_AGE.map((a) => (
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
              {ENCRYPTION_PIECES.map((p) => (
                <div key={p.piece} className="flex gap-3" style={{ fontSize: 15.5, lineHeight: 1.55 }}>
                  <span style={{ flexShrink: 0, width: 168, fontWeight: 700, color: 'var(--accentDeep)' }}>
                    {p.piece}
                  </span>
                  <span style={{ color: 'var(--text2)' }}>{p.what}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text2)', marginTop: 18 }}>
              {ENCRYPTION_HASHING_NOTE}
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
              {ENCRYPTION_MISCONCEPTIONS.map((m) => (
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
            <p style={{ fontSize: 16, lineHeight: 1.65, color: 'var(--text2)' }}>{ENCRYPTION_HONEST_PART}</p>
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
              {ENCRYPTION_LADDER.map((l) => (
                <div key={l.age} className="flex gap-3" style={{ fontSize: 15.5, lineHeight: 1.55 }}>
                  <span style={{ flexShrink: 0, width: 66, fontWeight: 700, color: 'var(--accentDeep)' }}>
                    {l.age}
                  </span>
                  <span style={{ color: 'var(--text2)' }}>{l.idea}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Make it real */}
          <div className="card" style={{ padding: '22px 26px', marginTop: 20 }}>
            <h3
              className="serif"
              style={{ fontSize: 18.5, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}
            >
              Make it real
            </h3>
            <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--text2)' }}>{MODULE_4_MAKE_IT_REAL}</p>
          </div>
        </div>
      </section>

      {/* The story */}
      <section id="history" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 820 }}>
          <SectionHeading>The story of encryption</SectionHeading>
          <p style={{ fontSize: 16.5, lineHeight: 1.65, color: 'var(--text2)', margin: '14px 0 30px' }}>
            Tell it as a story about a problem: how do you say something to one person when the message has
            to pass through everybody else? Four thousand years, and every step is somebody being told it is
            impossible.
          </p>

          <div className="flex flex-col" style={{ gap: 14 }}>
            {ENCRYPTION_HISTORY.map((h) => (
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
            {ENCRYPTION_PEOPLE.map((p) => (
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
          <SectionHeading>Where encryption is right now</SectionHeading>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 20, marginTop: 26 }}>
            <div className="card" style={{ padding: '24px 26px' }}>
              <h3
                className="serif"
                style={{ fontSize: 18.5, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}
              >
                What it is genuinely good at
              </h3>
              <ul className="flex flex-col" style={{ gap: 11, listStyle: 'none', padding: 0, margin: 0 }}>
                {ENCRYPTION_CAN.map((c) => (
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
                {ENCRYPTION_CANNOT.map((c) => (
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
            Frame it the same way as the last four classes: nobody knows, and the experts genuinely disagree.
            That is not a cop-out. It is the most accurate thing you can tell them, and it invites them to
            have an opinion of their own.
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
                {ENCRYPTION_SOON.map((s) => (
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
                {ENCRYPTION_LATER.map((s) => (
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
              {ENCRYPTION_OPEN_ARGUMENT}
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
            <p style={{ fontSize: 16, lineHeight: 1.65, color: 'var(--text2)' }}>{ENCRYPTION_STAYS_HUMAN}</p>
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
              “{MODULE_4_TEACHBACK_PROMPT}”
            </p>
            <div className="flex flex-col" style={{ gap: 12 }}>
              {MODULE_4_TEACHBACK_BY_LEVEL.map((l) => (
                <div key={l.level} style={byLevelRow}>
                  <span style={{ fontWeight: 700, color: 'var(--accentDeep)' }}>{l.level}, </span>
                  <span style={{ color: 'var(--text2)' }}>{l.what}</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 14, color: 'var(--text3)', marginTop: 16, lineHeight: 1.55 }}>
              {MODULE_4_TEACHBACK_NOTE}
            </p>
          </div>
        </div>
      </section>

      {/* The unplugged game */}
      <section id="game" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 820 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>
            <Gamepad2 style={{ width: 13, height: 13 }} /> Away from the screen
          </p>
          <SectionHeading>The unplugged game</SectionHeading>
          <div className="card" style={{ padding: '22px 26px', marginTop: 26 }}>
            <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--text2)' }}>{MODULE_4_GAME}</p>
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
            quizId="kids-stem-what-is-encryption"
            quizTitle="Kids STEM · Class 4, What Is Encryption?"
            mcq={MODULE_4_MCQ}
            openQuestions={MODULE_4_OPEN_QUESTIONS}
            submitLabel="Submit answers"
          />
        </div>
      </section>
    </CourseLayout>
  )
}
