import SwiftUI

/// Final onboarding gate: explicit, informed consent for the public, on-chain
/// **LuminaSoul** NFT. The Soul publishes the user's first name + journaling stats on
/// the Base blockchain, permanently and publicly — so we spell out exactly what is
/// shared and require an explicit choice. Declining is fine: the Soul simply never
/// mints (the server gates minting on `consent.soulPublicNft`).
struct SoulConsentStep: View {

    /// The user's first name (from the "Your name" step) for personalizing the copy.
    let firstName: String
    /// `true` = agree (the Soul may mint), `false` = decline (it never mints).
    let onDecision: (Bool) -> Void

    private var possessive: String {
        firstName.isEmpty ? "Your" : "\(firstName)'s"
    }

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()

            VStack(alignment: .leading, spacing: Spacing.l) {
                Spacer(minLength: Spacing.xl)

                Image(systemName: "sparkles")
                    .font(.system(size: 40, weight: .semibold))
                    .foregroundStyle(Color.accentWarm)

                VStack(alignment: .leading, spacing: Spacing.s) {
                    Text("Your public Soul")
                        .font(.journalDetailTitle)
                        .foregroundStyle(Color.textPrimary)
                    Text("LuminaLog can mint you a **LuminaSoul** — a one-of-a-kind NFT on the Base blockchain that grows as you journal. It's **public and permanent**.")
                        .font(.uiBody)
                        .foregroundStyle(Color.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
                }

                VStack(alignment: .leading, spacing: Spacing.m) {
                    Text("What becomes public, on-chain, forever:")
                        .font(.uiBody.weight(.semibold))
                        .foregroundStyle(Color.textPrimary)
                    sharedRow("person.fill", "Your first name", possessive == "Your" ? "the name you chose above" : firstName)
                    sharedRow("calendar", "Days journaled", "how many days you've written")
                    sharedRow("flame.fill", "Streaks", "your current and longest streak")
                    sharedRow("text.word.spacing", "Total words", "your lifetime word count")
                }
                .padding(Spacing.m)
                .background(
                    RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                        .fill(Color.cardBackground)
                )

                Label {
                    Text("Your journal entries, media, and everything you write are **never** put on-chain — only the details above are public.")
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                } icon: {
                    Image(systemName: "lock.fill").foregroundStyle(Color.accentWarm)
                }

                Spacer()

                VStack(spacing: Spacing.s) {
                    Button {
                        onDecision(true)
                    } label: {
                        Text("I understand & agree")
                            .font(.uiBody.weight(.semibold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, Spacing.m)
                            .background(
                                RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                                    .fill(Color.accentWarm)
                            )
                    }
                    .buttonStyle(.plain)

                    Button {
                        onDecision(false)
                    } label: {
                        Text("Not now — keep my Soul private")
                            .font(.uiBody)
                            .foregroundStyle(Color.textSecondary)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, Spacing.s)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, Spacing.l)
            .padding(.bottom, Spacing.l)
        }
    }

    private func sharedRow(_ icon: String, _ title: String, _ detail: String) -> some View {
        HStack(alignment: .top, spacing: Spacing.s) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .semibold))
                .foregroundStyle(Color.accentWarm)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: 1) {
                Text(title).font(.uiBody).foregroundStyle(Color.textPrimary)
                Text(detail).font(.captionText).foregroundStyle(Color.textSecondary)
            }
            Spacer()
        }
    }
}
