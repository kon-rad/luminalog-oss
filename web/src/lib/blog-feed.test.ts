import { describe, it, expect, vi } from 'vitest'

/* The real primitives pull in the Navbar and Firebase; the feed logic doesn't need them. */
vi.mock('@/components/blog', () => {
  const stub = () => null
  return { H2: stub, P: stub, UL: stub, A: stub, Pull: stub, Note: stub, Figure: stub }
})

import { feedPosts, allPosts, findPost } from './blog-feed'
import { posts as staticPosts } from './blog-posts'

const post = {
  slug: 'argo-daily-update-2026-10-14',
  title: 'Argo daily update',
  description: 'What shipped.',
  date: 'October 14, 2026',
  isoDate: '2099-01-01T07:10',
  readingTime: '2 min read',
  markdown: '## Shipped\n\n- one\n- **two**\n\nSee [the site](https://myargoquest.com).',
}

const ok = (body: unknown) => (async () => new Response(JSON.stringify(body))) as unknown as typeof fetch

describe('feedPosts', () => {
  it('returns nothing without a URL', async () => {
    expect(await feedPosts(ok({ posts: [post] }), undefined)).toEqual([])
  })

  it('keeps well-formed posts and drops malformed ones', async () => {
    const bad = { ...post, slug: '../etc' }
    const missing = { slug: 'x' }
    expect(await feedPosts(ok({ posts: [post, bad, missing] }), 'https://feed')).toEqual([post])
  })

  it('treats a failed fetch as an empty feed', async () => {
    const boom = (async () => { throw new Error('down') }) as unknown as typeof fetch
    expect(await feedPosts(boom, 'https://feed')).toEqual([])
    const notFound = (async () => new Response('', { status: 404 })) as unknown as typeof fetch
    expect(await feedPosts(notFound, 'https://feed')).toEqual([])
  })
})

describe('allPosts', () => {
  it('lists authored posts when the feed is unset', async () => {
    expect((await allPosts(ok({ posts: [post] }))).length).toBe(staticPosts.length)
  })
})

describe('findPost', () => {
  it('lets an authored post win a slug clash', async () => {
    const first = staticPosts[0]
    const found = await findPost(first.slug, ok({ posts: [{ ...post, slug: first.slug }] }))
    expect(found?.Content).toBe(first.Content)
  })
})
