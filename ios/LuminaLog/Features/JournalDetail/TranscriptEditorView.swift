import SwiftUI

/// Editor sheet for an image entry's transcript (design: editable transcript +
/// voice memos). Edit the text, clear it, or record voice memos that are
/// transcribed by the backend and appended to the text. Save uploads the clips
/// and persists the edited content.
struct TranscriptEditorView: View {

    @StateObject private var viewModel: TranscriptEditorViewModel
    @StateObject private var recorder = AudioRecorderController()
    @Environment(\.dismiss) private var dismiss

    init(
        entryId: String,
        initialText: String,
        journals: JournalRepository,
        ai: AIService,
        media: MediaUploader
    ) {
        _viewModel = StateObject(
            wrappedValue: TranscriptEditorViewModel(
                entryId: entryId,
                initialText: initialText,
                journals: journals,
                ai: ai,
                media: media
            )
        )
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.l) {
                    editor
                    recordControls
                    if !viewModel.pendingClips.isEmpty {
                        clipList
                    }
                }
                .padding(Spacing.m)
            }
            .background(Color.appBackground.ignoresSafeArea())
            .navigationTitle("Edit transcript")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if viewModel.saveState == .loading {
                        ProgressView().controlSize(.small).tint(Color.accentWarm)
                    } else {
                        Button("Save") { Task { await viewModel.save() } }
                    }
                }
            }
            .onChange(of: viewModel.didSave) { _, didSave in
                if didSave { dismiss() }
            }
            .alert(
                "Microphone access needed",
                isPresented: $recorder.permissionDenied
            ) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("Enable microphone access in Settings to record a voice memo.")
            }
            .alert(
                "Save failed",
                isPresented: Binding(
                    get: { viewModel.errorMessage != nil && !viewModel.didSave },
                    set: { if !$0 { viewModel.errorMessage = nil } }
                )
            ) {
                Button("OK", role: .cancel) { viewModel.errorMessage = nil }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
        }
    }

    // MARK: - Editor

    private var editor: some View {
        ZStack(alignment: .topTrailing) {
            TextEditor(text: $viewModel.text)
                .font(.journalBody)
                .foregroundStyle(Color.textPrimary)
                .scrollContentBackground(.hidden)
                .frame(minHeight: 220)
                .padding(Spacing.s)
                .background(
                    RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                        .fill(Color.secondaryBackground)
                )

            if !viewModel.text.isEmpty {
                Button {
                    viewModel.clear()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(Color.textSecondary)
                        .padding(Spacing.s)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear text")
            }
        }
    }

    // MARK: - Record

    @ViewBuilder
    private var recordControls: some View {
        if recorder.isRecording {
            HStack(spacing: Spacing.m) {
                Circle().fill(Color.danger).frame(width: 10, height: 10)
                Text(recorder.elapsedLabel)
                    .font(.captionText.monospacedDigit())
                    .foregroundStyle(Color.textSecondary)
                Spacer()
                Button {
                    if let clip = recorder.stop() {
                        Task { await viewModel.addRecordedClip(clip) }
                    }
                } label: {
                    Text("Stop").font(.uiBody.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, Spacing.l)
                        .frame(minHeight: 44)
                        .background(Capsule().fill(Color.danger))
                }
                .buttonStyle(.plain)
            }
        } else if viewModel.transcribeState == .loading {
            HStack(spacing: Spacing.s) {
                ProgressView().controlSize(.small).tint(Color.accentWarm)
                Text("Transcribing…").font(.captionText).foregroundStyle(Color.textSecondary)
                Spacer()
            }
            .frame(minHeight: 44)
        } else {
            Button {
                Task { await recorder.start() }
            } label: {
                HStack(spacing: Spacing.s) {
                    Image(systemName: "mic.fill")
                    Text("Record audio")
                }
                .font(.uiBody.weight(.semibold))
                .foregroundStyle(Color.accentWarm)
                .frame(maxWidth: .infinity, minHeight: 48)
                .background(
                    RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                        .stroke(Color.accentWarm, lineWidth: 1.5)
                )
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Pending clips

    private var clipList: some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            Text("VOICE MEMOS")
                .font(.captionText.weight(.semibold))
                .foregroundStyle(Color.textSecondary)
                .kerning(0.8)

            ForEach(viewModel.pendingClips) { clip in
                HStack(spacing: Spacing.s) {
                    Image(systemName: "waveform")
                        .foregroundStyle(Color.accentWarm)
                    Text(AudioPlayerCard.timeLabel(clip.durationSec))
                        .font(.captionText.monospacedDigit())
                        .foregroundStyle(Color.textSecondary)
                    Spacer()
                    if clip.transcribeFailed {
                        Button {
                            Task { await viewModel.transcribe(clipID: clip.id) }
                        } label: {
                            HStack(spacing: Spacing.xs) {
                                Image(systemName: "arrow.clockwise")
                                Text("Retry transcript")
                            }
                            .font(.captionText.weight(.semibold))
                            .foregroundStyle(Color.accentWarm)
                            .frame(minHeight: 44)
                        }
                        .buttonStyle(.plain)
                    } else {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(Color.accentWarm)
                    }
                }
                .padding(Spacing.m)
                .background(
                    RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                        .fill(Color.secondaryBackground)
                )
            }
        }
    }
}

// MARK: - Preview

#Preview("Editor") {
    TranscriptEditorView(
        entryId: "demo-entry-04",
        initialText: "Some OCR text from the photo.",
        journals: MockJournalRepository(),
        ai: MockAIService(),
        media: MockMediaUploader()
    )
}
