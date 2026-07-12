import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/auth-context'

export const metadata: Metadata = {
  metadataBase: new URL('https://luminalog.com'),
  title: 'LuminaLog — Merge with AI through daily conversation',
  description: 'LuminaLog is The Merge — a new category of journaling. Capture your life in text, voice, video, or photos and talk to a private AI companion that remembers everything, helps you see your patterns, and grows your mind, spirit, and ability to articulate yourself. Your journal is encrypted so only you hold the key, and you choose what you share with the AI.',
  icons: {
    icon: '/logo.svg',
    apple: '/logo-icon.png',
  },
  openGraph: {
    title: 'LuminaLog — Merge with AI through daily conversation',
    description: 'The Merge: a daily practice of merging with a private AI built entirely from your own life. It remembers everything, shows you patterns you couldn\'t see alone, and helps you grow more articulate and whole.',
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
