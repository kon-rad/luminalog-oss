import type { Metadata } from 'next'
import { LegalLayout, LEGAL_UPDATED, TermsContent } from '@/components/legal'

export const metadata: Metadata = {
  title: 'Terms of Service, Argo',
  description:
    'The terms governing your use of Argo: the Service, eligibility, subscriptions and Voice Credits, your content and ownership, AI disclaimers, and more.',
}

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated={LEGAL_UPDATED}>
      <TermsContent />
    </LegalLayout>
  )
}
