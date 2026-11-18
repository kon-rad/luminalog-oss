import type { Metadata } from 'next'
import JournalLanding from '@/components/landing/JournalLanding'

// The journal's landing page, moved here unchanged from the homepage when
// myargoquest.com became the Argo platform page (2026-11-02). `/journal` is
// taken by the signed-in app's entries route under (app), so the marketing
// page lives at /argo-journal, the product's name.
export const metadata: Metadata = {
  title: 'Argo Journal: Private journaling, voice conversations and your life story',
  description: 'An encrypted AI journal for your daily life. Explore on-device voice calls and a guided Life Story Interview, coming in the next iPhone update.',
  openGraph: {
    title: 'Argo Journal: Your voice. Your life story.',
    description: 'Coming in the next iPhone update: on-device speech for voice calls and a seven-part Life Story Interview. Learn what stays on your phone and what reaches the AI.',
    images: ['/logo-icon.png'],
  },
}

export default function ArgoJournalPage() {
  return <JournalLanding />
}
