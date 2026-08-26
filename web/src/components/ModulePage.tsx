import Link from 'next/link'
import { Sparkles, ArrowRight, ArrowUpRight, Radio, BookText, Check } from 'lucide-react'
import { CourseLayout, Pill, SectionHeading } from '@/components/course'
import CourseQuiz from '@/components/CourseQuiz'
import { COURSE_BASE, MODULES } from '@/lib/ai-agent-pro/course'
import { LUMA_URL, YOUTUBE_URL, type AgendaItem, type QuizMCQ } from '@/lib/ai-agent-pro/program'

/* ──────────────────────────────────────────────────────────────────────────
 * Shared scaffold for a module page.
 *
 * Modules 0, 1 and 2 predate this and stay hand-written; each carries a
 * bespoke section (the Windows toolstack, the five-tool grid, the model
 * profile table) that is not worth generalising. Everything from Module 3
 * onwards is the same shape, so it lives here: hero, ideas, agenda, steps,
 * cost, quiz, course grid, CTA. Per-module extras go in `children`, which is
 * rendered directly under the hero.
 * ────────────────────────────────────────────────────────────────────────── */

const outlineButton: React.CSSProperties = {
  height: 52,
  padding: '0 24px',
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--text)',
  border: '1px solid var(--hairline2)',
  background: 'var(--surface)',
}

export interface Idea {
  title: string
  body: string
}

export interface CostLine {
  item: string
  amount: string
}

export interface ModulePageProps {
  /** Module number, used for the pill and the "you are here" marker. */
  n: number
  /** Route slug, e.g. 'module-7'. Must match the entry in MODULES. */
  slug: string
  title: string
  lede: string
  /** Green pill beside the live badge, e.g. 'Free · No coding' or 'About 2 USD'. */
  costBadge: string
  /** One line naming what a student must already have. */
  prereq?: React.ReactNode
  guideUrl: string
  materialsUrl: string
  ideas: Idea[]
  ideasHeading?: string
  agenda: AgendaItem[]
  agendaLede: string
  steps: string[]
  stepsHeading?: string
  cost?: CostLine[]
  costNote?: string
  /** Said plainly, the way the module says it. Never softened. */
  caveat: string
  quizId: string
  mcq: QuizMCQ[]
  openQuestions: string[]
  /** Extra sections, rendered between the hero and "the ideas". */
  children?: React.ReactNode
}

