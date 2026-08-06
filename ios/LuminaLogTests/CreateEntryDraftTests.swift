import XCTest
@testable import LuminaLog

@MainActor
final class CreateEntryDraftTests: XCTestCase {

    private func tempDir() -> URL {
        let u = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try? FileManager.default.createDirectory(at: u, withIntermediateDirectories: true)
        return u
    }

    private func makeVM(store: DraftStore, request: CreateEntryRequest = CreateEntryRequest())
        -> CreateEntryViewModel
    {
        CreateEntryViewModel(
            request: request,
            dependencies: CreateEntryDependencies(
                auth: MockAuthService(signedIn: true),
                speech: AppleSpeechTranscriber(),
                entryProcessor: NoopEntryProcessor(),
                drafts: store
            )
        )
    }

    func testTypingPersistsADraft() {
        let store = DraftStore(directory: tempDir())
        let vm = makeVM(store: store)
        vm.text = "a thought"
        vm.persistDraftNow()                 // synchronous persist hook (debounce bypass)
        XCTAssertEqual(store.all().first?.text, "a thought")
    }

    func testEmptyDraftIsNotPersisted() {
        let store = DraftStore(directory: tempDir())
        let vm = makeVM(store: store)
        vm.text = "   "
        vm.persistDraftNow()
        XCTAssertTrue(store.all().isEmpty)
    }

    func testResumeHydratesText() {
        let store = DraftStore(directory: tempDir())
        let id = "resume-1"
        store.upsert(DraftEntry(draftId: id, text: "saved body", promptText: "P",
                                createdAtEpoch: 5, updatedAtEpoch: 5, attachments: []))
        let vm = makeVM(store: store, request: CreateEntryRequest(resumeDraftId: id))
        vm.loadResumedDraftIfNeeded()
        XCTAssertEqual(vm.text, "saved body")
        XCTAssertEqual(vm.promptText, "P")
    }

    func testDiscardRemovesDraft() {
        let store = DraftStore(directory: tempDir())
        let vm = makeVM(store: store)
        vm.text = "junk"
        vm.persistDraftNow()
        XCTAssertFalse(store.all().isEmpty)
        vm.discardDraft()
        XCTAssertTrue(store.all().isEmpty)
    }

    func testSaveRetainsDraftAsHandedOff() {
        let store = DraftStore(directory: tempDir())
        let vm = makeVM(store: store)
        vm.text = "keeper"
        vm.persistDraftNow()
        vm.save()
        XCTAssertTrue(vm.didSave)
        // The draft is RETAINED (not deleted) as the durable cross-launch retry
        // source, flagged `handedOff` so Home hides it; it's cleared once the entry
        // settles `.ready`. See DraftEntry.handedOff / CreateEntryViewModel.save().
        XCTAssertEqual(store.all().count, 1)
        XCTAssertTrue(store.all().first?.handedOff == true)
    }

    func testPersistAfterSaveDoesNotRecreateDraft() {
        let store = DraftStore(directory: tempDir())
        let vm = makeVM(store: store)
        vm.text = "keeper"
        vm.persistDraftNow()
        vm.save()
        XCTAssertEqual(store.all().count, 1)
        vm.persistDraftNow()                 // simulates the onDisappear flush after save
        // The post-save flush must NOT create a second/phantom draft, and must not
        // clear the handed-off flag on the retained one.
        XCTAssertEqual(store.all().count, 1, "a saved entry must not leave a phantom draft")
        XCTAssertTrue(store.all().first?.handedOff == true)
    }
}

/// Minimal EntryProcessor stub for tests (records nothing).
@MainActor
final class NoopEntryProcessor: EntryProcessor {
    func enqueue(_ job: EntryProcessingJob) {}
    func retry(draftId: String) {}
    func resumePendingJobs() async {}
    func sweepStuckEntries() async {}
}
