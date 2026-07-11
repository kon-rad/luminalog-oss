import XCTest
@testable import LuminaLog

private final class SpyPutAPI: ConsentAPIPutting {
    var puts: [(path: String, json: String)] = []
    var shouldThrow: Error?
    func put(path: String, body: some Encodable) async throws {
        if let shouldThrow { throw shouldThrow }
        let data = try JSONEncoder().encode(body)
        puts.append((path, String(data: data, encoding: .utf8) ?? ""))
    }
}

final class ConsentServiceTests: XCTestCase {
    private func store() -> ConsentStore {
        ConsentStore(defaults: UserDefaults(suiteName: "cs-\(UUID().uuidString)")!)
    }

    func testSyncPutsConsentAndMarksSynced() async throws {
        let api = SpyPutAPI(); let s = store(); s.recordLocalConsent()
        let svc = ConsentService(api: api, store: s)
        try await svc.sync()
        XCTAssertEqual(api.puts.count, 1)
        XCTAssertEqual(api.puts[0].path, "/v1/consent")
        XCTAssertTrue(api.puts[0].json.contains("\"aiDataSharing\":true"))
        XCTAssertTrue(api.puts[0].json.contains("2026-07-11"))
        XCTAssertFalse(s.needsServerSync)
    }

    func testSyncFailureLeavesNeedsSync() async {
        let api = SpyPutAPI(); api.shouldThrow = URLError(.notConnectedToInternet)
        let s = store(); s.recordLocalConsent()
        let svc = ConsentService(api: api, store: s)
        do { try await svc.sync(); XCTFail("should throw") } catch {}
        XCTAssertTrue(s.needsServerSync)
    }

    func testSyncIfNeededNoOpWhenNothingToSync() async {
        let api = SpyPutAPI(); let s = store()  // no consent recorded
        let svc = ConsentService(api: api, store: s)
        await svc.syncIfNeeded()
        XCTAssertTrue(api.puts.isEmpty)
    }
}
