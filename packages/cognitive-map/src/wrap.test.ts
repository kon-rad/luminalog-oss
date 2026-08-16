import { describe, it, expect } from 'vitest'
import { wrapLabel } from './wrap'

describe('wrapLabel', () => {
  it('keeps a short label on one line', () => {
    expect(wrapLabel('Trained at the gym', 20, 2)).toEqual(['Trained at the gym'])
  })

  it('breaks on word boundaries', () => {
    expect(wrapLabel('Only three people signed up', 20, 2))
      .toEqual(['Only three people', 'signed up'])
  })

  it('truncates with an ellipsis when it exceeds maxLines', () => {
    const lines = wrapLabel('One two three four five six seven eight nine ten', 20, 2)
    expect(lines).toHaveLength(2)
    expect(lines[1]!.endsWith('…')).toBe(true)
  })

  it('hard-breaks a single word longer than maxChars', () => {
    expect(wrapLabel('Supercalifragilisticexpialidocious', 10, 2))
      .toEqual(['Supercalif', 'ragilisti…'])
  })

  it('collapses runs of whitespace', () => {
    expect(wrapLabel('  Trained   at  the gym  ', 20, 2)).toEqual(['Trained at the gym'])
  })

  it('returns an empty array for empty input', () => {
    expect(wrapLabel('   ', 20, 2)).toEqual([])
  })
})
