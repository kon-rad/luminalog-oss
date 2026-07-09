import Link from 'next/link'
import Image from 'next/image'
import Navbar from '@/components/Navbar'

/* ──────────────────────────────────────────────────────────────────────────
 * Shared presentational helpers for the blog (/blog and /blog/[slug]).
 * Mirrors the visual language of the legal pages (see components/legal.tsx):
 * warm paper background, Newsreader serif headings, hairline rules, amber
 * accent. Post content is authored as React components in lib/blog-posts.tsx,
 * matching the existing PrivacyContent / TermsContent pattern (no MDX/CMS).
 * ────────────────────────────────────────────────────────────────────────── */

/* Shared footer, identical in spirit to the legal footer. */
function BlogFooter() {
  return (
    <footer style={{ background: 'var(--bg)', borderTop: '1px solid var(--hairline)', padding: '40px 0 56px' }}>
      <div className="wrap">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <Link href="/" className="inline-flex items-center gap-2.5 serif" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>
            <span style={{ width: 28, height: 28, borderRadius: 9, overflow: 'hidden', boxShadow: '0 2px 10px rgba(185,107,51,0.4)', flexShrink: 0, display: 'block' }}>
              <Image src="/logo.svg" width={28} height={28} alt="" />
            </span>
            LuminaLog
          </Link>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', fontSize: 14 }}>
            <Link href="/blog" style={{ color: 'var(--text2)' }}>Blog</Link>
            <Link href="/privacy" style={{ color: 'var(--text2)' }}>Privacy Policy</Link>
            <Link href="/terms" style={{ color: 'var(--text2)' }}>Terms</Link>
            <a href="https://x.com/konrad_gnat" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text2)' }}>Send me a tweet</a>
            <a href="mailto:konradmgnat@gmail.com" style={{ color: 'var(--text2)' }}>Support</a>
          </div>
        </div>
        <p style={{ marginTop: 28, fontSize: 13, color: 'var(--text3)' }}>
          © 2026 LuminaLog · Built by{' '}
          <a href="https://x.com/konrad_gnat" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accentDeep)', fontWeight: 600 }}>Konrad Gnat</a>
        </p>
      </div>
    </footer>
  )
}

/* Wrapper for a single blog post. */
export function BlogPostLayout({
  title,
  date,
  readingTime,
  children,
}: {
  title: string
  date: string
  readingTime: string
  children: React.ReactNode
}) {
  return (
    <>
      <Navbar />
      <main style={{ background: 'var(--bg)' }}>
        {/* Header */}
        <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
          <div className="wrap" style={{ padding: '72px 0 48px', maxWidth: 760 }}>
            <Link href="/blog" className="eyebrow" style={{ marginBottom: 18 }}>← All writing</Link>
            <h1 className="serif" style={{ marginTop: 14, fontSize: 'clamp(32px,4.6vw,48px)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.08, color: 'var(--text)' }}>{title}</h1>
            <p style={{ marginTop: 18, fontSize: 14.5, color: 'var(--text3)' }}>{date} · {readingTime}</p>
          </div>
        </section>

        {/* Body */}
        <section className="wrap" style={{ padding: '52px 0 88px', maxWidth: 760 }}>
          <article style={{ fontSize: 17.5, lineHeight: 1.75, color: 'var(--text2)' }}>
            {children}
          </article>

          {/* App CTA */}
          <div style={{ marginTop: 56, padding: '32px 32px', background: 'var(--surface)', border: '1px solid var(--hairline)', borderRadius: 'var(--r-card)', boxShadow: 'var(--shadow)' }}>
            <h3 className="serif" style={{ fontSize: 22, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)', marginBottom: 8 }}>
              Start your 750 words today
            </h3>
            <p style={{ fontSize: 16, color: 'var(--text2)', marginBottom: 20 }}>
              LuminaLog turns a daily entry — typed, spoken, or filmed — into clarity you can
              actually see. Private, encrypted, and built entirely from your own life.
            </p>
            <Link href="/#waitlist" className="btn-amber">Join the waitlist</Link>
          </div>
        </section>
      </main>
      <BlogFooter />
    </>
  )
}

/* Wrapper for the blog index. */
export function BlogIndexLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main style={{ background: 'var(--bg)' }}>
        <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
          <div className="wrap" style={{ padding: '72px 0 48px', maxWidth: 820 }}>
            <Link href="/" className="eyebrow" style={{ marginBottom: 18 }}>← Back to LuminaLog</Link>
            <h1 className="serif" style={{ marginTop: 14, fontSize: 'clamp(34px,5vw,52px)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.05, color: 'var(--text)' }}>Writing</h1>
            <p style={{ marginTop: 14, fontSize: 17, color: 'var(--text2)', maxWidth: 560 }}>
              On the science and practice of daily reflection — why putting your life into
              words changes how you think, feel, and grow.
            </p>
          </div>
        </section>
        <section className="wrap" style={{ padding: '48px 0 96px', maxWidth: 820 }}>
          {children}
        </section>
      </main>
      <BlogFooter />
    </>
  )
}

/* ── Typographic primitives (shared by post content) ── */
export function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="serif" style={{ fontSize: 26, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)', marginTop: 46, marginBottom: 14, lineHeight: 1.2 }}>
      {children}
    </h2>
  )
}
export function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginTop: 28, marginBottom: 8 }}>
      {children}
    </h3>
  )
}
export function P({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <p style={{ marginBottom: 18, ...style }}>{children}</p>
}
export function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul style={{ margin: '0 0 18px', paddingLeft: 0, display: 'flex', flexDirection: 'column', gap: 11 }}>
      {items.map((it, i) => (
        <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ flexShrink: 0, marginTop: 10, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  )
}
export function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accentDeep)', fontWeight: 600, textDecoration: 'underline', textUnderlineOffset: 3, textDecorationColor: 'var(--accentSoft)' }}>
      {children}
    </a>
  )
}
export function Pull({ children }: { children: React.ReactNode }) {
  return (
    <blockquote className="serif" style={{ margin: '32px 0', paddingLeft: 22, borderLeft: '3px solid var(--accent)', fontSize: 23, lineHeight: 1.4, fontWeight: 500, color: 'var(--text)', fontStyle: 'italic' }}>
      {children}
    </blockquote>
  )
}
export function Note({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ margin: '26px 0', padding: '18px 22px', background: 'var(--accentTint)', borderRadius: 16, fontSize: 15.5, lineHeight: 1.65, color: 'var(--text2)' }}>
      {children}
    </div>
  )
}

/* Full-width figure with optional caption. `priority` for the lead/hero image. */
export function Figure({
  src,
  alt,
  width,
  height,
  caption,
  priority = false,
}: {
  src: string
  alt: string
  width: number
  height: number
  caption?: React.ReactNode
  priority?: boolean
}) {
  return (
    <figure style={{ margin: '34px 0' }}>
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        priority={priority}
        sizes="(max-width: 800px) 100vw, 760px"
        style={{ width: '100%', height: 'auto', borderRadius: 'var(--r-card)', border: '1px solid var(--hairline)', boxShadow: 'var(--shadow)', display: 'block' }}
      />
      {caption && (
        <figcaption style={{ marginTop: 12, fontSize: 13.5, lineHeight: 1.55, color: 'var(--text3)', textAlign: 'center', fontStyle: 'italic' }}>
          {caption}
        </figcaption>
      )}
    </figure>
  )
}
