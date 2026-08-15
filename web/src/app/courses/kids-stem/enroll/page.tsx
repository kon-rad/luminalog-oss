import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Sparkles,
  Bot,
  ShieldCheck,
  BookOpen,
  Check,
  Trophy,
  ArrowRight,
  Presentation,
  PlayCircle,
} from 'lucide-react'
import { CourseLayout, SectionHeading } from '@/components/course'
import {
  KIDS_COURSE_BASE,
  CLASS_AGENDA,
  GOAL_STATEMENT,
  POINTS_RULE,
  REWARDS,
  REWARDS_KEEPSAKE,
} from '@/lib/kids-stem/course'
import {
  CLASS_FACTS,
  INCLUDED,
  PURPOSE_HEADING,
  PURPOSE_BODY,
  PRACTICE_HEADING,
  PRACTICE_BODY,
  PRACTICE_CLOSE,
  ROBOT_LEAD,
  ROBOT_BODY,
  TIERS,
  PLAN_INTRO,
  TERMS,
  PAYMENT_RAILS,
  PORTAL_NOTE,
  REPORT_NOTE,
  BOOK,
  PRIVACY_INTRO,
  PRIVACY_POINTS,
  BIO,
  BIO_KICKER,
  CLOSING,
  WHATSAPP_NUMBER,
  WHATSAPP_URL,
} from '@/lib/kids-stem/enroll'
import { DECK_URL, DECK_VIDEO_URL } from '@/lib/kids-stem/deck'

export const metadata: Metadata = {
  title: 'Join the Kids Class, Core Skills · Argo',
  description:
    'Kids Wholistic Creativity & STEM in Forest City. Mondays, Wednesdays and Fridays, ages 2–12. Plans, the robot assistant, the printed magazine, and how to enrol.',
  openGraph: {
    title: 'Join the Kids Class, Core Skills · Argo',
    description:
      'Kids Wholistic Creativity & STEM in Forest City. Three afternoons a week, ages 2–12, with a robot assistant in every session.',
  },
}

/* Shared body-copy style so paragraph rhythm stays consistent down the page. */
const body: React.CSSProperties = { fontSize: 16.5, lineHeight: 1.65, color: 'var(--text2)' }
const bodySm: React.CSSProperties = { fontSize: 15.5, lineHeight: 1.6, color: 'var(--text2)' }

function CheckRow({
  title,
  detail,
  children,
}: {
  title: string
  detail: string
  children?: React.ReactNode
}) {
  return (
    <li className="flex gap-3" style={{ alignItems: 'flex-start' }}>
      <span
        className="inline-flex items-center justify-center"
        style={{
          flexShrink: 0,
          width: 24,
          height: 24,
          borderRadius: 8,
          marginTop: 2,
          background: 'var(--accentSoft)',
          color: 'var(--accentDeep)',
        }}
      >
        <Check style={{ width: 14, height: 14 }} />
      </span>
      <span style={bodySm}>
        <span style={{ fontWeight: 600, color: 'var(--text)' }}>{title}</span>
        {': '}
        {detail}
        {children}
      </span>
    </li>
  )
}

