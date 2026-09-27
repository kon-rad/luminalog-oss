import XCTest
@testable import LuminaLog

final class RecordingDeletionPromptTests: XCTestCase {

    func testAudioPromptCopy() {
        let prompt = RecordingDeletionPrompt.audio(id: UUID())
        XCTAssertEqual(prompt.title, "Delete this recording?")
        XCTAssertEqual(prompt.message,
                       "Your voice recording will be permanently deleted. This can't be undone.")
    }

    func testVideoPromptCopy() {
        let prompt = RecordingDeletionPrompt.video
        XCTAssertEqual(prompt.title, "Delete this video?")
        XCTAssertEqual(prompt.message,
                       "Your video will be permanently deleted. This can't be undone.")
    }

    func testPromptIdsAreDistinct() {
        let a = RecordingDeletionPrompt.audio(id: UUID())
        let b = RecordingDeletionPrompt.audio(id: UUID())
        XCTAssertNotEqual(a.id, RecordingDeletionPrompt.video.id)
        XCTAssertNotEqual(a.id, b.id, "Each recording gets its own prompt")
        XCTAssertNotEqual(RecordingDeletionPrompt.audio(id: nil).id, a.id)
    }

    func testDiscardDraftPromptNamesTheRecordingsLost() {
        XCTAssertEqual(RecordingDeletionPrompt.discardDraft(recordingCount: 1).message,
                       "Discarding this entry permanently deletes 1 voice recording. This can't be undone.")
        XCTAssertEqual(RecordingDeletionPrompt.discardDraft(recordingCount: 3).message,
                       "Discarding this entry permanently deletes 3 voice recordings. This can't be undone.")
        XCTAssertEqual(RecordingDeletionPrompt.discardDraft(recordingCount: 2).confirmLabel, "Delete Forever")
    }

    func testCopyContainsNoEmDash() {
        for prompt in [RecordingDeletionPrompt.audio(id: nil), .video, .discardDraft(recordingCount: 2)] {
            XCTAssertFalse(prompt.title.contains("\u{2014}"))
            XCTAssertFalse(prompt.message.contains("\u{2014}"))
        }
    }
}
