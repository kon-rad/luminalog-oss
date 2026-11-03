import type { BlogPost } from '@/lib/blog-posts'

/* The news front: the newest post leads, the next two sit beside it, the rest fill the grid. */
export type Front = { lead: BlogPost | undefined; secondary: BlogPost[]; rest: BlogPost[] }

export function front(sorted: BlogPost[]): Front {
  return { lead: sorted[0], secondary: sorted.slice(1, 3), rest: sorted.slice(3) }
}
