import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
// The registry imports blog components, which pull in Firebase; the data is all this test needs.
vi.mock('@/components/blog', () => ({}))

import { DEFAULT_IMAGE, imageOf, posts } from '@/lib/blog-posts'
import { DESK_SIZE, deskRows, desks, front, isoWeek, ten } from '@/lib/articles'
import { CATEGORIES } from '@/lib/categories'

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

describe('magazine selection', () => {
  const sorted = [...posts].sort((a, b) => (a.isoDate < b.isoDate ? 1 : -1))
  const make = (slug: string, category: typeof CATEGORIES[number]) => ({ ...posts[0], slug, category })

  it('takes exactly the newest ten, or all posts when fewer exist', () => {
    expect(ten(sorted).map((p) => p.slug)).toEqual(sorted.slice(0, 10).map((p) => p.slug))
    expect(ten(sorted)).toHaveLength(10)
    expect(ten(sorted.slice(0, 4))).toHaveLength(4)
    expect(ten([])).toEqual([])
  })

  it('keeps populated desks in taxonomy order, one to DESK_SIZE newest posts each', () => {
    const shelves = desks(sorted)
    const populated = CATEGORIES.filter((c) => sorted.some((post) => (post.category ?? 'product-updates') === c))
    expect(shelves.map((desk) => desk.category)).toEqual(populated)
    for (const shelf of shelves) {
      const categoryPosts = sorted.filter((post) => (post.category ?? 'product-updates') === shelf.category)
      const unfeatured = categoryPosts.filter((post) => !ten(sorted).some((featured) => featured.slug === post.slug))
      const expected = (unfeatured.length <= 1 ? categoryPosts : unfeatured).slice(0, DESK_SIZE)
      expect(shelf.posts.map((post) => post.slug)).toEqual(expected.map((post) => post.slug))
      expect(shelf.posts.length).toBeGreaterThanOrEqual(1)
      expect(shelf.total).toBe(categoryPosts.length)
    }
  })

  it('omits empty desks and only overlaps The Ten when a desk has at most one fresh post', () => {
    const list = [
      make('featured-product', 'product-updates'),
      make('featured-news', 'news'),
      make('fresh-product-1', 'product-updates'),
      make('fresh-product-2', 'product-updates'),
      make('fresh-news', 'news'),
    ]
    const shelves = desks(list, list.slice(0, 2))
    expect(shelves.map((desk) => desk.category)).toEqual(['product-updates', 'news'])
    expect(shelves[0].posts.map((post) => post.slug)).toEqual(['fresh-product-1', 'fresh-product-2'])
    expect(shelves[1].posts.map((post) => post.slug)).toEqual(['featured-news', 'fresh-news'])
  })

  it('pairs neighbouring one-post desks into one row and leaves the rest full width', () => {
    const list = [
      make('a1', 'product-updates'), make('a2', 'product-updates'),
      make('b1', 'hardware'),
      make('c1', 'pop-up-cities'),
      make('d1', 'transhumanism'),
    ]
    const rows = deskRows(desks(list, []))
    expect(rows.map((row) => row.map((desk) => desk.category))).toEqual([
      ['product-updates'], ['hardware', 'pop-up-cities'], ['transhumanism'],
    ])
  })

  it('computes the ISO week for the dateline', () => {
    expect(isoWeek('2026-11-15')).toEqual({ week: 46, year: 2026 })
    expect(isoWeek('2026-01-01')).toEqual({ week: 1, year: 2026 })
    expect(isoWeek('2027-01-01')).toEqual({ week: 53, year: 2026 })
  })
})
