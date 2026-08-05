// Course quiz attempts — persisted per user at `users/{uid}/quizAttempts/{id}`.
// Plaintext (educational, low-sensitivity content; not journal data). Every
// submit is a NEW attempt (auto id), so the same quiz can be taken repeatedly
// and the full history is kept. All reads/writes are owner-scoped by the doc
// path segment `uid` (enforced by firestore.rules).

import {
  addDoc,
  collection,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'

/** A multiple-choice question, shared shape across course quizzes. */
export interface QuizMCQ {
  question: string
  options: string[]
  answer: number // index of the correct option
}

/** How the visitor answered one MCQ (`selectedIndex` = -1 if unanswered). */
export interface McqAnswer {
  questionIndex: number
  selectedIndex: number
  correctIndex: number
  correct: boolean
}

/** A single short-answer response. */
export interface ShortAnswer {
  question: string
  answer: string
}

/** The raw quiz state captured from the UI at submit time. */
export interface QuizAttemptInput {
  quizId: string
  quizTitle: string
  mcq: QuizMCQ[]
  selected: Record<number, number>
  openQuestions: string[]
  openAnswers: Record<number, string>
}

/** The persisted document shape (minus id + server timestamp). */
export interface QuizAttemptData {
  quizId: string
  quizTitle: string
  score: number
  total: number
  mcqAnswers: McqAnswer[]
  shortAnswers: ShortAnswer[]
}

/** A decoded attempt as read back for display. */
export interface QuizAttempt extends QuizAttemptData {
  id: string
  submittedAt: Date | null
}

/**
 * Pure — turn captured quiz UI state into the document payload. Scores the
 * MCQs, maps each choice (unanswered → -1, `correct: false`), and trims each
 * short answer. Exported so scoring/shape is unit-testable without Firestore.
 */
export function buildQuizAttemptData(input: QuizAttemptInput): QuizAttemptData {
  const mcqAnswers: McqAnswer[] = input.mcq.map((q, i) => {
    const selectedIndex = input.selected[i] ?? -1
    return {
      questionIndex: i,
      selectedIndex,
      correctIndex: q.answer,
      correct: selectedIndex === q.answer,
    }
  })

  const shortAnswers: ShortAnswer[] = input.openQuestions.map((question, i) => ({
    question,
    answer: (input.openAnswers[i] ?? '').trim(),
  }))

  return {
    quizId: input.quizId,
    quizTitle: input.quizTitle,
    score: mcqAnswers.filter((a) => a.correct).length,
    total: input.mcq.length,
    mcqAnswers,
    shortAnswers,
  }
}

/** Save a new attempt for `uid`. Returns nothing; throws on write failure. */
export async function saveQuizAttempt(uid: string, input: QuizAttemptInput): Promise<void> {
  const data = buildQuizAttemptData(input)
  await addDoc(collection(db, 'users', uid, 'quizAttempts'), {
    ...data,
    submittedAt: serverTimestamp(),
  })
}

/** Read all of a user's attempts, newest first. */
export async function getQuizAttempts(uid: string): Promise<QuizAttempt[]> {
  const q = query(collection(db, 'users', uid, 'quizAttempts'), orderBy('submittedAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => {
    const data = d.data() as QuizAttemptData & { submittedAt?: Timestamp }
    return {
      id: d.id,
      quizId: data.quizId,
      quizTitle: data.quizTitle,
      score: data.score,
      total: data.total,
      mcqAnswers: data.mcqAnswers ?? [],
      shortAnswers: data.shortAnswers ?? [],
      submittedAt: data.submittedAt?.toDate() ?? null,
    }
  })
}
