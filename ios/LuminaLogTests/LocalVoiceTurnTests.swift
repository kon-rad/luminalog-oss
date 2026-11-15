import XCTest
@testable import LuminaLog

/// The model-free rules of the local voice call: when a turn starts and ends,
/// how a streamed reply is cut into sentences, and what a voice turn sends.
final class LocalVoiceTurnTests: XCTestCase {

    // MARK: - VoiceTurnDetector

    private func run(_ probabilities: [Float], config: VoiceTurnDetector.Config = .default) -> [VoiceTurnDetector.Event] {
        var detector = VoiceTurnDetector(config: config)
        return probabilities.flatMap { detector.ingest(probability: $0) }
    }

    func testSilenceProducesNoEvents() {
        XCTAssertEqual(run([0.0, 0.1, 0.3, 0.5]), [])
    }

    func testSpeechThenSilenceEndsTheTurnAfterThreeSilentFrames() {
        let events = run([0.9, 0.9, 0.9, 0.1, 0.1, 0.1])
        XCTAssertEqual(events, [.started, .sustained, .ended(voicedFrames: 3, trailingSilenceFrames: 3)])
    }

    func testAShortPauseDoesNotEndTheTurn() {
        // Two silent frames (about 510 ms) mid-thought, then the user carries on.
        let events = run([0.9, 0.9, 0.1, 0.1, 0.9, 0.1, 0.1, 0.1])
        XCTAssertEqual(events, [.started, .sustained, .ended(voicedFrames: 3, trailingSilenceFrames: 3)])
    }

    func testSoftSpeechKeepsTheSegmentOpenButIsNotCountedAsVoiced() {
        // 0.4 is above the end threshold (hysteresis) and below the start threshold.
        let events = run([0.9, 0.4, 0.4, 0.1, 0.1, 0.1])
        XCTAssertEqual(events, [.started, .ended(voicedFrames: 1, trailingSilenceFrames: 3)])
    }

    func testABlipNeverReachesSustained() {
        // One voiced frame: a cough or "mm". It must not interrupt the assistant.
        let events = run([0.9, 0.1, 0.1, 0.1])
        XCTAssertFalse(events.contains(.sustained))
        XCTAssertEqual(events.last, .ended(voicedFrames: 1, trailingSilenceFrames: 3))
    }

    func testTheLengthCapEndsAnEndlessUtteranceWithNoTrailingSilence() {
        var config = VoiceTurnDetector.Config()
        config.maxUtteranceFrames = 5
        let events = run([Float](repeating: 0.9, count: 5), config: config)
        XCTAssertEqual(events.last, .ended(voicedFrames: 5, trailingSilenceFrames: 0))
    }

    func testTheDetectorIsReusableAfterATurn() {
        let events = run([0.9, 0.9, 0.1, 0.1, 0.1, 0.9, 0.9, 0.1, 0.1, 0.1])
        XCTAssertEqual(events.filter { $0 == .started }.count, 2)
    }

    // MARK: - VoiceCapturePipeline

    private actor ScriptedClassifier: VoiceFrameClassifying {
        private var script: [Float]
        init(_ script: [Float]) { self.script = script }
        func probability(for frame: [Float]) async throws -> Float {
            script.isEmpty ? 0 : script.removeFirst()
        }
        func reset() async {}
    }

    private func frame(_ value: Float) -> [Float] {
        [Float](repeating: value, count: VoiceCapturePipeline.frameSize)
    }

    func testThePipelineEmitsAnUtteranceWithLeadInAndOneTrailingFrame() async {
        // Frames: silence, speech, speech, silence x3.
        let pipeline = VoiceCapturePipeline(classifier: ScriptedClassifier([0.0, 0.9, 0.9, 0.0, 0.0, 0.0]))
        var events: [VoiceCaptureEvent] = []
        for value: Float in [0.1, 0.2, 0.3, 0.4, 0.5, 0.6] {
            events += await pipeline.ingest(frame(value))
        }
        guard case .utterance(let samples, let voicedFrames)? = events.last else {
            return XCTFail("expected an utterance, got \(events)")
        }
        XCTAssertEqual(Array(events.prefix(2)), [.speechStarted, .sustainedSpeech])
        XCTAssertEqual(voicedFrames, 2)
        // Lead-in frame + 2 speech frames + 1 of the 3 trailing silent frames.
        XCTAssertEqual(samples.count, 4 * VoiceCapturePipeline.frameSize)
        XCTAssertEqual(samples.first, 0.1)
        XCTAssertEqual(samples.last, 0.4)
    }

    func testThePipelineBuffersPartialFrames() async {
        let pipeline = VoiceCapturePipeline(classifier: ScriptedClassifier([0.9]))
        let half = [Float](repeating: 0, count: VoiceCapturePipeline.frameSize / 2)
        let first = await pipeline.ingest(half)
        let second = await pipeline.ingest(half)
        XCTAssertEqual(first, [])
        XCTAssertEqual(second, [.speechStarted])
    }

    func testAMutedPipelineIgnoresAudio() async {
        let pipeline = VoiceCapturePipeline(classifier: ScriptedClassifier([0.9, 0.9]))
        await pipeline.setMuted(true)
        let events = await pipeline.ingest(frame(0.5) + frame(0.5))
        XCTAssertEqual(events, [])
    }

    // MARK: - VoiceSentenceChunker

