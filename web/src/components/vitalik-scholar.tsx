import Link from 'next/link'
import Navbar from '@/components/Navbar'
import SocialLinks from '@/components/SocialLinks'
import { H2, P, A, Pull, Figure } from '@/components/blog'
import {
  type ScholarBlock,
  type ScholarClip,
  type ScholarPost,
  type ScholarTerm,
  timestamp,
  youtubeUrl,
} from '@/lib/vitalik-scholar'

/* ──────────────────────────────────────────────────────────────────────────
 * Vitalik Scholar (/vitalik-scholar and /vitalik-scholar/[slug]).
 * Same visual language as the blog (components/blog.tsx); posts are data
 * in lib/vitalik-scholar.ts rather than JSX, so one renderer covers them all.
 * ────────────────────────────────────────────────────────────────────────── */

function ScholarFooter() {
  return (
    <footer style={{ background: 'var(--bg)', borderTop: '1px solid var(--hairline)', padding: '40px 0 56px' }}>
      <div className="wrap">
        <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', fontSize: 14 }}>
          <Link href="/vitalik-scholar" style={{ color: 'var(--text2)', fontWeight: 600 }}>Vitalik Scholar</Link>
          <Link href="/blog" style={{ color: 'var(--text2)' }}>Blog</Link>
          <Link href="/events" style={{ color: 'var(--text2)' }}>Events</Link>
          <Link href="/" style={{ color: 'var(--text2)' }}>Argo</Link>
        </div>
        <SocialLinks marginTop={28} />
        <p style={{ marginTop: 24, fontSize: 13, color: 'var(--text3)', maxWidth: 640, lineHeight: 1.6 }}>
          Independent study notes. Not affiliated with Vitalik Buterin or the Ethereum Foundation.
          Clips are short excerpts for commentary and education; every post links to the full
          original talk.
        </p>
      </div>
    </footer>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main style={{ background: 'var(--bg)' }}>{children}</main>
      <ScholarFooter />
    </>
  )
}

function Header({ back, eyebrow, title, sub }: { back: { href: string; label: string }; eyebrow?: string; title: string; sub?: React.ReactNode }) {
  return (
    <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
      <div className="wrap" style={{ padding: '72px 0 48px', maxWidth: 820 }}>
        <Link href={back.href} className="eyebrow">{back.label}</Link>
        {eyebrow && <p style={{ marginTop: 18, fontSize: 13.5, color: 'var(--text3)', letterSpacing: '0.02em' }}>{eyebrow}</p>}
        <h1 className="serif" style={{ marginTop: 14, fontSize: 'clamp(32px,4.6vw,48px)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.08, color: 'var(--text)' }}>{title}</h1>
        {sub && <div style={{ marginTop: 16, fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 640 }}>{sub}</div>}
      </div>
    </section>
  )
}

export function ClipPlayer({ clip, youtubeId }: { clip: ScholarClip; youtubeId: string }) {
  return (
    <figure style={{ margin: 0 }}>
      <video
        controls
        preload="none"
        playsInline
        poster={clip.poster}
        src={clip.src}
        style={{ width: '100%', aspectRatio: '16 / 9', background: '#000', borderRadius: 'var(--r-card)', border: '1px solid var(--hairline)', display: 'block' }}
      />
      <figcaption style={{ marginTop: 10, fontSize: 14.5, lineHeight: 1.5, color: 'var(--text2)' }}>
        <strong style={{ color: 'var(--text)' }}>{clip.title}</strong>{' '}
        <a href={youtubeUrl(youtubeId, clip.start)} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accentDeep)', fontVariantNumeric: 'tabular-nums' }}>
          ({timestamp(clip.start)}–{timestamp(clip.end)})
        </a>
        <br />
        <span style={{ color: 'var(--text3)' }}>{clip.hook}</span>
      </figcaption>
    </figure>
  )
}

/* Plain text with `[label](url)` links rendered inline. */
function Rich({ text }: { text: string }) {
  const parts = text.split(/(\[[^\]]+\]\([^)\s]+\))/)
  return (
    <>
      {parts.map((part, i) => {
        const m = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/)
        return m ? <A key={i} href={m[2]}>{m[1]}</A> : part
      })}
    </>
  )
}

function Block({ block, post }: { block: ScholarBlock; post: ScholarPost }) {
  switch (block.type) {
    case 'h2':
      return <H2>{block.text}</H2>
    case 'p':
      return <P><Rich text={block.text} /></P>
    case 'pull':
      return <Pull>{block.text}</Pull>
    case 'figure':
      return <Figure src={block.src} alt={block.alt} width={block.width} height={block.height} caption={block.caption} />
    case 'clip': {
      const clip = post.clips[block.clip - 1]
      return clip ? <div style={{ margin: '30px 0' }}><ClipPlayer clip={clip} youtubeId={post.talk.youtubeId} /></div> : null
    }
  }
}

const KIND_LABEL: Record<ScholarTerm['kind'], string> = { term: 'Key terms', topic: 'Topics', idea: 'Ideas' }

