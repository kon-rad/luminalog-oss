import { describe, expect, it, vi } from 'vitest'
// The registry imports blog components, which pull in Firebase; the data is all this test needs.
vi.mock('@/components/blog', () => ({}))

import { categoryOf, posts } from '@/lib/blog-posts'
import { CATEGORIES, CATEGORY_META, isCategory } from '@/lib/categories'

describe('article categories', () => {
  it('has a label and subline for every category', () => {
    for (const c of CATEGORIES) {
      expect(CATEGORY_META[c].label).toBeTruthy()
      expect(CATEGORY_META[c].subline).toBeTruthy()
    }
  })

  it('every post resolves to a known category and slugs are unique', () => {
    expect(new Set(posts.map((p) => p.slug)).size).toBe(posts.length)
    for (const p of posts) expect(isCategory(categoryOf(p))).toBe(true)
  })

  it('per-category counts add up to the number of posts', () => {
    const total = CATEGORIES.reduce((n, c) => n + posts.filter((p) => categoryOf(p) === c).length, 0)
    expect(total).toBe(posts.length)
  })

  it('a post with no category is a product update', () => {
    expect(categoryOf({ ...posts[0], category: undefined })).toBe('product-updates')
  })

  it('rejects unknown slugs', () => {
    expect(isCategory('essays')).toBe(false)
  })
})
