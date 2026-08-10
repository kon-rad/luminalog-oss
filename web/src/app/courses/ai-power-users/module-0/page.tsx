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
  AlertTriangle,
} from 'lucide-react'
import { CourseLayout, Pill, SectionHeading } from '@/components/course'
import CourseQuiz from '@/components/CourseQuiz'
import { COURSE_BASE, MODULES } from '@/lib/ai-power-users/course'
import {
  MODULE_0_TOOLSTACK,
  MODULE_0_OBJECTIVES,
  MODULE_0_PREREQS,
  MODULE_0_AGENDA,
  MODULE_0_MCQ,
  MODULE_0_OPEN_QUESTIONS,
  MODULE_0_LUMA_URL,
  MODULE_0_GUIDE_URL,
  MODULE_0_MATERIALS_URL,
  YOUTUBE_URL,
} from '@/lib/ai-power-users/program'

export const metadata: Metadata = {
  title: 'Module 0 · Fundamentals for Windows 11, Argo',
  description:
    'The pre-course hour of AI Power Users, for anyone who has never opened a terminal. One folder, four windows: Windows Terminal, File Explorer, Handy, Obsidian, and VS Code. No AI, no agent, no code.',
}

const outlineButton: React.CSSProperties = {
  height: 52,
  padding: '0 24px',
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--text)',
  border: '1px solid var(--hairline2)',
  background: 'var(--surface)',
}

/* The spine of the session: everything points at one folder. */
const SPINE = 'C:\\Users\\you\\Documents\\secondBrain'

