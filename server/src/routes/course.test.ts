import { describe, it, expect, vi } from 'vitest'

// The route module imports firebaseAuth (service-account parse) and the mint
// service (chain clients) at load — mock both so the pure gate test needs no env.
vi.mock('../middleware/firebaseAuth', () => ({ db: {}, firebaseAuth: (_r: any, _s: any, n: any) => n() }))
vi.mock('../services/chain/courseBadgeService', () => ({ mintCourseBadge: async () => ({}) }))

import { validateSubmission } from './course'

const quiz = [
  { id: 'q1', type: 'mc' as const, prompt: 'Pick', options: ['a', 'b'] },
  { id: 'q2', type: 'short' as const, prompt: 'Say' },
]

describe('validateSubmission', () => {
  it('passes when every question has a non-empty answer', () => {
    expect(validateSubmission(quiz, { q1: 'a', q2: 'hello' })).toBeNull()
  })
  it('fails when a question is missing', () => {
    expect(validateSubmission(quiz, { q1: 'a' })).toMatch(/q2/)
  })
  it('fails when a short answer is blank', () => {
    expect(validateSubmission(quiz, { q1: 'a', q2: '   ' })).toMatch(/q2/)
  })
  it('fails when answers is not an object', () => {
    expect(validateSubmission(quiz, null as any)).toMatch(/answers/i)
  })
})
