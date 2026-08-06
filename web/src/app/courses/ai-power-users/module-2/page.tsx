import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  Radio,
  BookText,
  Check,
} from 'lucide-react'
import { CourseLayout, Pill, SectionHeading } from '@/components/course'
import CourseQuiz from '@/components/CourseQuiz'
import { COURSE_BASE } from '@/lib/ai-power-users/course'
import {
  MODULE_2_SKILLS,
  MODULE_2_AGENDA,
  MODULE_2_STEPS,
  MODULE_2_MCQ,
  MODULE_2_OPEN_QUESTIONS,
  MODULE_2_MATERIALS_URL,
  MODULE_2_GUIDE_URL,
  LUMA_URL,
  YOUTUBE_URL,
} from '@/lib/ai-power-users/program'

export const metadata: Metadata = {
  title: 'Module 2 · Agent Mastery and Vibe Coding a Pro Website — Argo',
  description:
    'Your AI agent writes its own tools, then builds a real client website — live, start to finish, deployed to a working URL. Model research, cost tracking, and a full site in one session. Free, no coding required.',
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

/* The four named model profiles students set up in Part 1. */
const PROFILES: { name: string; use: string; basis: string }[] = [
  { name: 'private', use: 'Client, financial and personal work', basis: 'Privacy — Morpheus, always' },
  { name: 'fast', use: 'Bulk, boring, summarising, tidying', basis: 'Price' },
  { name: 'smart', use: 'Judgment calls, client-facing writing', basis: 'General capability' },
  { name: 'coding', use: 'Building software, multi-file projects', basis: 'Agentic coding ability' },
]

/* The ideas that carry the session — the lines worth remembering. */
const IDEAS: { title: string; body: string }[] = [
  {
    title: 'Process beats prompt',
    body: 'A better prompt makes one answer better. A process makes every answer better. Left alone, an agent starts writing code in thirty seconds and builds the wrong thing beautifully.',
  },
  {
    title: 'One task per session',
    body: 'A session is one continuous conversation; a task is one unit of work. Finish the task, reset, then start the next. It kills context rot, cuts cost, and makes switching models free.',
  },
  {
    title: 'Goals are how you win an argument with an AI',
    body: 'When the agent offers a gorgeous animation that pushes the quote button below the fold, your written goals are what let you say no.',
  },
  {
    title: 'The senior move is removing things',
    body: 'This site probably does not need a database. Working out that it does not is worth more than building one.',
  },
]

export default function ModuleTwoPage() {
  return (
    <CourseLayout>
      {/* Hero */}
      <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
        <div className="wrap" style={{ padding: '64px 0 52px', textAlign: 'center' }}>
          <div className="flex flex-wrap items-center justify-center gap-2" style={{ marginBottom: 22 }}>
            <Pill>Module 2</Pill>
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
            Agent Mastery and Vibe Coding a Pro Website
          </h1>
          <p style={{ fontSize: 18.5, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 640, margin: '0 auto' }}>
            Your agent writes three tools for itself, then builds a real client website — from a
            blank folder to a live, deployed URL, in one session. An agency quotes this at
            $4,000–8,000 and six to eight weeks.
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
              href={MODULE_2_GUIDE_URL}
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

      {/* The three skills */}
      <section>
        <div className="wrap" style={{ padding: '64px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>Three skills your agent writes for itself</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 620, margin: '12px auto 0' }}>
              In Module 1 you wrote a skill by hand so you could see the machinery. You never have
              to do that again. You give the agent one brief, and it writes all three.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 22 }}>
            {MODULE_2_SKILLS.map((skill) => (
              <div key={skill.command} className="card flex flex-col" style={{ padding: '26px 28px' }}>
                <span
                  className="inline-flex items-center justify-center"
                  style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--accentSoft)', color: 'var(--accentDeep)', marginBottom: 16 }}
                >
                  <skill.icon style={{ width: 22, height: 22 }} />
                </span>
                <h3
                  style={{
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 17,
                    fontWeight: 700,
                    color: 'var(--text)',
                    marginBottom: 8,
                  }}
                >
                  {skill.command}
                </h3>
                <p style={{ fontSize: 15.5, lineHeight: 1.55, color: 'var(--text2)', marginBottom: 14 }}>
                  {skill.what}
                </p>
                <p style={{ fontSize: 14.5, lineHeight: 1.5, color: 'var(--text3)', fontStyle: 'italic', marginBottom: 16 }}>
                  {skill.why}
                </p>
                <span
                  className="inline-flex items-center rounded-full"
                  style={{ marginTop: 'auto', alignSelf: 'flex-start', fontSize: 12, fontWeight: 600, padding: '4px 11px', color: 'var(--text2)', border: '1px solid var(--hairline2)' }}
                >
                  {skill.cadence}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Model profiles */}
      <section style={{ background: 'var(--surfaceAlt)', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)' }}>
        <div className="wrap" style={{ padding: '64px 0', maxWidth: 800 }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>Four models, one command</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', marginTop: 12 }}>
              No single model is right for everything. You set up four named profiles and switch
              between them in one command — at task boundaries, where switching is free.
            </p>
          </div>
          <div className="flex flex-col" style={{ gap: 12 }}>
            {PROFILES.map((p) => (
              <div key={p.name} className="card flex flex-wrap items-center gap-5" style={{ padding: '18px 22px' }}>
                <div
                  style={{
                    flexShrink: 0,
                    minWidth: 88,
                    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                    fontSize: 14.5,
                    fontWeight: 700,
                    color: 'var(--accentDeep)',
                  }}
                >
                  {p.name}
                </div>
                <div style={{ flex: '1 1 240px', fontSize: 15.5, color: 'var(--text)' }}>{p.use}</div>
                <div style={{ fontSize: 14, color: 'var(--text3)' }}>{p.basis}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agenda */}
      <section>
        <div className="wrap" style={{ padding: '64px 0', maxWidth: 800 }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>The 110-minute session</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', marginTop: 12 }}>
              Two parts with a break in the middle. Hands-on the whole way through — you finish
              with a live URL.
            </p>
          </div>
          <div className="flex flex-col" style={{ gap: 12 }}>
            {MODULE_2_AGENDA.map((item) => (
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

      {/* The build, step by step */}
      <section style={{ background: 'var(--surfaceAlt)', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)' }}>
        <div className="wrap" style={{ padding: '64px 0', maxWidth: 800 }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>The website, step by step</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 620, margin: '12px auto 0' }}>
              We build for a fence installation company — unglamorous, real, and every town has
              fifty with terrible websites. Swap in roofing, landscaping or plumbing; the process
              is identical.
            </p>
          </div>
          <div className="flex flex-col" style={{ gap: 12 }}>
            {MODULE_2_STEPS.map((step, i) => (
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
            <a href={MODULE_2_GUIDE_URL} target="_blank" rel="noopener noreferrer" className="btn-amber">
              Open the full student guide
              <ArrowUpRight style={{ width: 16, height: 16 }} />
            </a>
            <a
              href={MODULE_2_MATERIALS_URL}
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

      {/* Ideas */}
      <section>
        <div className="wrap" style={{ padding: '64px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>The ideas that carry the session</SectionHeading>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2" style={{ gap: 22 }}>
            {IDEAS.map((idea) => (
              <div key={idea.title} className="card" style={{ padding: '26px 28px' }}>
                <h3 className="serif" style={{ fontSize: 20, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
                  {idea.title}
                </h3>
                <p style={{ fontSize: 15.5, lineHeight: 1.6, color: 'var(--text2)' }}>{idea.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Honest caveat */}
      <section style={{ background: 'var(--surfaceAlt)', borderTop: '1px solid var(--hairline)', borderBottom: '1px solid var(--hairline)' }}>
        <div className="wrap" style={{ padding: '56px 0', maxWidth: 720 }}>
          <div className="card" style={{ padding: '28px 30px' }}>
            <div
              style={{
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'var(--text3)',
                marginBottom: 12,
              }}
            >
              The honest part
            </div>
            <p style={{ fontSize: 16.5, lineHeight: 1.65, color: 'var(--text2)' }}>
              What you build in an hour is an excellent starting point, not a finished client
              delivery. Real client work adds their photos, their copy, their domain, revisions and
              support. The hour you save is the hour of <em>building</em> — which was never the
              valuable hour. The valuable hour is working out what to build, and the agent cannot
              do that part. It does not know the business, and it does not know the owner. That is
              the job you are selling.
            </p>
          </div>
        </div>
      </section>

      {/* Quiz */}
      <section>
        <div className="wrap" style={{ padding: '64px 0', maxWidth: 800 }}>
          <div style={{ textAlign: 'center', marginBottom: 38 }}>
            <SectionHeading>Knowledge check</SectionHeading>
            <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', marginTop: 12 }}>
              Five quick questions to check your understanding, then four to answer in your own
              words for peer review.
            </p>
          </div>
          <CourseQuiz
            quizId="module-2"
            quizTitle="AI Power Users · Module 2"
            mcq={MODULE_2_MCQ}
            openQuestions={MODULE_2_OPEN_QUESTIONS}
          />
        </div>
      </section>

      {/* Prev / next */}
      <section style={{ background: 'var(--surfaceAlt)', borderTop: '1px solid var(--hairline)' }}>
        <div className="wrap" style={{ padding: '48px 0', maxWidth: 800 }}>
          <div className="grid grid-cols-1 sm:grid-cols-2" style={{ gap: 16 }}>
            <Link
              href={`${COURSE_BASE}/module-1`}
              className="card"
              style={{ padding: '20px 22px', textDecoration: 'none', display: 'block' }}
            >
              <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 6 }}>Previous</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>
                Module 1 · Build Your Private AI Second Brain
              </div>
            </Link>
            <div className="card" style={{ padding: '20px 22px', opacity: 0.7 }}>
              <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 6 }}>Next</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text)' }}>Module 3 · Coming soon</div>
              <div
                className="inline-flex items-center gap-1"
                style={{ marginTop: 8, fontSize: 12.5, color: 'var(--accentDeep)', fontWeight: 600 }}
              >
                <Check style={{ width: 12, height: 12 }} /> You are on Module 2
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ borderTop: '1px solid var(--hairline)' }}>
        <div className="wrap" style={{ padding: '72px 0', textAlign: 'center', maxWidth: 640 }}>
          <SectionHeading>Join us live</SectionHeading>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', margin: '14px 0 30px' }}>
            Register on Luma to get the student guide and the livestream link. Everything you need
            to install beforehand is in the guide — start there.
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
 * the module-1 page and the Navbar glyphs. */
function GithubGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden style={{ flexShrink: 0 }}>
      <path d="M12 .5C5.73.5.5 5.73.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2.17c-3.2.7-3.88-1.37-3.88-1.37-.53-1.34-1.29-1.7-1.29-1.7-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.2 1.77 1.2 1.03 1.77 2.71 1.26 3.37.96.1-.75.4-1.26.73-1.55-2.56-.29-5.25-1.28-5.25-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11 11 0 0 1 5.79 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.24 2.76.12 3.05.74.81 1.19 1.84 1.19 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.73 18.27.5 12 .5z" />
    </svg>
  )
}
