import { describe, it, expect } from 'vitest'
import { wordCount } from '@/lib/wordCount'

describe('wordCount', () => {
  it('empty string → 0', () => {
    expect(wordCount('')).toBe(0)
  })

  it('whitespace-only → 0', () => {
    expect(wordCount('   \n\t  ')).toBe(0)
  })

  it('single word → 1', () => {
    expect(wordCount('hello')).toBe(1)
  })

  it('leading / trailing spaces do not count', () => {
    expect(wordCount('   hello world   ')).toBe(2)
  })

  it('collapses multiple internal spaces', () => {
    expect(wordCount('hello     world')).toBe(2)
  })

  it('newlines and tabs separate words', () => {
    expect(wordCount('a\nb\tc\r\nd')).toBe(4)
  })

  it('counts a normal sentence', () => {
    expect(wordCount('The quick brown fox jumps over the lazy dog')).toBe(9)
  })

  it('unicode words count as words', () => {
    expect(wordCount('héllo 世界 café naïve')).toBe(4)
  })
})
