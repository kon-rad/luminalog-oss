import SwiftUI

/// A text field with a large multiline editor and dictation controls. The mic
/// button streams live speech into the bound value; the paste button inserts
/// clipboard text. Both controls sit at the bottom-left under the editor.
struct DictationField: View {
    let placeholder: String
    let multiline: Bool
    @Binding var text: String
    let speech: SpeechTranscriber

    @State private var isListening = false
    @State private var task: Task<Void, Never>?

    // ~42% of screen height gives a spacious writing area across all devices.
    private let textAreaHeight: CGFloat = UIScreen.main.bounds.height * 0.42

    var body: some View {
        VStack(spacing: Spacing.xs) {
            TextEditor(text: $text)
                .frame(height: textAreaHeight)
                .scrollContentBackground(.hidden)
                .font(.uiBody)
                .foregroundStyle(Color.textPrimary)
                .padding(Spacing.s)
                .background(
                    RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                        .fill(Color.secondaryBackground.opacity(0.6))
                )
                .overlay(alignment: .topLeading) {
                    if text.isEmpty {
                        Text(placeholder)
                            .font(.uiBody)
                            .foregroundStyle(Color.textSecondary.opacity(0.5))
                            .padding(.top, Spacing.s + 8)
                            .padding(.leading, Spacing.s + 5)
                            .allowsHitTesting(false)
                    }
                }

            // Mic + paste buttons anchored to the left
            HStack(spacing: Spacing.s) {
                micButton
                pasteButton
                Spacer()
            }
        }
        // Stop any in-flight dictation when this field leaves the hierarchy
        // (e.g. the onboarding screen advances), so its recognition task can't
        // keep writing into the next screen's binding.
        .onDisappear { stop() }
    }

    private var micButton: some View {
        Button {
            isListening ? stop() : start()
        } label: {
            Image(systemName: isListening ? "mic.fill" : "mic")
                .font(.system(size: 15, weight: .medium))
                .foregroundStyle(isListening ? .white : Color.accentWarm)
                .frame(width: 38, height: 38)
                .background(
                    Circle().fill(isListening ? Color.accentWarm : Color.accentWarm.opacity(0.12))
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel(isListening ? "Stop dictation" : "Start dictation")
    }

    private var pasteButton: some View {
        Button {
            guard let paste = UIPasteboard.general.string, !paste.isEmpty else { return }
            text = text.isEmpty ? paste : text + " " + paste
        } label: {
            Image(systemName: "doc.on.clipboard")
                .font(.system(size: 14, weight: .medium))
                .foregroundStyle(Color.textSecondary)
                .frame(width: 38, height: 38)
                .background(
                    Circle().fill(Color.secondaryBackground.opacity(0.8))
                )
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Paste transcript from clipboard")
    }

    private func start() {
        guard task == nil else { return }
        isListening = true // optimistic — reset below if permission is denied
        // Capture the pre-dictation text synchronously (before any async suspension)
        // so the binding always reads the current field value.
        let sessionBase = textWithTrailingSpace(text)
        task = Task {
            guard await speech.requestAuthorization(), !Task.isCancelled else {
                isListening = false
                task = nil
                return
            }
            let stream = speech.startLiveTranscription()
            // `committed` grows as Apple fires isFinal or resets mid-session.
            // `lastPartial` is the previous Apple partial for reset detection.
            var committed = sessionBase
            var lastPartial = ""
            do {
                for try await partial in stream {
                    if Task.isCancelled { break }
                    // Apple's on-device recognizer occasionally resets its running
                    // transcript mid-session without firing isFinal — the new partial
                    // starts from "" (or a much shorter string). Detect this by
                    // checking if the partial shrank to less than a third of the
                    // previous one; if so, commit whatever is currently displayed
                    // so the new partial appends rather than replaces.
                    if !lastPartial.isEmpty && partial.count < lastPartial.count / 3 {
                        committed = textWithTrailingSpace(text)
                    }
                    lastPartial = partial
                    text = committed + partial
                }
            } catch {}
            isListening = false
            task = nil
        }
    }

    private func textWithTrailingSpace(_ s: String) -> String {
        guard !s.isEmpty else { return "" }
        return s.hasSuffix(" ") ? s : s + " "
    }

    private func stop() {
        speech.stopLiveTranscription()
        task?.cancel()
        task = nil
        isListening = false
    }
}
