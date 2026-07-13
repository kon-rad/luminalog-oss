import XCTest
@testable import LuminaLog

/// The mock repository must re-emit on its streams when data changes.
/// Tests run on the main actor because the mocks are `@MainActor` (matching
/// the service protocols).
final class MockJournalRepositoryTests: XCTestCase {

    @MainActor
    func testSaveEmitsUpdatedRecentEntries() async throws {
        let existing = JournalEntry(
            id: "old",
            userId: "user-1",
            type: .text,
            title: "Older entry",
            createdAt: Date(timeIntervalSinceNow: -86_400),
            updatedAt: Date(timeIntervalSinceNow: -86_400),
            content: "Yesterday.",
            wordCount: 1
        )
        let repository = MockJournalRepository(entries: [existing])

        var iterator = repository.recentEntries(limit: 10).makeAsyncIterator()

        let initial = await iterator.next()
        XCTAssertEqual(initial?.map(\.id), ["old"])

        let new = JournalEntry(
            id: "new",
            userId: "user-1",
            type: .text,
            title: "Fresh entry",
            createdAt: Date(),
            updatedAt: Date(),
            content: "Today.",
            wordCount: 1
        )
        try await repository.save(new)

        let afterSave = await iterator.next()
        XCTAssertEqual(afterSave?.map(\.id), ["new", "old"], "Newest entry should be first")

        try await repository.delete(id: "new")
        let afterDelete = await iterator.next()
        XCTAssertEqual(afterDelete?.map(\.id), ["old"])
    }

    @MainActor
    func testEntryStreamEmitsOnUpdate() async throws {
        let entry = JournalEntry(
            id: "e1",
            userId: "user-1",
            type: .text,
            title: "Before",
            content: "v1",
            wordCount: 1
        )
        let repository = MockJournalRepository(entries: [entry])

        var iterator = repository.entry(id: "e1").makeAsyncIterator()
        let initial = await iterator.next()
        XCTAssertEqual(initial??.title, "Before")

        var updated = entry
        updated.title = "After"
        try await repository.save(updated)

        let next = await iterator.next()
        XCTAssertEqual(next??.title, "After")
    }

    @MainActor
    func testPaginationReturnsOnlyOlderEntries() async throws {
        let now = Date()
        let entries = (0..<5).map { index in
            JournalEntry(
                id: "e\(index)",
                userId: "user-1",
                type: .text,
                title: "Entry \(index)",
                createdAt: now.addingTimeInterval(TimeInterval(-index) * 3_600),
                updatedAt: now,
                content: "",
                wordCount: 0
            )
        }
        let repository = MockJournalRepository(entries: entries)

        let firstPage = try await repository.entries(after: nil, limit: 2)
        XCTAssertEqual(firstPage.map(\.id), ["e0", "e1"])

        let secondPage = try await repository.entries(after: firstPage.last?.createdAt, limit: 2)
        XCTAssertEqual(secondPage.map(\.id), ["e2", "e3"])
    }

    @MainActor
    func testUpdateContentSetsTextAndAppendsMedia() async throws {
        let entry = JournalEntry(userId: "u1", type: .image, title: "Photos", content: "OCR text")
        let repo = MockJournalRepository(entries: [entry])

        let clip = MediaItem(s3Key: "users/u1/journals/\(entry.id)/audio-1.m4a", kind: .audio, durationSec: 12)
        let editedAt = Date()
        try await repo.updateContent(
            id: entry.id,
            content: "OCR text\n\nrecorded memo",
            wordCount: 4,
            contentEditedAt: editedAt,
            appendedMedia: [clip]
        )

        var latest: JournalEntry?
        for await e in repo.entry(id: entry.id) { latest = e; break }
        XCTAssertEqual(latest?.content, "OCR text\n\nrecorded memo")
        XCTAssertEqual(latest?.wordCount, 4)
        XCTAssertEqual(latest?.contentEditedAt, editedAt)
        XCTAssertEqual(latest?.media.filter { $0.kind == .audio }.count, 1)
    }

