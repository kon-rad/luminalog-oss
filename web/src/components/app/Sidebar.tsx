'use client'

// Desktop left rail (design §11 "left rail — later polish"; mirrors the
// LuminaLog Web App mockups #5/#6). Fixed, ~260px, shown only at lg+ (the
// AppShell keeps the bottom nav for < lg). Holds: wordmark, a primary "New
// entry" CTA, the four destinations, a dark-mode switch, and the signed-in
// profile. The mobile BottomNav stays the source of truth for < lg; the two
// never render together.

import Image from 'next/image'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House, BookText, MessageCircle, Settings, Plus } from 'lucide-react'
import { useTheme } from '@/lib/theme'
import { useAuth } from '@/lib/auth-context'
import { useSession } from '@/lib/session/session-context'

const TABS = [
  { href: '/home', label: 'Home', Icon: House },
  { href: '/journal', label: 'Journal', Icon: BookText },
  { href: '/chats', label: 'Chats', Icon: MessageCircle },
  { href: '/settings', label: 'Settings', Icon: Settings },
] as const

export const SIDEBAR_WIDTH = 260

export default function Sidebar() {
  const pathname = usePathname() ?? ''
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  return (
    <aside
      className="fixed inset-y-0 left-0 z-40 hidden flex-col lg:flex"
      style={{
        width: SIDEBAR_WIDTH,
        background: 'var(--bgElev)',
        borderRight: '1px solid var(--hairline)',
      }}
    >
      {/* Wordmark */}
      <Link href="/home" className="flex items-center gap-2.5 px-6 pt-7">
        <span style={{ width: 30, height: 30, borderRadius: 9, overflow: 'hidden', display: 'block' }}>
          <Image src="/logo.svg" width={30} height={30} alt="LuminaLog" />
        </span>
        <span className="serif text-lg font-semibold" style={{ color: 'var(--text)', letterSpacing: '-0.02em' }}>
          LuminaLog
        </span>
      </Link>

      {/* Primary CTA */}
      <div className="px-4 pt-6">
        <Link
          href="/create"
          className="flex h-11 w-full items-center justify-center gap-2 rounded-btn font-sans text-sm font-semibold text-white transition-transform duration-150 hover:-translate-y-0.5"
          style={{
            background: 'linear-gradient(135deg, #E8A05A, var(--accentDeep))',
            boxShadow: '0 2px 12px rgba(206,127,68,0.35)',
          }}
        >
          <Plus size={18} strokeWidth={2.25} />
          New entry
        </Link>
      </div>

      {/* Destinations */}
      <nav className="flex flex-col gap-1 px-3 pt-6">
        {TABS.map(({ href, label, Icon }) => {
          const active = isActive(href)
          return (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 rounded-btn px-3 py-2.5 font-sans text-sm font-medium transition-colors duration-150"
              style={{
                background: active ? 'var(--accentTint)' : 'transparent',
                color: active ? 'var(--accent)' : 'var(--text2)',
              }}
            >
              <Icon size={20} strokeWidth={1.9} color={active ? 'var(--accent)' : 'var(--text2)'} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="flex-1" />

      {/* Dark-mode switch + profile */}
      <div className="flex flex-col gap-3 px-4 pb-6">
        <DarkModeRow />
        <ProfileRow />
      </div>
    </aside>
  )
}

function DarkModeRow() {
  const { resolvedMode, setMode } = useTheme()
  const on = resolvedMode === 'dark'
  return (
    <div
      className="flex items-center justify-between rounded-btn px-3 py-2.5"
      style={{ background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)' }}
    >
      <span className="font-sans text-sm font-medium" style={{ color: 'var(--text2)' }}>
        Dark mode
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Toggle dark mode"
        onClick={() => setMode(on ? 'light' : 'dark')}
        className="relative h-6 w-11 shrink-0 rounded-full transition-colors duration-150"
        style={{ background: on ? 'var(--accent)' : 'var(--hairline2)' }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform duration-150"
          style={{ left: 2, transform: on ? 'translateX(20px)' : 'translateX(0)' }}
        />
      </button>
    </div>
  )
}

function ProfileRow() {
  const { user } = useAuth()
  const { profile } = useSession()

  const name = profile?.displayName?.trim() || user?.displayName || 'You'
  const initials =
    name === 'You'
      ? user?.email?.[0]?.toUpperCase() || 'Y'
      : name
          .split(/\s+/)
          .map((n) => n[0])
          .join('')
          .slice(0, 2)
          .toUpperCase()

  return (
    <div className="flex items-center gap-3 px-1">
      {user?.photoURL ? (
        <Image
          src={user.photoURL}
          width={36}
          height={36}
          alt={name}
          className="rounded-full"
          style={{ border: '1px solid var(--hairline2)' }}
        />
      ) : (
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-sans text-xs font-bold text-white"
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accentDeep))' }}
        >
          {initials}
        </span>
      )}
      <div className="min-w-0">
        <p className="truncate font-sans text-sm font-semibold" style={{ color: 'var(--text)' }}>
          {name}
        </p>
        <p className="font-sans text-xs" style={{ color: 'var(--text3)' }}>
          Free plan
        </p>
      </div>
    </div>
  )
}
