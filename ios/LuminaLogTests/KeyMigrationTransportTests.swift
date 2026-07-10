import XCTest
import CryptoKit
@testable import LuminaLog

/// In-memory `KeyMigrationTransport` double for unit tests. Stores the last
/// uploaded `MultiWrappedDEK` and replays it from `fetchWraps`, and counts
/// `finalizeMigration()` calls. Internal (not private) — a later task
/// extends this with tamper flags and reuses it for `KeyMigrator` tests.
final class InMemoryKeyMigrationTransport: KeyMigrationTransport {
    private(set) var uploadedWraps: MultiWrappedDEK?
    private(set) var finalizeMigrationCallCount = 0

    func uploadWraps(_ wraps: MultiWrappedDEK) async throws {
        uploadedWraps = wraps
    }

    func fetchWraps() async throws -> MultiWrappedDEK? {
        uploadedWraps
    }

    func finalizeMigration() async throws {
        finalizeMigrationCallCount += 1
    }
}

final class KeyMigrationTransportTests: XCTestCase {

    func testUploadThenFetchRoundTrips() async throws {
        // Verify the DTO mapping conceptually: MultiWrappedDEK -> transport -> back
        // must be bit-identical. The real HTTP path is `ProxyKeyMigrationTransport`,
        // backed by `ProxyAPIClient` (covered separately); this fake proves the
        // round-trip contract `KeyMigrator` will rely on.
        let dek = SymmetricKey(size: .bits256)
        let kek = SymmetricKey(size: .bits256)
        let wraps = MultiWrappedDEK(
            icloud: WrappedKey.wrapping(dek: dek, under: kek),
            recovery: RecoveryCode.wrap(dek: dek, code: "TESTTEST")
        )

        let fake = InMemoryKeyMigrationTransport()
        try await fake.uploadWraps(wraps)
        let back = try await fake.fetchWraps()

        XCTAssertEqual(back, wraps)
    }

    func testFetchWrapsReturnsNilBeforeAnyUpload() async throws {
        let fake = InMemoryKeyMigrationTransport()
        let back = try await fake.fetchWraps()
        XCTAssertNil(back)
    }

    func testFetchWrapsReturnsLatestUpload() async throws {
        let kek = SymmetricKey(size: .bits256)
        let dek1 = SymmetricKey(size: .bits256)
        let dek2 = SymmetricKey(size: .bits256)
        let wraps1 = MultiWrappedDEK(
            icloud: WrappedKey.wrapping(dek: dek1, under: kek),
            recovery: RecoveryCode.wrap(dek: dek1, code: "TESTTEST")
        )
        let wraps2 = MultiWrappedDEK(
            icloud: WrappedKey.wrapping(dek: dek2, under: kek),
            recovery: RecoveryCode.wrap(dek: dek2, code: "TESTTEST")
        )

        let fake = InMemoryKeyMigrationTransport()
        try await fake.uploadWraps(wraps1)
        try await fake.uploadWraps(wraps2)
        let back = try await fake.fetchWraps()

        XCTAssertEqual(back, wraps2)
        XCTAssertNotEqual(back, wraps1)
    }

    func testFinalizeMigrationCountsCalls() async throws {
        let fake = InMemoryKeyMigrationTransport()
        XCTAssertEqual(fake.finalizeMigrationCallCount, 0)

        try await fake.finalizeMigration()
        try await fake.finalizeMigration()

        XCTAssertEqual(fake.finalizeMigrationCallCount, 2)
    }
}