export default function ModulePage({
  n,
  slug,
  title,
  lede,
  costBadge,
  prereq,
  guideUrl,
  materialsUrl,
  ideas,
  ideasHeading = 'The ideas that carry the session',
  agenda,
  agendaLede,
  steps,
  stepsHeading = 'The build, step by step',
  cost,
  costNote,
  caveat,
  quizId,
  mcq,
  openQuestions,
  children,
}: ModulePageProps) {
  return (
    <CourseLayout>
      {/* Hero */}
      <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
        <div className="wrap" style={{ padding: '64px 0 52px', textAlign: 'center' }}>
          <div className="flex flex-wrap items-center justify-center gap-2" style={{ marginBottom: 22 }}>
            <Pill>Module {n}</Pill>
            <span
              className="inline-flex items-center gap-1.5 rounded-full"
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                padding: '5px 12px',
                color: 'var(--danger)',
                background: 'rgba(229,84,75,0.10)',
                border: '1px solid rgba(229,84,75,0.25)',
              }}
            >
              <Radio style={{ width: 12, height: 12 }} /> Live on YouTube
            </span>
            <span
              className="inline-flex items-center rounded-full"
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.04em',
                textTransform: 'uppercase',
                padding: '5px 12px',
                color: 'var(--dim-art)',
                background: 'rgba(125,191,114,0.12)',
                border: '1px solid rgba(125,191,114,0.28)',
              }}
            >
              {costBadge}
            </span>
          </div>

          <span className="eyebrow" style={{ marginBottom: 14, justifyContent: 'center' }}>
            <Sparkles style={{ width: 14, height: 14 }} /> AI Agent Pro
          </span>
          <h1
            className="serif"
            style={{
              fontSize: 46,
              fontWeight: 600,
              letterSpacing: '-0.03em',
              lineHeight: 1.08,
              color: 'var(--text)',
              marginBottom: 18,
            }}
          >
            {title}
          </h1>
          <p style={{ fontSize: 18.5, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 640, margin: '0 auto' }}>
            {lede}
          </p>

          {prereq && (
            <p
              style={{
                fontSize: 15.5,
                lineHeight: 1.55,
                color: 'var(--text2)',
                maxWidth: 560,
                margin: '20px auto 0',
                padding: '12px 18px',
                borderRadius: 'var(--r-card)',
                background: 'var(--surface)',
                border: '1px solid var(--hairline)',
              }}
            >
              {prereq}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-center gap-3" style={{ marginTop: 34 }}>
            <a href={LUMA_URL} target="_blank" rel="noopener noreferrer" className="btn-amber">
              Register on Luma
              <ArrowUpRight style={{ width: 16, height: 16 }} />
            </a>
            <a
              href={YOUTUBE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-btn"
              style={outlineButton}
            >
              <Radio style={{ width: 16, height: 16 }} />
              Watch live
            </a>
            <a
              href={guideUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-btn"
              style={outlineButton}
            >
              <BookText style={{ width: 16, height: 16 }} />
              Follow the guide
            </a>
          </div>
        </div>
      </section>

      {children}

      {/* The ideas */}
      <section style={{ background: 'var(--surfaceAlt)', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)' }}>
        <div className="wrap" style={{ padding: '64px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>{ideasHeading}</SectionHeading>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 22 }}>
            {ideas.map((idea) => (
              <div key={idea.title} className="card flex flex-col" style={{ padding: '26px 28px' }}>
                <h3 className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
                  {idea.title}
                </h3>
                <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--text2)' }}>{idea.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agenda */}
      <section>
        <div className="wrap" style={{ padding: '64px 0', maxWidth: 800 }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>The 60-minute session</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', marginTop: 12 }}>{agendaLede}</p>
          </div>
          <div className="flex flex-col" style={{ gap: 12 }}>
            {agenda.map((item) => (
              <div key={item.time} className="card flex gap-5" style={{ padding: '20px 22px' }}>
                <div
                  style={{
                    flexShrink: 0,
                    width: 46,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 14,
                    fontWeight: 700,
                    color: 'var(--accentDeep)',
                  }}
                >
                  {item.time}
                </div>
                <div>
                  <h3 style={{ fontSize: 16.5, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>
                    {item.title}
                  </h3>
                  <p style={{ fontSize: 15.5, lineHeight: 1.55, color: 'var(--text2)' }}>{item.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Steps */}
      <section style={{ background: 'var(--surfaceAlt)', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)' }}>
        <div className="wrap" style={{ padding: '64px 0', maxWidth: 800 }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>{stepsHeading}</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', marginTop: 12 }}>
              Every command and every copy-pasteable brief is in the student guide.
            </p>
          </div>
          <div className="flex flex-col" style={{ gap: 12 }}>
            {steps.map((step, i) => (
              <div key={step} className="card flex items-center gap-4" style={{ padding: '16px 20px' }}>
                <span
                  className="inline-flex items-center justify-center"
                  style={{
                    flexShrink: 0,
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    background: 'var(--accentSoft)',
                    color: 'var(--accentDeep)',
                    fontWeight: 700,
                    fontSize: 14,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: 16, color: 'var(--text)' }}>{step}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3" style={{ marginTop: 32 }}>
            <a href={guideUrl} target="_blank" rel="noopener noreferrer" className="btn-amber">
              Open the full student guide
              <ArrowUpRight style={{ width: 16, height: 16 }} />
            </a>
            <a
              href={materialsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-btn"
              style={outlineButton}
            >
              <GithubGlyph />
              Module materials on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* Cost and the honest caveat */}
      <section>
        <div className="wrap" style={{ padding: '64px 0', maxWidth: 800 }}>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 22 }}>
            {cost && (
              <div className="card flex flex-col" style={{ padding: '26px 28px' }}>
                <h3 className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 16 }}>
                  What it costs
                </h3>
                <dl style={{ margin: 0 }}>
                  {cost.map((line) => (
                    <div
                      key={line.item}
                      className="flex items-baseline justify-between gap-4"
                      style={{ padding: '9px 0', borderBottom: '1px solid var(--hairline)' }}
                    >
                      <dt style={{ fontSize: 15.5, color: 'var(--text2)' }}>{line.item}</dt>
                      <dd style={{ fontSize: 15.5, fontWeight: 600, color: 'var(--text)', textAlign: 'right', margin: 0 }}>
                        {line.amount}
                      </dd>
                    </div>
                  ))}
                </dl>
                {costNote && (
                  <p style={{ fontSize: 14.5, lineHeight: 1.55, color: 'var(--text2)', marginTop: 16 }}>{costNote}</p>
                )}
              </div>
            )}
            <div
              className="flex flex-col"
              style={{
                padding: '26px 28px',
                borderRadius: 'var(--r-card)',
                background: 'var(--accentSoft)',
                border: '1px solid var(--accentTint)',
              }}
            >
              <h3 className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
                The honest part
              </h3>
              <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--text2)' }}>{caveat}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Quiz */}
      <section style={{ background: 'var(--surfaceAlt)', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)' }}>
        <div className="wrap" style={{ padding: '64px 0', maxWidth: 800 }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>Knowledge check</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', marginTop: 12 }}>
              Five quick questions to check your understanding, then four to answer in your own
              words for peer review.
            </p>
          </div>
          <CourseQuiz
            quizId={quizId}
            quizTitle={`AI Agent Pro · Module ${n}`}
            mcq={mcq}
            openQuestions={openQuestions}
          />
        </div>
      </section>

      {/* Course grid */}
      <section>
        <div className="wrap" style={{ padding: '64px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>Where this sits in the course</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 560, margin: '12px auto 0' }}>
              Each module is a standalone hands-on session, though the later ones build on what the
              earlier ones left running.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4" style={{ gap: 16 }}>
            {MODULES.map((mod) => {
              const isCurrent = mod.slug === slug
              const card = (
                <div
                  style={{
                    height: '100%',
                    padding: '18px',
                    borderRadius: 'var(--r-card)',
                    background: isCurrent ? 'var(--accentTint)' : 'var(--surface)',
                    border: `1px solid ${isCurrent ? 'var(--accent)' : 'var(--hairline)'}`,
                    opacity: mod.tbd ? 0.7 : 1,
                  }}
                >
                  <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <div className="serif" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
                      Module {mod.n}
                    </div>
                  </div>
                  <div style={{ fontWeight: 500, lineHeight: 1.35, color: 'var(--text)', fontSize: 14.5 }}>
                    {mod.title}
                  </div>
                  {isCurrent && (
                    <div
                      className="inline-flex items-center gap-1"
                      style={{ marginTop: 8, fontSize: 12.5, color: 'var(--accentDeep)', fontWeight: 600 }}
                    >
                      <Check style={{ width: 12, height: 12 }} /> You are here
                    </div>
                  )}
                </div>
              )
              return mod.tbd ? (
                <div key={mod.slug}>{card}</div>
              ) : (
                <Link key={mod.slug} href={`${COURSE_BASE}/${mod.slug}`} style={{ display: 'block', textDecoration: 'none' }}>
                  {card}
                </Link>
              )
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: 'var(--surfaceAlt)', borderTop: '1px solid var(--hairline)' }}>
        <div className="wrap" style={{ padding: '72px 0', textAlign: 'center', maxWidth: 640 }}>
          <SectionHeading>Join us live</SectionHeading>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', margin: '14px 0 30px' }}>
            Register on Luma to get the student guide and the livestream link. Read the guide before
            you arrive; the session moves at the speed of someone who already has the accounts open.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a href={LUMA_URL} target="_blank" rel="noopener noreferrer" className="btn-amber">
              Register on Luma
              <ArrowUpRight style={{ width: 16, height: 16 }} />
            </a>
            <Link href={COURSE_BASE} className="inline-flex items-center gap-2 rounded-btn" style={outlineButton}>
              Course overview
              <ArrowRight style={{ width: 16, height: 16 }} />
            </Link>
          </div>
        </div>
      </section>
    </CourseLayout>
  )
}

/* lucide dropped brand marks, so the GitHub logo is inline, same approach as
 * the Apple/Google glyphs in Navbar. */
function GithubGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2.17c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
    </svg>
  )
}

/* Shared extra section: a grid of the skills an agent writes for itself. */
export function SkillsSection({
  heading,
  lede,
  skills,
}: {
  heading: string
  lede: string
  skills: { command: string; cadence: string; what: string; why: string; icon: React.ComponentType<{ style?: React.CSSProperties }> }[]
}) {
  return (
    <section>
      <div className="wrap" style={{ padding: '64px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 38 }}>
          <SectionHeading>{heading}</SectionHeading>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 620, margin: '12px auto 0' }}>
            {lede}
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 22 }}>
          {skills.map((skill) => (
            <div key={skill.command} className="card flex flex-col" style={{ padding: '26px 28px' }}>
              <div className="flex items-center gap-3" style={{ marginBottom: 14 }}>
                <span
                  className="inline-flex items-center justify-center"
                  style={{ width: 44, height: 44, borderRadius: 14, background: 'var(--accentSoft)', color: 'var(--accentDeep)', flexShrink: 0 }}
                >
                  <skill.icon style={{ width: 21, height: 21 }} />
                </span>
                <div>
                  <div
                    style={{
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                      fontSize: 16,
                      fontWeight: 700,
                      color: 'var(--text)',
                    }}
                  >
                    {skill.command}
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text3)' }}>{skill.cadence}</div>
                </div>
              </div>
              <p style={{ fontSize: 15.5, lineHeight: 1.55, color: 'var(--text2)', marginBottom: 14 }}>{skill.what}</p>
              <p
                style={{
                  fontSize: 14.5,
                  lineHeight: 1.55,
                  color: 'var(--text2)',
                  marginTop: 'auto',
                  paddingTop: 14,
                  borderTop: '1px solid var(--hairline)',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>Why it matters: </span>
                {skill.why}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
