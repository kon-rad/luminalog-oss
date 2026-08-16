import XCTest
@testable import LuminaLog

final class RecordingDeletionPromptTests: XCTestCase {

    func testAudioPromptCopy() {
        let prompt = RecordingDeletionPrompt.audio
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
        XCTAssertNotEqual(RecordingDeletionPrompt.audio.id, RecordingDeletionPrompt.video.id)
    }

    func testCopyContainsNoEmDash() {
        for prompt in [RecordingDeletionPrompt.audio, .video] {
            XCTAssertFalse(prompt.title.contains("\u{2014}"))
            XCTAssertFalse(prompt.message.contains("\u{2014}"))
        }
    }
}
