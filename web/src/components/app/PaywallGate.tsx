'use client'

import { ReactNode } from 'react'
import { useSession } from '@/lib/session/session-context'
import Splash from '@/components/app/Splash'
import SignIn from '@/components/app/SignIn'

// The app-entry gate (design §11, B.5): loading -> splash, signedOut -> sign in,
// signedIn -> the app.
//
// This used to lock the ENTIRE app behind the `pro` entitlement, mirroring iOS.
// The web tier is now freemium (design §2, 2026-08-23): journaling, media and
// keyword search are free, and only the AI surfaces are paid. So the Pro check
// moved out of here and into `ProGate`, which wraps individual surfaces, with
// the real enforcement in the server's `requirePro` middleware.
//
// What stays here is exactly what is still whole-app: you cannot use Argo
// without an account, because every entry is keyed to a uid.
export default function PaywallGate({ children }: { children: ReactNode }) {
  const { phase } = useSession()

  if (phase === 'loading') return <Splash />
  if (phase === 'signedOut') return <SignIn />

  return <>{children}</>
}
