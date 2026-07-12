import type { Metadata } from 'next'
import { LegalLayout, LEGAL_UPDATED, PrivacyContent } from '@/components/legal'

export const metadata: Metadata = {
  title: 'Privacy Policy — LuminaLog',
  description:
    'How LuminaLog collects, uses, and protects your data: zero-knowledge encrypted storage, on-device dictation, the AI providers we share what you choose with, and a no-training pledge. Includes our Terms of Service.',
}

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated={LEGAL_UPDATED}>
      <PrivacyContent />
    </LegalLayout>
  )
}