export default function KidsStemEnrollPage() {
  return (
    <CourseLayout>
      {/* ── The presentation ─────────────────────────────────────────────── */}
      <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
        <div className="wrap" style={{ padding: '28px 0', display: 'flex', justifyContent: 'center' }}>
          <div className="flex flex-wrap items-center justify-center" style={{ gap: 12 }}>
            <Link href={DECK_URL} className="btn-ghost">
              <Presentation style={{ width: 16, height: 16 }} />
              Slide deck
            </Link>
            <Link href={DECK_VIDEO_URL} className="btn-ghost">
              <PlayCircle style={{ width: 16, height: 16 }} />
              Video
            </Link>
          </div>
        </div>
      </section>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
        <div className="wrap" style={{ padding: '72px 0 56px', textAlign: 'center' }}>
          <span className="eyebrow" style={{ marginBottom: 18, justifyContent: 'center' }}>
            <Sparkles style={{ width: 14, height: 14 }} /> Core Skills · Forest City · Ages 2–12
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
            Kids Wholistic Creativity &amp; STEM
          </h1>
          <p
            style={{ fontSize: 19, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 680, margin: '0 auto' }}
          >
            Three times a week, sixty minutes, a small group practises drawing, journaling, and one STEM
            concept taught back in their own words, using nothing but pen and paper. These are the skills
            that let them think, remember and say what matters to them, and we celebrate what each child
            creates rather than comparing them to anyone else.
          </p>

          <div
            className="grid grid-cols-1 md:grid-cols-2"
            style={{ gap: '10px 32px', maxWidth: 700, margin: '32px auto 0', textAlign: 'left' }}
          >
            {CLASS_FACTS.map((f) => (
              <div key={f.label} className="flex gap-3" style={{ fontSize: 15.5, lineHeight: 1.5 }}>
                <span
                  style={{
                    flexShrink: 0,
                    width: 58,
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--text3)',
                    paddingTop: 3,
                  }}
                >
                  {f.label}
                </span>
                <span style={{ color: 'var(--text)' }}>{f.value}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── The sixty minutes ────────────────────────────────────────────── */}
      <section>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 820 }}>
          <SectionHeading>The sixty minutes</SectionHeading>
          <p style={{ ...body, margin: '14px 0 28px' }}>
            The same shape every session, so children know exactly what to expect and can settle quickly.
          </p>
          <div className="flex flex-col" style={{ gap: 14 }}>
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

      {/* ── What this is for ────────────────────────────────────────────── */}
      <section>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 820 }}>
          <SectionHeading>{PURPOSE_HEADING}</SectionHeading>
          <div className="flex flex-col" style={{ gap: 16, marginTop: 20 }}>
            {PURPOSE_BODY.map((para) => (
              <p key={para.slice(0, 24)} style={body}>
                {para}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ── How we practise it ──────────────────────────────────────────── */}
      <section>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 820 }}>
          <SectionHeading>{PRACTICE_HEADING}</SectionHeading>
          <div className="flex flex-col" style={{ gap: 16, marginTop: 20 }}>
            {PRACTICE_BODY.map((para) => (
              <p key={para.slice(0, 24)} style={body}>
                {para}
              </p>
            ))}
            <p
              className="serif"
              style={{
                fontSize: 19,
                lineHeight: 1.6,
                color: 'var(--text)',
                paddingTop: 16,
                borderTop: '1px solid var(--hairline)',
              }}
            >
              {PRACTICE_CLOSE}
            </p>
          </div>

          <div className="card flex flex-col" style={{ padding: '26px 28px', gap: 18 }}>
            <p className="eyebrow">
              <Trophy style={{ width: 14, height: 14 }} /> Points
            </p>
            <p style={bodySm}>{POINTS_RULE}</p>
            <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 16 }}>
              {REWARDS.map((r) => (
                <div
                  key={r.title}
                  className="flex flex-col"
                  style={{
                    gap: 6,
                    padding: '16px 18px',
                    borderRadius: 'var(--r-btn)',
                    background: 'var(--accentSoft)',
                  }}
                >
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      color: 'var(--accentDeep)',
                    }}
                  >
                    {r.cost} POINTS
                  </span>
                  <h3 className="serif" style={{ fontSize: 17, fontWeight: 600, color: 'var(--text)' }}>
                    {r.title}
                  </h3>
                  <p style={{ fontSize: 14, lineHeight: 1.5, color: 'var(--text2)' }}>{r.detail}</p>
                </div>
              ))}
            </div>
            <p style={bodySm}>{REWARDS_KEEPSAKE}</p>
          </div>
        </div>
      </section>

      {/* ── What's included ──────────────────────────────────────────────── */}
      <section>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 820 }}>
          <SectionHeading>What’s included</SectionHeading>
          <ul className="flex flex-col" style={{ gap: 14, margin: '24px 0 0' }}>
            {INCLUDED.map((item) => (
              <CheckRow key={item.title} title={item.title} detail={item.detail}>
                {item.href && (
                  <>
                    {' '}
                    <Link
                      href={item.href}
                      style={{
                        color: 'var(--accentDeep)',
                        fontWeight: 600,
                        textDecoration: 'underline',
                        textUnderlineOffset: 2,
                      }}
                    >
                      {item.linkLabel}
                    </Link>
                  </>
                )}
              </CheckRow>
            ))}
          </ul>

        </div>
      </section>

      {/* ── Friendly M Helper ────────────────────────────────────────────── */}
      <section>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 820 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>
            <Bot style={{ width: 14, height: 14 }} /> In the room with us
          </p>
          <SectionHeading>Friendly M Helper</SectionHeading>
          <p
            className="serif"
            style={{ fontSize: 20, lineHeight: 1.55, color: 'var(--text)', margin: '16px 0 26px' }}
          >
            {ROBOT_LEAD}
          </p>
          <div className="card flex flex-col" style={{ padding: '26px 28px', gap: 16 }}>
            {ROBOT_BODY.map((p) => (
              <p key={p.slice(0, 24)} style={body}>
                {p}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Plans ────────────────────────────────────────────────────────── */}
      <section id="plans" style={{ scrollMarginTop: 96 }}>
        <div className="wrap" style={{ padding: '52px 0 8px' }}>
          <SectionHeading>Choosing a plan</SectionHeading>
          <p style={{ ...body, margin: '14px 0 28px', maxWidth: 700 }}>{PLAN_INTRO}</p>

          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 20, maxWidth: 620 }}>
            {TIERS.map((t) => (
              <div key={t.name} className="card flex flex-col" style={{ padding: '22px 24px', gap: 8 }}>
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 700,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: 'var(--text3)',
                  }}
                >
                  {t.name}
                </span>
                <div
                  className="serif"
                  style={{ fontSize: 34, fontWeight: 600, lineHeight: 1.1, color: 'var(--text)' }}
                >
                  <span
                    style={{ fontSize: 16, color: 'var(--text3)', marginRight: 3, verticalAlign: '0.4em' }}
                  >
                    RM
                  </span>
                  {t.price}
                </div>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--accentDeep)' }}>{t.rate}</span>
                <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--text2)' }}>{t.note}</p>
              </div>
            ))}
          </div>

          {/* Terms */}
          <div
            className="card flex flex-col"
            style={{ padding: '24px 26px', marginTop: 20, gap: 10, maxWidth: 820 }}
          >
            <h3 className="serif" style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)' }}>
              How it works, plainly
            </h3>
            {TERMS.map((t) => (
              <p key={t.slice(0, 24)} style={bodySm}>
                {t}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* ── Paying ───────────────────────────────────────────────────────── */}
      <section>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 820 }}>
          <SectionHeading>Paying</SectionHeading>
          <p style={{ ...body, margin: '14px 0 22px' }}>
            Whichever is easiest for you. I’ll send a link or details for any of these.
          </p>
          <div className="flex flex-wrap" style={{ gap: 10 }}>
            {PAYMENT_RAILS.map((r) => (
              <span
                key={r}
                style={{
                  fontSize: 14.5,
                  fontWeight: 600,
                  padding: '9px 18px',
                  borderRadius: 999,
                  color: 'var(--text)',
                  background: 'var(--surface)',
                  border: '1px solid var(--hairline2)',
                }}
              >
                {r}
              </span>
            ))}
          </div>

          <div className="card flex flex-col" style={{ padding: '24px 26px', marginTop: 24, gap: 12 }}>
            <h3 className="serif" style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)' }}>
              Everything runs through the portal
            </h3>
            <p style={bodySm}>{PORTAL_NOTE}</p>
            <p style={bodySm}>{REPORT_NOTE}</p>
          </div>
        </div>
      </section>

      {/* ── The book ─────────────────────────────────────────────────────── */}
      <section>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 820 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>
            <BookOpen style={{ width: 14, height: 14 }} /> Every twelve classes
          </p>
          <SectionHeading>The book</SectionHeading>
          <p
            className="serif"
            style={{ fontSize: 20, lineHeight: 1.55, color: 'var(--text)', margin: '16px 0 8px' }}
          >
            {BOOK.lead}
          </p>
          <p style={{ ...bodySm, marginBottom: 26 }}>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{BOOK.title}</span>, {BOOK.body[0]}
          </p>

          <div className="card flex flex-col" style={{ padding: '26px 28px', gap: 20 }}>
            <p style={body}>{BOOK.body[1]}</p>

            <div
              className="grid grid-cols-1 md:grid-cols-2"
              style={{ gap: 20, paddingTop: 20, borderTop: '1px solid var(--hairline)' }}
            >
              <div className="flex flex-col" style={{ gap: 7 }}>
                <h3 className="serif" style={{ fontSize: 18, fontWeight: 600, color: 'var(--text)' }}>
                  {BOOK.digital.heading}
                </h3>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text2)' }}>{BOOK.digital.detail}</p>
              </div>
              <div className="flex flex-col" style={{ gap: 7 }}>
                <h3 className="serif" style={{ fontSize: 18, fontWeight: 600, color: 'var(--accentDeep)' }}>
                  {BOOK.print.heading}
                </h3>
                <p style={{ fontSize: 15, lineHeight: 1.6, color: 'var(--text2)' }}>{BOOK.print.detail}</p>
              </div>
            </div>

            <p style={{ fontSize: 14, lineHeight: 1.55, color: 'var(--text3)' }}>{BOOK.consent}</p>
          </div>
        </div>
      </section>

      {/* ── Privacy ──────────────────────────────────────────────────────── */}
      <section>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 820 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>
            <ShieldCheck style={{ width: 14, height: 14 }} /> Privacy
          </p>
          <SectionHeading>Your child’s privacy</SectionHeading>
          <p style={{ ...body, margin: '14px 0 24px' }}>{PRIVACY_INTRO}</p>
          <div className="card" style={{ padding: '26px 28px' }}>
            <ul className="flex flex-col" style={{ gap: 14 }}>
              {PRIVACY_POINTS.map((p) => (
                <CheckRow key={p.title} title={p.title} detail={p.detail} />
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Who teaches it ───────────────────────────────────────────────── */}
      <section>
        <div className="wrap" style={{ padding: '52px 0 8px', maxWidth: 820 }}>
          <p className="eyebrow" style={{ marginBottom: 10 }}>
            Who teaches it
          </p>
          <SectionHeading>Konrad Gnat</SectionHeading>
          <div className="flex flex-col" style={{ gap: 16, marginTop: 20 }}>
            {BIO.map((p) => (
              <p key={p.slice(0, 24)} style={body}>
                {p}
              </p>
            ))}
            <p
              className="serif"
              style={{
                fontSize: 19,
                lineHeight: 1.6,
                fontStyle: 'italic',
                color: 'var(--text)',
                paddingTop: 16,
                borderTop: '1px solid var(--hairline)',
              }}
            >
              {BIO_KICKER}
            </p>
          </div>
        </div>
      </section>

      {/* ── Close ────────────────────────────────────────────────────────── */}
      <section>
        <div className="wrap" style={{ padding: '52px 0 80px', maxWidth: 820 }}>
          <div className="card" style={{ padding: '34px 32px', background: 'var(--surfaceAlt)' }}>
            <SectionHeading>Come and see</SectionHeading>
            <p style={{ ...body, margin: '14px 0 18px' }}>{GOAL_STATEMENT}</p>
            <p style={{ ...body, margin: '0 0 26px' }}>{CLOSING}</p>
            <div className="flex flex-wrap items-center" style={{ gap: 12 }}>
              <a href={WHATSAPP_URL} target="_blank" rel="noopener noreferrer" className="btn-amber">
                WhatsApp {WHATSAPP_NUMBER}
                <ArrowRight style={{ width: 16, height: 16 }} />
              </a>
              <Link href={KIDS_COURSE_BASE} className="btn-ghost">
                See the course
              </Link>
              <Link href={DECK_URL} className="btn-ghost">
                View the slide deck
              </Link>
            </div>
          </div>
        </div>
      </section>
    </CourseLayout>
  )
}
