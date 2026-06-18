import XCTest
import CryptoKit
@testable import LuminaLog

final class VoiceCallMappingTests: XCTestCase {
    private func cipher() -> FieldCipher { FieldCipher(key: SymmetricKey(size: .bits256)) }

    func testMessageSourceDecodesRichFields() throws {
        let c = cipher()
        let data: [String: Any] = [
            "journalId": "e1",
            "type": "note",
            "date": "2026-06-01",
            "score": 0.82,
            "title": try c.sealed("My Title", "messages.sources.0.title"),
            "snippet": try c.sealed("snippet text", "messages.sources.0.snippet"),
        ]
        let src = try XCTUnwrap(try MessageSource(data: data, cipher: c, index: 0))
        XCTAssertEqual(src.journalId, "e1")
        XCTAssertEqual(src.type, "note")
        XCTAssertEqual(src.date, "2026-06-01")
        XCTAssertEqual(src.score, 0.82, accuracy: 0.001)
        XCTAssertEqual(src.title, "My Title")
        XCTAssertEqual(src.snippet, "snippet text")
    }

    func testChatDecodesVoiceFields() throws {
        let c = cipher()
        let data: [String: Any] = [
            "userId": "u1",
            "kind": "voice",
            "title": try c.sealed("Evening call", "chats.title"),
            "voiceStatus": "completed",
            "endedReason": "customer-ended-call",
            "recordingPath": "voice/u1/call_1.wav",
            "recordingDurationSeconds": 42.0,
            "rawTranscript": try c.sealed("AI: hi\nUser: hello", "chats.rawTranscript"),
        ]
        let chat = try XCTUnwrap(Chat(documentId: "c1", data: data, cipher: c))
        XCTAssertEqual(chat.voiceStatus, "completed")
        XCTAssertEqual(chat.endedReason, "customer-ended-call")
        XCTAssertEqual(chat.recordingPath, "voice/u1/call_1.wav")
        XCTAssertEqual(chat.recordingDurationSeconds, 42.0)
        XCTAssertEqual(chat.rawTranscript, "AI: hi\nUser: hello")
    }
}
