import Link from 'next/link'
import Image from 'next/image'
import Navbar from '@/components/Navbar'

/* ──────────────────────────────────────────────────────────────────────────
 * Shared presentational helpers for the legal pages (/privacy and /terms).
 * Content is intentionally generic and reflects LuminaLog's shipped
 * functionality: AI-assisted journaling in text/voice/video/photo, on-device
 * transcription & OCR, encrypted storage, anonymized AI processing, a
 * no-training pledge, App Store subscriptions, and consumable Voice Credits.
 * ────────────────────────────────────────────────────────────────────────── */

export const LEGAL_UPDATED = 'July 1, 2026'

export function LegalLayout({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: React.ReactNode
}) {
  return (
    <>
      <Navbar />
      <main style={{ background: 'var(--bg)' }}>
        {/* Header */}
        <section style={{ borderBottom: '1px solid var(--hairline)', background: 'var(--surfaceAlt)' }}>
          <div className="wrap" style={{ padding: '72px 0 48px', maxWidth: 820 }}>
            <Link href="/" className="eyebrow" style={{ marginBottom: 18 }}>← Back to LuminaLog</Link>
            <h1 className="serif" style={{ marginTop: 14, fontSize: 'clamp(34px,5vw,52px)', fontWeight: 600, letterSpacing: '-0.03em', lineHeight: 1.05, color: 'var(--text)' }}>{title}</h1>
            <p style={{ marginTop: 14, fontSize: 15, color: 'var(--text3)' }}>Last updated: {updated}</p>
          </div>
        </section>

        {/* Body */}
        <section className="wrap" style={{ padding: '56px 0 96px', maxWidth: 820 }}>
          <article style={{ fontSize: 16.5, lineHeight: 1.72, color: 'var(--text2)' }}>
            {children}
          </article>
        </section>
      </main>

      {/* Footer */}
      <footer style={{ background: 'var(--bg)', borderTop: '1px solid var(--hairline)', padding: '40px 0 56px' }}>
        <div className="wrap">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <Link href="/" className="inline-flex items-center gap-2.5 serif" style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.02em' }}>
              <span style={{ width: 28, height: 28, borderRadius: 9, overflow: 'hidden', boxShadow: '0 2px 10px rgba(185,107,51,0.4)', flexShrink: 0, display: 'block' }}>
                <Image src="/logo.svg" width={28} height={28} alt="" />
              </span>
              LuminaLog
            </Link>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', fontSize: 14 }}>
              <Link href="/privacy" style={{ color: 'var(--text2)' }}>Privacy Policy</Link>
              <Link href="/terms" style={{ color: 'var(--text2)' }}>Terms</Link>
              <a href="https://x.com/konrad_gnat" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text2)' }}>Send me a tweet</a>
              <a href="mailto:konradmgnat@gmail.com" style={{ color: 'var(--text2)' }}>Support</a>
              <a href="https://github.com/konradgnat/luminalog" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text2)' }}>GitHub</a>
            </div>
          </div>
          <p style={{ marginTop: 28, fontSize: 13, color: 'var(--text3)' }}>
            © 2026 LuminaLog · Built by{' '}
            <a href="https://x.com/konrad_gnat" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accentDeep)', fontWeight: 600 }}>Konrad Gnat</a>
          </p>
        </div>
      </footer>
    </>
  )
}

