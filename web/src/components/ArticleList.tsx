import Link from 'next/link'
import Image from 'next/image'
import Navbar from '@/components/Navbar'
import { BlogFooter } from '@/components/blog'
import { ActiveChipScroll } from '@/components/ActiveChipScroll'
import { categoryOf, imageOf, posts, type BlogPost } from '@/lib/blog-posts'
import { front } from '@/lib/articles'
import { CATEGORIES, CATEGORY_META, type Category } from '@/lib/categories'

/* Shared by /articles and /articles/[category]: the masthead, the filter row and the news front.
 * Styles live in globals.css under "News front". */

export function sortedPosts(list: BlogPost[] = posts): BlogPost[] {
  return [...list].sort((a, b) => (a.isoDate < b.isoDate ? 1 : -1))
}

/* Full-width page shell: masthead on the alt surface, then the front on paper. */
export function ArticlesLayout({ title, subline, children, mastheadImage }: { title: string; subline: string; children: React.ReactNode; mastheadImage?: string }) {
  return (
    <>
      <Navbar />
      <main style={{ background: 'var(--bg)' }}>
        <section className={`news-masthead${mastheadImage ? ' news-masthead-image' : ''}`}>
          {mastheadImage && <Image src={mastheadImage} alt="" fill priority sizes="100vw" className="news-masthead-media" />}
          <div className="wrap">
            <p className="eyebrow">Argo</p>
            <h1 className="serif news-masthead-title">{title}</h1>
            <p className="news-masthead-subline">{subline}</p>
          </div>
        </section>
        <section className="wrap news-body">{children}</section>
      </main>
      <BlogFooter />
    </>
  )
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

function Meta({ post, showCategory }: { post: BlogPost; showCategory: boolean }) {
  return (
    <p className="news-meta">
      {showCategory && <span className="news-meta-category">{CATEGORY_META[categoryOf(post)].label}</span>}
      <span className="news-meta-when">
        <time dateTime={post.isoDate}>{post.date}</time> · {post.readingTime}
      </span>
    </p>
  )
}

/* The lead story: full-bleed image with the title set over its lower edge. */
export function LeadCard({ post, showCategory, rank }: { post: BlogPost; showCategory: boolean; rank?: number }) {
  return (
    <Link href={`/blog/${post.slug}`} className="news-lead">
      <div className="news-lead-media">
        <Image src={imageOf(post)} alt="" fill priority sizes="(max-width: 900px) 100vw, 760px" style={{ objectFit: 'cover' }} />
      </div>
      <div className="news-lead-text">
        {rank && <span className="ten-rank ten-rank-overlay">No. {rank}</span>}
        <Meta post={post} showCategory={showCategory} />
        {rank ? <h3 className="serif news-lead-title">{post.title}</h3> : <h2 className="serif news-lead-title">{post.title}</h2>}
        <p className="news-lead-desc">{post.description}</p>
      </div>
    </Link>
  )
}

/* The two stories beside the lead: a small landscape image above the title. */
export function SecondaryCard({ post, showCategory, rank }: { post: BlogPost; showCategory: boolean; rank?: number }) {
  return (
    <Link href={`/blog/${post.slug}`} className="news-secondary">
      <div className="news-media news-media-secondary">
        <Image src={imageOf(post)} alt="" fill sizes="(max-width: 900px) 100vw, 340px" style={{ objectFit: 'cover' }} />
      </div>
      {rank && <span className="ten-rank">No. {rank}</span>}
      <Meta post={post} showCategory={showCategory} />
      {rank ? <h3 className="serif news-secondary-title">{post.title}</h3> : <h2 className="serif news-secondary-title">{post.title}</h2>}
    </Link>
  )
}

/* Everything else: a three-up grid of image cards. */
export function ArticleCard({ post, showCategory, magazine = false }: { post: BlogPost; showCategory: boolean; magazine?: boolean }) {
  return (
    <Link href={`/blog/${post.slug}`} className="card news-card">
      <div className="news-media news-media-card">
        <Image src={imageOf(post)} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 340px" style={{ objectFit: 'cover' }} />
      </div>
      <div className="news-card-body">
        <Meta post={post} showCategory={showCategory} />
        {magazine ? <h3 className="serif news-card-title">{post.title}</h3> : <h2 className="serif news-card-title">{post.title}</h2>}
        <p className="news-card-desc">{post.description}</p>
      </div>
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
  const { lead, secondary, rest } = front(list)
  return (
    <>
      {lead && (
        <div className="news-top">
          <LeadCard post={lead} showCategory={showCategory} />
          {secondary.length > 0 && (
            <div className="news-side">
              {secondary.map((post) => <SecondaryCard key={post.slug} post={post} showCategory={showCategory} />)}
            </div>
          )}
        </div>
      )}
      {rest.length > 0 && (
        <>
          <p className="eyebrow news-rule">More articles</p>
          <div className="news-grid">
            {rest.map((post) => <ArticleCard key={post.slug} post={post} showCategory={showCategory} />)}
          </div>
        </>
      )}
    </>
  )
}