    func testSentencesAreReleasedAsTheyComplete() {
        var chunker = VoiceSentenceChunker()
        XCTAssertEqual(chunker.feed("That sounds like a "), [])
        XCTAssertEqual(chunker.feed("heavy week. What part "), ["That sounds like a heavy week."])
        XCTAssertEqual(chunker.feed("stayed with you?"), [])
        XCTAssertEqual(chunker.flush(), "What part stayed with you?")
        XCTAssertNil(chunker.flush())
    }

    func testAVeryShortSentenceIsJoinedToTheNext() {
        var chunker = VoiceSentenceChunker()
        XCTAssertEqual(chunker.feed("Hi. I read what you wrote today. "), ["Hi. I read what you wrote today."])
    }

    func testDecimalsAndAbbreviationsMidTokenDoNotSplit() {
        var chunker = VoiceSentenceChunker()
        XCTAssertEqual(chunker.feed("You ran 3.5 kilometres today! Nice. "), ["You ran 3.5 kilometres today!"])
        XCTAssertEqual(chunker.flush(), "Nice.")
    }

    func testAClosingQuoteStaysWithItsSentence() {
        var chunker = VoiceSentenceChunker()
        XCTAssertEqual(
            chunker.feed("You wrote \"I finally feel rested.\" That matters. "),
            ["You wrote \"I finally feel rested.\"", "That matters."]
        )
    }

    // MARK: - VoiceTurnText

    func testFirstMessageUsesTheNameWhenThereIsOne() {
        XCTAssertEqual(VoiceTurnText.firstMessage(name: " Konrad "), "Hi, Konrad. I'm your private AI journal companion. What's on your mind?")
        XCTAssertEqual(VoiceTurnText.firstMessage(name: ""), "Hi. I'm your private AI journal companion. What's on your mind?")
    }

    func testBackchannelMatchesTheServerRule() {
        for text in ["yeah", "Mm-hm.", "ok got it", "", "I see"] {
            XCTAssertTrue(VoiceTurnText.isBackchannel(text), text)
        }
        for text in ["what about mom?", "why though?", "yeah but I was thinking about work"] {
            XCTAssertFalse(VoiceTurnText.isBackchannel(text), text)
        }
    }

    // MARK: - VoiceTurnRequest

    private func encoded(_ request: VoiceTurnRequest) throws -> [String: Any] {
        let data = try JSONEncoder().encode(request)
        return try XCTUnwrap(JSONSerialization.jsonObject(with: data) as? [String: Any])
    }

    func testTheRequestCarriesContextAndHistoryAndNeverAKey() throws {
        let context = VoiceCallContext(
            name: "Konrad", bio: "A builder.", profile: ["goals": "ship it"],
            todayContext: "TODAY", ragContext: "CALL-START-RAG", focalEntry: "FOCAL", memoryContext: "MEMORY"
        )
        let history = [
            ChatMessage(role: .assistant, text: "Hi, Konrad."),
            ChatMessage(role: .user, text: "Hey."),
        ]
        let request = VoiceTurnRequest(
            chatId: "c1", message: "What did I write?", history: history,
            context: context, ragContext: "TURN-RAG", now: "2026-11-15 10:00 JST"
        )
        let json = try encoded(request)

        XCTAssertEqual(json["message"] as? String, "What did I write?")
        XCTAssertEqual(json["ragContext"] as? String, "TURN-RAG")
        XCTAssertEqual(json["todayContext"] as? String, "TODAY")
        XCTAssertEqual(json["memoryContext"] as? String, "MEMORY")
        XCTAssertEqual(json["focalEntry"] as? String, "FOCAL")
        XCTAssertEqual(json["now"] as? String, "2026-11-15 10:00 JST")
        let turns = try XCTUnwrap(json["history"] as? [[String: String]])
        XCTAssertEqual(turns, [["role": "assistant", "content": "Hi, Konrad."], ["role": "user", "content": "Hey."]])
        // The whole point of the local path: no key and no audio on the wire.
        XCTAssertNil(json["dek"])
        XCTAssertNil(json["audio"])
    }

    func testCallStartRetrievalIsTheFallbackWhenTheTurnHasNone() throws {
        let context = VoiceCallContext(
            name: "", bio: "", profile: [:], todayContext: "", ragContext: "CALL-START-RAG", focalEntry: nil
        )
        let request = VoiceTurnRequest(chatId: "c1", message: "yeah", history: [], context: context, ragContext: "", now: "now")
        XCTAssertEqual(try encoded(request)["ragContext"] as? String, "CALL-START-RAG")
    }

    func testHistoryIsCappedToTheMostRecentMessages() {
        let history = (0..<50).map { ChatMessage(role: $0 % 2 == 0 ? .user : .assistant, text: "m\($0)") }
        let request = VoiceTurnRequest(chatId: "c1", message: "next", history: history, context: nil, ragContext: "", now: "now")
        XCTAssertEqual(request.history.count, VoiceTurnRequest.historyLimit)
        XCTAssertEqual(request.history.last?.content, "m49")
    }

    func testLocalNowStampFormat() {
        let date = Date(timeIntervalSince1970: 1_784_000_000)
        let stamp = VoiceCallClock.localNowStamp(date, timeZone: TimeZone(identifier: "UTC")!)
        XCTAssertEqual(stamp, "2026-07-14 03:33 GMT")
    }
}