    @MainActor
    func testUpdateContentThrowsWhenEntryMissing() async {
        let repo = MockJournalRepository(entries: [])
        do {
            try await repo.updateContent(id: "missing", content: "x", wordCount: 1, contentEditedAt: Date(), appendedMedia: [])
            XCTFail("expected entryNotFound")
        } catch JournalRepositoryError.entryNotFound {
            // expected
        } catch {
            XCTFail("unexpected error: \(error)")
        }
    }

    @MainActor
    func testApplyEntryEditUpdatesFieldsAndAppendsHistory() async throws {
        let entry = JournalEntry(id: "e1", userId: "u1", type: .text, title: "Old", content: "Old body")
        let repo = MockJournalRepository(entries: [entry])

        let when = Date(timeIntervalSince1970: 1_760_600_000)
        try await repo.applyEntryEdit(
            id: "e1", title: "New", content: "New body",
            wordCount: 2,
            contentEditedAt: when,
            edit: EditRecord(editedAt: when, fields: ["title", "content"])
        )

        let updated = try await repo.entries(after: nil, limit: 10).first { $0.id == "e1" }
        XCTAssertEqual(updated?.title, "New")
        XCTAssertEqual(updated?.content, "New body")
        XCTAssertEqual(updated?.wordCount, 2)
        XCTAssertEqual(updated?.contentEditedAt, when)
        XCTAssertEqual(updated?.editHistory.count, 1)
        XCTAssertEqual(updated?.editHistory.first?.fields, ["title", "content"])
    }

    @MainActor
    func testApplyEntryEditThrowsWhenMissing() async {
        let repo = MockJournalRepository(entries: [])
        do {
            try await repo.applyEntryEdit(
                id: "nope", title: "t", content: "c", wordCount: 1, contentEditedAt: nil,
                edit: EditRecord(fields: ["title"])
            )
            XCTFail("expected entryNotFound")
        } catch JournalRepositoryError.entryNotFound {
            // expected
        } catch {
            XCTFail("unexpected error: \(error)")
        }
    }

    /// Regression: a background-pipeline `save` writes a fresh `JournalEntry`
    /// whose AI fields are nil (EntryProcessor/EntryFinalizer never load them).
    /// Production `save` is `setData(merge: true)` and `firestoreData` omits the
    /// AI keys when nil, so such a save must NOT clear a summary/insights/prompts
    /// that a previous `updateAIFields` already persisted. The mock mirrors that
    /// merge contract so demo mode behaves like Firestore.
    @MainActor
    func testSaveDoesNotClobberPersistedAIFields() async throws {
        let generated = JournalEntry(
            id: "e1",
            userId: "user-1",
            type: .text,
            title: "Entry",
            content: "Body worth summarizing.",
            summary: AIGeneration(text: "keep me", model: "m"),
            insights: AIGeneration(text: "## keep insights", model: "m"),
            prompts: AIPrompts(items: ["Keep this prompt?"], model: "m"),
            wordCount: 3
        )
        let repo = MockJournalRepository(entries: [generated])

        // Background status transition: same entry, AI fields nil.
        var pipelineWrite = generated
        pipelineWrite.summary = nil
        pipelineWrite.insights = nil
        pipelineWrite.prompts = nil
        pipelineWrite.processingStatus = .ready
        try await repo.save(pipelineWrite)

        let stored = try await repo.entries(after: nil, limit: 10).first { $0.id == "e1" }
        XCTAssertEqual(stored?.summary?.text, "keep me", "save must not clear a persisted summary")
        XCTAssertEqual(stored?.insights?.text, "## keep insights", "save must not clear persisted insights")
        XCTAssertEqual(stored?.prompts?.items, ["Keep this prompt?"], "save must not clear persisted prompts")
        XCTAssertEqual(stored?.processingStatus, .ready, "non-AI fields still update normally")
    }
}
