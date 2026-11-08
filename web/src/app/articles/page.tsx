import type { Metadata } from 'next'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { ArticlesLayout, CategoryNav, sortedPosts } from '@/components/ArticleList'
import { MagazineFront } from '@/components/MagazineFront'
import { DEFAULT_IMAGE } from '@/lib/blog-posts'
import { ARTICLES_SUBLINE } from '@/lib/categories'

export const metadata: Metadata = {
  title: 'Articles, Argo',
  description: ARTICLES_SUBLINE,
  openGraph: { title: 'Articles, Argo', description: ARTICLES_SUBLINE },
}

export default function ArticlesPage() {
  const mastheadImage = ['/blog/argo-articles-masthead.jpg', DEFAULT_IMAGE]
    .find((image) => existsSync(join(process.cwd(), 'public', image)))
  return (
    <ArticlesLayout title="Articles" subline={ARTICLES_SUBLINE} mastheadImage={mastheadImage}>
      <CategoryNav />
      <MagazineFront sorted={sortedPosts()} />
    </ArticlesLayout>
  )
}
