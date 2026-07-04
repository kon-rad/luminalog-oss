'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ChevronRight, Sparkles } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { ThemeToggle } from '@/lib/theme'

// Settings tab root — minimal M2 subset of design B.17: just Appearance +
// Sign Out. The rest of B.17's cards (Profile, Leaderboard, User Information,
// Daily Reminder, Subscription, AI Summary Config, Voice Credits, Delete
// Account, Legal) are later milestones.
export default function SettingsPage() {
  const { signOut } = useAuth()
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    if (!window.confirm('Sign out of LuminaLog?')) return
    setSigningOut(true)
    try {
      await signOut()
      router.push('/')
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="serif text-2xl font-semibold" style={{ color: 'var(--text)' }}>
        Settings
      </h1>

      <section className="card flex flex-col gap-3 p-4">
        <h2 className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>
          Appearance
        </h2>
        <ThemeToggle />
      </section>

      <Link
        href="/dashboard"
        className="card flex items-center gap-3 p-4 no-underline"
        style={{ color: 'var(--text)' }}
      >
        <span
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
          style={{ background: 'var(--surfaceAlt)', color: 'var(--accent)' }}
        >
          <Sparkles size={18} strokeWidth={2} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="serif text-base font-semibold" style={{ color: 'var(--text)' }}>
            Your Soul
          </span>
          <span className="text-sm" style={{ color: 'var(--text2)' }}>
            Your constellation — one star per 750-word day.
          </span>
        </span>
        <ChevronRight size={18} strokeWidth={2} className="shrink-0" style={{ color: 'var(--text2)' }} />
      </Link>

      {/* Later milestones: Profile, Leaderboard, User Information, Daily
          Reminder, Subscription, AI Summary Config, Voice Credits, Delete
          Account, Legal (design B.17). */}

      <section className="card p-4">
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          className="w-full text-center text-sm font-semibold transition-opacity duration-150"
          style={{ color: 'var(--danger)', opacity: signingOut ? 0.6 : 1 }}
        >
          {signingOut ? 'Signing out…' : 'Sign Out'}
        </button>
      </section>
    </div>
  )
}
