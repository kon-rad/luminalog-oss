import type { Metadata } from 'next'
import Link from 'next/link'
import { BlogIndexLayout } from '@/components/blog'
import { posts } from '@/lib/blog-posts'

export const metadata: Metadata = {
  title: 'Writing — LuminaLog',
  description:
    'The LuminaLog blog: the science and practice of daily reflection — why putting your life into words changes how you think, feel, and grow.',
  openGraph: {
    title: 'Writing — LuminaLog',
    description:
      'The science and practice of daily reflection — why putting your life into words changes how you think, feel, and grow.',
  },
}

export default function BlogIndexPage() {
  const sorted = [...posts].sort((a, b) => (a.isoDate < b.isoDate ? 1 : -1))

  return (
    <BlogIndexLayout>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {sorted.map((post) => (
          <Link key={post.slug} href={`/blog/${post.slug}`} className="card" style={{ display: 'block', padding: '30px 32px', textDecoration: 'none' }}>
            <p style={{ fontSize: 13.5, color: 'var(--text3)', marginBottom: 10 }}>
              {post.date} · {post.readingTime}
            </p>
            <h2 className="serif" style={{ fontSize: 27, fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.15, color: 'var(--text)', marginBottom: 10 }}>
              {post.title}
            </h2>
            <p style={{ fontSize: 16.5, lineHeight: 1.6, color: 'var(--text2)', marginBottom: 14 }}>
              {post.description}
            </p>
            <span className="eyebrow">Read →</span>
          </Link>
        ))}
      </div>
    </BlogIndexLayout>
  )
}
