import type { BlogPost } from '@/lib/blog-posts'
import { categoryOf } from '@/lib/blog-posts'
import { CATEGORIES, type Category } from '@/lib/categories'

/* The news front: the newest post leads, the next two sit beside it, the rest fill the grid. */
export type Front = { lead: BlogPost | undefined; secondary: BlogPost[]; rest: BlogPost[] }

export function front(sorted: BlogPost[]): Front {
  return { lead: sorted[0], secondary: sorted.slice(1, 3), rest: sorted.slice(3) }
}

/* The magazine front (/articles): The Ten, then one desk per populated category. */
export const DESK_SIZE = 4

export function ten(sorted: BlogPost[]): BlogPost[] {
  return sorted.slice(0, 10)
}

export type Desk = { category: Category; posts: BlogPost[]; total: number }

/* A desk shows its newest posts that are not already in The Ten. A category with at most one such
 * post shows its newest posts regardless, so a small category is never an empty shelf. */
export function desks(sorted: BlogPost[], featured: BlogPost[] = ten(sorted), size = DESK_SIZE): Desk[] {
  const featuredSlugs = new Set(featured.map((post) => post.slug))
  return CATEGORIES.flatMap((category) => {
    const categoryPosts = sorted.filter((post) => categoryOf(post) === category)
    if (categoryPosts.length === 0) return []
    const fresh = categoryPosts.filter((post) => !featuredSlugs.has(post.slug))
    return [{ category, posts: (fresh.length <= 1 ? categoryPosts : fresh).slice(0, size), total: categoryPosts.length }]
  })
}

/* Page rows: a one-post desk takes half a row when its neighbour is also a one-post desk. */
export function deskRows(list: Desk[]): Desk[][] {
  const rows: Desk[][] = []
  for (let i = 0; i < list.length; i++) {
    if (list[i].posts.length === 1 && list[i + 1]?.posts.length === 1) rows.push([list[i], list[++i]])
    else rows.push([list[i]])
  }
  return rows
}

/* ISO 8601 week number of a YYYY-MM-DD date, for the masthead dateline. */
export function isoWeek(isoDate: string): { week: number; year: number } {
  const d = new Date(`${isoDate.slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7))
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1)
  return { week: Math.ceil(((d.getTime() - yearStart) / 86400000 + 1) / 7), year: d.getUTCFullYear() }
}
