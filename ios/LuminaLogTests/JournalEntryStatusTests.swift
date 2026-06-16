import XCTest
@testable import LuminaLog

/// The derived activity/badge state that the list and detail views read to show
/// background-processing progress (processing → uploading → transcribing → done).
final class JournalEntryStatusTests: XCTestCase {

    private func entry(
        processing: ProcessingStatus?,
        transcript: TranscriptStatus? = nil
    ) -> JournalEntry {
        JournalEntry(
            userId: "u",
            type: .voice,
            title: "t",
            transcriptStatus: transcript,
            processingStatus: processing
        )
    }

    func testLocalPipelineStatesMapToActivity() {
        XCTAssertEqual(entry(processing: .processing).activityState, .processing)
        XCTAssertEqual(entry(processing: .uploading).activityState, .uploading)
        XCTAssertEqual(entry(processing: .saving).activityState, .saving)
    }

    func testFailedProcessingIsFailed() {
        XCTAssertEqual(entry(processing: .failed).activityState, .failed)
    }

    func testTranscribingResolvesViaTranscriptStatus() {
        // Local pipeline handed off to the server; still transcribing.
        XCTAssertEqual(
            entry(processing: .transcribing, transcript: .processing).activityState,
            .transcribing
        )
        // Server finished → entry is done.
        XCTAssertEqual(
            entry(processing: .transcribing, transcript: .ready).activityState,
            .idle
        )
        // Server failed → failed.
        XCTAssertEqual(
            entry(processing: .transcribing, transcript: .failed).activityState,
            .failed
        )
    }

    func testReadyAndNilProcessingFallBackToTranscriptStatus() {
        // Legacy entries (no processingStatus) still show transcription progress.
        XCTAssertEqual(entry(processing: nil, transcript: .processing).activityState, .transcribing)
        XCTAssertEqual(entry(processing: nil, transcript: .failed).activityState, .failed)
        XCTAssertEqual(entry(processing: nil, transcript: .ready).activityState, .idle)
        XCTAssertEqual(entry(processing: nil, transcript: nil).activityState, .idle)
        XCTAssertEqual(entry(processing: .ready, transcript: nil).activityState, .idle)
    }

    func testBadgeText() {
        XCTAssertEqual(entry(processing: .processing).statusBadgeText, "Processing…")
        XCTAssertEqual(entry(processing: .uploading).statusBadgeText, "Uploading…")
        XCTAssertEqual(entry(processing: .saving).statusBadgeText, "Saving…")
        XCTAssertEqual(
            entry(processing: .transcribing, transcript: .processing).statusBadgeText,
            "Transcribing…"
        )
        XCTAssertEqual(entry(processing: .failed).statusBadgeText, "Failed")
        XCTAssertNil(entry(processing: .ready).statusBadgeText)
        XCTAssertNil(entry(processing: nil).statusBadgeText)
    }
}
