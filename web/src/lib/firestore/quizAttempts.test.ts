import { describe, it, expect, vi } from 'vitest'

// quizAttempts.ts imports `db` from firebase at module load; stub it so the
// pure builder can be tested without initialising a real Firebase app.
vi.mock('@/lib/firebase', () => ({ db: { __db: true } }))

import { buildQuizAttemptData, type QuizAttemptInput } from '@/lib/firestore/quizAttempts'

const MCQ = [
  { question: 'Q1', options: ['a', 'b', 'c'], answer: 1 },
  { question: 'Q2', options: ['a', 'b'], answer: 0 },
  { question: 'Q3', options: ['a', 'b'], answer: 1 },
]
const OPEN = ['Explain one', 'Explain two']

function make(overrides: Partial<QuizAttemptInput> = {}): QuizAttemptInput {
  return {
    quizId: 'module-1',
    quizTitle: 'AI Power Users · Module 1',
    mcq: MCQ,
    selected: { 0: 1, 1: 1, 2: 1 }, // Q1 correct, Q2 wrong, Q3 correct
    openQuestions: OPEN,
    openAnswers: { 0: '  a second brain  ', 1: '' },
    ...overrides,
  }
}

describe('buildQuizAttemptData', () => {
  it('scores MCQs and maps each choice against the correct index', () => {
    const data = buildQuizAttemptData(make())
    expect(data.score).toBe(2)
    expect(data.total).toBe(3)
    expect(data.mcqAnswers).toEqual([
      { questionIndex: 0, selectedIndex: 1, correctIndex: 1, correct: true },
      { questionIndex: 1, selectedIndex: 1, correctIndex: 0, correct: false },
      { questionIndex: 2, selectedIndex: 1, correctIndex: 1, correct: true },
    ])
  })

  it('records an unanswered MCQ as selectedIndex -1 and not correct', () => {
    const data = buildQuizAttemptData(make({ selected: { 0: 1 } }))
    expect(data.score).toBe(1)
    expect(data.mcqAnswers[1]).toEqual({
      questionIndex: 1,
      selectedIndex: -1,
      correctIndex: 0,
      correct: false,
    })
    expect(data.mcqAnswers[2].selectedIndex).toBe(-1)
  })

  it('trims short answers and keeps blanks as empty strings', () => {
    const data = buildQuizAttemptData(make())
    expect(data.shortAnswers).toEqual([
      { question: 'Explain one', answer: 'a second brain' },
      { question: 'Explain two', answer: '' },
    ])
  })

  it('carries the quiz identity through', () => {
    const data = buildQuizAttemptData(make({ quizId: 'kids-stem', quizTitle: 'Kids STEM · Class 0' }))
    expect(data.quizId).toBe('kids-stem')
    expect(data.quizTitle).toBe('Kids STEM · Class 0')
  })
})
