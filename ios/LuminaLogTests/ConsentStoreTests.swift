import XCTest
@testable import LuminaLog

final class ConsentStoreTests: XCTestCase {
    private func makeDefaults() -> UserDefaults {
        let d = UserDefaults(suiteName: "consent-test-\(UUID().uuidString)")!
        return d
    }

    func testDefaultsToNotConsented() {
        let store = ConsentStore(defaults: makeDefaults())
        XCTAssertFalse(store.hasConsentedAI)
        XCTAssertFalse(store.needsServerSync)
    }

    func testRecordLocalConsentSetsFlagAndNeedsSync() {
        let store = ConsentStore(defaults: makeDefaults())
        store.recordLocalConsent()
        XCTAssertTrue(store.hasConsentedAI)
        XCTAssertTrue(store.needsServerSync)
    }

    func testMarkSyncedClearsNeedsSync() {
        let store = ConsentStore(defaults: makeDefaults())
        store.recordLocalConsent()
        store.markSynced()
        XCTAssertTrue(store.hasConsentedAI)
        XCTAssertFalse(store.needsServerSync)
    }
}
