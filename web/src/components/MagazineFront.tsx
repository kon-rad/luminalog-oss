import Image from 'next/image'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { BlogFooter } from '@/components/blog'
import { ArticleList, CategoryNav } from '@/components/ArticleList'
import { categoryOf, imageOf, type BlogPost } from '@/lib/blog-posts'
import { deskRows, desks, isoWeek, ten, type Desk } from '@/lib/articles'
import { ARTICLES_SUBLINE, CATEGORY_META } from '@/lib/categories'

/* The /articles front page as a magazine: an ink nameplate with a dateline, The Ten (the ten newest
 * stories: a cover story, three runners-up, six on an ink band), then one desk per populated
 * category. Category pages keep ArticlesLayout. Styles: globals.css, "Magazine front".
 * Design: the vault note Areas/argo/media/articles-page-design.md, revision 2026-11-15. */

const href = (post: BlogPost) => `/blog/${post.slug}`

function When({ post }: { post: BlogPost }) {
  return (
    <span className="mag-meta">
      <time dateTime={post.isoDate}>{post.date}</time> · {post.readingTime}
    </span>
  )
}

/* The rank is real text for screen readers ("Number 4") and a large numeral for the eye. */
function Rank({ n, className = '' }: { n: number; className?: string }) {
  return (
    <span className={`serif mag-num ${className}`}>
      <span className="mag-sr">Number </span>{n}
    </span>
  )
}

function Masthead({ image, sorted, deskCount }: { image?: string; sorted: BlogPost[]; deskCount: number }) {
  const newest = sorted[0]
  const issue = newest ? isoWeek(newest.isoDate) : undefined
  return (
    <header className="mag-masthead">
      {image && <Image src={image} alt="" fill priority sizes="100vw" className="mag-masthead-media" />}
      <div className="wrap mag-masthead-inner">
        <p className="mag-masthead-eyebrow">Argo</p>
        <h1 className="serif mag-nameplate">Articles</h1>
        <p className="mag-masthead-subline">{ARTICLES_SUBLINE}</p>
        {newest && issue && (
          <p className="mag-dateline">
            <span>Week {issue.week}, {issue.year}</span>
            <span className="mag-dateline-mid">{sorted.length} articles on {deskCount} desks</span>
            <span>Latest <time dateTime={newest.isoDate}>{newest.date}</time></span>
          </p>
        )}
      </div>
    </header>
  )
}

function CoverStory({ post }: { post: BlogPost }) {
  return (
    <Link href={href(post)} className="mag-cover mag-link">
      <span className="mag-media mag-cover-media">
        <Image src={imageOf(post)} alt="" fill priority sizes="(max-width: 1000px) 100vw, 640px" />
      </span>
      <span className="mag-cover-text">
        <Rank n={1} className="mag-num-cover" />
        <span className="mag-kicker">Cover story · {CATEGORY_META[categoryOf(post)].label}</span>
        <h3 className="serif mag-cover-title mag-title">{post.title}</h3>
        <span className="mag-cover-desc">{post.description}</span>
        <When post={post} />
      </span>
    </Link>
  )
}

function RunnerUp({ post, rank }: { post: BlogPost; rank: number }) {
  return (
    <Link href={href(post)} className="mag-runner mag-link">
      <span className="mag-media mag-runner-media">
        <Image src={imageOf(post)} alt="" fill sizes="(max-width: 640px) 100vw, (max-width: 1000px) 50vw, 340px" />
      </span>
      <span className="mag-runner-text">
        <Rank n={rank} />
        <span className="mag-runner-body">
          <span className="mag-kicker">{CATEGORY_META[categoryOf(post)].label}</span>
          <h3 className="serif mag-runner-title mag-title">{post.title}</h3>
          <When post={post} />
        </span>
      </span>
    </Link>
  )
}

function BandItem({ post, rank }: { post: BlogPost; rank: number }) {
  return (
    <Link href={href(post)} className="mag-band-item mag-link">
      <Rank n={rank} className="mag-num-band" />
      <span className="mag-band-body">
        <span className="mag-kicker">{CATEGORY_META[categoryOf(post)].label}</span>
        <h3 className="serif mag-band-title mag-title">{post.title}</h3>
        <When post={post} />
      </span>
      <span className="mag-media mag-band-media">
        <Image src={imageOf(post)} alt="" fill sizes="96px" />
      </span>
    </Link>
  )
}

