// The authenticated route-group layout (design §11 / module map `(app)/layout.tsx`).
// Does NOT render <html>/<body> — the root layout owns those. AuthProvider is
// already mounted at the root; this layer adds theme, session bootstrap, the
// paywall gate, and the app shell (bottom nav + FAB) around every route under
// (app)/.
import { ReactNode } from 'react'
import { ThemeProvider } from '@/lib/theme'
import { SessionProvider } from '@/lib/session/session-context'
import PaywallGate from '@/components/app/PaywallGate'
import AppShell from '@/components/app/AppShell'

export default function AppGroupLayout({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <SessionProvider>
        <PaywallGate>
          <AppShell>{children}</AppShell>
        </PaywallGate>
      </SessionProvider>
    </ThemeProvider>
  )
}
