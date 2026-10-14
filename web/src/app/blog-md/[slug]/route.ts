import { posts, getPost } from '@/lib/blog-posts'
import { postMarkdown } from '@/lib/blog-markdown'

/* /blog/<slug>.md is rewritten here (next.config.js). One post as markdown, for agents. */

export const dynamic = 'force-static'

export function generateStaticParams() {
  return posts.map((p) => ({ slug: p.slug }))
}

export function GET(_req: Request, { params }: { params: { slug: string } }) {
  const post = getPost(params.slug)
  if (!post) {
    return new Response(`No post with slug "${params.slug}". The list is at /blog/agents.json\n`, {
      status: 404,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    })
  }
  return new Response(postMarkdown(post), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
