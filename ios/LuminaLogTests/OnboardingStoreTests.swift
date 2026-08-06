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

    // MARK: - Draft ownership

    /// A draft is filled in pre-auth, so it starts unclaimed — the first account
    /// to sign in owns it.
    func testUnclaimedDraftHasNoOwner() {
        let store = OnboardingStore(defaults: makeDefaults())
        store.saveDraft(["name": "Ada"])
        XCTAssertNil(store.draftOwner)
    }

    func testClaimRecordsTheOwningUser() {
        let defaults = makeDefaults()
        let store = OnboardingStore(defaults: defaults)
        store.saveDraft(["name": "Ada"])
        store.claimDraft(for: "uid-a")
        XCTAssertEqual(OnboardingStore(defaults: defaults).draftOwner, "uid-a",
                       "Ownership must survive a relaunch, like the draft itself")
    }

    /// Clearing is what runs at sign-out and after a successful merge; leaving a
    /// stale owner behind would misattribute the NEXT person's draft.
    func testClearDraftAlsoClearsTheOwner() {
        let store = OnboardingStore(defaults: makeDefaults())
        store.saveDraft(["name": "Ada"])
        store.claimDraft(for: "uid-a")
        store.clearDraft()
        XCTAssertNil(store.draftOwner)
        XCTAssertTrue(store.loadDraft().isEmpty)
    }

    func testDraftBelongsToItsClaimantOnly() {
        let store = OnboardingStore(defaults: makeDefaults())
        store.saveDraft(["name": "Ada"])
        store.claimDraft(for: "uid-a")
        XCTAssertTrue(store.draftBelongs(to: "uid-a"))
        XCTAssertFalse(store.draftBelongs(to: "uid-b"))
    }

    /// The normal path: onboarding is filled in before any account exists, so an
    /// unclaimed draft is fair game for whoever signs in first.
    func testUnclaimedDraftBelongsToAnyUser() {
        let store = OnboardingStore(defaults: makeDefaults())
        store.saveDraft(["name": "Ada"])
        XCTAssertTrue(store.draftBelongs(to: "uid-a"))
    }
}
