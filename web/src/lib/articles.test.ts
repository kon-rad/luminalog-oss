import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
// The registry imports blog components, which pull in Firebase; the data is all this test needs.
vi.mock('@/components/blog', () => ({}))

import { DEFAULT_IMAGE, imageOf, posts } from '@/lib/blog-posts'
import { front } from '@/lib/articles'

const PUBLIC = join(__dirname, '..', '..', 'public')

describe('article heroes', () => {
  it('every post names a hero image under /blog/ and the file is in public/', () => {
    for (const p of posts) {
      const img = imageOf(p)
      expect(img, p.slug).toMatch(/^\/blog\/[^/]+\.(jpg|jpeg|png|webp)$/)
      expect(existsSync(join(PUBLIC, img)), `${p.slug}: ${img}`).toBe(true)
    }
  })

  it('the default hero exists and is used when a post has none', () => {
    expect(existsSync(join(PUBLIC, DEFAULT_IMAGE))).toBe(true)
    expect(imageOf({ ...posts[0], image: undefined })).toBe(DEFAULT_IMAGE)
  })
})

describe('front page layout', () => {
  const sorted = [...posts].sort((a, b) => (a.isoDate < b.isoDate ? 1 : -1))

  it('lead is the newest post, then two secondaries, then the rest in order', () => {
    const f = front(sorted)
    expect(f.lead?.slug).toBe(sorted[0].slug)
    expect(f.secondary.map((p) => p.slug)).toEqual(sorted.slice(1, 3).map((p) => p.slug))
    expect(f.rest.map((p) => p.slug)).toEqual(sorted.slice(3).map((p) => p.slug))
  })

  it('handles short lists without losing a post', () => {
    expect(front([])).toEqual({ lead: undefined, secondary: [], rest: [] })
    const one = front(sorted.slice(0, 1))
    expect(one.lead?.slug).toBe(sorted[0].slug)
    expect(one.secondary).toEqual([])
    const two = front(sorted.slice(0, 2))
    expect(two.secondary.length).toBe(1)
    expect(two.rest).toEqual([])
  })
})
