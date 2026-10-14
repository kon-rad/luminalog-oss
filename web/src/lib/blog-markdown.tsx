import { Fragment, isValidElement, type ReactNode } from 'react'
import { H2, H3, P, UL, A, Pull, Note, Figure } from '@/components/blog'
import { posts, type BlogPost } from '@/lib/blog-posts'

/* ──────────────────────────────────────────────────────────────────────────
 * Blog posts as markdown, for agents.
 * Posts are authored as JSX (lib/blog-posts.tsx), so this walks each post's
 * element tree and maps the blog primitives to markdown. No react-dom/server,
 * no build step: the same function feeds the "Copy to agents" button, the
 * /blog/<slug>.md route and /blog/agents.json.
 * ────────────────────────────────────────────────────────────────────────── */

export const SITE = 'https://myargoquest.com'

const abs = (u: string): string => (u.startsWith('/') ? `${SITE}${u}` : u)

type Props = { children?: ReactNode; [key: string]: unknown }

/** Inline text: everything inside a paragraph, list item, heading or link. */
function inline(node: ReactNode): string {
  return render(node).replace(/\s*\n\s*/g, ' ').replace(/ {2,}/g, ' ').trim()
}

/** A block, separated from its neighbours by a blank line. */
const blockOf = (text: string): string => `\n\n${text.trim()}\n\n`

const quote = (text: string): string =>
  text
    .trim()
    .split('\n')
    .map((line) => (line ? `> ${line}` : '>'))
    .join('\n')

function render(node: ReactNode, inPre = false): string {
  if (node === null || node === undefined || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map((n) => render(n, inPre)).join('')
  if (!isValidElement(node)) return ''

  const { type } = node
  const props = (node.props ?? {}) as Props
  const kids = (): string => render(props.children, inPre)

  if (type === Fragment) return kids()
  if (type === H2) return blockOf(`## ${inline(props.children)}`)
  if (type === H3) return blockOf(`### ${inline(props.children)}`)
  if (type === P) return blockOf(inline(props.children))
  if (type === UL) {
    const items = (props.items as ReactNode[] | undefined) ?? []
    return blockOf(items.map((it) => `- ${inline(it)}`).join('\n'))
  }
  if (type === A) return `[${inline(props.children)}](${abs(String(props.href ?? ''))})`
  if (type === Pull) return blockOf(quote(collapse(kids())))
  if (type === Note) return blockOf(quote(collapse(kids())))
  if (type === Figure) {
    const img = `![${String(props.alt ?? '')}](${abs(String(props.src ?? ''))})`
    const caption = props.caption ? inline(props.caption as ReactNode) : ''
    return blockOf(caption ? `${img}\n*${caption}*` : img)
  }

  if (typeof type === 'string') {
    switch (type) {
      case 'strong':
      case 'b':
        return `**${inline(props.children)}**`
      case 'em':
      case 'i':
        return `*${inline(props.children)}*`
      case 'code':
        return inPre ? kids() : `\`${inline(props.children)}\``
      case 'pre':
        return blockOf(`\`\`\`\n${render(props.children, true).replace(/\n+$/, '')}\n\`\`\``)
      case 'br':
        return '\n'
      case 'a':
        return `[${inline(props.children)}](${abs(String(props.href ?? ''))})`
      case 'img':
        return `![${String(props.alt ?? '')}](${abs(String(props.src ?? ''))})`
      case 'h1':
      case 'h2':
        return blockOf(`## ${inline(props.children)}`)
      case 'h3':
      case 'h4':
        return blockOf(`### ${inline(props.children)}`)
      case 'p':
      case 'div':
      case 'section':
      case 'figure':
        return blockOf(kids())
      case 'blockquote':
        return blockOf(quote(collapse(kids())))
      case 'ul':
      case 'ol':
        return blockOf(kids())
      case 'li':
        return `- ${inline(props.children)}\n`
      default:
        return kids()
    }
  }

  // Any other component: call it and render what it returns (posts use plain
  // function components without hooks).
  if (typeof type === 'function') {
    try {
      return render((type as (p: Props) => ReactNode)(props), inPre)
    } catch {
      return kids()
    }
  }
  return kids()
}

/** Blank-line-separated blocks, no runs of empty lines. */
function collapse(text: string): string {
  return text
    .split('\n')
    .map((l) => l.replace(/\s+$/, ''))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export const postUrl = (slug: string): string => `${SITE}/blog/${slug}`
export const postMarkdownUrl = (slug: string): string => `${SITE}/blog/${slug}.md`

/** The whole post as markdown with YAML frontmatter. */
export function postMarkdown(post: BlogPost): string {
  const { Content } = post
  const body = collapse(render(<Content />))
  const esc = (s: string): string => JSON.stringify(s)
  return [
    '---',
    `title: ${esc(post.title)}`,
    `description: ${esc(post.description)}`,
    `date: ${post.isoDate.slice(0, 10)}`,
    `reading_time: ${esc(post.readingTime)}`,
    `url: ${postUrl(post.slug)}`,
    `markdown: ${postMarkdownUrl(post.slug)}`,
    'publisher: Argo (myargoquest.com)',
    '---',
    '',
    `# ${post.title}`,
    '',
    body,
    '',
  ].join('\n')
}

export type AgentPostEntry = {
  slug: string
  title: string
  description: string
  date: string
  reading_time: string
  url: string
  markdown: string
}

export function agentIndex(): AgentPostEntry[] {
  return posts.map((p) => ({
    slug: p.slug,
    title: p.title,
    description: p.description,
    date: p.isoDate.slice(0, 10),
    reading_time: p.readingTime,
    url: postUrl(p.slug),
    markdown: postMarkdownUrl(p.slug),
  }))
}
