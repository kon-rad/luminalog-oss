import AVFoundation
import Foundation
import OSLog
import UIKit

/// A voice call whose speech runs on the iPhone.
///
/// Microphone audio is segmented by Silero VAD, transcribed by Parakeet and the
/// reply is spoken by Kokoro (or the system voice), all on device. Only the TEXT
/// of each turn, plus the journal context the phone builds for it, goes to our
/// server (`POST /v1/ai/voice-turn`). No audio leaves the phone and the journal
/// key is never sent, so the server cannot decrypt anything during the call.
///
/// Fail closed: if the model cannot be reached the call says so and stays local.
/// There is no fallback to a cloud voice service.
@MainActor
final class LocalVoiceCallService: VoiceCallService {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "voice")

    private let api: ProxyAPIClient
    private let ai: AIService
    private let engineProvider: LocalVoiceEngineProviding
    private let requestMicPermission: () async -> Bool
    private let broadcaster = VoiceCallEventBroadcaster()

    // Per-call state.
    private var audio: VoiceAudioIO?
    private var pipeline: VoiceCapturePipeline?
    private var engines: LocalVoiceEngineSet?
    private var captureTask: Task<Void, Never>?
    private var turnTask: Task<Void, Never>?
    private var chatId = ""
    private var context: VoiceCallContext?
    /// What both sides actually said and heard, in order. Sent as history.
    private var history: [ChatMessage] = []
    /// Bumped whenever the current reply is superseded (interruption, new turn,
    /// hang-up). Every await in a turn re-checks it before touching state.
    private var generation = 0
    /// True from the end of a user utterance until the reply finishes playing.
    private var assistantActive = false
    /// The part of the current reply that has started playing.
    private var spokenText = ""
    /// Audio of a turn that was cut off before it was transcribed (the user kept
    /// talking). Prepended to the next utterance so nothing they said is lost.
    private var carriedSamples: [Float] = []
    /// Set after Kokoro fails mid-call; the rest of the call uses the system voice.
    private var neuralVoiceFailed = false
    private var lastStatusLine = ""
    private var memoryObserver: NSObjectProtocol?
    /// Set when the call is one sitting of the Life Story Interview.
    private var sitting: LifeInterviewSitting?
    /// The question the interviewer is on, as last reported by the server.
    private var interviewItem: String?

    /// Turn-taking for an interview: people pause to remember, so wait about
    /// 1.5 s of silence (6 frames) before treating the answer as finished.
    static let interviewTurnConfig: VoiceTurnDetector.Config = {
        var config = VoiceTurnDetector.Config.default
        config.endSilenceFrames = 6
        return config
    }()

    init(
        api: ProxyAPIClient,
        ai: AIService,
        engineProvider: LocalVoiceEngineProviding = LocalVoiceEngines.shared,
        requestMicPermission: @escaping () async -> Bool = {
            await AVAudioApplication.requestRecordPermission()
        }
    ) {
        self.api = api
        self.ai = ai
        self.engineProvider = engineProvider
        self.requestMicPermission = requestMicPermission
        // Models stay loaded between calls so the second call connects at once.
        // Give the memory back if the system asks while no call is live.
        memoryObserver = NotificationCenter.default.addObserver(
            forName: UIApplication.didReceiveMemoryWarningNotification, object: nil, queue: .main
        ) { [weak self] _ in
            Task { @MainActor [weak self] in
                guard let self, self.audio == nil else { return }
                await self.engineProvider.unload()
            }
        }
    }

    deinit {
        if let memoryObserver { NotificationCenter.default.removeObserver(memoryObserver) }
    }

    // MARK: - VoiceCallService

    var events: AsyncStream<VoiceCallEvent> {
        broadcaster.makeStream()
    }

    func startCall(chatId: String, journalId: String?, journalTitle: String?, interview: LifeInterviewSitting?) async throws {
        // Microphone first: a call that cannot hear the user must fail loudly (ADR-0110).
        guard await requestMicPermission() else {
            Self.logger.error("mic permission denied, refusing to start the call")
            broadcaster.send(.failed(message: VoiceCallError.microphonePermissionDenied.localizedDescription))
            throw VoiceCallError.microphonePermissionDenied
        }

        broadcaster.send(.connecting)
        resetCallState()
        self.chatId = chatId
        sitting = interview
        interviewItem = interview?.startItem
        generation += 1
        let callGeneration = generation

        // Context and models load side by side. The context is plaintext built on
        // device (profile, today's entries, memory ladder, focal entry, retrieval).
        async let builtContext = try? await ai.voiceCallContext(chatId: chatId, journalId: journalId)
        let engines: LocalVoiceEngineSet
        do {
            engines = try await engineProvider.prepare { [weak self] line in
                Task { @MainActor [weak self] in
                    // Download progress repeats the same line many times a second.
                    guard let self, line != self.lastStatusLine else { return }
                    self.lastStatusLine = line
                    self.broadcaster.send(.preparing(line))
                }
            }
        } catch {
            Self.logger.error("speech models failed to load: \(error.localizedDescription, privacy: .public)")
            let message = "The on-device speech models couldn't be loaded. Check your connection for the first download, then try again."
            broadcaster.send(.failed(message: message))
            throw VoiceCallError.callConfigFailed(message)
        }
        context = await builtContext ?? nil
        // The user may have hung up while the models were loading.
        guard callGeneration == generation else { return }

        let audio = VoiceAudioIO()
        let pipeline = VoiceCapturePipeline(
            classifier: engines.classifier,
            config: interview == nil ? .default : Self.interviewTurnConfig
        )
        await pipeline.reset()
        let microphone = audio.microphone()
        audio.onInterruption = { [weak self] in
            Task { @MainActor [weak self] in self?.endForInterruption() }
        }
        do {
            try audio.start()
        } catch {
            Self.logger.error("audio start failed: \(error.localizedDescription, privacy: .public)")
            audio.stop()
            let message = "The microphone couldn't be started. Close other apps using it and try again."
            broadcaster.send(.failed(message: message))
            throw VoiceCallError.callConfigFailed(message)
        }
        self.audio = audio
        self.pipeline = pipeline
        self.engines = engines

        captureTask = Task { [weak self] in
            for await chunk in microphone {
                let captured = await pipeline.ingest(chunk)
                guard let self, !Task.isCancelled else { return }
                for event in captured { self.handle(event) }
            }
        }

        broadcaster.send(.connected)

        // The greeting is spoken locally, instantly, with no network round trip.
        let greeting = interview?.openingLine ?? VoiceTurnText.firstMessage(name: context?.name ?? "")
        assistantActive = true
        turnTask = Task { [weak self] in
            await self?.speak(lines: [greeting], generation: callGeneration, addToHistory: true)
        }
    }

    func endCall() async {
        teardown()
        broadcaster.send(.ended(reason: nil))
    }

    func setMuted(_ muted: Bool) {
        audio?.setMuted(muted)
        guard let pipeline else { return }
        Task { await pipeline.setMuted(muted) }
    }

    // MARK: - Capture events

    private func handle(_ event: VoiceCaptureEvent) {
        switch event {
        case .speechStarted:
            if !assistantActive { broadcaster.send(.userSpeaking) }

        case .sustainedSpeech:
            // Deliberate speech over the assistant: stop talking and listen.
            if assistantActive { interrupt() }

        case .utterance(let samples, _):
            // Still active here means the sound was too short to interrupt
            // ("mm-hm", a cough): let the reply carry on.
            guard !assistantActive else { return }
            startTurn(samples)
        }
    }

    /// The user spoke over the reply (or over the thinking pause).
    private func interrupt() {
        Self.logger.log("barge-in, spokenChars=\(self.spokenText.count, privacy: .public)")
        generation += 1
        turnTask?.cancel()
        turnTask = nil
        audio?.stopPlayback()
        // Record what was actually heard, so the next turn's history matches reality.
        commitAssistantMessage()
        assistantActive = false
        broadcaster.send(.userSpeaking)
    }

    private func startTurn(_ samples: [Float]) {
        generation += 1
        let turnGeneration = generation
        let audioSamples = carriedSamples + samples
        carriedSamples = audioSamples
        assistantActive = true
        spokenText = ""
        broadcaster.send(.assistantSpeaking(partial: nil))
        turnTask = Task { [weak self] in
            await self?.runTurn(audioSamples, generation: turnGeneration)
        }
    }

    // MARK: - One turn

    private func runTurn(_ samples: [Float], generation turnGeneration: Int) async {
        guard let engines else { return }
        let turnStart = Date()

        let text = (try? await engines.speechToText.transcribe(samples)) ?? ""
        guard turnGeneration == generation else { return }
        carriedSamples = []
        let sttMs = Self.milliseconds(since: turnStart)
        guard !text.isEmpty else {
            finishTurn(generation: turnGeneration)
            return
        }

        let priorHistory = history
        let userMessage = ChatMessage(role: .user, text: text)
        history.append(userMessage)
        broadcaster.send(.transcriptUpdated(userMessage))

        // Retrieval over past entries for THIS turn, on device (the query goes to
        // our search index as text; entries are decrypted only on the phone).
        let ragStart = Date()
        // An interview uses no journal context, so it skips the search entirely.
        let skipRetrieval = sitting != nil || VoiceTurnText.isBackchannel(text)
        let ragContext = skipRetrieval ? "" : await ai.voiceTurnContext(query: text)
        guard turnGeneration == generation else { return }
        let ragMs = Self.milliseconds(since: ragStart)

        let request = VoiceTurnRequest(
            chatId: chatId,
            message: text,
            history: priorHistory,
            context: context,
            ragContext: ragContext,
            now: VoiceCallClock.localNowStamp(),
            interview: sitting.map {
                VoiceTurnRequest.Interview(
                    section: $0.section.key,
                    item: interviewItem ?? $0.startItem,
                    resumed: $0.resumed
                )
            }
        )

        let (sentences, sentenceFeed) = AsyncStream<String>.makeStream()
        let timings = TurnTimings(turnStart: turnStart)
        let playback = Task { [weak self] in
            await self?.play(sentences: sentences, generation: turnGeneration, timings: timings)
        }

        var chunker = VoiceSentenceChunker()
        var receivedAny = false
        let requestStart = Date()
        var firstTokenMs = -1
        do {
            for try await payload in api.streamEvents(path: "/v1/ai/voice-turn", body: request) {
                guard turnGeneration == generation else { break }
                guard let data = payload.data(using: .utf8),
                      let chunk = try? JSONDecoder().decode(Delta.self, from: data) else { continue }
                if let progress = chunk.interview {
                    if let item = progress.item { interviewItem = item }
                    broadcaster.send(.interviewProgress(item: progress.item, sectionComplete: progress.sectionComplete))
                }
                guard let delta = chunk.delta, !delta.isEmpty else { continue }
                if !receivedAny {
                    receivedAny = true
                    firstTokenMs = Self.milliseconds(since: requestStart)
                }
                for sentence in chunker.feed(delta) { sentenceFeed.yield(sentence) }
            }
            if turnGeneration == generation, let rest = chunker.flush() { sentenceFeed.yield(rest) }
        } catch {
            Self.logger.error("voice turn failed: \(error.localizedDescription, privacy: .public)")
        }

        let failed = !receivedAny && turnGeneration == generation
        if failed { sentenceFeed.yield(VoiceTurnText.unreachableLine) }
        sentenceFeed.finish()
        await playback.value
        guard turnGeneration == generation else { return }

        // Timings only, never content: this is the latency table for the device spike.
        Self.logger.log(
            "turn sttMs=\(sttMs, privacy: .public) ragMs=\(ragMs, privacy: .public) firstTokenMs=\(firstTokenMs, privacy: .public) firstAudioMs=\(timings.firstAudioMs, privacy: .public) audioSec=\(Double(samples.count) / VoiceAudioIO.captureSampleRate, format: .fixed(precision: 1), privacy: .public) failed=\(failed, privacy: .public)"
        )

        if failed {
            // Shown in the transcript but kept out of the history sent to the model.
            let spoken = spokenText
            spokenText = ""
            if !spoken.isEmpty {
                broadcaster.send(.transcriptUpdated(ChatMessage(role: .assistant, text: spoken)))
            }
        } else {
            commitAssistantMessage()
        }
        finishTurn(generation: turnGeneration)
    }

    /// Speaks fixed lines (the greeting) outside the request flow.
    private func speak(lines: [String], generation turnGeneration: Int, addToHistory: Bool) async {
        let (sentences, feed) = AsyncStream<String>.makeStream()
        lines.forEach { feed.yield($0) }
        feed.finish()
        spokenText = ""
        await play(sentences: sentences, generation: turnGeneration, timings: TurnTimings(turnStart: Date()))
        guard turnGeneration == generation else { return }
        if addToHistory { commitAssistantMessage() }
        finishTurn(generation: turnGeneration)
    }

    /// Synthesizes sentences one ahead of playback, so the gap between sentences
    /// is the audio hand-off and not the synthesis time.
    private func play(sentences: AsyncStream<String>, generation turnGeneration: Int, timings: TurnTimings) async {
        guard let audio else { return }
        let (clips, clipFeed) = AsyncStream<(text: String, samples: [Float])>.makeStream()

        let synthesis = Task { [weak self] in
            for await sentence in sentences {
                guard let self, self.generation == turnGeneration else { break }
                if let samples = await self.synthesize(sentence) {
                    clipFeed.yield((sentence, samples))
                }
            }
            clipFeed.finish()
        }

        for await clip in clips {
            guard turnGeneration == generation else { break }
            if timings.firstAudioMs < 0 { timings.firstAudioMs = Self.milliseconds(since: timings.turnStart) }
            spokenText = spokenText.isEmpty ? clip.text : spokenText + " " + clip.text
            broadcaster.send(.assistantSpeaking(partial: spokenText))
            await audio.play(clip.samples)
        }
        synthesis.cancel()
    }

    /// Kokoro when it is loaded and the phone is not hot; otherwise the system
    /// voice. Never a cloud voice.
    private func synthesize(_ text: String) async -> [Float]? {
        guard let engines else { return nil }
        let thermal = ProcessInfo.processInfo.thermalState
        let cool = thermal != .serious && thermal != .critical
        if let neural = engines.neuralVoice, !neuralVoiceFailed, cool {
            do {
                return try await neural.synthesize(text)
            } catch {
                neuralVoiceFailed = true
                Self.logger.error("Kokoro failed, system voice for the rest of the call: \(error.localizedDescription, privacy: .public)")
            }
        }
        return try? await engines.systemVoice.synthesize(text)
    }

    // MARK: - Turn bookkeeping

    /// Moves what was spoken of the current reply into the transcript and history.
    private func commitAssistantMessage() {
        let spoken = spokenText.trimmingCharacters(in: .whitespacesAndNewlines)
        spokenText = ""
        guard !spoken.isEmpty else { return }
        let message = ChatMessage(role: .assistant, text: spoken)
        history.append(message)
        broadcaster.send(.transcriptUpdated(message))
    }

    private func finishTurn(generation turnGeneration: Int) {
        guard turnGeneration == generation else { return }
        assistantActive = false
        broadcaster.send(.listening)
    }

    private func endForInterruption() {
        guard audio != nil else { return }
        teardown()
        broadcaster.send(.ended(reason: "The call was interrupted."))
    }

    private func teardown() {
        generation += 1
        turnTask?.cancel()
        turnTask = nil
        captureTask?.cancel()
        captureTask = nil
        audio?.stop()
        audio = nil
        pipeline = nil
        engines = nil
        assistantActive = false
    }

    private func resetCallState() {
        teardown()
        history = []
        context = nil
        sitting = nil
        interviewItem = nil
        spokenText = ""
        carriedSamples = []
        neuralVoiceFailed = false
        lastStatusLine = ""
    }

    private static func milliseconds(since start: Date) -> Int {
        Int((Date().timeIntervalSince(start) * 1000).rounded())
    }

    private struct Delta: Decodable {
        let delta: String?
        let interview: InterviewProgress?
    }

    private struct InterviewProgress: Decodable {
        let item: String?
        let sectionComplete: Bool
    }

    /// Mutable per-turn timing shared between the request loop and playback
    /// (both run on the main actor).
    @MainActor
    private final class TurnTimings {
        let turnStart: Date
        var firstAudioMs = -1
        init(turnStart: Date) { self.turnStart = turnStart }
    }
}
