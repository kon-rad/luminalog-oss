import XCTest
import CryptoKit
@testable import LuminaLog

final class ChatMappingTests: XCTestCase {
    func testDecodesPendingRecordingKey() throws {
        let cipher = FieldCipher(key: SymmetricKey(size: .bits256))
        let data: [String: Any] = [
            "userId": "u1",
            "kind": "voice",
            "pendingRecordingKey": "users/u1/voice-staging/c.wav",
        ]
        let chat = try XCTUnwrap(Chat(documentId: "chat_1", data: data, cipher: cipher))
        XCTAssertEqual(chat.pendingRecordingKey, "users/u1/voice-staging/c.wav")
        XCTAssertNil(chat.recordingPath)
    }
}
