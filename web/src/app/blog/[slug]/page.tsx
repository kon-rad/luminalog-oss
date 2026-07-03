import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BlogPostLayout } from '@/components/blog'
import { posts, getPost } from '@/lib/blog-posts'

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getPost(params.slug)
  if (!post) return { title: 'Not found — LuminaLog' }
  return {
    title: `${post.title} — LuminaLog`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
    },
  }
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug)
  if (!post) notFound()

  const { Content } = post
  return (
    <BlogPostLayout title={post.title} date={post.date} readingTime={post.readingTime}>
      <Content />
    </BlogPostLayout>
  )
}
