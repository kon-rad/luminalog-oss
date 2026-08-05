import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  ExternalLink,
  Radio,
  BookText,
  Check,
} from 'lucide-react'
import { CourseLayout, DaySchedule, Pill, SectionHeading } from '@/components/course'
import CourseQuiz from '@/components/CourseQuiz'
import { COURSE_BASE, DAYS } from '@/lib/ai-power-users/course'
import {
  TOOLSTACK,
  MODULE_1_AGENDA,
  MODULE_1_MCQ,
  MODULE_1_OPEN_QUESTIONS,
  LUMA_URL,
  YOUTUBE_URL,
  GUIDE_URL,
  MODULE_1_MATERIALS_URL,
} from '@/lib/ai-power-users/program'

export const metadata: Metadata = {
  title: 'Module 1 · Build Your Private AI Second Brain — Argo',
  description:
    'The live first session of AI Power Users. Install a complete private AI stack — offline speech-to-text, Obsidian, the Hermes agent, and a private Morpheus model — and build your first agent skill. Free, no coding required.',
}

const STEPS = [
  'Install Obsidian — your notes window',
  'Install VS Code — inspect your files, skills, and config',
  'Install Handy — offline speech-to-text',
  'Install cmux — your agent terminal (macOS)',
  'Install Hermes — your AI agent',
  'Create a Morpheus account & API key — the private brain',
  'Build your second brain with the PARA method',
  'Run Hermes in your folder and connect it to Morpheus',
  'Create your first skill: a daily standup',
]

const outlineButton: React.CSSProperties = {
  height: 52,
  padding: '0 24px',
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--text)',
  border: '1px solid var(--hairline2)',
  background: 'var(--surface)',
}

