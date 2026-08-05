'use client'

// Loads the signed-in user's saved quiz attempts (newest first) for the
// dashboard "Your quizzes" section. Mirrors the shape of useSoul: {data,
// loading, error} plus a `reload` for after a fresh submit.
import { useCallback, useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { getQuizAttempts, type QuizAttempt } from '@/lib/firestore/quizAttempts'

export function useQuizAttempts() {
  const { user, loading: authLoading } = useAuth()
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const reload = useCallback(() => setReloadKey((k) => k + 1), [])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setAttempts([])
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    setError(null)
    getQuizAttempts(user.uid)
      .then((a) => {
        if (!cancelled) setAttempts(a)
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Could not load your quizzes.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [user, authLoading, reloadKey])

  return { attempts, loading, error, reload }
}
