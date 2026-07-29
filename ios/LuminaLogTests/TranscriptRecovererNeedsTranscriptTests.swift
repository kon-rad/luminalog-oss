import XCTest
@testable import LuminaLog

/// `TranscriptRecoverer.needsTranscript` decides whether the finalizer should
/// auto-recover a voice/video entry's transcript from S3. Before the fix it only
/// fired on `.failed` status or empty content — so a degenerate `.ready`
/// transcript (a 127 s clip that came back as one word) looked successful and
/// was never re-transcribed. It must now also fire when the stored transcript is
/// implausibly short for the recording's length.
@MainActor
final class TranscriptRecovererNeedsTranscriptTests: XCTestCase {

    private func voiceEntry(
        content: String,
        status: TranscriptStatus?,
        durationSec: Double?
    ) -> JournalEntry {
        let media = durationSec.map { [MediaItem(s3Key: "clip.m4a", kind: .audio, durationSec: $0)] } ?? []
        return JournalEntry(
            userId: "u1", type: .voice, title: "t",
            content: content, media: media,
            transcriptStatus: status, wordCount: WordCount.of(content))
    }

    func testDegenerateReadyTranscriptNeedsRecovery() {
        // The exact stick point: 127 s of audio, saved `.ready` with one word.
        let entry = voiceEntry(content: "Yeah", status: .ready, durationSec: 127)
        XCTAssertTrue(TranscriptRecoverer.needsTranscript(entry))
    }

    func testPlausibleReadyTranscriptDoesNotNeedRecovery() {
        let words = Array(repeating: "word", count: 80).joined(separator: " ")
        let entry = voiceEntry(content: words, status: .ready, durationSec: 60)
        XCTAssertFalse(TranscriptRecoverer.needsTranscript(entry))
    }

    func testFailedStatusStillNeedsRecovery() {
        let entry = voiceEntry(content: "anything", status: .failed, durationSec: 60)
        XCTAssertTrue(TranscriptRecoverer.needsTranscript(entry))
    }

    func testEmptyContentStillNeedsRecovery() {
        let entry = voiceEntry(content: "", status: .ready, durationSec: 60)
        XCTAssertTrue(TranscriptRecoverer.needsTranscript(entry))
    }

    func testPlausibleTranscriptWithUnknownDurationDoesNotNeedRecovery() {
        // No media duration to scale against → non-empty content is accepted.
        let entry = voiceEntry(content: "A short but real note.", status: .ready, durationSec: nil)
        XCTAssertFalse(TranscriptRecoverer.needsTranscript(entry))
    }

    func testTextEntryNeverNeedsTranscript() {
        let entry = JournalEntry(userId: "u1", type: .text, title: "t", content: "x")
        XCTAssertFalse(TranscriptRecoverer.needsTranscript(entry))
    }
}
