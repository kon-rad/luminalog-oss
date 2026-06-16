import SwiftUI

/// Voice call screen (design §8). Leans into a dark, immersive treatment in
/// BOTH appearance modes: a near-black backdrop with the breathing orb (or
/// live transcript), duration up top, and call controls along the bottom.
struct VoiceCallView: View {

    @StateObject private var viewModel: VoiceCallViewModel

    /// "View transcript" after the call: the parent dismisses this cover
    /// and pushes the saved `.voice` chat.
    let onViewTranscript: (Chat) -> Void
    /// Called when the user has no credits so the caller can present the store.
    let onInsufficientCredits: (() -> Void)?

    @Environment(\.dismiss) private var dismiss

    /// Deep near-black canvas used regardless of system appearance.
    private static let canvas = Color(red: 0.05, green: 0.045, blue: 0.04)

    init(
        voice: VoiceCallService,
        chats: ChatRepository,
        credits: CreditService,
        onViewTranscript: @escaping (Chat) -> Void,
        onInsufficientCredits: (() -> Void)? = nil
    ) {
        _viewModel = StateObject(wrappedValue: VoiceCallViewModel(voice: voice, chats: chats, credits: credits))
        self.onViewTranscript = onViewTranscript
        self.onInsufficientCredits = onInsufficientCredits
    }

    #if DEBUG
    /// Preview hook: render with a preconfigured view model.
    init(previewViewModel: VoiceCallViewModel) {
        _viewModel = StateObject(wrappedValue: previewViewModel)
        self.onViewTranscript = { _ in }
        self.onInsufficientCredits = nil
    }
    #endif

    var body: some View {
        ZStack {
            Self.canvas.ignoresSafeArea()

            switch viewModel.phase {
            case .connecting:
                connectingContent
            case .active:
                activeContent
            case .ended(let reason):
                endedContent(reason: reason)
            case .failed(let message):
                failedContent(message: message)
            case .insufficientCredits:
                // Handled via .onChange below; show nothing while dismissing.
                Color.clear
            }
        }
        // Immersive dark treatment in both modes (design §8) — children
        // (bubbles, controls) render their dark variants, and the preferred
        // scheme keeps the status bar legible over the near-black canvas.
        .environment(\.colorScheme, .dark)
        .preferredColorScheme(.dark)
        .task {
            await viewModel.start()
        }
        .onChange(of: viewModel.phase) { _, phase in
            if case .insufficientCredits = phase {
                dismiss()
                onInsufficientCredits?()
            }
        }
    }

    // MARK: - Connecting

    private var connectingContent: some View {
        VStack(spacing: Spacing.l) {
            BreathingOrb(state: .listening, dimmed: true)
            HStack(spacing: Spacing.s) {
                ProgressView()
                    .tint(Color.accentWarm)
                Text("Connecting…")
                    .font(.uiBody)
                    .foregroundStyle(Color.textSecondary)
            }
        }
        .overlay(alignment: .topTrailing) {
            closeButton
                .padding(Spacing.m)
        }
    }

    // MARK: - Active

    private var activeContent: some View {
        VStack(spacing: 0) {
            // Duration up top.
            Text(viewModel.durationText)
                .font(.statValue.monospacedDigit())
                .foregroundStyle(Color.textPrimary)
                .padding(.top, Spacing.m)
                .accessibilityLabel("Call duration \(viewModel.durationText)")

            Text("Voice chat with your journal")
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
                .padding(.top, Spacing.xs)

            Spacer(minLength: Spacing.m)

            switch viewModel.displayMode {
            case .animation:
                animationMode
            case .transcript:
                transcriptMode
            }

            Spacer(minLength: Spacing.m)

            controls
                .padding(.bottom, Spacing.l)
        }
        .padding(.horizontal, Spacing.m)
    }

    private var animationMode: some View {
        VStack(spacing: Spacing.xl) {
            BreathingOrb(state: viewModel.speakingState)

            VStack(spacing: Spacing.s) {
                Text(viewModel.speakingState.caption)
                    .font(.promptQuote)
                    .foregroundStyle(Color.textPrimary)
                    .contentTransition(.opacity)
                    .animation(.easeInOut(duration: 0.25), value: viewModel.speakingState)

                if let partial = viewModel.assistantPartial {
                    Text(partial)
                        .font(.uiBody)
                        .foregroundStyle(Color.textSecondary)
                        .multilineTextAlignment(.center)
                        .lineLimit(3)
                        .padding(.horizontal, Spacing.l)
                        .transition(.opacity)
                }
            }
            .frame(minHeight: 96, alignment: .top)
        }
    }

