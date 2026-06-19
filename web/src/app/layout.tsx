import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'

export const metadata: Metadata = {
  metadataBase: new URL('https://luminalog.com'),
  title: 'LuminaLog — Merge with AI through daily conversation',
  description: 'Capture your life in text, voice, video, or photos. Talk to an AI companion that has read every entry you\'ve ever written — and shows you patterns you couldn\'t see alone.',
  icons: {
    icon: '/logo.svg',
    apple: '/logo-icon.png',
  },
  openGraph: {
    title: 'LuminaLog — Merge with AI through daily conversation',
    description: 'Capture your life in text, voice, video, or photos. Talk to an AI companion that has read every entry you\'ve ever written — and shows you patterns you couldn\'t see alone.',
    images: ['/logo-icon.png'],
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