/* ── Typographic primitives ── */
function H2({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="serif" style={{ fontSize: 25, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text)', marginTop: 44, marginBottom: 14, lineHeight: 1.2 }}>
      {children}
    </h2>
  )
}
function H3({ children }: { children: React.ReactNode }) {
  return (
    <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginTop: 26, marginBottom: 8 }}>
      {children}
    </h3>
  )
}
function P({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <p style={{ marginBottom: 16, ...style }}>{children}</p>
}
function UL({ items }: { items: React.ReactNode[] }) {
  return (
    <ul style={{ margin: '0 0 16px', paddingLeft: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
      {items.map((it, i) => (
        <li key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <span style={{ color: 'var(--accent)', flexShrink: 0, marginTop: 9, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)' }} />
          <span>{it}</span>
        </li>
      ))}
    </ul>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 * PRIVACY POLICY
 * ────────────────────────────────────────────────────────────────────────── */
export function PrivacyContent() {
  return (
    <>
      <P>
        This Privacy Policy explains how LuminaLog (&ldquo;LuminaLog,&rdquo; &ldquo;we,&rdquo; &ldquo;us,&rdquo; or
        &ldquo;our&rdquo;) collects, uses, and protects your information when you use the
        LuminaLog mobile application and related services (the &ldquo;Service&rdquo;). LuminaLog is a
        private, AI-assisted journaling app. Your journal is among the most personal data a
        person can keep, and protecting it is central to how the Service is designed.
      </P>
      <P>
        By using the Service, you agree to this Privacy Policy and to the
        <Link href="/terms" style={{ color: 'var(--accentDeep)', fontWeight: 600 }}> Terms of Service</Link>,
        which are also included at the end of this page.
      </P>

      <H2>1. Information we collect</H2>
      <H3>Account information</H3>
      <P>
        When you create an account, we collect the information provided by your chosen sign-in
        method (for example, Sign in with Apple or Google), which may include a name, email
        address, or a privacy-relay address. We use this only to authenticate you and operate
        your account.
      </P>
      <H3>Journal content</H3>
      <P>
        The Service lets you capture entries as text, voice recordings, video, and photographs
        (including photos of handwritten pages). This content, along with derived data such as
        transcripts, summaries, insights, tags, and emotional analysis, is stored so the Service
        can function and so your AI companion can draw on your history.
      </P>
      <H3>Usage and device information</H3>
      <P>
        We collect limited technical information needed to run and improve the Service, such as
        app version, device type, basic diagnostics, crash logs, and feature-usage signals (for
        example, streak counts and daily word totals). We do not use this to build advertising
        profiles.
      </P>
      <H3>Payment information</H3>
      <P>
        Subscriptions and Voice Credit purchases are processed by Apple through the App Store.
        We do not collect or store your payment-card details; we receive only the transaction
        and entitlement status needed to unlock features you have purchased.
      </P>

      <H2>2. How we use your information</H2>
      <UL items={[
        'To provide the core Service — storing your entries and generating transcripts, summaries, insights, prompts, daily insight cards, and conversational replies.',
        'To maintain features such as your streak, daily 750-word goal, and statistics.',
        'To authenticate you, operate your account, and provide customer support.',
        'To keep the Service secure, prevent abuse, and diagnose technical problems.',
        'To comply with legal obligations.',
      ]} />

      <H2>3. On-device processing</H2>
      <P>
        Speech-to-text transcription of voice entries and optical character recognition (OCR) of
        handwritten pages are performed on your device using Apple&apos;s on-device frameworks.
        Your raw voice audio and the original handwriting images used for these steps are not
        required to leave your device for transcription or OCR to work.
      </P>

      <H2>4. Encryption</H2>
      <P>
        Your entries and associated media are encrypted in transit and at rest. Sensitive text
        fields are protected with a per-user encryption envelope so that journal content is not
        stored in plaintext.
      </P>

      <H2>5. AI processing &amp; anonymization</H2>
      <P>
        Some features — AI insights, pattern analysis, daily insight cards, emotional analysis,
        and chat or live voice conversations — require secure cloud processing using third-party
        AI providers. When your content is processed for these features, it is handled through
        private, encrypted processing and is not connected to your personal identity. The AI can
        come to understand you deeply without us disclosing who you are to the AI providers.
      </P>
      <P style={{ fontWeight: 600, color: 'var(--text)' }}>
        Your journal is never used to train AI models — not ours, and not those of our providers.
      </P>

      <H2>6. Third-party service providers</H2>
      <P>
        We share only what is necessary with a limited set of processors who help us run the
        Service, each acting under contractual confidentiality and security obligations. These
        currently include, by category:
      </P>
      <UL items={[
        'Cloud hosting and database / authentication providers (for example, Google Firebase / Firestore) to store accounts and encrypted data.',
        'AI model providers to generate insights, summaries, prompts, and conversation.',
        'Live voice-conversation providers (for example, Vapi) to power real-time spoken conversations with your AI companion; audio is processed to run the call.',
        'Emotion-analysis providers used to estimate the emotional tone of an entry.',
        'Subscription-management providers (for example, RevenueCat) to process purchases and manage your subscription and entitlement status.',
        'An image provider (for example, Unsplash) used to match a themed photograph to your daily insight card; photographer attribution is shown on the card.',
        'Apple, for sign-in, subscriptions, and in-app purchases.',
      ]} />
      <P>
        We do not sell your personal information, and we do not share your journal content with
        third parties for their own marketing.
      </P>

      <H2>7. Sharing you control</H2>
      <P>
        The Service lets you generate a shareable Daily Insights card. Sharing is always
        initiated by you. Any entry you mark as excluded from sharing is left out of the card and
        of the insights it summarizes. When you choose to share a card through your device&apos;s
        share sheet, the receiving app or service handles that content under its own terms.
      </P>

      <H2>8. Data retention &amp; deletion</H2>
      <P>
        We retain your information for as long as your account is active. You can delete
        individual entries at any time. You can also delete your account, which permanently
        removes your entries, derived AI data, and media. Some limited records may be retained
        where required to comply with legal, tax, or security obligations.
      </P>

      <H2>9. Your rights</H2>
      <P>
        Depending on where you live, you may have rights to access, correct, export, or delete
        your personal information, and to object to or restrict certain processing. You can
        exercise many of these rights directly in the app, or by contacting us at the address
        below.
      </P>

      <H2>10. Children</H2>
      <P>
        The Service is not directed to children. You must meet the minimum age required by your
        jurisdiction and the App Store to use it, and in any case be at least 13 years old (or
        older where local law requires). We do not knowingly collect personal information from
        children below the applicable age.
      </P>

      <H2>11. Security</H2>
      <P>
        We use technical and organizational measures — including encryption, access controls, and
        anonymized processing — to protect your information. No method of transmission or storage
        is completely secure, but we work to protect your data and to limit who can access it.
      </P>

      <H2>12. International transfers</H2>
      <P>
        Your information may be processed in countries other than your own. Where required, we
        rely on appropriate safeguards for such transfers.
      </P>

      <H2>13. Open source</H2>
      <P>
        The LuminaLog iOS app and backend are publicly available on GitHub. Our privacy practices
        are not only a promise — much of the implementation can be read and verified in the code.
      </P>

      <H2>14. Changes to this policy</H2>
      <P>
        We may update this Privacy Policy from time to time. When we make material changes, we
        will update the &ldquo;Last updated&rdquo; date above and, where appropriate, notify you in the app.
      </P>

      <H2>15. Contact us</H2>
      <P>
        Questions about this policy or your data? Email us at{' '}
        <a href="mailto:konradmgnat@gmail.com" style={{ color: 'var(--accentDeep)', fontWeight: 600 }}>konradmgnat@gmail.com</a>.
      </P>

      {/* Terms of Service included on the Privacy page, per request */}
      <div style={{ marginTop: 64, paddingTop: 8, borderTop: '1px solid var(--hairline2)' }}>
        <TermsContent heading="Terms of Service" />
      </div>
    </>
  )
}

/* ──────────────────────────────────────────────────────────────────────────
 * TERMS OF SERVICE (generic)
 * ────────────────────────────────────────────────────────────────────────── */
export function TermsContent({ heading }: { heading?: string }) {
  return (
    <>
      {heading && (
        <h2 className="serif" style={{ fontSize: 30, fontWeight: 600, letterSpacing: '-0.025em', color: 'var(--text)', marginTop: 32, marginBottom: 18, lineHeight: 1.15 }}>
          {heading}
        </h2>
      )}

      <P>
        These Terms of Service (&ldquo;Terms&rdquo;) govern your use of the LuminaLog application and
        related services (the &ldquo;Service&rdquo;). By creating an account or using the Service, you
        agree to these Terms. If you do not agree, do not use the Service.
      </P>

      <H2>1. The Service</H2>
      <P>
        LuminaLog is a private, AI-assisted journaling app. It lets you capture entries in text,
        voice, video, and photos, and provides AI-generated transcripts, summaries, insights,
        prompts, daily insight cards, and text or live-voice conversation with an AI companion
        grounded in your own entries. Features may change, improve, or be discontinued over time.
      </P>

      <H2>2. Eligibility</H2>
      <P>
        You must be at least 13 years old (or older if required by your jurisdiction or the App
        Store) and able to form a binding contract to use the Service.
      </P>

      <H2>3. Your account</H2>
      <P>
        You access the Service by signing in through a supported provider. You are responsible
        for activity under your account and for keeping your sign-in method secure. Notify us
        promptly of any unauthorized use.
      </P>

      <H2>4. Subscriptions, billing &amp; Voice Credits</H2>
      <UL items={[
        'The Service is offered as a monthly or annual subscription. Subscriptions are sold and managed through the Apple App Store and are billed to your Apple account.',
        'Subscriptions renew automatically unless cancelled at least 24 hours before the end of the current period. Manage or cancel your subscription in your App Store account settings.',
        'Live voice calls are powered by consumable Voice Credits purchased separately. Credits are consumed as you use them and are generally non-refundable once used, except where required by law.',
        'Prices may change; we will give notice as required. Refunds, where applicable, are handled according to Apple’s policies.',
      ]} />

      <H2>5. Your content &amp; ownership</H2>
      <P>
        You own your journal entries and the content you create. You grant us only the limited
        license needed to host, process, encrypt, transcribe, analyze, and display your content
        in order to provide the Service to you. We do not claim ownership of your content and we
        do not use it to train AI models.
      </P>

      <H2>6. Acceptable use</H2>
      <P>You agree not to:</P>
      <UL items={[
        'Use the Service for any unlawful purpose or to upload content you do not have the right to use.',
        'Attempt to access other users’ data, breach security, or disrupt the Service.',
        'Reverse engineer or misuse the Service except as permitted by its open-source license.',
        'Use the Service to harm yourself or others, or in place of emergency or professional help.',
      ]} />

      <H2>7. AI features &amp; no professional advice</H2>
      <P>
        AI-generated insights, prompts, summaries, emotional analysis, and conversation are for
        personal reflection only. They may be inaccurate or incomplete and are not professional,
        medical, psychological, legal, or financial advice, diagnosis, or treatment. The Service
        is not a crisis or mental-health service. If you are in distress or in an emergency,
        contact a qualified professional or your local emergency services.
      </P>

      <H2>8. Privacy</H2>
      <P>
        Your use of the Service is also governed by our{' '}
        <Link href="/privacy" style={{ color: 'var(--accentDeep)', fontWeight: 600 }}>Privacy Policy</Link>,
        which describes how we collect, use, and protect your information.
      </P>

      <H2>9. Intellectual property &amp; open source</H2>
      <P>
        The LuminaLog name and brand are our property. The application and backend source code
        are made available on GitHub under their applicable open-source license; your use of that
        code is governed by that license.
      </P>

      <H2>10. Third-party services</H2>
      <P>
        The Service relies on third-party providers (such as hosting, authentication, AI, and the
        App Store). We are not responsible for third-party services, and your use of them may be
        subject to their own terms.
      </P>

      <H2>11. Disclaimers</H2>
      <P>
        The Service is provided &ldquo;as is&rdquo; and &ldquo;as available,&rdquo; without warranties of any kind,
        whether express or implied, including fitness for a particular purpose and
        non-infringement, to the fullest extent permitted by law. We do not warrant that the
        Service will be uninterrupted, error-free, or that AI output will be accurate.
      </P>

      <H2>12. Limitation of liability</H2>
      <P>
        To the maximum extent permitted by law, LuminaLog and its operators will not be liable for
        any indirect, incidental, special, consequential, or punitive damages, or for any loss of
        data, profits, or goodwill. Our total liability for any claim relating to the Service will
        not exceed the amount you paid for the Service in the twelve months before the claim.
      </P>

      <H2>13. Indemnification</H2>
      <P>
        You agree to indemnify and hold harmless LuminaLog and its operators from claims arising
        out of your misuse of the Service or violation of these Terms.
      </P>

      <H2>14. Termination</H2>
      <P>
        You may stop using the Service and delete your account at any time. We may suspend or
        terminate access if you violate these Terms or to protect the Service. Provisions that by
        their nature should survive termination will survive.
      </P>

      <H2>15. Changes to these Terms</H2>
      <P>
        We may update these Terms from time to time. Material changes will be reflected by an
        updated date and, where appropriate, in-app notice. Continued use after changes take
        effect constitutes acceptance.
      </P>

      <H2>16. Governing law</H2>
      <P>
        These Terms are governed by the laws of the operator&apos;s principal place of business,
        without regard to conflict-of-laws rules, except where mandatory local consumer-protection
        laws apply to you.
      </P>

      <H2>17. Contact</H2>
      <P>
        Questions about these Terms? Email{' '}
        <a href="mailto:konradmgnat@gmail.com" style={{ color: 'var(--accentDeep)', fontWeight: 600 }}>konradmgnat@gmail.com</a>.
      </P>
    </>
  )
}
