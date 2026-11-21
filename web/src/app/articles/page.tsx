import type { Metadata } from 'next'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { sortedPosts } from '@/components/ArticleList'
import { MagazineFront } from '@/components/MagazineFront'
import { ARTICLES_SUBLINE } from '@/lib/categories'

/* The cover photograph behind the nameplate. Without the file the masthead is plain ink. */
const MASTHEAD_IMAGE = '/blog/argo-articles-masthead.jpg'

// Blog posts are added by a separate publish/deploy flow. A persisted static
// route cache can otherwise serve an older front after the registry is rebuilt.
export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Articles, Argo',
  description: ARTICLES_SUBLINE,
  openGraph: { title: 'Articles, Argo', description: ARTICLES_SUBLINE, images: [MASTHEAD_IMAGE] },
}

export default function ArticlesPage() {
  const mastheadImage = existsSync(join(process.cwd(), 'public', MASTHEAD_IMAGE)) ? MASTHEAD_IMAGE : undefined
  return <MagazineFront sorted={sortedPosts()} mastheadImage={mastheadImage} />
}
