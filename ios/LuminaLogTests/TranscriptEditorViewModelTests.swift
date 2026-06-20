import XCTest
@testable import LuminaLog

final class TranscriptEditorViewModelTests: XCTestCase {

    // MARK: - Spies

    @MainActor
    final class SpyAI: AIService {
        var transcriptToReturn = "transcribed words"
        var shouldFail = false
        var clipCalls = 0
        var indexCalls = 0

        func generateSummary(journalId: String) async throws -> AIGeneration { AIGeneration(text: "", model: "") }
        func generateInsights(journalId: String) async throws -> AIGeneration { AIGeneration(text: "", model: "") }
        func generatePrompts(journalId: String) async throws -> [String] { [] }
        func dailyPrompt() async throws -> String { "" }
        func streamChatReply(chatId: String, message: String) -> AsyncThrowingStream<String, Error> {
            AsyncThrowingStream { $0.finish() }
        }
        func requestIndex(journalId: String) async { indexCalls += 1 }
        func deleteEntry(journalId: String) async throws {}
        func transcribeJournal(journalId: String) async throws {}
        func transcribeClip(audio: Data, contentType: String) async throws -> String {
            clipCalls += 1
            if shouldFail { throw NSError(domain: "spy", code: 1) }
            return transcriptToReturn
        }
        func relatedEntries(journalId: String, limit: Int) async throws -> [RelatedEntry] { [] }
        func searchKeyword(query: String) async throws -> [SearchResult] { [] }
        func searchSemantic(query: String) async throws -> [SearchResult] { [] }
        func journalGraph() async throws -> JournalGraph { JournalGraph(nodes: [], links: []) }
    }

    @MainActor
    final class SpyMedia: MediaUploader {
        var uploadCalls = 0
        func upload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> MediaItem {
            uploadCalls += 1
            return MediaItem(s3Key: "key-\(uploadCalls)", kind: kind)
        }
        func prepareUpload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> PreparedUpload {
            uploadCalls += 1
            return PreparedUpload(encryptedFileURL: fileURL, s3Key: "key-\(uploadCalls)", mediaItem: MediaItem(s3Key: "key-\(uploadCalls)", kind: kind))
        }
        func presignUpload(s3Key: String?, kind: MediaKind, ext: String, bytes: Int, journalId: String) async throws -> (s3Key: String, url: URL) {
            (s3Key ?? "key-presigned", URL(fileURLWithPath: "/dev/null"))
        }
        func viewURL(for s3Key: String) async throws -> URL { URL(fileURLWithPath: "/tmp/\(s3Key)") }
        func localFileURL(for s3Key: String) async throws -> URL { URL(fileURLWithPath: "/tmp/\(s3Key)") }
    }

    /// Writes a few bytes to a temp .m4a so the view model can read clip data.
    @MainActor
    private func makeClip(duration: Double = 5) throws -> AudioAttachment {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(UUID().uuidString).m4a")
        try Data("audio-bytes".utf8).write(to: url)
        return AudioAttachment(url: url, durationSec: duration)
    }

    // MARK: - Tests

    @MainActor
    func testRecordedClipTranscribesAndAppendsText() async throws {
        let ai = SpyAI()
        let vm = TranscriptEditorViewModel(
            entryId: "e1",
            entryCreatedAt: Date(),
            initialText: "Existing text",
            journals: MockJournalRepository(entries: [.init(userId: "u", type: .image, title: "t")]),
            profiles: MockProfileRepository(),
            ai: ai,
            media: SpyMedia()
        )
        let clip = try makeClip()

        await vm.addRecordedClip(clip)

        XCTAssertEqual(ai.clipCalls, 1)
        XCTAssertEqual(vm.text, "Existing text\n\ntranscribed words")
        XCTAssertEqual(vm.pendingClips.count, 1)
        XCTAssertFalse(vm.pendingClips[0].transcribeFailed)
    }

    @MainActor
    func testSecondClipAppendsAfterFirst() async throws {
        let ai = SpyAI()
        let vm = TranscriptEditorViewModel(
            entryId: "e1", entryCreatedAt: Date(), initialText: "",
            journals: MockJournalRepository(entries: [.init(userId: "u", type: .image, title: "t")]),
            profiles: MockProfileRepository(), ai: ai, media: SpyMedia()
        )
        ai.transcriptToReturn = "first"
        await vm.addRecordedClip(try makeClip())
        ai.transcriptToReturn = "second"
        await vm.addRecordedClip(try makeClip())

        XCTAssertEqual(vm.text, "first\n\nsecond")
        XCTAssertEqual(vm.pendingClips.count, 2)
    }

    @MainActor
    func testTranscriptionFailureKeepsClipAndText() async throws {
        let ai = SpyAI()
        ai.shouldFail = true
        let vm = TranscriptEditorViewModel(
            entryId: "e1", entryCreatedAt: Date(), initialText: "Original",
            journals: MockJournalRepository(entries: [.init(userId: "u", type: .image, title: "t")]),
            profiles: MockProfileRepository(), ai: ai, media: SpyMedia()
        )

        await vm.addRecordedClip(try makeClip())

        XCTAssertEqual(vm.text, "Original")
        XCTAssertEqual(vm.pendingClips.count, 1)
        XCTAssertTrue(vm.pendingClips[0].transcribeFailed)
    }

    @MainActor
    func testClearEmptiesText() {
        let vm = TranscriptEditorViewModel(
            entryId: "e1", entryCreatedAt: Date(), initialText: "Some text",
            journals: MockJournalRepository(entries: []),
            profiles: MockProfileRepository(), ai: SpyAI(), media: SpyMedia()
        )
        vm.clear()
        XCTAssertEqual(vm.text, "")
    }

    @MainActor
    func testSaveUploadsAllClipsPersistsAndIndexes() async throws {
        let entry = JournalEntry(userId: "u", type: .image, title: "t", content: "")
        let repo = MockJournalRepository(entries: [entry])
        let ai = SpyAI()
        let media = SpyMedia()
        let vm = TranscriptEditorViewModel(
            entryId: entry.id, entryCreatedAt: entry.createdAt, initialText: "",
            journals: repo, profiles: MockProfileRepository(), ai: ai, media: media
        )
        await vm.addRecordedClip(try makeClip())
        await vm.addRecordedClip(try makeClip())

        await vm.save()

        XCTAssertEqual(media.uploadCalls, 2)
        XCTAssertEqual(ai.indexCalls, 1)
        XCTAssertTrue(vm.didSave)

        var latest: JournalEntry?
        for await e in repo.entry(id: entry.id) { latest = e; break }
        XCTAssertEqual(latest?.media.filter { $0.kind == .audio }.count, 2)
        XCTAssertEqual(latest?.content, vm.text)
        XCTAssertNotNil(latest?.contentEditedAt)
    }

    @MainActor
    func testSaveOnDeletedEntrySetsErrorAndDismisses() async {
        let repo = MockJournalRepository(entries: [])
        let vm = TranscriptEditorViewModel(
            entryId: "gone", entryCreatedAt: Date(), initialText: "edited",
            journals: repo, profiles: MockProfileRepository(), ai: SpyAI(), media: SpyMedia()
        )
        await vm.save()
        XCTAssertNotNil(vm.errorMessage)
        XCTAssertTrue(vm.didSave)
    }
}