/* A desk's first story: image above, large title, the description. */
function DeskFeature({ post, wide = false }: { post: BlogPost; wide?: boolean }) {
  return (
    <Link href={href(post)} className={`mag-feature mag-link${wide ? ' mag-feature-wide' : ''}`}>
      <span className="mag-media mag-feature-media">
        <Image src={imageOf(post)} alt="" fill sizes="(max-width: 1000px) 100vw, 620px" />
      </span>
      <span className="mag-feature-text">
        <h3 className="serif mag-feature-title mag-title">{post.title}</h3>
        <span className="mag-feature-desc">{post.description}</span>
        <When post={post} />
      </span>
    </Link>
  )
}

/* The desk's other stories: a thumbnail beside the title. */
function DeskRow({ post }: { post: BlogPost }) {
  return (
    <Link href={href(post)} className="mag-row mag-link">
      <span className="mag-media mag-row-media">
        <Image src={imageOf(post)} alt="" fill sizes="148px" />
      </span>
      <span className="mag-row-text">
        <h3 className="serif mag-row-title mag-title">{post.title}</h3>
        <When post={post} />
      </span>
    </Link>
  )
}

function DeskSection({ desk, flipped, half }: { desk: Desk; flipped: boolean; half: boolean }) {
  const { label, subline } = CATEGORY_META[desk.category]
  const [first, ...others] = desk.posts
  const count = `${desk.total} ${desk.total === 1 ? 'article' : 'articles'}`
  return (
    <section aria-labelledby={`desk-${desk.category}`} className="mag-desk">
      <div className="mag-desk-head">
        <div>
          <h2 id={`desk-${desk.category}`} className="serif mag-desk-title">{label}</h2>
          <p className="mag-desk-deck">{subline}</p>
        </div>
        <Link href={`/articles/${desk.category}`} aria-label={`All ${count} in ${label}`} className="mag-desk-link">
          {desk.total === 1 ? 'Open the desk' : `All ${count}`} <span aria-hidden>→</span>
        </Link>
      </div>
      {others.length === 0 && <DeskFeature post={first} wide={!half} />}
      {others.length === 1 && (
        <div className="mag-desk-pair">
          <DeskFeature post={first} />
          <DeskFeature post={others[0]} />
        </div>
      )}
      {others.length > 1 && (
        <div className={`mag-desk-grid${flipped ? ' mag-desk-flipped' : ''}`}>
          <DeskFeature post={first} />
          <div className="mag-rows">
            {others.map((post) => <DeskRow key={post.slug} post={post} />)}
          </div>
        </div>
      )}
    </section>
  )
}

export function MagazineFront({ sorted, mastheadImage }: { sorted: BlogPost[]; mastheadImage?: string }) {
  const featured = ten(sorted)
  const shelves = desks(sorted, featured)
  let fullDesks = 0
  return (
    <>
      <Navbar />
      <main className="mag">
        <Masthead image={mastheadImage} sorted={sorted} deskCount={shelves.length} />
        <div className="wrap mag-chips"><CategoryNav /></div>
        {sorted.length === 0 ? (
          <div className="wrap mag-empty"><ArticleList list={[]} showCategory={false} /></div>
        ) : (
          <>
            <section aria-labelledby="the-ten" className="mag-ten">
              <div className="wrap">
                <div className="mag-section-head">
                  <h2 id="the-ten" className="serif mag-section-title">The Ten</h2>
                  <p className="mag-section-deck">The ten newest stories, newest first.</p>
                </div>
                <CoverStory post={featured[0]} />
                {featured.length > 1 && (
                  <div className="mag-runners">
                    {featured.slice(1, 4).map((post, i) => <RunnerUp key={post.slug} post={post} rank={i + 2} />)}
                  </div>
                )}
              </div>
              {featured.length > 4 && (
                <div className="mag-band">
                  <div className="wrap mag-band-grid">
                    {featured.slice(4).map((post, i) => <BandItem key={post.slug} post={post} rank={i + 5} />)}
                  </div>
                </div>
              )}
            </section>
            <div className="wrap mag-desks">
              {deskRows(shelves).map((row) => (
                <div key={row[0].category} className={row.length === 2 ? 'mag-desk-halves' : undefined}>
                  {row.map((desk) => (
                    <DeskSection
                      key={desk.category}
                      desk={desk}
                      half={row.length === 2}
                      flipped={desk.posts.length > 2 && fullDesks++ % 2 === 1}
                    />
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </main>
      <BlogFooter />
    </>
  )
}
