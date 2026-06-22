import SwiftUI

/// Pre-auth onboarding: introduces LuminaLog's value proposition and collects
/// the 18 profile fields, one per screen. Voice or text; nothing is required.
struct OnboardingView: View {
    @StateObject private var viewModel: OnboardingViewModel
    let speech: SpeechTranscriber
    /// Called when the user finishes the flow (gate then shows sign-in).
    let onComplete: () -> Void

    init(store: OnboardingStore, speech: SpeechTranscriber, onComplete: @escaping () -> Void) {
        _viewModel = StateObject(wrappedValue: OnboardingViewModel(store: store))
        self.speech = speech
        self.onComplete = onComplete
    }

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            VStack(spacing: Spacing.l) {
                ProgressView(value: viewModel.progress)
                    .tint(Color.accentWarm)
                    .padding(.top, Spacing.m)
                    .padding(.horizontal, Spacing.m)

                if viewModel.index == 0 { valueProp }

                ScrollView {
                    VStack(alignment: .leading, spacing: Spacing.m) {
                        graphicSlot(viewModel.current.graphicAsset)
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
                    // recognition task reset (and the old one's .onDisappear fires)
                    // when the screen advances.
                    .id(viewModel.current.key)
                }

                navButtons
            }
        }
    }

    private var valueProp: some View {
        VStack(spacing: Spacing.s) {
            Text("Welcome to LuminaLog")
                .font(.journalTitle)
                .foregroundStyle(Color.textPrimary)
            Text("A daily journal for self-discovery, self-knowledge, and self-actualization — open-ended writing about what matters to you, with AI insights, prompts, and a companion who remembers. Aim for 750 words a day to build a streak that grows your vocabulary, your ideas, and your connection with yourself.")
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(.horizontal, Spacing.l)
    }

    /// Placeholder illustration slot until the SVG art (follow-on) is produced.
    private func graphicSlot(_ name: String) -> some View {
        RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
            .fill(Color.accentWarm.opacity(0.10))
            .frame(height: 160)
            .frame(maxWidth: .infinity)
            .overlay(
                Image(systemName: "sparkles")
                    .font(.system(size: 40, weight: .light))
                    .foregroundStyle(Color.accentWarm.opacity(0.5))
            )
            .accessibilityHidden(true)
    }

    private var navButtons: some View {
        HStack(spacing: Spacing.m) {
            if viewModel.index > 0 {
                Button("Back") { viewModel.back() }
                    .buttonStyle(.plain)
                    .foregroundStyle(Color.textSecondary)
            }
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
