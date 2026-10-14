import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { BlogPostLayout } from '@/components/blog'
import { posts, getPost } from '@/lib/blog-posts'
import { postMarkdown } from '@/lib/blog-markdown'

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getPost(params.slug)
  if (!post) return { title: 'Not found, Argo' }
  return {
    title: `${post.title}, Argo`,
    description: post.description,
    openGraph: {
      title: post.title,
      description: post.description,
      type: 'article',
    },
    // Agents that look for an alternate format find the markdown version.
    alternates: { types: { 'text/markdown': `/blog/${post.slug}.md` } },
  }
}

export default function BlogPostPage({ params }: { params: { slug: string } }) {
  const post = getPost(params.slug)
  if (!post) notFound()

  const { Content } = post
  return (
    <BlogPostLayout
      title={post.title}
      date={post.date}
      readingTime={post.readingTime}
      agent={{ markdown: postMarkdown(post), markdownUrl: `/blog/${post.slug}.md` }}
    >
      <Content />
    </BlogPostLayout>
  )
}
