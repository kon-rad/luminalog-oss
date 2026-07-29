import XCTest
@testable import LuminaLog

/// A speech-to-text transcript that is a word or two for a multi-minute
/// recording is not a real transcript — the provider under-returned (or the
/// audio was near-silent). These entries were being saved as successful
/// `.ready` transcripts and never re-tried (see the "one character" incidents:
/// a 127s clip → 1 word, a 359s clip → 2 words, all marked ready).
///
/// `TranscriptPlausibility` is the single gate that distinguishes a plausibly
/// complete transcript from a degenerate one, scaled to the audio length.
final class TranscriptPlausibilityTests: XCTestCase {

    // MARK: Degenerate results from real incidents are rejected

    func testRejectsOneWordForTwoMinuteClip() {
        // 5D6FE23C…: 127s of audio came back as a single word.
        XCTAssertFalse(TranscriptPlausibility.isPlausible("Yeah", forDurationSec: 127))
    }

    func testRejectsTwoWordsForSixMinuteClip() {
        // 59946F20…: 359s → 2 words.
        XCTAssertFalse(TranscriptPlausibility.isPlausible("Um okay", forDurationSec: 359))
    }

    func testRejectsEmptyForFiveMinuteClip() {
        // 0A7863A0…: 300s → 0 words.
        XCTAssertFalse(TranscriptPlausibility.isPlausible("", forDurationSec: 300))
    }

    func testRejectsOneWordForFortySecondClip() {
        // 53539925…: 41s → 1 word.
        XCTAssertFalse(TranscriptPlausibility.isPlausible("So", forDurationSec: 41))
    }

    // MARK: Legitimate transcripts pass

    func testAcceptsNormalTranscript() {
        let words = Array(repeating: "word", count: 60).joined(separator: " ")
        XCTAssertTrue(TranscriptPlausibility.isPlausible(words, forDurationSec: 60))
    }

    func testAcceptsLegitimateShortNoteInAShortRecording() {
        // A real quick note: don't punish someone for a genuinely brief thought.
        XCTAssertTrue(TranscriptPlausibility.isPlausible("Okay, tomorrow works", forDurationSec: 30))
    }

    func testAcceptsSingleWordForVeryShortClip() {
        // 4s clip, "Yes." — genuinely could be all that was said.
        XCTAssertTrue(TranscriptPlausibility.isPlausible("Yes.", forDurationSec: 4))
    }

    // MARK: Unknown duration falls back to non-empty (old behavior)

    func testUnknownDurationAcceptsNonEmpty() {
        XCTAssertTrue(TranscriptPlausibility.isPlausible("hi", forDurationSec: nil))
    }

    func testUnknownDurationRejectsEmpty() {
        XCTAssertFalse(TranscriptPlausibility.isPlausible("   ", forDurationSec: nil))
    }

    func testZeroDurationRejectsEmpty() {
        XCTAssertFalse(TranscriptPlausibility.isPlausible("", forDurationSec: 0))
    }
}
