import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BlogPostLayout } from '@/components/blog'
import { posts } from '@/lib/blog-posts'
import { findPost } from '@/lib/blog-feed'

/* Authored posts build statically; feed posts render on first request and refresh each minute. */
export const revalidate = 60

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }))
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await findPost(params.slug)
  if (!post) return { title: 'Not found, Argo' }
  return {
    title: `${post.title}, Argo`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
    },
  }
}

export default async function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = await findPost(params.slug)
  if (!post) notFound()

  const { Content } = post
  return (
    <BlogPostLayout title={post.title} date={post.date} readingTime={post.readingTime}>
      <Content />
    </BlogPostLayout>
  )
}