export default function ModuleOnePage() {
  return (
    <CourseLayout>
      {/* Hero */}
      <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
        <div className="wrap" style={{ padding: '64px 0 52px', textAlign: 'center' }}>
          <div className="flex flex-wrap items-center justify-center gap-2" style={{ marginBottom: 22 }}>
            <Pill>Day 1 · Module 1</Pill>
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
              Free · No coding
            </span>
          </div>

          <span className="eyebrow" style={{ marginBottom: 14, justifyContent: 'center' }}>
            <Sparkles style={{ width: 14, height: 14 }} /> AI Power Users
          </span>
          <h1
            className="serif"
            style={{ fontSize: 46, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.08, color: 'var(--text)', marginBottom: 18 }}
          >
            Build Your Private AI Second Brain
          </h1>
          <p style={{ fontSize: 18.5, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 620, margin: '0 auto' }}>
            In 45 minutes we install a complete private AI stack, live — a personal agent that
            lives inside your own notes, thinks with a private model, and works offline. Then we
            build your first agent skill: a daily standup with your AI.
          </p>

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
              href={GUIDE_URL}
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

      {/* What you'll build */}
      <section>
        <div className="wrap" style={{ padding: '64px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>What you’ll build</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 560, margin: '12px auto 0' }}>
              Five free tools, wired into one private-AI workstation. Nothing depends on a single
              company’s cloud.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 22 }}>
            {TOOLSTACK.map((tool) => (
              <a
                key={tool.name}
                href={tool.href}
                target="_blank"
                rel="noopener noreferrer"
                className="card flex flex-col"
                style={{ padding: '26px 28px', textDecoration: 'none' }}
              >
                <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                  <span
                    className="inline-flex items-center justify-center"
                    style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--accentSoft)', color: 'var(--accentDeep)' }}
                  >
                    <tool.icon style={{ width: 22, height: 22 }} />
                  </span>
                  <ExternalLink style={{ width: 16, height: 16, color: 'var(--text3)' }} />
                </div>
                <h3 className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 8 }}>
                  {tool.name}
                </h3>
                <p style={{ fontSize: 15.5, lineHeight: 1.55, color: 'var(--text2)', marginBottom: 16 }}>
                  {tool.role}
                </p>
                <div className="flex flex-wrap gap-2" style={{ marginTop: 'auto' }}>
                  <span
                    className="inline-flex items-center rounded-full"
                    style={{ fontSize: 12, fontWeight: 600, padding: '4px 11px', color: 'var(--dim-art)', background: 'rgba(125,191,114,0.12)' }}
                  >
                    {tool.free}
                  </span>
                  {tool.openSource && (
                    <span
                      className="inline-flex items-center rounded-full"
                      style={{ fontSize: 12, fontWeight: 600, padding: '4px 11px', color: 'var(--text2)', border: '1px solid var(--hairline2)' }}
                    >
                      Open source
                    </span>
                  )}
                </div>
              </a>
            ))}
          </div>
        </div>
      </section>

      {/* Agenda */}
      <section style={{ background: 'var(--surfaceAlt)', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)' }}>
        <div className="wrap" style={{ padding: '64px 0', maxWidth: 800 }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>The 45-minute session</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', marginTop: 12 }}>
              Hands-on the whole way through. You finish with a working setup.
            </p>
          </div>
          <div className="flex flex-col" style={{ gap: 12 }}>
            {MODULE_1_AGENDA.map((item) => (
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
      <section>
        <div className="wrap" style={{ padding: '64px 0', maxWidth: 800 }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>The build, step by step</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', marginTop: 12 }}>
              The full walkthrough — every command, link, and description — is in the student guide.
            </p>
          </div>
          <div className="flex flex-col" style={{ gap: 12 }}>
            {STEPS.map((step, i) => (
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
            <a href={GUIDE_URL} target="_blank" rel="noopener noreferrer" className="btn-amber">
              Open the full student guide
              <ArrowUpRight style={{ width: 16, height: 16 }} />
            </a>
            <a
              href={MODULE_1_MATERIALS_URL}
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

      {/* Quiz */}
      <section style={{ background: 'var(--surfaceAlt)', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)' }}>
        <div className="wrap" style={{ padding: '64px 0', maxWidth: 800 }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>Knowledge check</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', marginTop: 12 }}>
              Five quick questions to check your understanding, then five to answer in your own
              words for peer review.
            </p>
          </div>
          <CourseQuiz
            quizId="module-1"
            quizTitle="AI Power Users · Module 1"
            mcq={MODULE_1_MCQ}
            openQuestions={MODULE_1_OPEN_QUESTIONS}
          />
        </div>
      </section>

      {/* Program grid */}
      <section>
        <div className="wrap" style={{ padding: '64px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>Part of a 5-day week</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 560, margin: '12px auto 0' }}>
              One topic a day, Monday to Friday — a 45-minute workshop plus a 45-minute hands-on
              mentoring session, with a 15-minute break after each. This is Day 1, Module 1.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5" style={{ gap: 16 }}>
            {DAYS.map((day) => {
              const isCurrent = day.slug === 'day-1'
              const card = (
                <div
                  style={{
                    height: '100%',
                    padding: '18px',
                    borderRadius: 'var(--r-card)',
                    background: isCurrent ? 'var(--accentTint)' : 'var(--surface)',
                    border: `1px solid ${isCurrent ? 'var(--accent)' : 'var(--hairline)'}`,
                    opacity: day.tbd ? 0.7 : 1,
                  }}
                >
                  <div style={{ textAlign: 'center', marginBottom: 12 }}>
                    <div className="serif" style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
                      {day.weekday}
                    </div>
                    <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>Day {day.day}</div>
                  </div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--accentDeep)', marginBottom: 4 }}>
                    {day.tbd ? 'Topic' : 'Module 1'}
                  </div>
                  <div style={{ fontWeight: 500, lineHeight: 1.35, color: 'var(--text)', fontSize: 14.5 }}>
                    {day.tbd ? 'TBD' : 'Build Your Private AI Second Brain'}
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
              return isCurrent ? (
                <Link key={day.slug} href={`${COURSE_BASE}/module-1`} style={{ display: 'block', textDecoration: 'none' }}>
                  {card}
                </Link>
              ) : (
                <div key={day.slug}>{card}</div>
              )
            })}
          </div>
          <div
            className="card"
            style={{ marginTop: 20, padding: '20px 22px', maxWidth: 420, marginLeft: 'auto', marginRight: 'auto' }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--text3)',
                marginBottom: 12,
                textAlign: 'center',
              }}
            >
              Every day
            </div>
            <DaySchedule />
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ background: 'var(--surfaceAlt)', borderTop: '1px solid var(--hairline)' }}>
        <div className="wrap" style={{ padding: '72px 0', textAlign: 'center', maxWidth: 640 }}>
          <SectionHeading>Join us live</SectionHeading>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', margin: '14px 0 30px' }}>
            Register on Luma to get the student guide and the livestream link. Bring a laptop and a
            real project you want your AI to help you track.
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

/* lucide dropped brand marks, so the GitHub logo is inline — same approach as
 * the Apple/Google glyphs in Navbar. */
function GithubGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2.17c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
    </svg>
  )
}
