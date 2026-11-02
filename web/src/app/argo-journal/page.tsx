import type { Metadata } from 'next'
import JournalLanding from '@/components/landing/JournalLanding'

// The journal's landing page, moved here unchanged from the homepage when
// myargoquest.com became the Argo platform page (2026-11-02). `/journal` is
// taken by the signed-in app's entries route under (app), so the marketing
// page lives at /argo-journal, the product's name.
export const metadata: Metadata = {
  title: 'Argo Journal: Record, reflect, and grow with your private AI journaling app',
  description: 'Argo Journal is The Merge, a new category of journaling. Capture your life in text, voice, video, or photos and talk to a private AI that remembers everything, helps you see your patterns, and grows your mind, spirit, and ability to articulate yourself. Your journal is encrypted so only you hold the key, and you choose what you share with the AI.',
  openGraph: {
    title: 'Argo Journal: Record, reflect, and grow with your private AI journaling app',
    description: 'The Merge: a daily practice of merging with a private AI built entirely from your own life. It remembers everything, shows you patterns you couldn\'t see alone, and helps you grow more articulate and whole.',
    images: ['/logo-icon.png'],
  },
}

export default function ArgoJournalPage() {
  return <JournalLanding />
}
