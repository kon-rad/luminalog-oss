import Image from 'next/image'
import Link from 'next/link'
import { ArticleCard, ArticleList, LeadCard, SecondaryCard } from '@/components/ArticleList'
import { imageOf, type BlogPost } from '@/lib/blog-posts'
import { desks, ten } from '@/lib/articles'
import { CATEGORY_META } from '@/lib/categories'

function TenItem({ post, rank }: { post: BlogPost; rank: number }) {
  return (
    <Link href={`/blog/${post.slug}`} className="ten-item">
      <span className="ten-item-media">
        <Image src={imageOf(post)} alt="" fill sizes="112px" />
      </span>
      <span className="ten-item-body">
        <span className="ten-rank">No. {rank}</span>
        <h3 className="serif ten-title">{post.title}</h3>
        <span className="news-meta"><time dateTime={post.isoDate}>{post.date}</time> · {post.readingTime}</span>
      </span>
    </Link>
  )
}

function DeskSingle({ post }: { post: BlogPost }) {
  return (
    <Link href={`/blog/${post.slug}`} className="card desk-single">
      <span className="desk-single-media">
        <Image src={imageOf(post)} alt="" fill sizes="(max-width: 640px) 100vw, 220px" />
      </span>
      <span className="desk-single-body">
        <span className="news-meta"><time dateTime={post.isoDate}>{post.date}</time> · {post.readingTime}</span>
        <h3 className="serif news-card-title">{post.title}</h3>
        <span className="news-card-desc">{post.description}</span>
      </span>
    </Link>
  )
}

export function MagazineFront({ sorted }: { sorted: BlogPost[] }) {
  if (sorted.length === 0) return <ArticleList list={[]} showCategory={false} />

  const featured = ten(sorted)
  const shelves = desks(sorted, featured)
  return (
    <>
      <section aria-labelledby="the-ten-title">
        <h2 id="the-ten-title" className="eyebrow ten-heading">The Ten</h2>
        <div className={`news-top${featured.length === 1 ? ' news-top-solo' : ''}`}>
          <LeadCard post={featured[0]} showCategory={false} rank={1} />
          {featured.length > 1 && (
            <div className={`news-side${featured.length === 2 ? ' news-side-solo' : ''}`}>
              {featured.slice(1, 3).map((post, index) =>
                <SecondaryCard key={post.slug} post={post} showCategory={false} rank={index + 2} />)}
            </div>
          )}
        </div>
        {featured.length > 3 && (
          <div className="ten-list">
            {featured.slice(3).map((post, index) => <TenItem key={post.slug} post={post} rank={index + 4} />)}
          </div>
        )}
      </section>
      <div className="desks">
        {shelves.map(({ category, posts }) => {
          const label = CATEGORY_META[category].label
          return (
            <section key={category} aria-labelledby={`desk-${category}`}>
              <div className="desk-head">
                <h2 id={`desk-${category}`} className="serif desk-title">{label}</h2>
                <Link href={`/articles/${category}`} aria-label={`View all ${label} articles`} className="desk-link">
                  View all {label} →
                </Link>
              </div>
              {posts.length === 1
                ? <DeskSingle post={posts[0]} />
                : <div className="news-grid">{posts.map((post) =>
                    <ArticleCard key={post.slug} post={post} showCategory={false} magazine />)}</div>}
            </section>
          )
        })}
      </div>
    </>
  )
}
