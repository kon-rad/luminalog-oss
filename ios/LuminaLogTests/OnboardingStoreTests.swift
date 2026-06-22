import XCTest
@testable import LuminaLog

@MainActor
final class OnboardingStoreTests: XCTestCase {

    private func makeDefaults() -> UserDefaults {
        let name = "test-\(UUID().uuidString)"
        let d = UserDefaults(suiteName: name)!
        d.removePersistentDomain(forName: name)
        return d
    }

    func testDraftRoundTrips() {
        let store = OnboardingStore(defaults: makeDefaults())
        store.saveDraft(["name": "Ada", "goals": "Build things"])
        XCTAssertEqual(store.loadDraft()["name"], "Ada")
        XCTAssertEqual(store.loadDraft()["goals"], "Build things")
    }

    func testCompletionFlagPersistsAcrossInstances() {
        let defaults = makeDefaults()
        let store = OnboardingStore(defaults: defaults)
        XCTAssertFalse(store.isCompleted)
        store.markCompleted()
        XCTAssertTrue(OnboardingStore(defaults: defaults).isCompleted)
    }

    func testClearDraftRemovesValues() {
        let store = OnboardingStore(defaults: makeDefaults())
        store.saveDraft(["name": "Ada"])
        store.clearDraft()
        XCTAssertTrue(store.loadDraft().isEmpty)
    }

    func testEmptyDraftByDefault() {
        XCTAssertTrue(OnboardingStore(defaults: makeDefaults()).loadDraft().isEmpty)
    }
}
