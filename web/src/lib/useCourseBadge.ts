'use client'

import { useCallback, useEffect, useState } from 'react'
import { useAuth } from './auth-context'

export interface QuizQuestion {
  id: string
  type: 'mc' | 'short'
  prompt: string
  options?: string[]
}

export interface CourseClass {
  name: string
  course: string
  module: string
  date: string
  time: string
  location: string
  imageUrl: string
  contentUrl: string | null
  active: boolean
  quiz: QuizQuestion[]
}

export interface CourseBadge {
  tokenId: string
  contract?: string
  chain?: string
  txHash?: string
  status?: 'minting' | 'minted' | 'failed'
}

export interface CoursePayload {
  class: CourseClass
  participation: {
    answers: Record<string, string> | null
    submittedAt: unknown
    badge: CourseBadge | null
  } | null
}

export function basescanBadgeUrl(b: CourseBadge): string {
  const base = b.chain === 'base' ? 'https://basescan.org' : 'https://sepolia.basescan.org'
  return `${base}/nft/${b.contract}/${b.tokenId}`
}

export function useCourseBadge(classId: string) {
  const { user } = useAuth()
  const [data, setData] = useState<CoursePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!user) {
      setLoading(false)
      return
    }
    try {
      setLoading(true)
      const token = await user.getIdToken()
      const res = await fetch(`/api/course/${classId}`, {
        headers: { authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error(`course ${res.status}`)
      setData(await res.json())
      setError(null)
    } catch (e: any) {
      setError(e?.message ?? 'failed')
    } finally {
      setLoading(false)
    }
  }, [user, classId])

  useEffect(() => {
    void load()
  }, [load])

  const submit = useCallback(
    async (answers: Record<string, string>) => {
      if (!user) throw new Error('not signed in')
      const token = await user.getIdToken()
      const res = await fetch(`/api/course/${classId}/submit`, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({ answers }),
      })
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `submit ${res.status}`)
    },
    [user, classId],
  )

  const mint = useCallback(async (): Promise<CourseBadge> => {
    if (!user) throw new Error('not signed in')
    const token = await user.getIdToken()
    const res = await fetch(`/api/course/${classId}/mint`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error ?? `mint ${res.status}`)
    return res.json()
  }, [user, classId])

  return { data, loading, error, reload: load, submit, mint }
}
