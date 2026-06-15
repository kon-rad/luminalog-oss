import SwiftUI
import AuthenticationServices

/// Calm welcome screen: wordmark, tagline, and the sign-in providers.
struct SignInView: View {

    @EnvironmentObject private var services: AppServices
    @Environment(\.colorScheme) private var colorScheme

    @State private var isWorking = false
    @State private var errorMessage: String?

    var body: some View {
        ZStack {
            Color.appBackground
                .ignoresSafeArea()

            VStack(spacing: 0) {
                Spacer()

                VStack(spacing: Spacing.m) {
                    Text("LuminaLog")
                        .font(.journalTitle)
                        .foregroundStyle(Color.textPrimary)
                    Text("Your journal, with a memory.")
                        .font(.promptQuote)
                        .foregroundStyle(Color.textSecondary)
                }
                .multilineTextAlignment(.center)
                .accessibilityElement(children: .combine)

                Spacer()
                Spacer()

                VStack(spacing: Spacing.m) {
                    if let errorMessage {
                        Text(errorMessage)
                            .font(.captionText)
                            .foregroundStyle(Color.accentWarm)
                            .multilineTextAlignment(.center)
                            .padding(.horizontal, Spacing.m)
                            .transition(.opacity)
                    }

                    appleButton
                    googleButton
                }
                .padding(.horizontal, Spacing.l)
                .padding(.bottom, Spacing.xl)
                .animation(.default, value: errorMessage)
            }
        }
    }

    // MARK: - Buttons

    /// HIG-styled Apple button for the visuals; an invisible overlay button
    /// routes the tap into `AuthService.signInWithApple()`, which owns the
    /// whole ASAuthorization handshake (nonce included).
    private var appleButton: some View {
        SignInWithAppleButton(.signIn, onRequest: { _ in }, onCompletion: { _ in })
            .signInWithAppleButtonStyle(colorScheme == .dark ? .white : .black)
            .frame(maxWidth: .infinity, minHeight: 50, maxHeight: 50)
            .clipShape(RoundedRectangle(cornerRadius: CornerRadius.medium))
            .allowsHitTesting(false)
            .accessibilityHidden(true)
            .overlay {
                Button {
                    run { try await services.auth.signInWithApple() }
                } label: {
                    Color.clear.contentShape(Rectangle())
                }
                .accessibilityLabel("Sign in with Apple")
            }
            .disabled(isWorking)
            .opacity(isWorking ? 0.5 : 1)
    }

    private var googleButton: some View {
        Button {
            run { try await services.auth.signInWithGoogle() }
        } label: {
            HStack(spacing: Spacing.s) {
                GoogleIcon()
                Text("Continue with Google")
                    .font(.uiBody.weight(.medium))
                    .foregroundStyle(Color.textPrimary)
            }
            .frame(maxWidth: .infinity)
            .frame(minHeight: 50)
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.medium)
                    .fill(Color.cardBackground)
            )
            .overlay(
                RoundedRectangle(cornerRadius: CornerRadius.medium)
                    .strokeBorder(Color.textSecondary.opacity(0.25), lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
        .disabled(isWorking)
        .opacity(isWorking ? 0.5 : 1)
    }

    // MARK: - Actions

    private func run(_ operation: @escaping () async throws -> Void) {
        guard !isWorking else { return }
        errorMessage = nil
        isWorking = true
        Task {
            do {
                try await operation()
            } catch AuthServiceError.cancelled {
                // The user dismissed the provider sheet — not an error.
            } catch {
                errorMessage = friendlyMessage(for: error)
            }
            isWorking = false
        }
    }

    private func friendlyMessage(for error: Error) -> String {
        if let authError = error as? AuthServiceError {
            return authError.localizedDescription
        }
        return "Something went wrong signing you in. Please try again."
    }
}

// MARK: - Google icon

/// Simple Google "G" badge that reads as the Google brand without requiring
/// an image asset.
private struct GoogleIcon: View {
    var body: some View {
        ZStack {
            Circle()
                .fill(Color(red: 0.259, green: 0.522, blue: 0.957))
                .frame(width: 22, height: 22)
            Text("G")
                .font(.system(size: 13, weight: .bold))
                .foregroundStyle(.white)
        }
    }
}

// MARK: - Previews

#Preview("Light") {
    SignInView()
        .environmentObject(AppServices.mocks())
}

#Preview("Dark") {
    SignInView()
        .environmentObject(AppServices.mocks())
        .preferredColorScheme(.dark)
}
