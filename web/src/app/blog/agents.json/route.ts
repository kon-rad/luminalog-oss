import { agentIndex, SITE } from '@/lib/blog-markdown'

/* Every blog post, newest first, with its markdown URL. For agents. */

export const dynamic = 'force-static'

export function GET() {
  const body = {
    site: `${SITE}/blog`,
    skill: `${SITE}/blog/SKILL.md`,
    count: agentIndex().length,
    posts: agentIndex(),
  }
  return new Response(JSON.stringify(body, null, 2), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  })
}
