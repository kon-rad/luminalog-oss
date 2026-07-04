'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { House, BookText, MessageCircle, Settings } from 'lucide-react'
import Fab from '@/components/app/Fab'

// Persistent bottom nav (design B.0): blurred material bar, ~56px, top
// hairline, four tabs — Home · Journal · [raised FAB +] · Chats · Settings.
// Active tab = filled/accent icon + label; inactive = text-secondary. Hidden
// on immersive routes (create modal, an open chat conversation) — for M2 that
// is just `/create` and `/chats/<id>` (the chats list root stays visible).
const TABS = [
  { href: '/home', label: 'Home', Icon: House },
  { href: '/journal', label: 'Journal', Icon: BookText },
  { href: '/chats', label: 'Chats', Icon: MessageCircle },
  { href: '/settings', label: 'Settings', Icon: Settings },
] as const

function isImmersive(pathname: string): boolean {
  if (pathname.startsWith('/create')) return true
  // An open chat conversation (any /chats/<id> below the list root) is
  // immersive; the /chats list root itself keeps the nav.
  if (/^\/chats\/[^/]+/.test(pathname)) return true
  return false
}

export default function BottomNav() {
  const pathname = usePathname() ?? ''

  if (isImmersive(pathname)) return null

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)

  const left = TABS.slice(0, 2)
  const right = TABS.slice(2)

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-[560px] items-stretch justify-between px-2"
      style={{
        height: 56,
        background: 'color-mix(in srgb, var(--surface) 88%, transparent)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        borderTop: '0.5px solid var(--hairline)',
      }}
    >
      {left.map((tab) => (
        <NavItem key={tab.href} {...tab} active={isActive(tab.href)} />
      ))}

      <div className="relative flex w-16 flex-none items-start justify-center">
        <Fab />
      </div>

      {right.map((tab) => (
        <NavItem key={tab.href} {...tab} active={isActive(tab.href)} />
      ))}
    </nav>
  )
}

function NavItem({
  href,
  label,
  Icon,
  active,
}: {
  href: string
  label: string
  Icon: typeof House
  active: boolean
}) {
  const color = active ? 'var(--accent)' : 'var(--text2)'
  return (
    <Link href={href} className="flex flex-1 flex-col items-center justify-center gap-0.5">
      <Icon size={22} strokeWidth={1.75} color={color} fill={active ? color : 'none'} />
      <span className="text-[11px] font-medium" style={{ color }}>
        {label}
      </span>
    </Link>
  )
}
