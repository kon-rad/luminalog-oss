import Image from 'next/image'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import SocialLinks from '@/components/SocialLinks'
import AppStoreButton from '@/components/AppStoreButton'
import { APP_STORE_URL } from '@/lib/appStore'
import { INK, CREAM, MUTE, ACCENT } from '@/components/landing/theme'

// The Argo platform page (2026-11-02). The journal's landing page, which used
// to be this route, lives at /argo-journal unchanged. Structure and copy
// follow Areas/argo/brand/argo-rename-and-slogan.md section 5 and Konrad's
// public copy brief of 2026-11-01 (card t_e9b485a8); the design follows the
// research-lab reference in Areas/argo/design/: warm paper, small calm type,
// one accent, a serif for the long lines.

const GITHUB_URL = 'https://github.com/kon-rad/argo'
const DOCS_URL = 'https://kon-rad.github.io/argo/'
const SETUP_VAULT_URL = '/setup-vault'
const EXO_URL = 'https://exo.myargoquest.com'
const JOURNAL_PATH = '/argo-journal'

const CLAIMS: { title: string; body: string }[] = [
  {
    title: 'Persistent memory across everything you do.',
    body: 'One knowledge base you own: plain markdown in a git repo, searchable by the engine, outliving any app. All your projects, facts, decisions and research in one place you can read, copy and keep forever.',
  },
  {
    title: 'Agents that work like a company, not a swarm.',
    body: 'Projects organize into teams of agents. Work breaks into tasks tracked on a kanban board. Agents coordinate on a message board like Slack. You file a ticket; agents assign, work and report. The human stops prompting every step. That is the whole point.',
  },
  {
    title: 'Any harness, any machine, configured as code.',
    body: 'Run Claude Code, Hermes, Codex or a local open model, on your laptop, a server or any machine you own. Bots, teams, organizations and permissions live in config files, so the whole company of agents follows rules you write and version.',
  },
  {
    title: 'Every run logged, searchable, improvable.',
    body: 'Agent logs in one place: which harness, which model, how many tokens, what it cost, where it ran. Vector embeddings give similarity search and retrieval-augmented generation across the knowledge base. Logs feed back to improve the workflow, the organization and the code.',
  },
]

type Product = {
  eyebrow: string
  name: string
  body: string
  cta: { label: string; href: string; external?: boolean }
  links?: { label: string; href: string }[]
}

const PRODUCTS: Product[] = [
  {
    eyebrow: 'Open source',
    name: 'Argo',
    body: 'The agentic second brain: a knowledge base you own, agents that run on the best open model or harness for the job, and a loop that improves itself. Local-first, private by construction, yours.',
    cta: { label: 'View on GitHub', href: GITHUB_URL, external: true },
    links: [
      { label: 'Read the docs', href: DOCS_URL },
      { label: 'Set up your vault', href: SETUP_VAULT_URL },
    ],
  },
  {
    eyebrow: 'iOS app',
    name: 'Argo Journal',
    body: 'A private, encrypted AI journaling app. Capture in voice, text, video, or handwriting. An AI reads every entry you have written and shows you patterns you cannot see from inside your own head.',
    cta: { label: 'Download on the App Store', href: APP_STORE_URL, external: true },
    links: [{ label: 'About the journal', href: JOURNAL_PATH }],
  },
  {
    eyebrow: 'Wearable',
    name: 'Exo',
    body: 'A modular wearable computer: display glasses, earbuds and a few keys on a sling, built around a Raspberry Pi, that you hold a button and talk to. Thin client: it carries nothing worth stealing.',
    cta: { label: 'Join the waitlist', href: EXO_URL, external: true },
  },
]

const FOOTER_LINKS: [string, string][] = [
  ['Journal', JOURNAL_PATH],
  ['Exo', EXO_URL],
  ['Articles', '/articles'],
  ['Events', '/events'],
  ['Courses', '/courses'],
  ['GitHub', GITHUB_URL],
  ['Docs', DOCS_URL],
  ['Set up your vault', SETUP_VAULT_URL],
  ['Privacy Policy', '/privacy'],
  ['Terms', '/terms'],
  ['Support', 'mailto:konradmgnat@gmail.com'],
]

