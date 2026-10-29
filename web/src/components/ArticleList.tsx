import Link from 'next/link'
import { categoryOf, posts, type BlogPost } from '@/lib/blog-posts'
import { CATEGORIES, CATEGORY_META, type Category } from '@/lib/categories'
import { ActiveChipScroll } from '@/components/ActiveChipScroll'

/* Shared by /articles and /articles/[category]: the filter row and the card list. */

export function sortedPosts(list: BlogPost[] = posts): BlogPost[] {
  return [...list].sort((a, b) => (a.isoDate < b.isoDate ? 1 : -1))
}

export function CategoryNav({ active }: { active?: Category }) {
  const counts = new Map<Category, number>()
  for (const p of posts) counts.set(categoryOf(p), (counts.get(categoryOf(p)) ?? 0) + 1)
  const visible = CATEGORIES.filter((c) => c === active || (counts.get(c) ?? 0) > 0)
  return (
    <nav aria-label="Article categories" className="chip-row">
      <Link href="/articles" className="chip" aria-current={active ? undefined : 'page'}>All</Link>
      {visible.map((c) => (
        <Link key={c} href={`/articles/${c}`} className="chip" aria-current={c === active ? 'page' : undefined}>
          {CATEGORY_META[c].label}
        </Link>
      ))}
      <ActiveChipScroll />
    </nav>
  )
}

export function ArticleCard({ post, showCategory }: { post: BlogPost; showCategory: boolean }) {
  return (
    <Link href={`/blog/${post.slug}`} className="card article-card" style={{ display: 'block', textDecoration: 'none' }}>
      {showCategory && <p className="eyebrow" style={{ marginBottom: 12 }}>{CATEGORY_META[categoryOf(post)].label}</p>}
      <h2 className="serif article-card-title" style={{ fontWeight: 600, letterSpacing: '-0.025em', lineHeight: 1.15, color: 'var(--text)', marginBottom: 10 }}>
        {post.title}
      </h2>
      <p className="article-card-desc" style={{ lineHeight: 1.6, color: 'var(--text2)', marginBottom: 14 }}>
        {post.description}
      </p>
      <p style={{ fontSize: 13.5, color: 'var(--text3)' }}>
        <time dateTime={post.isoDate}>{post.date}</time> · {post.readingTime}
      </p>
    </Link>
  )
}

export function ArticleList({ list, showCategory, emptyLabel }: { list: BlogPost[]; showCategory: boolean; emptyLabel?: string }) {
  if (list.length === 0) {
    return (
      <div className="article-empty" style={{ border: '1px dashed var(--hairline2)', borderRadius: 'var(--r-card)', textAlign: 'center' }}>
        <p className="serif" style={{ fontSize: 22, fontWeight: 600, color: 'var(--text)' }}>
          {emptyLabel ? `Nothing in ${emptyLabel} yet.` : 'No articles yet.'}
        </p>
        {emptyLabel && (
          <>
            <p style={{ fontSize: 15.5, color: 'var(--text2)', margin: '10px auto 22px', maxWidth: 420 }}>
              The first one is on its way. Until then, here&apos;s everything else we&apos;ve written.
            </p>
            <Link href="/articles" className="btn-ghost">All articles</Link>
          </>
        )}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {list.map((post) => <ArticleCard key={post.slug} post={post} showCategory={showCategory} />)}
    </div>
  )
}
