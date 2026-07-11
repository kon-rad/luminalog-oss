import XCTest
@testable import LuminaLog

@MainActor
final class ConsentGateTests: XCTestCase {
    private func makeStore(consented: Bool) -> ConsentStore {
        let s = ConsentStore(defaults: UserDefaults(suiteName: "cg-\(UUID().uuidString)")!)
        if consented { s.recordLocalConsent(); s.markSynced() }
        return s
    }

    func testNoConsentNeedsConsentTrue() {
        let s = makeStore(consented: false)
        let vm = ConsentGateViewModel(store: s, service: ConsentService(api: SpyPutAPI(), store: s))
        XCTAssertTrue(vm.needsConsent)
    }

    func testAlreadyConsentedNeedsConsentFalse() {
        let s = makeStore(consented: true)
        let vm = ConsentGateViewModel(store: s, service: ConsentService(api: SpyPutAPI(), store: s))
        XCTAssertFalse(vm.needsConsent)
    }

    func testAgreeRecordsSyncsAndClearsNeedsConsent() async {
        let s = makeStore(consented: false)
        let api = SpyPutAPI()
        let vm = ConsentGateViewModel(store: s, service: ConsentService(api: api, store: s))
        await vm.agree()
        XCTAssertEqual(api.puts.count, 1)
        XCTAssertFalse(vm.needsConsent)
        XCTAssertFalse(vm.syncFailed)
    }

    func testAgreeSyncFailureKeepsGateAndFlagsFailure() async {
        let s = makeStore(consented: false)
        let api = SpyPutAPI(); api.shouldThrow = URLError(.notConnectedToInternet)
        let vm = ConsentGateViewModel(store: s, service: ConsentService(api: api, store: s))
        await vm.agree()
        XCTAssertTrue(vm.needsConsent)   // still gated
        XCTAssertTrue(vm.syncFailed)
    }
}
