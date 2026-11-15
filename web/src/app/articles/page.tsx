import type { Metadata } from 'next'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { sortedPosts } from '@/components/ArticleList'
import { MagazineFront } from '@/components/MagazineFront'
import { ARTICLES_SUBLINE } from '@/lib/categories'

/* The cover photograph behind the nameplate. Without the file the masthead is plain ink. */
const MASTHEAD_IMAGE = '/blog/argo-articles-masthead.jpg'

export const metadata: Metadata = {
  title: 'Articles, Argo',
  description: ARTICLES_SUBLINE,
  openGraph: { title: 'Articles, Argo', description: ARTICLES_SUBLINE, images: [MASTHEAD_IMAGE] },
}

export default function ArticlesPage() {
  const mastheadImage = existsSync(join(process.cwd(), 'public', MASTHEAD_IMAGE)) ? MASTHEAD_IMAGE : undefined
  return <MagazineFront sorted={sortedPosts()} mastheadImage={mastheadImage} />
}
