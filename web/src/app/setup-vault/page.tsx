import type { Metadata } from 'next'
import Link from 'next/link'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import Navbar from '@/components/Navbar'
import SiteFooter from '@/components/SiteFooter'
import CopyToAgents from '@/components/CopyToAgents'

/* The human page for the setup-vault skill. The agent-facing copy of the same
 * skill is served from /setup-vault/skill.md (vendored under src/lib/skills/). */

export const metadata: Metadata = {
  title: 'Set up your vault, Argo',
  description:
    'Hand your agent the setup-vault skill and answer four questions. It takes an empty folder to a private second brain: plain markdown in a git repo you own, the web app, and search.',
}

export const dynamic = 'force-static'

const ENGINE = 'https://github.com/kon-rad/argo'
const SKILL_ON_GITHUB = 'https://github.com/kon-rad/argo/blob/main/skills/setup-vault/SKILL.md'
const DOCS_SETUP = 'https://kon-rad.github.io/argo/onboarding/02-set-up-your-vault/'
const SKILL_URL = '/setup-vault/skill.md'

const QUESTIONS: [string, string][] = [
  ['Where should the vault live?', 'An absolute path to a new or empty folder. An existing markdown folder moves in once the vault is up.'],
  ['Which operating system is this?', 'macOS, Debian or Ubuntu, or something else. It picks the install commands.'],
  ['Semantic search now, later, or never?', 'Keyword search needs no keys. Semantic search needs an embedding provider.'],
  ['Which agent harness comes next?', 'Claude Code, Hermes, another tool, or none yet. Only decides which page you land on after.'],
]

const RUNS = [
  'Checks the prerequisites (git, Python 3.9+, Node 22+, PostgreSQL 15+ and pgvector), installing only what is missing.',
  'Creates the vault: git init, the engine as a submodule at .secondbrain/, then secondbrain-vault init.',
  'Runs the app, and puts the launcher on your PATH.',
  'Adds your notes and builds the search index with secondbrain scan.',
  'Turns on semantic search, if you asked for it.',
  'Points the vault at a private remote and makes the first push.',
]

export default function SetupVaultPage() {
  const skill = readFileSync(path.join(process.cwd(), 'src/lib/skills/setup-vault.md'), 'utf8')
  return (
    <>
      <Navbar />
      <main style={{ background: 'var(--bg)' }}>
        <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
          <div className="wrap" style={{ padding: '72px 0 48px', maxWidth: 820 }}>
            <Link href="/" className="eyebrow" style={{ marginBottom: 18 }}>
              ← Back to Argo
            </Link>
            <h1
              className="serif"
              style={{
                marginTop: 14,
                fontSize: 'clamp(34px,5vw,52px)',
                fontWeight: 600,
                letterSpacing: '-0.03em',
                lineHeight: 1.05,
                color: 'var(--text)',
              }}
            >
              Set up your vault
            </h1>
            <p style={{ marginTop: 18, fontSize: 17, lineHeight: 1.7, color: 'var(--text2)', maxWidth: 660 }}>
              Argo is open source, and a vault is an empty folder that becomes a private git repo of
              plain markdown with the engine inside it. You do not have to read the install steps:
              hand your agent the <strong>setup-vault</strong> skill, answer four questions, and it
              runs them, checking each before the next.
            </p>
            <div style={{ marginTop: 24, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
              <CopyToAgents markdown={skill} markdownUrl={SKILL_URL} />
              <a
                href={DOCS_SETUP}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 14, color: 'var(--accentDeep)', fontWeight: 600 }}
              >
                Or read the steps yourself →
              </a>
            </div>
          </div>
        </section>

        <section className="wrap" style={{ padding: '56px 0 96px', maxWidth: 820 }}>
          <article style={{ fontSize: 16.5, lineHeight: 1.72, color: 'var(--text2)' }}>
            <h2 className="serif" style={{ fontSize: 26, fontWeight: 600, margin: '0 0 16px', color: 'var(--text)' }}>
              The four questions
            </h2>
            <p style={{ margin: '0 0 18px' }}>
              The skill asks all four in one go, then works from your answers. Nothing runs before
              that.
            </p>
            <div style={{ overflowX: 'auto', marginBottom: 28 }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 15 }}>
                <tbody>
                  {QUESTIONS.map(([q, a]) => (
                    <tr key={q}>
                      <td
                        style={{
                          textAlign: 'left',
                          padding: '10px 14px 10px 0',
                          borderBottom: '1px solid var(--hairline)',
                          verticalAlign: 'top',
                          width: '38%',
                          color: 'var(--text)',
                          fontWeight: 600,
                        }}
                      >
                        {q}
                      </td>
                      <td style={{ textAlign: 'left', padding: '10px 0', borderBottom: '1px solid var(--hairline)', verticalAlign: 'top' }}>
                        {a}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="serif" style={{ fontSize: 26, fontWeight: 600, margin: '36px 0 16px', color: 'var(--text)' }}>
              What it runs
            </h2>
            <ul style={{ paddingLeft: 22, margin: '0 0 28px' }}>
              {RUNS.map((line) => (
                <li key={line} style={{ marginBottom: 8 }}>
                  {line}
                </li>
              ))}
            </ul>

            <h2 className="serif" style={{ fontSize: 26, fontWeight: 600, margin: '36px 0 16px', color: 'var(--text)' }}>
              What it deliberately leaves alone
            </h2>
            <p style={{ margin: '0 0 28px' }}>
              It stops once the vault runs and search works. It connects no agent harness, turns on
              no module, and sets up no server, and it says so when it is done. Those are the next
              pages, and you read them when you want them.
            </p>

            <h2 className="serif" style={{ fontSize: 26, fontWeight: 600, margin: '36px 0 16px', color: 'var(--text)' }}>
              Where to go next
            </h2>
            <ul style={{ paddingLeft: 22, margin: 0 }}>
              <li style={{ marginBottom: 8 }}>
                <a href={DOCS_SETUP} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accentDeep)', fontWeight: 600 }}>
                  Set up your vault
                </a>{' '}
                in the docs: the same path by hand, with a check after each step.
              </li>
              <li style={{ marginBottom: 8 }}>
                <a href={SKILL_ON_GITHUB} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accentDeep)', fontWeight: 600 }}>
                  The skill on GitHub
                </a>
                , and for an agent, the raw file at <code>{SKILL_URL}</code>.
              </li>
              <li style={{ marginBottom: 8 }}>
                <a href={ENGINE} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accentDeep)', fontWeight: 600 }}>
                  The engine
                </a>
                : the app, the vault template, the hooks and the shared skills. MIT licensed.
              </li>
            </ul>
          </article>
        </section>
      </main>
      <SiteFooter />
    </>
  )
}
