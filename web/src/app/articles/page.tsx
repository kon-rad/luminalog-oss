import type { Metadata } from 'next'
import { BlogIndexLayout } from '@/components/blog'
import { ArticleList, CategoryNav, sortedPosts } from '@/components/ArticleList'
import { ARTICLES_SUBLINE } from '@/lib/categories'

export const metadata: Metadata = {
  title: 'Articles, Argo',
  description: ARTICLES_SUBLINE,
  openGraph: { title: 'Articles, Argo', description: ARTICLES_SUBLINE },
}

export default function ArticlesPage() {
  return (
    <BlogIndexLayout title="Articles" subline={ARTICLES_SUBLINE}>
      <CategoryNav />
      <ArticleList list={sortedPosts()} showCategory />
    </BlogIndexLayout>
  )
}
