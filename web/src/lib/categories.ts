/* Article categories: the one list the web code derives from (type, routes, filter row, tests).
 * The publisher keeps a copy in .hermes/skills/social-media/argo-daily-update/scripts/publish_update.py,
 * pinned by its test; `tsc --noEmit` checks every registry literal against this union.
 * Order is the filter-row order. Labels are display text; slugs never change. */

export const CATEGORIES = [
  'product-updates',
  'news',
  'ai-news',
  'hardware',
  'crypto',
  'hackathons',
  'pop-up-cities',
  'transhumanism',
] as const

export type Category = (typeof CATEGORIES)[number]

export const DEFAULT_CATEGORY: Category = 'product-updates'

export const ARTICLES_SUBLINE =
  'What we’re building, what we’re reading, and what it means for owning your own data and tools.'

export const CATEGORY_META: Record<Category, { label: string; subline: string }> = {
  'product-updates': { label: 'Product updates', subline: 'What changed in Argo this week, from the build log.' },
  news: { label: 'Argo news', subline: 'Events, partnerships and announcements from Argo.' },
  'ai-news': { label: 'AI news', subline: 'What happened in AI, and what it means for people who use it.' },
  hardware: { label: 'Hardware', subline: 'Chips, devices and wearables you can own.' },
  crypto: { label: 'Crypto', subline: 'Ethereum, Base and tools for owning your own data and money.' },
  hackathons: { label: 'Hackathons', subline: 'What we built, what we learned, and what’s coming up.' },
  'pop-up-cities': { label: 'Pop-up cities', subline: 'Network states, pop-up villages and the people building them.' },
  transhumanism: { label: 'Transhumanism', subline: 'Longevity, augmentation and the long view.' },
}

export function isCategory(s: string): s is Category {
  return (CATEGORIES as readonly string[]).includes(s)
}
