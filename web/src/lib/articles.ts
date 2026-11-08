import type { BlogPost } from '@/lib/blog-posts'
import { categoryOf } from '@/lib/blog-posts'
import { CATEGORIES, type Category } from '@/lib/categories'

/* The news front: the newest post leads, the next two sit beside it, the rest fill the grid. */
export type Front = { lead: BlogPost | undefined; secondary: BlogPost[]; rest: BlogPost[] }

export function front(sorted: BlogPost[]): Front {
  return { lead: sorted[0], secondary: sorted.slice(1, 3), rest: sorted.slice(3) }
}

export function ten(sorted: BlogPost[]): BlogPost[] {
  return sorted.slice(0, 10)
}

export type Desk = { category: Category; posts: BlogPost[] }

export function desks(sorted: BlogPost[], featured: BlogPost[] = ten(sorted)): Desk[] {
  const featuredSlugs = new Set(featured.map((post) => post.slug))
  return CATEGORIES.flatMap((category) => {
    const categoryPosts = sorted.filter((post) => categoryOf(post) === category)
    if (categoryPosts.length === 0) return []
    const fresh = categoryPosts.filter((post) => !featuredSlugs.has(post.slug)).slice(0, 3)
    return [{ category, posts: fresh.length <= 1 ? categoryPosts.slice(0, 3) : fresh }]
  })
}
