import AVFoundation
import SwiftUI

/// Shared voice picker for a live call and Settings. The sample is available
/// only outside a call so it cannot play over someone's conversation.
struct CallVoiceSelectionView: View {
    let inCall: Bool

    @ObservedObject private var preference = CallVoicePreference.shared
    @Environment(\.dismiss) private var dismiss
    @State private var previewing: CallVoiceChoice?
    @State private var previewError: String?
    @State private var previewTask: Task<Void, Never>?
    @State private var player = CallVoicePreviewPlayer()

    private var neuralAvailable: Bool {
        ProcessInfo.processInfo.physicalMemory >= LocalVoiceEngines.neuralVoiceMinimumMemory
    }

    var body: some View {
        NavigationStack {
            List {
                Section {
                    ForEach(CallVoiceChoice.allCases) { choice in
                        row(choice)
                    }
                } footer: {
                    Text(neuralAvailable
                         ? "Voices speak on this iPhone. Another voice may need a one-time download."
                         : "This iPhone uses its device voice because it has limited memory.")
                }

                if inCall {
                    Section {
                        Text("A change starts with the next reply. The current reply finishes in its original voice.")
                    }
                    if let effective = preference.effective {
                        Section("Now speaking") {
                            Text(effective.title)
                            if let reason = preference.fallbackReason {
                                Text(reason).font(.footnote)
                            }
                        }
                    }
                }

                if let error = preference.errorMessage ?? previewError {
                    Section {
                        Text(error)
                            .foregroundStyle(.red)
                            .accessibilityAddTraits(.updatesFrequently)
                        if let failed = preference.failedChoice {
                            Button("Retry \(failed.title)") {
                                Task { await preference.select(failed) }
                            }
                        }
                    }
                }
            }
            .navigationTitle("Call voice")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .onDisappear {
            previewTask?.cancel()
            player.stop()
        }
    }

    private func row(_ choice: CallVoiceChoice) -> some View {
        HStack(spacing: 12) {
            Button {
                Task { await preference.select(choice) }
            } label: {
                HStack {
                    Text(choice.title)
                    Spacer()
                    if preference.preparing == choice {
                        ProgressView().accessibilityLabel("Preparing \(choice.title)")
                    } else if preference.selected == choice {
                        Image(systemName: "checkmark")
                            .foregroundStyle(.tint)
                    }
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .disabled(preference.preparing != nil || (choice.isNeural && !neuralAvailable))
            .accessibilityLabel("\(choice.title), \(preference.selected == choice ? "selected" : "select voice")")

            if !inCall && (choice == .device || neuralAvailable) {
                Button {
                    previewTask?.cancel()
                    player.stop()
                    previewError = nil
                    previewing = choice
                    previewTask = Task {
                        do {
                            let samples = try await LocalVoiceEngines.shared.sample(choice)
                            try Task.checkCancellation()
                            try await player.play(samples)
                        } catch is CancellationError {
                            // A new preview or dismissal stopped this sample.
                        } catch {
                            previewError = error.localizedDescription
                        }
                        previewing = nil
                    }
                } label: {
                    if previewing == choice { ProgressView() }
                    else { Image(systemName: "play.circle") }
                }
                .disabled(previewing != nil)
                .accessibilityLabel("Play \(choice.title) sample")
            }
        }
        .frame(minHeight: 44)
    }
}

/// Output-only preview player. It never starts the microphone or stores audio.
@MainActor
private final class CallVoicePreviewPlayer {
    private let engine = AVAudioEngine()
    private let node = AVAudioPlayerNode()
    private let format = AVAudioFormat(
        commonFormat: .pcmFormatFloat32,
        sampleRate: VoiceAudioIO.playbackSampleRate,
        channels: 1,
        interleaved: false
    )!

    init() {
        engine.attach(node)
        engine.connect(node, to: engine.mainMixerNode, format: format)
    }

    func play(_ samples: [Float]) async throws {
        guard !samples.isEmpty,
              let buffer = AVAudioPCMBuffer(pcmFormat: format, frameCapacity: AVAudioFrameCount(samples.count)),
              let channel = buffer.floatChannelData?[0] else { return }
        samples.withUnsafeBufferPointer { source in
            channel.update(from: source.baseAddress!, count: samples.count)
        }
        buffer.frameLength = AVAudioFrameCount(samples.count)
        let session = AVAudioSession.sharedInstance()
        try session.setCategory(.playback, mode: .default)
        try session.setActive(true)
        try engine.start()
        node.play()
        await node.scheduleBuffer(buffer, at: nil, options: [], completionCallbackType: .dataPlayedBack)
        stop()
    }

    func stop() {
        node.stop()
        engine.stop()
        try? AVAudioSession.sharedInstance().setActive(false, options: .notifyOthersOnDeactivation)
    }
}