function Terms({ terms }: { terms: ScholarTerm[] }) {
  return (
    <>
      {(['term', 'topic', 'idea'] as const).map((kind) => {
        const group = terms.filter((t) => t.kind === kind)
        if (!group.length) return null
        return (
          <div key={kind}>
            <h3 style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', margin: '30px 0 12px' }}>{KIND_LABEL[kind]}</h3>
            <dl style={{ display: 'flex', flexDirection: 'column', gap: 16, margin: 0 }}>
              {group.map((t) => (
                <div key={t.term}>
                  <dt style={{ fontWeight: 700, color: 'var(--text)' }}>{t.term}</dt>
                  <dd style={{ margin: '4px 0 0' }}>
                    {t.definition}
                    {t.links.length > 0 && (
                      <span style={{ display: 'block', marginTop: 4, fontSize: 15 }}>
                        {t.links.map((l, i) => (
                          <span key={l.href}>{i > 0 && ' · '}<A href={l.href}>{l.label}</A></span>
                        ))}
                      </span>
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        )
      })}
    </>
  )
}

export function ScholarPostView({ post }: { post: ScholarPost }) {
  const { talk } = post
  // Clips already embedded in the body aren't repeated in the Clips section.
  const inline = new Set(post.body.flatMap((b) => (b.type === 'clip' ? [b.clip - 1] : [])))
  const moreClips = post.clips.filter((_, i) => !inline.has(i))
  return (
    <Shell>
      <Header
        back={{ href: '/vitalik-scholar', label: '← Vitalik Scholar' }}
        eyebrow={`${talk.speaker} · ${talk.event} · ${talk.duration}`}
        title={post.title}
        sub={<p style={{ fontSize: 14.5, color: 'var(--text3)' }}>{post.date} · {post.readingTime}</p>}
      />
      <section className="wrap" style={{ padding: '44px 0 88px', maxWidth: 760 }}>
        <article style={{ fontSize: 17.5, lineHeight: 1.75, color: 'var(--text2)' }}>
          <div style={{ position: 'relative', aspectRatio: '16 / 9', borderRadius: 'var(--r-card)', overflow: 'hidden', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow)', background: '#000' }}>
            <iframe
              src={`https://www.youtube-nocookie.com/embed/${talk.youtubeId}`}
              title={talk.title}
              loading="lazy"
              allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
            />
          </div>
          <p style={{ marginTop: 12, fontSize: 14.5, color: 'var(--text3)' }}>
            Original talk: <A href={youtubeUrl(talk.youtubeId)}>{talk.title}</A> ({talk.event}, {talk.date})
          </p>

          <H2>In 100 words</H2>
          <P><Rich text={post.summary100} /></P>

          <H2>In 1,000 words</H2>
          {post.summary1000.map((para, i) => <P key={i}><Rich text={para} /></P>)}

          {post.body.map((block, i) => <Block key={i} block={block} post={post} />)}

          <H2>Timestamps</H2>
          <ol style={{ listStyle: 'none', padding: 0, margin: '0 0 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            {post.chapters.map((c) => (
              <li key={c.start} style={{ display: 'flex', gap: 14 }}>
                <a href={youtubeUrl(talk.youtubeId, c.start)} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0, minWidth: 52, color: 'var(--accentDeep)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
                  {timestamp(c.start)}
                </a>
                <span><strong style={{ color: 'var(--text)' }}>{c.title}.</strong> {c.note}</span>
              </li>
            ))}
          </ol>

          {moreClips.length > 0 && (
            <>
              <H2>{inline.size ? 'More clips' : 'Clips'}</H2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 30 }}>
                {moreClips.map((clip) => <ClipPlayer key={clip.src} clip={clip} youtubeId={talk.youtubeId} />)}
              </div>
            </>
          )}

          <H2>Key terms, topics and ideas</H2>
          <Terms terms={post.terms} />

          <H2>Further reading</H2>
          <ul style={{ margin: '0 0 18px', paddingLeft: 20 }}>
            {post.furtherReading.map((l) => <li key={l.href} style={{ marginBottom: 6 }}><A href={l.href}>{l.label}</A></li>)}
          </ul>
        </article>
      </section>
    </Shell>
  )
}

export function ScholarIndexView({ posts }: { posts: ScholarPost[] }) {
  const clips = posts.flatMap((p) => p.clips.map((clip) => ({ clip, post: p })))
  return (
    <Shell>
      <Header
        back={{ href: '/', label: '← Back to Argo' }}
        title="Vitalik Scholar"
        sub={
          <p>
            Study notes on Vitalik Buterin&apos;s talks and the ideas behind Ethereum. Each post
            links to the full original, summarises it in 100 and 1,000 words, and lists the key
            terms with somewhere to read further.
          </p>
        }
      />
      <section className="wrap" style={{ padding: '48px 0 40px', maxWidth: 820 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {posts.map((post) => (
            <Link key={post.slug} href={`/vitalik-scholar/${post.slug}`} className="card" style={{ display: 'block', padding: '30px 32px', textDecoration: 'none' }}>
              <p style={{ fontSize: 13.5, color: 'var(--text3)', marginBottom: 10 }}>
                {post.talk.event} · {post.talk.duration} talk · {post.readingTime}
              </p>
              <h2 className="serif" style={{ fontSize: 27, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.15, color: 'var(--text)', marginBottom: 10 }}>{post.title}</h2>
              <p style={{ fontSize: 16.5, lineHeight: 1.6, color: 'var(--text2)', marginBottom: 14 }}>{post.description}</p>
              <span className="eyebrow">Read →</span>
            </Link>
          ))}
        </div>
      </section>
      {clips.length > 0 && (
        <section className="wrap" style={{ padding: '8px 0 96px', maxWidth: 820 }}>
          <h2 className="serif" style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--text)', marginBottom: 22 }}>Clips</h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(100%, 360px), 1fr))', gap: 28 }}>
            {clips.map(({ clip, post }) => (
              <div key={clip.src}>
                <ClipPlayer clip={clip} youtubeId={post.talk.youtubeId} />
                <Link href={`/vitalik-scholar/${post.slug}`} style={{ display: 'inline-block', marginTop: 6, fontSize: 13.5, color: 'var(--text3)' }}>From: {post.title} →</Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </Shell>
  )
}
