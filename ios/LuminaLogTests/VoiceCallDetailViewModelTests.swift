import XCTest
@testable import LuminaLog

@MainActor
final class VoiceCallDetailViewModelTests: XCTestCase {
    func testReadyWhenRecordingPathPresent() async {
        let chat = Chat(id: "c1", userId: "u1", kind: .voice, recordingPath: "users/u1/voice/c.wav")
        let repo = MockChatRepository(chats: [chat])
        let media = MockMediaUploader()
        let vm = VoiceCallDetailViewModel(chatId: "c1", repository: repo, media: media, importer: nil)
        await vm.start()
        XCTAssertEqual(vm.recordingState, .ready)
        XCTAssertNotNil(vm.recordingURL)
    }

    func testProcessingWhenOnlyPendingKeyPresent() async {
        let chat = Chat(id: "c1", userId: "u1", kind: .voice, pendingRecordingKey: "users/u1/voice-staging/c.wav")
        let repo = MockChatRepository(chats: [chat])
        let vm = VoiceCallDetailViewModel(chatId: "c1", repository: repo, media: MockMediaUploader(), importer: nil)
        await vm.start()
        XCTAssertEqual(vm.recordingState, .processing)
    }

    func testUnavailableWhenNeitherPresent() async {
        let chat = Chat(id: "c1", userId: "u1", kind: .voice)
        let repo = MockChatRepository(chats: [chat])
        let vm = VoiceCallDetailViewModel(chatId: "c1", repository: repo, media: MockMediaUploader(), importer: nil)
        await vm.start()
        XCTAssertEqual(vm.recordingState, .unavailable)
    }
}
