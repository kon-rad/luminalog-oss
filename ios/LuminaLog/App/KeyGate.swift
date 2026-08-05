import SwiftUI

/// Launch-level gate on the zero-knowledge encryption key.
///
/// Renders `content` only once a DEK is installed. Without one, every content
/// path fails closed — journal lists yield empty and saves throw — so before
/// this gate existed a keyless account looked like an app whose data silently
/// vanished (ADR-0114). It sits OUTSIDE `ConsentGate`/`PaywallGate`: nothing in
/// the app is meaningful without a key, and enrollment needs only a Firebase
/// token.
///
/// Brand-new accounts pass through in one tap (enrollment is non-interactive;
/// only the recovery code needs acknowledging). Returning users never see it.
struct KeyGate<Content: View>: View {

    @ObservedObject var enrollment: KeyEnrollmentService
    let userId: String
    /// Called once the key becomes usable, so `SessionStore` can run the profile
    /// seed + stream it deferred while the user was locked out.
    var onUnlock: () async -> Void
    var onSignOut: () -> Void
    @ViewBuilder var content: () -> Content

    @State private var isSubmitting = false

    var body: some View {
        Group {
            switch enrollment.state {
            case .resolving:
                UnlockingView()

            case .unlocked:
                content()

            case .showingRecoveryCode(let code):
                RecoveryCodeDisplayView(code: code) {
                    enrollment.acknowledgeRecoveryCode(userId: userId)
                }

            case .needsRecoveryCode(let failedAttempt):
                RecoveryCodeEntryView(
                    failedAttempt: failedAttempt,
                    isSubmitting: isSubmitting,
                    onSubmit: { code in
                        Task {
                            isSubmitting = true
                            await enrollment.submitRecoveryCode(code, userId: userId)
                            isSubmitting = false
                        }
                    },
                    onSignOut: onSignOut
                )

            case .failed(let message):
                KeyUnlockFailedView(message: message) {
                    Task { await enrollment.resolve(userId: userId) }
                }
            }
        }
        // The recovery-code path unlocks long after sign-in, so the deferred
        // profile bootstrap runs here rather than in `handleAuthChange`.
        .task(id: enrollment.state == .unlocked) {
            guard enrollment.state == .unlocked else { return }
            await onUnlock()
        }
    }
}

/// Neutral progress state while the key is being loaded, enrolled, or unlocked.
private struct UnlockingView: View {
    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            VStack(spacing: Spacing.m) {
                ProgressView().tint(Color.accentWarm)
                Text("Unlocking your journal…")
                    .font(.uiBody)
                    .foregroundStyle(Color.textSecondary)
            }
        }
    }
}

/// A transient failure (offline, server unreachable). Explicitly NOT treated as
/// "this account has no key" — enrolling on a network blip would mint a second
/// DEK and orphan everything already encrypted under the first.
private struct KeyUnlockFailedView: View {
    let message: String
    var onRetry: () -> Void

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            VStack(spacing: Spacing.m) {
                Spacer()
                Image(systemName: "exclamationmark.triangle")
                    .font(.system(size: 36))
                    .foregroundStyle(Color.danger)
                Text("Couldn't unlock your journal")
                    .font(.sectionHeader)
                    .foregroundStyle(Color.textPrimary)
                Text(message)
                    .font(.uiBody)
                    .foregroundStyle(Color.textSecondary)
                    .multilineTextAlignment(.center)
                Text("Your entries are safe — nothing was changed.")
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
                Spacer()
                KeyGatePrimaryButton(title: "Try again", action: onRetry)
            }
            .padding(Spacing.l)
        }
    }
}
