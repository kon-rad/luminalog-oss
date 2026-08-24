import { BRIDGING_GENERATIONS } from './decks/bridgingGenerations'

/** Who is asking whom. Rendered on the card face so a table of strangers knows
 *  immediately which side of the generation gap should answer. */
export type CardDirection = 'younger-to-elder' | 'elder-to-younger'

export const CARD_THEMES = [
  'journey',
  'decisions',
  'craft',
  'learning',
  'mentorship',
  'tools',
  'money',
  'failure',
  'observations',
  'vision',
] as const

export type CardTheme = (typeof CARD_THEMES)[number]

export interface Card {
  id: string
  direction: CardDirection
  theme: CardTheme
  prompt: string
}

export interface Deck {
  id: string
  slug: string
  title: string
  tagline: string
  description: string
  /** How the two directions are described on the deck page and the card face. */
  directions: Record<CardDirection, { label: string; blurb: string }>
  cards: Card[]
}

/** Every deck the site can play. Decks are static bundle content, not database
 *  rows: a room stores only the shuffled order of indexes into `cards`. */
export const DECKS: Deck[] = [BRIDGING_GENERATIONS]

export function getDeck(slug: string): Deck | undefined {
  return DECKS.find((deck) => deck.slug === slug)
}

/** Human label for a theme, used on the card face and in filters. */
export const THEME_LABELS: Record<CardTheme, string> = {
  journey: 'Journey',
  decisions: 'Decisions',
  craft: 'Craft',
  learning: 'Learning',
  mentorship: 'Mentorship',
  tools: 'Tools',
  money: 'Money',
  failure: 'Failure',
  observations: 'Observations',
  vision: 'Vision',
}