export default function ModuleZeroPage() {
  return (
    <CourseLayout>
      {/* Hero */}
      <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
        <div className="wrap" style={{ padding: '64px 0 52px', textAlign: 'center' }}>
          <div className="flex flex-wrap items-center justify-center gap-2" style={{ marginBottom: 22 }}>
            <Pill>Pre-course · Module 0</Pill>
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
              Free · 60 minutes · Windows 11
            </span>
          </div>

          <span className="eyebrow" style={{ marginBottom: 14, justifyContent: 'center' }}>
            <Sparkles style={{ width: 14, height: 14 }} /> AI Power Users
          </span>
          <h1
            className="serif"
            style={{ fontSize: 46, fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.08, color: 'var(--text)', marginBottom: 18 }}
          >
            Fundamentals for Windows 11
          </h1>
          <p style={{ fontSize: 18.5, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 620, margin: '0 auto' }}>
            The first hour of the course, for anyone who has never used a terminal. No AI, no
            agent, no coding. This is the hour that makes every session after it make sense.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-3" style={{ marginTop: 34 }}>
            <a href={MODULE_0_LUMA_URL} target="_blank" rel="noopener noreferrer" className="btn-amber">
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
              Watch the livestream
            </a>
            <a
              href={MODULE_0_GUIDE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-btn"
              style={outlineButton}
            >
              <BookText style={{ width: 16, height: 16 }} />
              Student handbook
            </a>
          </div>
        </div>
      </section>

      {/* The spine */}
      <section>
        <div className="wrap" style={{ padding: '64px 0', maxWidth: 800 }}>
          <div style={{ textAlign: 'center', marginBottom: 30 }}>
            <SectionHeading>One folder, four windows</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', marginTop: 12 }}>
              Everything in this session points at a single folder on your own machine.
            </p>
          </div>
          <div
            className="card"
            style={{
              padding: '22px 24px',
              textAlign: 'center',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
              fontSize: 16,
              fontWeight: 600,
              color: 'var(--accentDeep)',
              overflowX: 'auto',
            }}
          >
            {SPINE}
          </div>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', marginTop: 22, textAlign: 'center' }}>
            You create it in the terminal, browse it in File Explorer, read it in Obsidian, and
            inspect it in VS Code. Not four applications to learn. Four windows onto one folder.
          </p>
        </div>
      </section>

      {/* The tools */}
      <section style={{ background: 'var(--surfaceAlt)', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)' }}>
        <div className="wrap" style={{ padding: '64px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>The five tools</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 560, margin: '12px auto 0' }}>
              Two are already on your machine. The other three are free downloads, and everything
              they touch stays in plain files you own.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3" style={{ gap: 22 }}>
            {MODULE_0_TOOLSTACK.map((tool) => {
              const body = (
                <>
                  <div className="flex items-center justify-between" style={{ marginBottom: 16 }}>
                    <span
                      className="inline-flex items-center justify-center"
                      style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--accentSoft)', color: 'var(--accentDeep)' }}
                    >
                      <tool.icon style={{ width: 22, height: 22 }} />
                    </span>
                    {tool.href && <ExternalLink style={{ width: 16, height: 16, color: 'var(--text3)' }} />}
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
                      {tool.source}
                    </span>
                  </div>
                </>
              )
              return tool.href ? (
                <a
                  key={tool.name}
                  href={tool.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="card flex flex-col"
                  style={{ padding: '26px 28px', textDecoration: 'none' }}
                >
                  {body}
                </a>
              ) : (
                <div key={tool.name} className="card flex flex-col" style={{ padding: '26px 28px' }}>
                  {body}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Before the session */}
      <section>
        <div className="wrap" style={{ padding: '64px 0', maxWidth: 800 }}>
          <div style={{ textAlign: 'center', marginBottom: 30 }}>
            <SectionHeading>Before the session</SectionHeading>
          </div>
          <div className="flex flex-col" style={{ gap: 12 }}>
            {MODULE_0_PREREQS.map((item, i) => (
              <div key={item} className="card flex items-center gap-4" style={{ padding: '16px 20px' }}>
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
                <span style={{ fontSize: 16, color: 'var(--text)' }}>{item}</span>
              </div>
            ))}
          </div>
          <div
            className="flex gap-3"
            style={{
              marginTop: 20,
              padding: '16px 20px',
              borderRadius: 'var(--r-btn)',
              background: 'rgba(229,84,75,0.08)',
              border: '1px solid rgba(229,84,75,0.22)',
            }}
          >
            <AlertTriangle style={{ width: 18, height: 18, color: 'var(--danger)', flexShrink: 0, marginTop: 2 }} />
            <p style={{ fontSize: 15.5, lineHeight: 1.55, color: 'var(--text2)' }}>
              Download the Whisper model at home. It is over a gigabyte and will not finish on
              venue wifi with thirty people trying at once.
            </p>
          </div>
        </div>
      </section>

      {/* Agenda */}
      <section style={{ background: 'var(--surfaceAlt)', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)' }}>
        <div className="wrap" style={{ padding: '64px 0', maxWidth: 800 }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>The 60-minute session</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', marginTop: 12 }}>
              No break. You build the folder as we go, and write the note that Module 1 opens.
            </p>
          </div>
          <div className="flex flex-col" style={{ gap: 12 }}>
            {MODULE_0_AGENDA.map((item) => (
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

      {/* Objectives */}
      <section>
        <div className="wrap" style={{ padding: '64px 0', maxWidth: 800 }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>What you can do by the end</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', marginTop: 12 }}>
              Every step, command, and link is written out in the student handbook.
            </p>
          </div>
          <ul className="flex flex-col" style={{ gap: 12, listStyle: 'none' }}>
            {MODULE_0_OBJECTIVES.map((objective) => (
              <li key={objective} className="card flex items-start gap-4" style={{ padding: '16px 20px' }}>
                <Check style={{ width: 18, height: 18, color: 'var(--dim-art)', flexShrink: 0, marginTop: 3 }} />
                <span style={{ fontSize: 16, lineHeight: 1.5, color: 'var(--text)' }}>{objective}</span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-center justify-center gap-3" style={{ marginTop: 32 }}>
            <a href={MODULE_0_GUIDE_URL} target="_blank" rel="noopener noreferrer" className="btn-amber">
              Open the student handbook
              <ArrowUpRight style={{ width: 16, height: 16 }} />
            </a>
            <a
              href={MODULE_0_MATERIALS_URL}
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

      {/* What you take with you */}
      <section style={{ background: 'var(--surfaceAlt)', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)' }}>
        <div className="wrap" style={{ padding: '64px 0', maxWidth: 720, textAlign: 'center' }}>
          <SectionHeading>What you take with you</SectionHeading>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', margin: '14px 0 0' }}>
            A <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>secondBrain</code>{' '}
            folder organised with PARA, containing{' '}
            <code style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
              2-areas/ai-power-users/module-00.md
            </code>
            , a reference note you wrote partly with your own voice. That folder is what the next
            session opens.
          </p>
        </div>
      </section>

      {/* Quiz */}
      <section>
        <div className="wrap" style={{ padding: '64px 0', maxWidth: 800 }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>Knowledge check</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', marginTop: 12 }}>
              Six quick questions to check your understanding, then five short answers in your own
              words for peer review.
            </p>
          </div>
          <CourseQuiz
            quizId="module-0"
            quizTitle="AI Power Users · Module 0"
            mcq={MODULE_0_MCQ}
            openQuestions={MODULE_0_OPEN_QUESTIONS}
          />
        </div>
      </section>

      {/* Program grid */}
      <section style={{ background: 'var(--surfaceAlt)', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)' }}>
        <div className="wrap" style={{ padding: '64px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>Where this sits in the course</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 560, margin: '12px auto 0' }}>
              Module 0 is the machine. Module 1 onward is the course proper, where your AI agent
              moves into the folder you just built. Mac and Linux students can skip straight to
              Module 1.
            </p>
          </div>
          <ModuleGrid currentSlug="module-0" />
        </div>
      </section>

      {/* CTA */}
      <section>
        <div className="wrap" style={{ padding: '72px 0', textAlign: 'center', maxWidth: 640 }}>
          <SectionHeading>Join us live</SectionHeading>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', margin: '14px 0 30px' }}>
            Register on Luma for the seat and the reminders, watch on YouTube if you cannot make it
            to the room, and keep the student handbook open the whole way through.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <a href={MODULE_0_LUMA_URL} target="_blank" rel="noopener noreferrer" className="btn-amber">
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
              Watch the livestream
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

/* The whole module list as cards, with the current one marked. */
function ModuleGrid({ currentSlug }: { currentSlug: string }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6" style={{ gap: 16 }}>
      {MODULES.map((mod) => {
        const isCurrent = mod.slug === currentSlug
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
