import { SITE } from '@/lib/blog-markdown'

/* An agent skill (SKILL.md format) for reading the Argo blog. Served as a file
 * so any agent can install it: save it as skills/argo-blog/SKILL.md. */

export const dynamic = 'force-static'

const SKILL = `---
name: argo-blog
description: Read the Argo blog (myargoquest.com/blog) as clean markdown. List every post with titles, dates and summaries, then fetch the full text of the ones you need. Use when someone asks what Argo has written about a topic, wants a post summarized, quoted or implemented, or pastes a myargoquest.com/blog link.
---

# Argo blog

The Argo blog is served in agent-friendly formats. No key, no login, no scraping.

## List the posts

\`\`\`bash
curl -s ${SITE}/blog/agents.json
\`\`\`

Returns \`{ site, skill, count, posts: [{ slug, title, description, date, reading_time, url, markdown }] }\`, newest first.
The same list as markdown: \`${SITE}/blog/index.md\`.

## Read one post

Append \`.md\` to any post URL:

\`\`\`bash
curl -s ${SITE}/blog/<slug>.md
\`\`\`

The body is markdown with YAML frontmatter (title, description, date, reading_time, url, markdown, publisher). Images are absolute URLs.

## How to use it

1. Fetch \`agents.json\`, pick posts by title and description (or search them for the user's topic).
2. Fetch only the posts you need as \`.md\`.
3. Quote from the markdown and link the post's \`url\` when you cite it.

Humans can also press **Copy to agents** at the top right of any post, which copies the same markdown.
`

export function GET() {
  return new Response(SKILL, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  })
}