    private var transcriptMode: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: Spacing.s) {
                    ForEach(viewModel.transcript) { message in
                        MessageBubble(text: message.text, role: message.role)
                    }
                    if let partial = viewModel.assistantPartial {
                        MessageBubble(text: partial, role: .assistant, isStreaming: true)
                    }
                    Color.clear.frame(height: 1).id("voice-bottom")
                }
                .padding(.vertical, Spacing.s)
            }
            .onChange(of: viewModel.transcript.count) {
                withAnimation(.easeOut(duration: 0.2)) {
                    proxy.scrollTo("voice-bottom", anchor: .bottom)
                }
            }
            .onChange(of: viewModel.assistantPartial) {
                proxy.scrollTo("voice-bottom", anchor: .bottom)
            }
        }
    }

    /// Bottom controls: mute, animation/transcript toggle, prominent end.
    private var controls: some View {
        HStack(spacing: Spacing.xl) {
            controlButton(
                systemImage: viewModel.isMuted ? "mic.slash.fill" : "mic.slash",
                label: viewModel.isMuted ? "Unmute" : "Mute",
                isActive: viewModel.isMuted
            ) {
                viewModel.toggleMute()
            }

            // End call — prominent, red, larger.
            Button {
                Task { await viewModel.endCall() }
            } label: {
                Image(systemName: "phone.down.fill")
                    .font(.system(size: 26, weight: .semibold))
                    .foregroundStyle(.white)
                    .frame(width: 72, height: 72)
                    .background(Circle().fill(Color(red: 0.85, green: 0.25, blue: 0.22)))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("End call")

            controlButton(
                systemImage: viewModel.displayMode == .animation ? "text.bubble" : "waveform",
                label: viewModel.displayMode == .animation ? "Show transcript" : "Show animation",
                isActive: viewModel.displayMode == .transcript
            ) {
                withAnimation(.easeInOut(duration: 0.2)) {
                    viewModel.toggleDisplayMode()
                }
            }
        }
    }

    private func controlButton(
        systemImage: String,
        label: String,
        isActive: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            Image(systemName: systemImage)
                .font(.system(size: 20, weight: .medium))
                .foregroundStyle(isActive ? Self.canvas : Color.textPrimary)
                .frame(width: 56, height: 56)
                .background(
                    Circle().fill(isActive ? Color.textPrimary : Color.white.opacity(0.1))
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(label)
    }

    // MARK: - Ended

    private func endedContent(reason: String?) -> some View {
        VStack(spacing: Spacing.l) {
            Image(systemName: "checkmark.circle")
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(Color.accentWarm)

            VStack(spacing: Spacing.s) {
                Text("Call ended")
                    .font(.journalTitle)
                    .foregroundStyle(Color.textPrimary)
                Text(reason ?? "Your conversation was saved to Chats.")
                    .font(.uiBody)
                    .foregroundStyle(Color.textSecondary)
                    .multilineTextAlignment(.center)
                if viewModel.elapsedSeconds > 0 {
                    Text("Duration \(viewModel.durationText)")
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }
            }

            VStack(spacing: Spacing.s) {
                if let chat = viewModel.chat {
                    Button {
                        onViewTranscript(chat)
                    } label: {
                        Text("View transcript")
                            .font(.uiBody.weight(.semibold))
                            .foregroundStyle(.white)
                            .frame(maxWidth: .infinity, minHeight: 48)
                            .background(
                                RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                                    .fill(Color.accentWarm)
                            )
                    }
                    .buttonStyle(.plain)
                }

                Button {
                    dismiss()
                } label: {
                    Text("Done")
                        .font(.uiBody.weight(.semibold))
                        .foregroundStyle(Color.textPrimary)
                        .frame(maxWidth: .infinity, minHeight: 48)
                        .background(
                            RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                                .fill(Color.white.opacity(0.1))
                        )
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, Spacing.xl)
        }
        .padding(Spacing.l)
    }

    // MARK: - Failed

    private func failedContent(message: String) -> some View {
        VStack(spacing: Spacing.l) {
            Image(systemName: "exclamationmark.triangle")
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(Color.tintVoice)

            VStack(spacing: Spacing.s) {
                Text("Call failed")
                    .font(.journalTitle)
                    .foregroundStyle(Color.textPrimary)
                Text(message)
                    .font(.uiBody)
                    .foregroundStyle(Color.textSecondary)
                    .multilineTextAlignment(.center)
            }

            Button {
                dismiss()
            } label: {
                Text("Close")
                    .font(.uiBody.weight(.semibold))
                    .foregroundStyle(Color.textPrimary)
                    .frame(maxWidth: .infinity, minHeight: 48)
                    .background(
                        RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                            .fill(Color.white.opacity(0.1))
                    )
            }
            .buttonStyle(.plain)
            .padding(.horizontal, Spacing.xl)
        }
        .padding(Spacing.l)
    }

    private var closeButton: some View {
        Button {
            Task { await viewModel.endCall() }
            dismiss()
        } label: {
            Image(systemName: "xmark")
                .font(.system(size: 15, weight: .semibold))
                .foregroundStyle(Color.textSecondary)
                .frame(width: 36, height: 36)
                .background(Circle().fill(Color.white.opacity(0.08)))
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Cancel call")
    }
}

// MARK: - Breathing orb

/// Calming audio-reactive orb: concentric rings breathe via a sine wave whose
/// speed/amplitude follow the call state, tinted by who is speaking.
struct BreathingOrb: View {

    let state: VoiceCallViewModel.SpeakingState
    var dimmed = false

    var body: some View {
        TimelineView(.animation) { timeline in
            let time = timeline.date.timeIntervalSinceReferenceDate
            let params = Self.params(for: state)

            ZStack {
                ForEach(0..<3, id: \.self) { ring in
                    let phase = Double(ring) * 0.9
                    let scale = 1 + params.amplitude * sin(time * params.speed + phase)
                    Circle()
                        .fill(params.tint.opacity((0.22 - Double(ring) * 0.06) * (dimmed ? 0.5 : 1)))
                        .frame(width: 170 + CGFloat(ring) * 56, height: 170 + CGFloat(ring) * 56)
                        .scaleEffect(scale)
                }

                Circle()
                    .fill(
                        RadialGradient(
                            colors: [
                                params.tint.opacity(dimmed ? 0.5 : 0.95),
                                params.tint.opacity(dimmed ? 0.25 : 0.55)
                            ],
                            center: .center,
                            startRadius: 8,
                            endRadius: 80
                        )
                    )
                    .frame(width: 150, height: 150)
                    .scaleEffect(1 + params.amplitude * 0.6 * sin(time * params.speed))
                    .shadow(color: params.tint.opacity(dimmed ? 0.15 : 0.45), radius: 40)
            }
        }
        .frame(width: 300, height: 300)
        .animation(.easeInOut(duration: 0.4), value: state)
        .accessibilityHidden(true)
    }

    private static func params(
        for state: VoiceCallViewModel.SpeakingState
    ) -> (speed: Double, amplitude: Double, tint: Color) {
        switch state {
        case .listening:
            // Gentle resting pulse.
            return (1.6, 0.035, .accentWarm)
        case .thinking:
            // Quick, tight shimmer.
            return (5.0, 0.02, .accentWarm)
        case .assistantSpeaking:
            // Stronger, talkative swell.
            return (3.2, 0.08, .accentWarm)
        case .userSpeaking:
            // Distinct tint while the user holds the floor.
            return (3.0, 0.06, .tintVoice)
        }
    }
}

// MARK: - Previews

#if DEBUG

#Preview("Connecting") {
    VoiceCallPreview(configure: { vm in
        vm.setPreviewState(phase: .connecting)
    })
}

#Preview("Active — animation") {
    VoiceCallPreview(configure: { vm in
        vm.setPreviewState(
            phase: .active,
            speakingState: .assistantSpeaking,
            assistantPartial: "You wrote this morning about wanting margin before the rush…",
            elapsedSeconds: 83
        )
    })
}

#Preview("Active — transcript") {
    VoiceCallPreview(configure: { vm in
        vm.setPreviewState(
            phase: .active,
            speakingState: .listening,
            transcript: MockData.chatMessages["demo-chat-02"] ?? [],
            elapsedSeconds: 247,
            displayMode: .transcript
        )
    })
}

#Preview("Ended") {
    VoiceCallPreview(configure: { vm in
        vm.setPreviewState(phase: .ended(reason: "Talk soon — I'll be here."), elapsedSeconds: 312)
    })
}

#Preview("Failed") {
    VoiceCallPreview(configure: { vm in
        vm.setPreviewState(phase: .failed(message: "Voice calls aren't available yet in this build."))
    })
}

private struct VoiceCallPreview: View {
    let configure: (VoiceCallViewModel) -> Void

    var body: some View {
        let repository = MockChatRepository()
        let viewModel = VoiceCallViewModel(
            voice: MockVoiceCallService(chats: repository),
            chats: repository,
            credits: MockCreditService()
        )
        viewModel.disableStartForPreviews()
        configure(viewModel)
        return VoiceCallView(previewViewModel: viewModel)
    }
}

#endif
