'use client'

import { useEffect, useState } from 'react'
import { WifiOff } from 'lucide-react'

// Surfaces connectivity loss instead of leaving the app looking silently
// broken: Firestore's realtime listeners treat a dropped connection as
// retryable and keep reconnecting in the background without ever erroring
// out to the app, so a page mid-load (e.g. /journal's entry stream) just
// sits on its loading state forever with no indication why. `navigator.onLine`
// plus the `online`/`offline` window events give an immediate, accurate signal
// independent of any one Firestore listener.
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    setOffline(!navigator.onLine)
    const goOffline = () => setOffline(true)
    const goOnline = () => setOffline(false)
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <div
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 px-4 py-2 font-sans text-[13px] font-semibold text-white"
      style={{ background: 'var(--accent)' }}
    >
      <WifiOff size={14} strokeWidth={2} />
      You&rsquo;re offline. Reconnecting when your connection returns.
    </div>
  )
}
