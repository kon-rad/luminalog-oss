import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BlogIndexLayout } from '@/components/blog'
import { ArticleList, CategoryNav, sortedPosts } from '@/components/ArticleList'
import { categoryOf, posts } from '@/lib/blog-posts'
import { CATEGORIES, CATEGORY_META, isCategory } from '@/lib/categories'

export const dynamicParams = false

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category }))
}

export function generateMetadata({ params }: { params: { category: string } }): Metadata {
  const { category } = params
  if (!isCategory(category)) return {}
  const { label, subline } = CATEGORY_META[category]
  return {
    title: `${label}, Argo articles`,
    description: subline,
    openGraph: { title: `${label}, Argo articles`, description: subline },
  }
}

export default function ArticleCategoryPage({ params }: { params: { category: string } }) {
  const { category } = params
  if (!isCategory(category)) notFound()
  const { label, subline } = CATEGORY_META[category]
  const list = sortedPosts(posts.filter((p) => categoryOf(p) === category))
  return (
    <BlogIndexLayout title={label} subline={subline} back={{ href: '/articles', label: '← All articles' }}>
      <CategoryNav active={category} />
      <ArticleList list={list} showCategory={false} emptyLabel={label} />
    </BlogIndexLayout>
  )
}