const CTA_STYLE: React.CSSProperties = {
  display: 'inline-block',
  padding: '10px 18px',
  background: 'var(--accent)',
  color: '#fff',
  borderRadius: 999,
  fontSize: 13.5,
  fontWeight: 600,
  textDecoration: 'none',
}

const ext = (href: string) =>
  href.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {}

export default function Home() {
  return (
    <>
      <Navbar immersive />
      <span id="top" />

      {/* Hero: ink, so the gold emblem keeps its contrast (brand rule). */}
      <section
        style={{
          background: INK,
          color: CREAM,
          padding: 'clamp(72px, 12vh, 128px) 24px clamp(64px, 10vh, 112px)',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 680, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Image
            src="/argo-emblem-alpha.png"
            alt="Argo"
            width={176}
            height={220}
            priority
            style={{ width: 'clamp(120px, 18vw, 176px)', height: 'auto' }}
          />
          <h1
            className="serif"
            style={{
              fontSize: 'clamp(30px, 4.6vw, 46px)',
              fontWeight: 600,
              letterSpacing: '-0.02em',
              lineHeight: 1.1,
              margin: '36px 0 0',
              color: CREAM,
            }}
          >
            Argo: agentic second brain
          </h1>
          <p
            className="serif"
            style={{
              fontStyle: 'italic',
              fontSize: 'clamp(18px, 2.4vw, 22px)',
              color: ACCENT,
              margin: '14px 0 0',
            }}
          >
            A hackable, DIY agent orchestration stack.
          </p>
          <p
            style={{
              fontSize: 'clamp(15px, 1.8vw, 17px)',
              lineHeight: 1.65,
              color: MUTE,
              maxWidth: 520,
              margin: '22px 0 0',
            }}
          >
            The agents are yours. The data is yours. Nothing important moves without you.
          </p>
          <div style={{ display: 'flex', gap: 12, marginTop: 36, flexWrap: 'wrap', justifyContent: 'center' }}>
            <Link
              href={SETUP_VAULT_URL}
              style={{
                padding: '11px 22px',
                background: ACCENT,
                color: INK,
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Set up your vault
            </Link>
            <a
              href={GITHUB_URL}
              {...ext(GITHUB_URL)}
              style={{
                padding: '11px 22px',
                background: 'transparent',
                color: CREAM,
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                border: '1px solid rgba(243,238,228,0.28)',
              }}
            >
              View on GitHub
            </a>
            <a
              href={DOCS_URL}
              {...ext(DOCS_URL)}
              style={{
                padding: '11px 22px',
                background: 'transparent',
                color: CREAM,
                borderRadius: 999,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: 'none',
                border: '1px solid rgba(243,238,228,0.28)',
              }}
            >
              Read the docs
            </a>
          </div>
          <p style={{ fontSize: 13, color: MUTE, marginTop: 22, opacity: 0.8 }}>
            Open source, MIT. Your vault, your agents, your keys.
          </p>
        </div>
      </section>

      {/* Why Argo: four claims, in the order from the brief. */}
      <section id="why" style={{ background: 'var(--bg)', padding: 'clamp(64px, 9vh, 104px) 24px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          <p className="eyebrow" style={{ color: 'var(--accentDeep)', marginBottom: 12 }}>Why Argo</p>
          <h2
            className="serif"
            style={{ fontSize: 'clamp(24px, 3.2vw, 32px)', fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.2, color: 'var(--text)', margin: 0, maxWidth: 620 }}
          >
            Persistent memory across all your work, teams of agents instead of prompts, and logs that make the whole system better.
          </h2>
          <ol style={{ listStyle: 'none', padding: 0, margin: '44px 0 0', display: 'flex', flexDirection: 'column' }}>
            {CLAIMS.map((claim, i) => (
              <li
                key={claim.title}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '40px 1fr',
                  gap: 16,
                  padding: '26px 0',
                  borderTop: '1px solid var(--hairline2)',
                }}
              >
                <span style={{ fontSize: 13, color: 'var(--text3)', paddingTop: 4, fontVariantNumeric: 'tabular-nums' }}>
                  0{i + 1}
                </span>
                <div>
                  <h3 className="serif" style={{ fontSize: 20, fontWeight: 600, lineHeight: 1.3, margin: 0, color: 'var(--text)' }}>
                    {claim.title}
                  </h3>
                  <p style={{ fontSize: 15.5, lineHeight: 1.65, color: 'var(--text2)', margin: '10px 0 0', maxWidth: 600 }}>
                    {claim.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Products: the platform, the journal, the wearable. */}
      <section id="products" style={{ background: 'var(--surfaceAlt)', padding: 'clamp(64px, 9vh, 104px) 24px' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto' }}>
          <p className="eyebrow" style={{ color: 'var(--accentDeep)', marginBottom: 12 }}>Products</p>
          <h2
            className="serif"
            style={{ fontSize: 'clamp(24px, 3.2vw, 32px)', fontWeight: 600, letterSpacing: '-0.015em', lineHeight: 1.2, color: 'var(--text)', margin: 0 }}
          >
            One platform, three ways in.
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: 20,
              marginTop: 40,
            }}
          >
            {PRODUCTS.map((p) => (
              <article
                key={p.name}
                style={{
                  background: 'var(--surface)',
                  border: '1px solid var(--hairline)',
                  borderRadius: 16,
                  padding: '28px 26px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 12,
                }}
              >
                <p className="eyebrow" style={{ color: 'var(--text3)', margin: 0 }}>{p.eyebrow}</p>
                <h3 className="serif" style={{ fontSize: 24, fontWeight: 600, letterSpacing: '-0.01em', margin: 0, color: 'var(--text)' }}>
                  {p.name}
                </h3>
                <p style={{ fontSize: 15, lineHeight: 1.65, color: 'var(--text2)', margin: 0, flex: 1 }}>{p.body}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
                  {p.cta.href === APP_STORE_URL ? (
                    // The tracked conversion button: fires app_store_click.
                    <AppStoreButton variant="nav" label={p.cta.label} style={{ ...CTA_STYLE, alignSelf: 'flex-start' }} />
                  ) : (
                    <a href={p.cta.href} {...ext(p.cta.href)} style={{ ...CTA_STYLE, alignSelf: 'flex-start' }}>
                      {p.cta.label}
                    </a>
                  )}
                  {p.links?.map((l) => (
                    <Link key={l.label} href={l.href} {...ext(l.href)} style={{ fontSize: 13.5, color: 'var(--accentDeep)', fontWeight: 600 }}>
                      {l.label} &rarr;
                    </Link>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <footer style={{ background: 'var(--bg)', borderTop: '1px solid var(--hairline)', padding: '52px 0 60px' }}>
        <div className="wrap">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <div>
              <a href="#top" className="inline-flex items-center gap-2.5 serif" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em' }}>
                <span style={{ width: 32, height: 32, borderRadius: 10, overflow: 'hidden', boxShadow: '0 2px 10px rgba(185,107,51,0.4)', flexShrink: 0, display: 'block' }}>
                  <Image unoptimized src="/argo-logo.png" width={32} height={32} alt="" />
                </span>
                Argo
              </a>
              <p className="serif" style={{ fontStyle: 'italic', fontSize: 16, color: 'var(--text2)', marginTop: 14, maxWidth: 300 }}>
                Argo: a hackable, DIY agent orchestration stack.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', paddingTop: 6, maxWidth: 560 }}>
              {FOOTER_LINKS.map(([label, href]) => (
                <a key={label} href={href} {...ext(href)} style={{ fontSize: 14, color: 'var(--text2)' }}>{label}</a>
              ))}
            </div>
          </div>
          <SocialLinks marginTop={34} />
          <p style={{ marginTop: 28, fontSize: 13, color: 'var(--text3)' }}>
            &copy; 2026 Argo. Built by{' '}
            <a href="https://x.com/konrad_gnat" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accentDeep)', fontWeight: 600 }}>Konrad Gnat</a>
          </p>
        </div>
      </footer>
    </>
  )
}
