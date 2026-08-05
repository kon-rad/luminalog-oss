import Link from 'next/link'
import {
  Target,
  Check,
  Clock,
  Sparkles,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  FlaskConical,
  Users,
  PencilLine,
  FileText,
} from 'lucide-react'
import Navbar from '@/components/Navbar'
import SiteFooter from '@/components/SiteFooter'
import {
  COURSE_BASE,
  DAYS,
  DAY_SESSIONS,
  RUBRIC,
  VALUES,
  type CourseDay,
  type CourseExercise,
  type ExerciseKind,
} from '@/lib/ai-power-users/course'

/* ──────────────────────────────────────────────────────────────────────────
 * Presentational pieces for the AI Power Users course pages.
 * Same visual language as the blog, legal and events pages: warm paper
 * background, Newsreader serif headings, hairline rules, amber accent.
 * The knowledge check is a separate client component (CourseQuiz.tsx).
 * ────────────────────────────────────────────────────────────────────────── */

/* ── Shared bits ─────────────────────────────────────────────────────────── */

export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full"
      style={{
        fontSize: 12,
        fontWeight: 700,
        letterSpacing: '0.04em',
        textTransform: 'uppercase',
        padding: '5px 12px',
        color: 'var(--accentDeep)',
        background: 'var(--accentSoft)',
        border: '1px solid var(--accentTint)',
      }}
    >
      {children}
    </span>
  )
}

export function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="serif"
      style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.15, color: 'var(--text)' }}
    >
      {children}
    </h2>
  )
}

/* ── Page chrome ─────────────────────────────────────────────────────────── */

export function CourseLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main style={{ background: 'var(--bg)' }}>{children}</main>
      <SiteFooter />
    </>
  )
}

/* Hero for the course overview. */
export function CourseHero() {
  return (
    <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
      <div className="wrap" style={{ padding: '72px 0 56px', textAlign: 'center' }}>
        <span className="eyebrow" style={{ marginBottom: 18, justifyContent: 'center' }}>
          <Sparkles style={{ width: 14, height: 14 }} /> Argo · Course
        </span>
        <h1
          className="serif"
          style={{ fontSize: 52, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.05, color: 'var(--text)', marginBottom: 18 }}
        >
          AI Power Users
        </h1>
        <p style={{ fontSize: 19, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 640, margin: '0 auto' }}>
          Go from “I’ve heard of ChatGPT” to picking the right tool for any task,
          prompting it like a pro, chaining tools together, protecting your data,
          and even running a private model on your own laptop.
        </p>
        <p style={{ fontSize: 17, fontWeight: 600, color: 'var(--accentDeep)', marginTop: 22 }}>
          A one-week intensive. Hands-on every session. Hype-free.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3" style={{ marginTop: 34 }}>
          <Link href={`${COURSE_BASE}/day-1`} className="btn-amber">
            Start Day 1
            <ArrowRight style={{ width: 16, height: 16 }} />
          </Link>
          <Link
            href={`${COURSE_BASE}/values`}
            className="inline-flex items-center gap-2 rounded-btn"
            style={{
              height: 52,
              padding: '0 26px',
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--text)',
              border: '1px solid var(--hairline2)',
              background: 'var(--surface)',
            }}
          >
            Our values
          </Link>
        </div>
      </div>
    </section>
  )
}

/* Chrome for a single lesson: day header, objectives, body, prev/next. */
export function LessonLayout({ day, children }: { day: CourseDay; children: React.ReactNode }) {
  return (
    <CourseLayout>
      <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
        <div className="wrap" style={{ padding: '56px 0 40px', maxWidth: 800 }}>
          <div style={{ marginBottom: 22 }}>
            <CourseDayList currentSlug={day.slug} />
          </div>
          <div className="flex flex-wrap items-center gap-3" style={{ marginBottom: 16 }}>
            <Pill>
              Day {day.day} · {day.weekday}
            </Pill>
            <span className="inline-flex items-center gap-1.5" style={{ fontSize: 14, color: 'var(--text2)' }}>
              <Clock style={{ width: 14, height: 14 }} />
              {day.duration}
            </span>
          </div>
          <h1
            className="serif"
            style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1, color: 'var(--text)', marginBottom: 14 }}
          >
            {day.title}
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--text2)' }}>{day.theme}</p>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ padding: '32px 0 0', maxWidth: 800 }}>
          <Objectives objectives={day.objectives} />
        </div>
      </section>

      <section>
        <div className="wrap" style={{ padding: '40px 0 24px', maxWidth: 800, display: 'flex', flexDirection: 'column', gap: 48 }}>
          {children}
        </div>
      </section>

      <section>
        <div className="wrap" style={{ padding: '16px 0 72px', maxWidth: 800 }}>
          <CourseNav currentSlug={day.slug} />
        </div>
      </section>
    </CourseLayout>
  )
}

