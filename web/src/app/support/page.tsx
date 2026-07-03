import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal'

export const metadata: Metadata = {
  title: 'Support — LuminaLog',
  description: 'Get help with LuminaLog. Contact us by email or on X (Twitter) for support, questions, and feedback.',
}

export default function SupportPage() {
  return (
    <LegalLayout title="Support" updated="June 30, 2026">
      <h2>Contact Us</h2>
      <p>
        We&apos;re here to help. If you have a question, ran into a bug, or just want
        to share feedback, reach out — we respond to every message.
      </p>

      <h2>Email</h2>
      <p>
        The fastest way to get help is email:{' '}
        <a href="mailto:konradmgnat@gmail.com">konradmgnat@gmail.com</a>
      </p>
      <p>We typically respond within one business day.</p>

      <h2>X (Twitter)</h2>
      <p>
        You can also reach us on X:{' '}
        <a href="https://x.com/konrad_gnat" target="_blank" rel="noopener noreferrer">
          @konrad_gnat
        </a>
      </p>

      <h2>Common Questions</h2>
      <h3>How do I cancel my subscription?</h3>
      <p>
        Subscriptions are managed through the App Store. Open the Settings app on
        your iPhone, tap your name → Subscriptions, find LuminaLog, and tap
        Cancel Subscription.
      </p>

      <h3>My entries are not syncing</h3>
      <p>
        Make sure you have a stable internet connection and are signed in to your
        account. Pull down to refresh on the journal screen. If the issue persists,
        contact us at{' '}
        <a href="mailto:konradmgnat@gmail.com">konradmgnat@gmail.com</a>.
      </p>

      <h3>How is my data protected?</h3>
      <p>
        Your journal entries are encrypted on-device before being stored. Our AI
        processes anonymized content only — your name and identifying details are
        never shared with AI providers. See our{' '}
        <a href="/privacy">Privacy Policy</a> for full details.
      </p>

      <h3>How do I sign in?</h3>
      <p>
        LuminaLog uses <strong>Sign in with Apple</strong> or <strong>Sign in with
        Google</strong> — there is no separate password to remember. Just tap the
        provider you used when you created your account. If you have trouble
        signing in, email us at{' '}
        <a href="mailto:konradmgnat@gmail.com">konradmgnat@gmail.com</a>.
      </p>
    </LegalLayout>
  )
}
