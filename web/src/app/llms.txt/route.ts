import { agentIndex, SITE } from '@/lib/blog-markdown'

/* llms.txt (llmstxt.org): where agents find Argo's readable content. */

export const dynamic = 'force-static'

export function GET() {
  const posts = agentIndex()
  const lines = [
    '# Argo',
    '',
    '> Argo is a private, encrypted AI journal (iOS and web). The blog covers the app, our build log, AI agents and the Argo Podcast.',
    '',
    '## Blog',
    '',
    `- [All posts as JSON](${SITE}/blog/agents.json): slug, title, description, date, markdown URL`,
    `- [All posts as markdown](${SITE}/blog/index.md)`,
    `- [Agent skill for the blog](${SITE}/blog/SKILL.md)`,
    '',
    '## Recent posts',
    '',
    ...posts.slice(0, 20).map((p) => `- [${p.title}](${p.markdown}): ${p.description}`),
    '',
  ]
  return new Response(lines.join('\n'), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } })
}
