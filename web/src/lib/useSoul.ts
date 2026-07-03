'use client'

import { useEffect, useState } from 'react'
import { useAuth } from './auth-context'

export interface ConstellationPoint {
  dayIndex: number
  date: string
  x: number
  y: number
  z: number
  wordCount: number
  streakAtEarn: number
}

export interface SoulPayload {
  constellation: { version: number; points: ConstellationPoint[] }
  stats: { streakCount: number; totalWords: number; goalDayWords: number }
}

export function useSoul(): { data: SoulPayload | null; loading: boolean; error: string | null } {
  const { user } = useAuth()
  const [data, setData] = useState<SoulPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!user) { setLoading(false); return }
    ;(async () => {
      try {
        setLoading(true)
        const token = await user.getIdToken()
        const res = await fetch('/api/soul', { headers: { authorization: `Bearer ${token}` } })
        if (!res.ok) throw new Error(`soul ${res.status}`)
        const json = (await res.json()) as SoulPayload
        if (!cancelled) { setData(json); setError(null) }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [user])

  return { data, loading, error }
}
