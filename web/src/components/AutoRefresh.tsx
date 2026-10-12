'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

/* Re-renders the server component on an interval, so a page left open (an OBS
 * browser source on the stream) picks up fresh numbers without a reload. */
export default function AutoRefresh({ seconds }: { seconds: number }) {
  const router = useRouter()
  useEffect(() => {
    const id = setInterval(() => router.refresh(), seconds * 1000)
    return () => clearInterval(id)
  }, [router, seconds])
  return null
}
