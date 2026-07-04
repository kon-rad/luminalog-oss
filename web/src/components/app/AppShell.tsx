'use client'

import { ReactNode } from 'react'
import BottomNav from '@/components/app/BottomNav'

// The authenticated app frame (design §11): a centered app column, comfortable
// on both desktop and mobile, holding the routed page content above the fixed
// bottom nav. All four tabs stay mounted at the layout level (Next's route
// group), so switching tabs preserves each tab's own scroll/nav state.
//
// Note: the design also calls for hiding the bar when a text input is
// focused; for M2 we keep it simple (route-based hiding only, see
// BottomNav's isImmersive) and skip focus-based hiding.
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <div className="mx-auto max-w-[560px] px-4 pb-24 pt-6">{children}</div>
      <BottomNav />
    </div>
  )
}
