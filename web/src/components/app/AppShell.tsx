'use client'

import { ReactNode } from 'react'
import BottomNav from '@/components/app/BottomNav'
import Sidebar from '@/components/app/Sidebar'

// The authenticated app frame (design §11). Responsive by breakpoint:
//   • < lg (mobile/tablet): a centered ~560px column above the fixed BottomNav
//     — the original phone-style layout.
//   • ≥ lg (desktop): a fixed left Sidebar (the "left rail" the M1/M2 spec
//     deferred as later polish) with the content offset to its right and
//     centered in a comfortable measure; the BottomNav is hidden.
// The Sidebar and BottomNav never render together — each is gated by the lg
// breakpoint so exactly one nav is visible. All four tabs stay mounted at the
// layout level (Next's route group), so switching tabs preserves each tab's
// own scroll/nav state.
export default function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      <Sidebar />
      <div className="lg:pl-[260px]">
        <div className="mx-auto max-w-[560px] px-4 pb-24 pt-6 lg:max-w-[680px] lg:px-8 lg:pb-12 lg:pt-10">
          {children}
        </div>
      </div>
      <BottomNav />
    </div>
  )
}