/* The two fixed time slots every day runs (workshop + hands-on mentoring),
 * with their durations and breaks. Shared by the overview, the Module-1 grid,
 * and the TBD day pages so the format is stated in exactly one place. */
export function DaySchedule({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex flex-col" style={{ gap: 8 }}>
      {DAY_SESSIONS.map((s) => (
        <div
          key={s.title}
          className="flex items-center justify-between gap-3"
          style={{ fontSize: compact ? 13 : 14.5 }}
        >
          <span className="inline-flex items-center gap-2" style={{ color: 'var(--text)', fontWeight: 600 }}>
            <Clock style={{ width: 14, height: 14, color: 'var(--accent)' }} />
            {s.title}
          </span>
          <span style={{ color: 'var(--text3)', whiteSpace: 'nowrap' }}>
            {s.durationMin} min · {s.breakMin} min break
          </span>
        </div>
      ))}
    </div>
  )
}

/* Placeholder page for a future (TBD) day: the topic is not announced yet, but
 * the format (workshop + mentoring) is fixed and shown. */
export function TbdLessonPage({ day }: { day: CourseDay }) {
  return (
    <CourseLayout>
      <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
        <div className="wrap" style={{ padding: '56px 0 40px', maxWidth: 800 }}>
          <div style={{ marginBottom: 22 }}>
            <CourseDayList currentSlug={day.slug} />
          </div>
          <div className="flex flex-wrap items-center gap-3" style={{ marginBottom: 16 }}>
            <Pill>
              Day {day.day} · {day.weekday}
            </Pill>
            <span className="inline-flex items-center gap-1.5" style={{ fontSize: 14, color: 'var(--text2)' }}>
              <Clock style={{ width: 14, height: 14 }} />
              {day.duration}
            </span>
          </div>
          <h1
            className="serif"
            style={{ fontSize: 40, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.1, color: 'var(--text)', marginBottom: 14 }}
          >
            Topic coming soon
          </h1>
          <p style={{ fontSize: 18, lineHeight: 1.6, color: 'var(--text2)' }}>
            The topic for this day is still being planned. The format is set: a 45-minute workshop
            and a 45-minute hands-on mentoring session, each followed by a 15-minute break.
          </p>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ padding: '32px 0 0', maxWidth: 800 }}>
          <div className="card" style={{ padding: '26px 28px' }}>
            <h2 className="serif" style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
              How the day runs
            </h2>
            <DaySchedule />
          </div>
        </div>
      </section>

      <section>
        <div className="wrap" style={{ padding: '40px 0 72px', maxWidth: 800 }}>
          <CourseNav currentSlug={day.slug} />
        </div>
      </section>
    </CourseLayout>
  )
}

/* A titled teaching block. */
export function LessonSection({
  title,
  eyebrow,
  children,
}: {
  title: string
  eyebrow?: string
  children: React.ReactNode
}) {
  return (
    <section style={{ scrollMarginTop: 96 }}>
      {eyebrow && (
        <p className="eyebrow" style={{ marginBottom: 10 }}>
          {eyebrow}
        </p>
      )}
      <h2
        className="serif"
        style={{ fontSize: 27, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.2, color: 'var(--text)', marginBottom: 16 }}
      >
        {title}
      </h2>
      <div className="lesson-prose flex flex-col gap-4" style={{ fontSize: 17, lineHeight: 1.65, color: 'var(--text2)' }}>
        {children}
      </div>
    </section>
  )
}

