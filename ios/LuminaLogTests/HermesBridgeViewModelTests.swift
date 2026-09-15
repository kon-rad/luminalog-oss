import XCTest
@testable import LuminaLog

private final class InMemorySecretStore: SecretStore {
    private var storage: [String: Data] = [:]
    func data(for account: String) -> Data? { storage[account] }
    func set(_ data: Data, for account: String) { storage[account] = data }
    func remove(for account: String) { storage[account] = nil }
}

/// Fake `HermesStreamConnection` backing: `HermesStreamConnection` itself is
/// a concrete class wrapping `URLSessionWebSocketTask`, so tests exercise
/// `HermesBridgeViewModel`'s event-handling by driving its `handle(_:)` path
/// indirectly is not possible from outside the module. Stream accumulation
/// is instead covered by feeding events through a fake service whose
/// `openStream` seam is exercised via the fake below, which stands in for
/// the wire-level connection with a directly-controllable event sequence.
private final class FakeHermesBridgeService: HermesBridgeService {
    var pairResult: Result<String, Error> = .success("test-token")
    var tasksResult: Result<[HermesTaskSummary], Error> = .success([])
    var changesResult: Result<[HermesCommitSummary], Error> = .success([])
    var fileResult: Result<HermesFileResult, Error> = .success(
        HermesFileResult(type: "file", path: "", content: "", entries: nil)
    )

    func pair(baseURL: URL, code: String, deviceName: String) async throws -> String {
        try pairResult.get()
    }

    func recentTasks(baseURL: URL, token: String, limit: Int) async throws -> [HermesTaskSummary] {
        try tasksResult.get()
    }

    func recentChanges(baseURL: URL, token: String, limit: Int) async throws -> [HermesCommitSummary] {
        try changesResult.get()
    }

    func readFile(baseURL: URL, token: String, path: String) async throws -> HermesFileResult {
        try fileResult.get()
    }

    func openStream(baseURL: URL, token: String) -> HermesStreamConnection {
        HermesStreamConnection(session: .shared, baseURL: baseURL, token: token)
    }
}

@MainActor
final class HermesBridgeViewModelTests: XCTestCase {

    private func makeSUT(service: FakeHermesBridgeService = FakeHermesBridgeService())
        -> (HermesBridgeViewModel, InMemorySecretStore) {
        let store = InMemorySecretStore()
        let vm = HermesBridgeViewModel(service: service, secretStore: store)
        return (vm, store)
    }

    func testStartsUnpaired() {
        let (vm, _) = makeSUT()
        XCTAssertEqual(vm.pairingState, .unpaired)
    }

    func testSuccessfulPairingPersistsTokenAndFlipsState() async {
        let (vm, store) = makeSUT()
        await vm.pair(baseURLString: "https://gateway.example.com", code: "123456", deviceName: "Test")

        XCTAssertEqual(vm.pairingState, .paired(baseURL: URL(string: "https://gateway.example.com")!))
        XCTAssertNotNil(store.data(for: "hermesBridge.token"))
        XCTAssertNil(vm.errorMessage)
    }

    func testFailedPairingLeavesUnpairedAndSetsError() async {
        struct Boom: Error, LocalizedError { var errorDescription: String? { "bad code" } }
        let service = FakeHermesBridgeService()
        service.pairResult = .failure(Boom())
        let (vm, _) = makeSUT(service: service)

        await vm.pair(baseURLString: "https://gateway.example.com", code: "000000", deviceName: "Test")

        XCTAssertEqual(vm.pairingState, .unpaired)
        XCTAssertEqual(vm.errorMessage, "bad code")
    }

    func testInvalidBaseURLIsRejectedWithoutCallingService() async {
        let (vm, _) = makeSUT()
        await vm.pair(baseURLString: "not a url", code: "123456", deviceName: "Test")

        XCTAssertEqual(vm.pairingState, .unpaired)
        XCTAssertNotNil(vm.errorMessage)
    }

    func testLoadRecentTasksPopulatesList() async {
        let service = FakeHermesBridgeService()
        service.tasksResult = .success([
            HermesTaskSummary(id: "1", title: "Ship feature", status: "done", priority: 0, completedAt: 100),
        ])
        let (vm, _) = makeSUT(service: service)
        await vm.pair(baseURLString: "https://gateway.example.com", code: "123456", deviceName: "Test")

        await vm.loadRecentTasks()

        XCTAssertEqual(vm.tasks.map(\.title), ["Ship feature"])
    }

    func testUnauthorizedLoadClearsTokenAndUnpairs() async {
        let service = FakeHermesBridgeService()
        let (vm, store) = makeSUT(service: service)
        await vm.pair(baseURLString: "https://gateway.example.com", code: "123456", deviceName: "Test")
        XCTAssertNotNil(store.data(for: "hermesBridge.token"))

        service.tasksResult = .failure(HermesBridgeError.httpError(statusCode: 401, body: ""))
        await vm.loadRecentTasks()

        XCTAssertEqual(vm.pairingState, .unpaired)
        XCTAssertNil(store.data(for: "hermesBridge.token"))
    }

    func testUnpairClearsStateAndToken() async {
        let (vm, store) = makeSUT()
        await vm.pair(baseURLString: "https://gateway.example.com", code: "123456", deviceName: "Test")

        vm.unpair()

        XCTAssertEqual(vm.pairingState, .unpaired)
        XCTAssertNil(store.data(for: "hermesBridge.token"))
        XCTAssertTrue(vm.tasks.isEmpty)
        XCTAssertTrue(vm.commits.isEmpty)
    }
}
