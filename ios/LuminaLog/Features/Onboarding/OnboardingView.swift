import SwiftUI

/// Pre-auth onboarding: landing page + 18 profile field screens, one per screen.
/// Voice or text; nothing is required.
struct OnboardingView: View {
    @StateObject private var viewModel: OnboardingViewModel
    let speech: SpeechTranscriber
    /// Called when the user finishes the flow (gate then shows sign-in).
    let onComplete: () -> Void
    /// When provided, a dev-mode dismiss button appears (top-right). Only visible
    /// when `DevFlags.devMode` is true — used by the Settings onboarding replay.
    let onDismiss: (() -> Void)?

    @State private var showingLanding = true

    init(
        store: OnboardingStore,
        speech: SpeechTranscriber,
        onComplete: @escaping () -> Void,
        onDismiss: (() -> Void)? = nil
    ) {
        _viewModel = StateObject(wrappedValue: OnboardingViewModel(store: store))
        self.speech = speech
        self.onComplete = onComplete
        self.onDismiss = onDismiss
    }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.appBackground.ignoresSafeArea()

            Group {
                if showingLanding {
                    landingPage
                        .transition(.opacity)
                } else {
                    questionFlow
                        .transition(.opacity)
                }
            }
            .animation(.easeInOut(duration: 0.3), value: showingLanding)

            // Dismiss button — only visible in dev mode (dev onboarding replay)
            if DevFlags.devMode, let onDismiss {
                Button { onDismiss() } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 26))
                        .foregroundStyle(Color.textSecondary)
                        .padding(Spacing.m)
                }
                .accessibilityLabel("Close onboarding preview")
            }
        }
    }

    // MARK: - Landing page

    private var landingPage: some View {
        ScrollView {
            VStack(spacing: Spacing.l) {
                // Logo
                if let icon = UIImage(named: "AppIcon") {
                    Image(uiImage: icon)
                        .resizable()
                        .scaledToFit()
                        .frame(width: 96, height: 96)
                        .clipShape(Circle())
                }

                // Title + subtitle
                VStack(spacing: Spacing.s) {
                    Text("Your AI Journaling Companion.")
                        .font(.journalTitle)
                        .foregroundStyle(Color.textPrimary)
                        .multilineTextAlignment(.center)

                    Text("Talk, Write or Film Your Day.")
                        .font(.system(.title3, design: .serif))
                        .foregroundStyle(Color.textSecondary)
                        .multilineTextAlignment(.center)
                }
                .padding(.horizontal, Spacing.l)

                // Value proposition
                Text("Develop your ability to articulate your thoughts and unlock your creativity. Through daily voice, text, and video journaling you empower yourself, discover who you are, and tap into the superhuman potential within you.")
                    .font(.uiBody)
                    .foregroundStyle(Color.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, Spacing.l)

                // Privacy / streak section
                VStack(alignment: .leading, spacing: Spacing.m) {
                    Text("Build Your Streak and Deepen The Merge")
                        .font(.uiBody.weight(.semibold))
                        .foregroundStyle(Color.textPrimary)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    privacyBadge(icon: "lock.fill",       label: "End-to-end encrypted")
                    privacyBadge(icon: "eye.slash.fill",  label: "We never read your entries")
                    privacyBadge(icon: "shield.fill",     label: "Anonymized — AI can't identify you")
                }
                .padding(Spacing.l)
                .background(
                    RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                        .fill(Color.secondaryBackground)
                )
                .padding(.horizontal, Spacing.m)

                // Get Started button
                Button {
                    withAnimation(.easeInOut(duration: 0.3)) {
                        showingLanding = false
                    }
                } label: {
                    Text("Get Started")
                        .font(.uiBody.weight(.semibold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, Spacing.m)
                        .background(Capsule().fill(Color.accentWarm))
                }
                .padding(.horizontal, Spacing.m)
                .padding(.bottom, Spacing.xl)
            }
            .padding(.top, Spacing.xl)
        }
    }

    @ViewBuilder
    private func privacyBadge(icon: String, label: String) -> some View {
        HStack(spacing: Spacing.m) {
            Image(systemName: icon)
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.accentWarm)
                .frame(width: 24)
            Text(label)
                .font(.uiBody)
                .foregroundStyle(Color.textPrimary)
        }
    }

    // MARK: - Question flow

    private var questionFlow: some View {
        VStack(spacing: Spacing.l) {
            ProgressView(value: viewModel.progress)
                .tint(Color.accentWarm)
                .padding(.top, Spacing.m)
                .padding(.horizontal, Spacing.m)

            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.m) {
                    Text(viewModel.current.question)
                        .font(.system(.title2, design: .serif).weight(.semibold))
                        .foregroundStyle(Color.textPrimary)
                    if !viewModel.current.helper.isEmpty {
                        Text(viewModel.current.helper)
                            .font(.captionText)
                            .foregroundStyle(Color.textSecondary)
                    }
                    DictationField(
                        placeholder: viewModel.current.title,
                        multiline: viewModel.current.multiline,
                        text: Binding(
                            get: { viewModel.binding(for: viewModel.current) },
                            set: { viewModel.setValue($0, for: viewModel.current) }
                        ),
                        speech: speech
                    )
                    if viewModel.current.key == "biography" {
                        let count = viewModel.binding(for: viewModel.current)
                            .split(whereSeparator: { $0.isWhitespace }).count
                        Text("\(count) / \(ProfileFieldCatalog.bioWordLimit) words")
                            .font(.captionText)
                            .foregroundStyle(count >= ProfileFieldCatalog.bioWordLimit ? Color.accentWarm : Color.textSecondary)
                            .frame(maxWidth: .infinity, alignment: .trailing)
                    }
                }
                .padding(.horizontal, Spacing.m)
                // Fresh identity per question so the DictationField's state and
                // recognition task reset when the screen advances.
                .id(viewModel.current.key)
            }

            navButtons
        }
    }

    private var navButtons: some View {
        HStack(spacing: Spacing.m) {
            Button("Back") {
                if viewModel.index == 0 {
                    withAnimation(.easeInOut(duration: 0.3)) {
                        showingLanding = true
                    }
                } else {
                    viewModel.back()
                }
            }
            .buttonStyle(.plain)
            .foregroundStyle(Color.textSecondary)

            Spacer()

            Button(viewModel.isLast ? "Get started" : "Next") {
                if viewModel.isLast {
                    viewModel.finish()
                    onComplete()
                } else {
                    viewModel.next()
                }
            }
            .font(.uiBody.weight(.semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, Spacing.l)
            .padding(.vertical, Spacing.m)
            .background(Capsule().fill(Color.accentWarm))
        }
        .padding(.horizontal, Spacing.m)
        .padding(.bottom, Spacing.l)
    }
}