export function Objectives({ objectives }: { objectives: string[] }) {
  return (
    <div className="card" style={{ padding: '26px 28px' }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 16 }}>
        <Target style={{ width: 18, height: 18, color: 'var(--accent)' }} />
        <h2 className="serif" style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)' }}>
          By the end of this session you can
        </h2>
      </div>
      <ul className="flex flex-col gap-3">
        {objectives.map((objective) => (
          <li key={objective} className="flex gap-3" style={{ fontSize: 15.5, lineHeight: 1.55, color: 'var(--text2)' }}>
            <Check style={{ width: 16, height: 16, color: 'var(--accent)', flexShrink: 0, marginTop: 3 }} />
            <span>{objective}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ── Values ──────────────────────────────────────────────────────────────── */

export function ValuesGrid({ showInClass = false }: { showInClass?: boolean }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 22 }}>
      {VALUES.map((value) => (
        <div key={value.title} className="card flex flex-col" style={{ padding: '26px 28px' }}>
          <span
            className="inline-flex items-center justify-center"
            style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--accentSoft)', color: 'var(--accentDeep)', marginBottom: 16 }}
          >
            <value.icon style={{ width: 22, height: 22 }} />
          </span>
          <h3 className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
            {value.title}
          </h3>
          <p style={{ fontSize: 15.5, lineHeight: 1.55, color: 'var(--text2)' }}>{value.meaning}</p>
          {showInClass && (
            <p
              style={{
                fontSize: 14.5,
                lineHeight: 1.55,
                color: 'var(--text2)',
                marginTop: 16,
                paddingTop: 16,
                borderTop: '1px solid var(--hairline)',
              }}
            >
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>In class: </span>
              {value.inClass}
            </p>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Exercises ───────────────────────────────────────────────────────────── */

const KIND_META: Record<ExerciseKind, { label: string; icon: typeof FlaskConical }> = {
  lab: { label: 'Hands-on lab', icon: FlaskConical },
  peer: { label: 'Peer exercise', icon: Users },
  homework: { label: 'Homework', icon: PencilLine },
  essay: { label: 'Essay', icon: FileText },
}

export function Exercise({ exercise }: { exercise: CourseExercise }) {
  const meta = KIND_META[exercise.kind]
  const Icon = meta.icon

  return (
    <div style={{ background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-card)', padding: '24px 26px' }}>
      <div className="flex items-center gap-2" style={{ marginBottom: 12 }}>
        <span className="eyebrow">
          <Icon style={{ width: 13, height: 13 }} />
          {meta.label}
        </span>
        {exercise.due && <span style={{ fontSize: 13, color: 'var(--text3)' }}>· {exercise.due}</span>}
      </div>
      <h4 className="serif" style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)', marginBottom: 14 }}>
        {exercise.title}
      </h4>
      <ol className="flex flex-col gap-2.5">
        {exercise.steps.map((step, i) => (
          <li key={step} className="flex gap-3" style={{ fontSize: 15, lineHeight: 1.5, color: 'var(--text2)' }}>
            <span
              className="inline-flex items-center justify-center"
              style={{
                width: 21,
                height: 21,
                flexShrink: 0,
                marginTop: 1,
                borderRadius: '50%',
                background: 'var(--accentSoft)',
                color: 'var(--accentDeep)',
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {i + 1}
            </span>
            <span>{step}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}

export function ExerciseList({ exercises }: { exercises: CourseExercise[] }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 22 }}>
      {exercises.map((ex) => (
        <Exercise key={ex.title} exercise={ex} />
      ))}
    </div>
  )
}

/* ── Rubric ──────────────────────────────────────────────────────────────── */

export function RubricTable() {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          fontSize: 15,
          borderCollapse: 'collapse',
          border: '1px solid var(--hairline)',
          borderRadius: 'var(--r-card)',
          overflow: 'hidden',
        }}
      >
        <thead>
          <tr style={{ background: 'var(--surfaceAlt)', textAlign: 'left' }}>
            <th style={{ padding: '13px 16px', fontWeight: 600, color: 'var(--text)' }}>Criterion</th>
            <th style={{ padding: '13px 16px', fontWeight: 600, color: 'var(--text)' }}>What peers look for</th>
            <th style={{ padding: '13px 16px', fontWeight: 600, color: 'var(--text)', textAlign: 'center', whiteSpace: 'nowrap' }}>
              Score
            </th>
          </tr>
        </thead>
        <tbody>
          {RUBRIC.map((c) => (
            <tr key={c.title} style={{ borderTop: '1px solid var(--hairline)' }}>
              <td style={{ padding: '13px 16px', fontWeight: 500, color: 'var(--text)', verticalAlign: 'top' }}>{c.title}</td>
              <td style={{ padding: '13px 16px', color: 'var(--text2)', verticalAlign: 'top' }}>{c.description}</td>
              <td style={{ padding: '13px 16px', color: 'var(--text2)', textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'top' }}>
                1–5
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* ── Course navigation ───────────────────────────────────────────────────── */

/* Prev/next navigation only chains the live (non-TBD) days plus the capstone —
 * TBD days are placeholders and are skipped. */
const LESSON_ORDER = [
  ...DAYS.filter((d) => !d.tbd).map((d) => ({
    slug: d.slug,
    href: `${COURSE_BASE}/${d.slug}`,
    label: `Day ${d.day} · ${d.title}`,
  })),
  { slug: 'capstone', href: `${COURSE_BASE}/capstone`, label: 'Capstone' },
]

function chipStyle(active: boolean): React.CSSProperties {
  return {
    fontSize: 13,
    fontWeight: 600,
    padding: '6px 14px',
    borderRadius: 999,
    textDecoration: 'none',
    color: active ? 'var(--accentDeep)' : 'var(--text2)',
    background: active ? 'var(--accentTint)' : 'transparent',
    border: `1px solid ${active ? 'var(--accent)' : 'var(--hairline2)'}`,
  }
}

/** Compact list of the lessons, with the current one marked. */
export function CourseDayList({ currentSlug }: { currentSlug?: string }) {
  return (
    <nav className="flex flex-wrap gap-2">
      <Link href={COURSE_BASE} style={chipStyle(false)}>
        Overview
      </Link>
      {DAYS.map((d) =>
        d.tbd ? (
          <span key={d.slug} style={{ ...chipStyle(d.slug === currentSlug), opacity: 0.5, cursor: 'default' }}>
            Day {d.day}
          </span>
        ) : (
          <Link
            key={d.slug}
            href={`${COURSE_BASE}/${d.slug}`}
            aria-current={d.slug === currentSlug ? 'page' : undefined}
            style={chipStyle(d.slug === currentSlug)}
          >
            Day {d.day}
          </Link>
        ),
      )}
      <Link
        href={`${COURSE_BASE}/capstone`}
        aria-current={currentSlug === 'capstone' ? 'page' : undefined}
        style={chipStyle(currentSlug === 'capstone')}
      >
        Capstone
      </Link>
    </nav>
  )
}

/** Previous / next links at the foot of a lesson. */
export function CourseNav({ currentSlug }: { currentSlug: string }) {
  const index = LESSON_ORDER.findIndex((l) => l.slug === currentSlug)
  const prev = index > 0 ? LESSON_ORDER[index - 1] : null
  const next = index >= 0 && index < LESSON_ORDER.length - 1 ? LESSON_ORDER[index + 1] : null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 16 }}>
      {prev ? (
        <Link href={prev.href} className="card flex items-center gap-3" style={{ padding: '16px 20px', textDecoration: 'none' }}>
          <ArrowLeft style={{ width: 16, height: 16, color: 'var(--accent)', flexShrink: 0 }} />
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text3)' }}>Previous</span>
            <span style={{ display: 'block', fontWeight: 600, color: 'var(--text)' }}>{prev.label}</span>
          </span>
        </Link>
      ) : (
        <span />
      )}
      {next ? (
        <Link
          href={next.href}
          className="card flex items-center justify-end gap-3"
          style={{ padding: '16px 20px', textAlign: 'right', textDecoration: 'none' }}
        >
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text3)' }}>Next</span>
            <span style={{ display: 'block', fontWeight: 600, color: 'var(--text)' }}>{next.label}</span>
          </span>
          <ArrowRight style={{ width: 16, height: 16, color: 'var(--accent)', flexShrink: 0 }} />
        </Link>
      ) : (
        <Link
          href={COURSE_BASE}
          className="card flex items-center justify-end gap-3"
          style={{ padding: '16px 20px', textAlign: 'right', textDecoration: 'none' }}
        >
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 12.5, color: 'var(--text3)' }}>Finish</span>
            <span style={{ display: 'block', fontWeight: 600, color: 'var(--text)' }}>Back to overview</span>
          </span>
          <ArrowUpRight style={{ width: 16, height: 16, color: 'var(--accent)', flexShrink: 0 }} />
        </Link>
      )}
    </div>
  )
}
