import SwiftUI

/// Required AI-data-sharing consent screen (App Store 5.1.1/5.1.2). Shown before
/// any AI call — as a required onboarding step and via `ConsentGate`. Purely
/// presentational; the caller persists consent in `onAgree`.
struct AIConsentView: View {
    let onAgree: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.l) {
                    Text("Your journal & AI")
                        .font(.journalTitle)
                        .foregroundStyle(Color.textPrimary)

                    Text("LuminaLog uses AI to create your summaries, reflections, daily prompts, and voice features. To do that, the **entries, voice recordings, and profile details** you use with an AI feature are sent — over an encrypted connection — to trusted AI providers who process them for you:")
                        .font(.uiBody)
                        .foregroundStyle(Color.textPrimary)

                    VStack(alignment: .leading, spacing: Spacing.s) {
                        providerRow("Together AI", "summaries, chat, prompts, transcription")
                        providerRow("Hume AI", "optional emotion insights")
                        providerRow("Vapi & Deepgram", "live voice journaling")
                    }
                    .padding(Spacing.m)
                    .background(RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous).fill(Color.cardBackground))

                    Text("Your journal is encrypted at rest and we can't read your stored entries — but text or audio you use with an AI feature is shared with these providers to generate your results. They process it only to provide these features — never to train their models or for advertising.")
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)

                    Link("Privacy Policy", destination: URL(string: "https://luminalog.com/privacy")!)
                        .font(.uiBody.weight(.semibold))
                        .foregroundStyle(Color.accentWarm)
                }
                .padding(Spacing.l)
            }
            VStack(spacing: Spacing.s) {
                Text("By continuing, you agree to this processing.")
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
                Button(action: onAgree) {
                    Text("I Agree & Continue")
                        .font(.uiBody.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, minHeight: 52)
                        .background(Capsule().fill(Color.accentWarm))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("I Agree and Continue")
            }
            .padding(Spacing.l)
        }
        .background(Color.appBackground.ignoresSafeArea())
    }

    private func providerRow(_ name: String, _ purpose: String) -> some View {
        HStack(alignment: .top, spacing: Spacing.s) {
            Image(systemName: "circle.fill").font(.system(size: 6)).foregroundStyle(Color.accentWarm).padding(.top, 7)
            (Text(name).font(.uiBody.weight(.semibold)) + Text(" — \(purpose)").font(.uiBody))
                .foregroundStyle(Color.textPrimary)
        }
    }
}

#Preview { AIConsentView(onAgree: {}) }
