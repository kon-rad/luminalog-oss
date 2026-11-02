import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'
import AnalyticsProvider from '@/components/AnalyticsProvider'
import SolanaWalletProvider from '@/lib/wallet/WalletProvider'

export const metadata: Metadata = {
  metadataBase: new URL('https://myargoquest.com'),
  title: 'Argo: the open-source agentic second brain. Stay the author.',
  description: 'Argo is an open-source agentic second brain: a knowledge base you own, agents that run on the best open model or harness for the job, and a loop that improves itself. Local-first, private by construction, yours.',
  icons: {
    icon: '/logo.png',
    apple: '/logo-icon.png',
  },
  openGraph: {
    title: 'Argo: the open-source agentic second brain. Stay the author.',
    description: 'The agents are yours. The data is yours. Nothing important moves without you.',
    images: ['/argo-emblem.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Outside AuthProvider on purpose: measurement must not wait on auth,
            and a signed-out marketing visitor is exactly the traffic measured. */}
        <AnalyticsProvider />
        {/* SolanaWalletProvider wraps AuthProvider (not the reverse) so
            AuthProvider's body can call useWallet() directly. */}
        <SolanaWalletProvider>
          <AuthProvider>
            {children}
          </AuthProvider>
        </SolanaWalletProvider>
      </body>
    </html>
  )
}
