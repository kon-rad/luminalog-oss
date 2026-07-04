import { describe, expect, it } from 'vitest'
import { deriveEntryTitle } from '@/lib/entryTitle'

describe('deriveEntryTitle', () => {
  it('a seeded prompt always wins, verbatim', () => {
    expect(deriveEntryTitle('some journal text', 'What are you grateful for?')).toBe(
      'What are you grateful for?',
    )
  })

  it('trims a seeded prompt', () => {
    expect(deriveEntryTitle('body', '  Padded prompt  ')).toBe('Padded prompt')
  })

  it('falls back to the first non-blank line of the body', () => {
    expect(deriveEntryTitle('\n\nToday was good.\nMore detail follows.')).toBe('Today was good.')
  })

  it('ignores a blank/whitespace-only seeded prompt', () => {
    expect(deriveEntryTitle('First line here', '   ')).toBe('First line here')
  })

  it('clips a long first line to 60 chars with an ellipsis', () => {
    const longLine = 'x'.repeat(80)
    const title = deriveEntryTitle(longLine)
    expect(title.length).toBe(61) // 60 chars + ellipsis
    expect(title.endsWith('…')).toBe(true)
    expect(title.startsWith('x'.repeat(60))).toBe(true)
  })

  it('falls back to "Untitled" for blank/whitespace-only body and no prompt', () => {
    expect(deriveEntryTitle('   \n  \n ')).toBe('Untitled')
    expect(deriveEntryTitle('')).toBe('Untitled')
  })
})
