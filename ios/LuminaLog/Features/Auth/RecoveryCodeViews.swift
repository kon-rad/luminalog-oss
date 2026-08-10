import SwiftUI

/// Shown exactly once, right after a new account's encryption key is enrolled.
///
/// The code is derived into `KEK_recovery` and never stored — not on the device,
/// not on our servers — so this screen is the user's only chance to keep it. It
/// gates on an explicit confirmation rather than a dismissible card for that
/// reason: if the iCloud Keychain is ever lost, this code is the only thing that
/// can decrypt their journal.
struct RecoveryCodeDisplayView: View {

    let code: String
    var onContinue: () -> Void

    @State private var savedCodeConfirmed = false

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()

            VStack(spacing: Spacing.l) {
                VStack(spacing: Spacing.s) {
                    Image(systemName: "key.horizontal")
                        .font(.system(size: 36))
                        .foregroundStyle(Color.accentWarm)
                    Text("Save your recovery code")
                        .font(.sectionHeader)
                        .foregroundStyle(Color.textPrimary)
                    Text("Your journal is encrypted with a key only you hold. This code is the backup way to unlock it if you ever lose access to this device, we can't recover it for you.")
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                        .multilineTextAlignment(.center)
                }

                VStack(spacing: Spacing.s) {
                    Text(code)
                        .font(.system(.body, design: .monospaced))
                        .foregroundStyle(Color.textPrimary)
                        .multilineTextAlignment(.center)
                        .textSelection(.enabled)
                        .padding(Spacing.m)
                        .frame(maxWidth: .infinity)
                        .background(
                            RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                                .fill(Color.cardBackground)
                        )
                        .overlay(
                            RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                                .strokeBorder(Color.textSecondary.opacity(0.25), lineWidth: 1)
                        )
                    CopyButton(text: code, accessibilityText: "Copy recovery code")
                }

                Toggle(isOn: $savedCodeConfirmed) {
                    Text("I've saved my recovery code")
                        .font(.uiBody)
                        .foregroundStyle(Color.textPrimary)
                }
                .tint(Color.accentWarm)

                Spacer()

                KeyGatePrimaryButton(title: "Continue", disabled: !savedCodeConfirmed, action: onContinue)
            }
            .padding(Spacing.l)
        }
        .interactiveDismissDisabled(true)
    }
}

/// Shown when the account HAS an encryption key but this device holds nothing
/// that can open it — a reinstall, a new device, or iCloud Keychain turned off.
/// Without this screen those states are indistinguishable from "my journal is
/// empty", which is what made the original bug invisible (ADR-0114).
struct RecoveryCodeEntryView: View {

    let failedAttempt: Bool
    let isSubmitting: Bool
    var onSubmit: (String) -> Void
    var onSignOut: () -> Void

    @State private var code = ""

    private var canSubmit: Bool {
        !isSubmitting && !RecoveryCode.normalize(code).isEmpty
    }

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()

            VStack(spacing: Spacing.l) {
                VStack(spacing: Spacing.s) {
                    Image(systemName: "lock.rotation")
                        .font(.system(size: 36))
                        .foregroundStyle(Color.accentWarm)
                    Text("Unlock your journal")
                        .font(.sectionHeader)
                        .foregroundStyle(Color.textPrimary)
                    Text("This device doesn't have your encryption key yet. Enter the recovery code you saved when you set up your account.")
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                        .multilineTextAlignment(.center)
                }

                TextField("XXXX-XXXX-XXXX…", text: $code, axis: .vertical)
                    .font(.system(.body, design: .monospaced))
                    .foregroundStyle(Color.textPrimary)
                    .textInputAutocapitalization(.characters)
                    .autocorrectionDisabled(true)
                    .lineLimit(3, reservesSpace: true)
                    .padding(Spacing.m)
                    .background(
                        RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                            .fill(Color.cardBackground)
                    )
                    .overlay(
                        RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                            .strokeBorder(
                                failedAttempt ? Color.danger : Color.textSecondary.opacity(0.25),
                                lineWidth: 1
                            )
                    )

                if failedAttempt {
                    Text("That code didn't unlock your journal. Check for missing characters and try again.")
                        .font(.captionText)
                        .foregroundStyle(Color.danger)
                        .multilineTextAlignment(.center)
                }

                Spacer()

                KeyGatePrimaryButton(
                    title: isSubmitting ? "Unlocking…" : "Unlock",
                    disabled: !canSubmit,
                    action: { onSubmit(code) }
                )

                Button("Sign in with a different account", action: onSignOut)
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
            }
            .padding(Spacing.l)
        }
        .interactiveDismissDisabled(true)
    }
}

/// Shared capsule button for the key-gate screens, matching `ZKMigrationView`.
struct KeyGatePrimaryButton: View {
    let title: String
    var disabled: Bool = false
    var action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(title)
                .font(.uiBody.weight(.semibold))
                .foregroundStyle(Color.appBackground)
                .frame(maxWidth: .infinity)
                .frame(minHeight: 50)
                .background(Capsule().fill(Color.accentWarm.opacity(disabled ? 0.4 : 1)))
        }
        .buttonStyle(.plain)
        .disabled(disabled)
    }
}

// MARK: - Previews

#Preview("Save code") {
    RecoveryCodeDisplayView(
        code: RecoveryCode.group("A1B2C3D4E5F6G7H8J9K0MNPQRSTVWXYZ0123456789ABCDEFGHJK"),
        onContinue: {}
    )
}

#Preview("Enter code") {
    RecoveryCodeEntryView(failedAttempt: true, isSubmitting: false, onSubmit: { _ in }, onSignOut: {})
}
