import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { ScholarPostView } from '@/components/vitalik-scholar'
import { scholarPosts, getScholarPost } from '@/lib/vitalik-scholar'

export function generateStaticParams() {
  return scholarPosts.map((p) => ({ slug: p.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const post = getScholarPost(params.slug)
  if (!post) return { title: 'Not found, Argo' }
  return {
    title: `${post.title}, Vitalik Scholar`,
    description: post.description,
    openGraph: { title: post.title, description: post.description, type: 'article', images: [post.hero.src] },
  }
}

export default function ScholarPostPage({ params }: { params: { slug: string } }) {
  const post = getScholarPost(params.slug)
  if (!post) notFound()
  return <ScholarPostView post={post} />
}
