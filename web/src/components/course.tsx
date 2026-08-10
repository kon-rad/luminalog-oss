import Link from 'next/link'
import { Sparkles, ArrowRight } from 'lucide-react'
import Navbar from '@/components/Navbar'
import SiteFooter from '@/components/SiteFooter'
import { COURSE_BASE, MODULES, VALUES } from '@/lib/ai-power-users/course'

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
          Five hands-on modules. Hype-free.
        </p>
        <div className="flex flex-wrap items-center justify-center gap-3" style={{ marginTop: 34 }}>
          <Link href={`${COURSE_BASE}/module-1`} className="btn-amber">
            Start Module 1
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

/* ── Course navigation ───────────────────────────────────────────────────── */

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

/** Compact chip list of the modules, with the current page marked. TBD modules
 * are dimmed and not linked. */
export function CourseModuleList({ currentSlug }: { currentSlug?: string }) {
  return (
    <nav className="flex flex-wrap gap-2">
      <Link href={COURSE_BASE} style={chipStyle(false)}>
        Overview
      </Link>
      {MODULES.map((mod) =>
        mod.tbd ? (
          <span
            key={mod.slug}
            style={{ ...chipStyle(false), opacity: 0.5, cursor: 'default' }}
          >
            Module {mod.n}
          </span>
        ) : (
          <Link
            key={mod.slug}
            href={`${COURSE_BASE}/${mod.slug}`}
            aria-current={mod.slug === currentSlug ? 'page' : undefined}
            style={chipStyle(mod.slug === currentSlug)}
          >
            Module {mod.n}
          </Link>
        ),
      )}
    </nav>
  )
}
