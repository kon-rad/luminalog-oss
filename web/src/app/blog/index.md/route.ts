import { agentIndex, SITE } from '@/lib/blog-markdown'

/* The blog's table of contents as markdown, for agents. */

export const dynamic = 'force-static'

export function GET() {
  const lines = [
    '# Argo blog',
    '',
    `Every post on ${SITE}/blog, newest first. Append \`.md\` to any post URL for its markdown.`,
    `JSON: ${SITE}/blog/agents.json · Skill: ${SITE}/blog/SKILL.md`,
    '',
    ...agentIndex().map(
      (p) => `- [${p.title}](${p.markdown}) (${p.date}, ${p.reading_time}): ${p.description}`,
    ),
    '',
  ]
  return new Response(lines.join('\n'), {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  })
}
