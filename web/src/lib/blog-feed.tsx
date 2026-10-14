import { H2, P, UL, A } from '@/components/blog'
import { posts as staticPosts, type BlogPost } from '@/lib/blog-posts'

/* ──────────────────────────────────────────────────────────────────────────
 * Posts published from a JSON feed instead of a deploy.
 *
 * The daily Argo update is written and approved on a private server, which
 * appends it to a JSON file. The blog merges that file with the authored posts
 * in blog-posts.tsx, so a new update goes live within a minute without a
 * rebuild. The URL is a server-only env var, so the host stays out of this
 * public repo; unset or unreachable means the blog shows only authored posts.
 *
 * Feed bodies are a small markdown subset: `## ` headings, `- ` lists,
 * paragraphs, **bold** and [links](https://…). Anything else renders as text.
 * ────────────────────────────────────────────────────────────────────────── */

const BLOG_FEED_URL = process.env.BLOG_FEED_URL

export interface FeedPost {
  slug: string
  title: string
  description: string
  date: string
  isoDate: string
  readingTime: string
  markdown: string
}

type Fetch = typeof fetch

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/

function isFeedPost(p: unknown): p is FeedPost {
  const o = p as Record<string, unknown>
  return (
    !!o &&
    ['slug', 'title', 'description', 'date', 'isoDate', 'readingTime', 'markdown'].every((k) => typeof o[k] === 'string') &&
    SLUG.test(o.slug as string)
  )
}

export async function feedPosts(f: Fetch = fetch, url = BLOG_FEED_URL): Promise<FeedPost[]> {
  if (!url) return []
  try {
    const res = await f(url, { next: { revalidate: 60 }, signal: AbortSignal.timeout(5000) } as RequestInit)
    if (!res.ok) return []
    const body = (await res.json()) as { posts?: unknown[] }
    return Array.isArray(body.posts) ? body.posts.filter(isFeedPost) : []
  } catch {
    return []
  }
}

/* Inline markdown: **bold** and [text](http(s) url). Other text passes through. */
export function renderInline(text: string): React.ReactNode[] {
  const out: React.ReactNode[] = []
  const re = /\*\*([^*]+)\*\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    if (m[1] !== undefined) out.push(<strong key={m.index}>{m[1]}</strong>)
    else out.push(<A key={m.index} href={m[3]}>{m[2]}</A>)
    last = re.lastIndex
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/* Block markdown → blog primitives. Blank lines separate blocks. */
export function renderMarkdown(md: string): React.ReactNode {
  const blocks = md.replace(/\r\n/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean)
  return (
    <>
      {blocks.map((block, i) => {
        if (block.startsWith('## ')) return <H2 key={i}>{block.slice(3).trim()}</H2>
        const lines = block.split('\n')
        if (lines.every((l) => /^[-*] /.test(l))) {
          return <UL key={i} items={lines.map((l, j) => <span key={j}>{renderInline(l.slice(2).trim())}</span>)} />
        }
        return <P key={i}>{renderInline(lines.join(' '))}</P>
      })}
    </>
  )
}

function toBlogPost(p: FeedPost): BlogPost {
  return { ...p, Content: () => renderMarkdown(p.markdown) }
}

/* Authored posts plus feed posts, newest first. An authored post wins a slug clash. */
export async function allPosts(f: Fetch = fetch): Promise<BlogPost[]> {
  const taken = new Set(staticPosts.map((p) => p.slug))
  const feed = (await feedPosts(f)).filter((p) => !taken.has(p.slug)).map(toBlogPost)
  return [...staticPosts, ...feed].sort((a, b) => (a.isoDate < b.isoDate ? 1 : -1))
}

export async function findPost(slug: string, f: Fetch = fetch): Promise<BlogPost | undefined> {
  return (await allPosts(f)).find((p) => p.slug === slug)
}
