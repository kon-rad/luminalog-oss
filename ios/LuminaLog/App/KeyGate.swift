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
    /// The SAME connected-wallet session the rest of the app uses (sign-in,
    /// wallet linking). Nil when wallet-connect isn't wired (previews/mocks),
    /// which simply hides the wallet-unlock option.
    var wallet: WalletConnectService?
    /// Reads the `eoa` wrap slot, both to decide whether to offer the wallet
    /// option at all and (inside `submitWalletUnlock`) to unwrap the DEK.
    var eoaTransport: EOAWrapTransport?
    /// Called once the key becomes usable, so `SessionStore` can run the profile
    /// seed + stream it deferred while the user was locked out.
    var onUnlock: () async -> Void
    var onSignOut: () -> Void
    @ViewBuilder var content: () -> Content

    @State private var isSubmitting = false
    /// True once the server confirms this account has an `eoa` wrap on file.
    /// Resolved here rather than passed in because the fetch is only worth
    /// making when the user actually lands on `.needsRecoveryCode`.
    @State private var hasEOAWrap = false
    /// Which of the two unlock screens is showing. The recovery code stays the
    /// default: it is the backstop every account has, while the wallet wrap is
    /// opt-in.
    @State private var showWalletUnlock = false

    /// Whether the wallet-unlock option can be offered at all: the services are
    /// wired AND this account has an `eoa` wrap to open.
    private var canUnlockWithWallet: Bool {
        hasEOAWrap && wallet != nil && eoaTransport != nil
    }

    /// True while the user is locked out and being asked for key material.
    private var isLockedOut: Bool {
        if case .needsRecoveryCode = enrollment.state { return true }
        return false
    }

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
                if showWalletUnlock && canUnlockWithWallet {
                    WalletUnlockView(
                        failedAttempt: failedAttempt,
                        isSubmitting: isSubmitting,
                        onUnlock: { unlockWithWallet() },
                        onUseRecoveryCodeInstead: { showWalletUnlock = false },
                        onSignOut: onSignOut
                    )
                } else {
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
                        onSignOut: onSignOut,
                        onUseWalletInstead: canUnlockWithWallet ? { showWalletUnlock = true } : nil
                    )
                }

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
        // Only asked once the user is actually locked out, and only once per
        // lockout: a failed attempt re-emits `.needsRecoveryCode` but leaves
        // this id `true`, so the fetch is not repeated.
        .task(id: isLockedOut) {
            guard isLockedOut, let eoaTransport, !hasEOAWrap else { return }
            // A fetch failure (offline) simply leaves the wallet option hidden;
            // the recovery code stays available either way.
            let wrap = try? await eoaTransport.fetchEOAWrap()
            hasEOAWrap = wrap != nil
        }
    }

    /// Sign the fixed key-wrap message with the connected wallet and unwrap the
    /// DEK from the `eoa` slot. Reuses the app's existing wallet session,
    /// connecting first only when nothing is connected yet.
    private func unlockWithWallet() {
        guard !isSubmitting, let wallet, let eoaTransport else { return }
        Task {
            isSubmitting = true
            defer { isSubmitting = false }
            if wallet.connectedAddress == nil {
                // A cancelled connect is a user decision, not a failed unlock:
                // leave the state (and the on-screen message) untouched.
                do { try await wallet.connect() } catch { return }
            }
            await enrollment.submitWalletUnlock(
                userId: userId, wallet: wallet, eoaTransport: eoaTransport)
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
                Text("Your entries are safe, nothing was changed.")
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
                Spacer()
                KeyGatePrimaryButton(title: "Try again", action: onRetry)
            }
            .padding(Spacing.l)
        }
    }
}
