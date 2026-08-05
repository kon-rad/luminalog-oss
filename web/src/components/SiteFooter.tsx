import Link from 'next/link'
import Image from 'next/image'

/* The footer shared by the public marketing pages (/events, /courses).
 * Same visual language as the blog and legal footers. */
export default function SiteFooter() {
  return (
    <footer style={{ background: 'var(--bg)', borderTop: '1px solid var(--hairline)', padding: '40px 0 56px' }}>
      <div className="wrap">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
          <Link href="/" className="inline-flex items-center gap-2.5 serif" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>
            <span style={{ width: 28, height: 28, borderRadius: 9, overflow: 'hidden', boxShadow: '0 2px 10px rgba(185,107,51,0.4)', flexShrink: 0, display: 'block' }}>
              <Image src="/logo.png" width={28} height={28} alt="" />
            </span>
            Argo
          </Link>
          <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', fontSize: 14 }}>
            <Link href="/courses" style={{ color: 'var(--text2)' }}>Courses</Link>
            <Link href="/events" style={{ color: 'var(--text2)' }}>Events</Link>
            <Link href="/blog" style={{ color: 'var(--text2)' }}>Blog</Link>
            <Link href="/privacy" style={{ color: 'var(--text2)' }}>Privacy Policy</Link>
            <Link href="/terms" style={{ color: 'var(--text2)' }}>Terms</Link>
            <a href="mailto:konradmgnat@gmail.com" style={{ color: 'var(--text2)' }}>Support</a>
          </div>
        </div>
        <p style={{ marginTop: 28, fontSize: 13, color: 'var(--text3)' }}>
          © 2026 Argo · Built by{' '}
          <a href="https://x.com/konrad_gnat" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accentDeep)', fontWeight: 600 }}>Konrad Gnat</a>
        </p>
      </div>
    </footer>
  )
}
