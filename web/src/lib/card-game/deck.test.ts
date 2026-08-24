import { describe, it, expect } from 'vitest'
import { DECKS, CARD_THEMES, getDeck, type Card } from './deck'
import { BRIDGING_GENERATIONS } from './decks/bridgingGenerations'

const DASHES = /[—]|--|\s–\s/

describe('bridging-generations deck', () => {
  const cards = BRIDGING_GENERATIONS.cards

  it('holds exactly 100 cards', () => {
    expect(cards).toHaveLength(100)
  })

  it('splits evenly between the two directions', () => {
    const younger = cards.filter((c) => c.direction === 'younger-to-elder')
    const elder = cards.filter((c) => c.direction === 'elder-to-younger')
    expect(younger).toHaveLength(50)
    expect(elder).toHaveLength(50)
  })

  it('numbers ids sequentially and uniquely', () => {
    const ids = cards.map((c) => c.id)
    expect(new Set(ids).size).toBe(100)
    ids.forEach((id, i) => {
      expect(id).toBe(`bg-${String(i + 1).padStart(3, '0')}`)
    })
  })

  it('phrases every card as a question', () => {
    for (const card of cards) {
      expect(card.prompt.trim().endsWith('?'), `${card.id}: ${card.prompt}`).toBe(true)
    }
  })

  it('uses only known themes', () => {
    for (const card of cards) {
      expect(CARD_THEMES, card.id).toContain(card.theme)
    }
  })

  // The workspace style rule bans the em dash everywhere, including content
  // strings. A card that violates it would ship straight onto the table.
  it('contains no em dashes or dash substitutes', () => {
    const strings = [
      BRIDGING_GENERATIONS.title,
      BRIDGING_GENERATIONS.tagline,
      BRIDGING_GENERATIONS.description,
      ...cards.map((c: Card) => c.prompt),
    ]
    for (const s of strings) {
      expect(DASHES.test(s), s).toBe(false)
    }
  })
})

describe('getDeck', () => {
  it('resolves a known slug', () => {
    expect(getDeck('bridging-generations')?.id).toBe('bridging-generations')
  })

  it('returns undefined for an unknown slug', () => {
    expect(getDeck('not-a-deck')).toBeUndefined()
  })

  it('registers the deck', () => {
    expect(DECKS.map((d) => d.slug)).toContain('bridging-generations')
  })
})
