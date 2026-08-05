import XCTest
import CryptoKit
@testable import LuminaLog

/// The zero-knowledge unlock decision tree: enroll a brand-new account, unlock a
/// returning device, or fall back to the recovery code — always failing closed.
@MainActor
final class KeyEnrollmentServiceTests: XCTestCase {

    // MARK: - Fakes

    private final class FakeStore: SecretStore {
        private var items: [String: Data] = [:]
        func data(for account: String) -> Data? { items[account] }
        func set(_ data: Data, for account: String) { items[account] = data }
        func remove(for account: String) { items[account] = nil }
    }

    /// Always fails — the production `ICloudKeyProvider` behavior for a device
    /// with no iCloud KEK. Tests that need a working provider install the DEK
    /// into the device store instead (the `loadCipher` cache hit).
    private final class FailingProvider: KeyProvider {
        private(set) var calls = 0
        func fetchDataKey(userId: String) async throws -> Data {
            calls += 1
            throw ICloudKeyProviderError.noICloudKey
        }
    }

    private struct Offline: Error {}

    /// Transport whose fetch/upload can be made to fail, to prove we never
    /// enroll (mint a second DEK) on a transient error.
    private final class FlakyTransport: KeyMigrationTransport {
        var stored: MultiWrappedDEK?
        var fetchError: Error?
        var uploadError: Error?
        private(set) var uploads = 0

        init(stored: MultiWrappedDEK? = nil) { self.stored = stored }

        func uploadWraps(_ wraps: MultiWrappedDEK) async throws {
            uploads += 1
            if let uploadError { throw uploadError }
            stored = wraps
        }
        func fetchWraps() async throws -> MultiWrappedDEK? {
            if let fetchError { throw fetchError }
            return stored
        }
        func finalizeMigration() async throws {}
    }

    // MARK: - SUT

    private struct SUT {
        let service: KeyEnrollmentService
        let keys: UserKeyStore
        let transport: FlakyTransport
        let deviceStore: FakeStore
        let iCloudStore: FakeStore
        let defaults: UserDefaults
    }

    private func makeSUT(
        stored: MultiWrappedDEK? = nil,
        code: String = "AAAA-BBBB-CCCC-DDDD",
        file: StaticString = #filePath, line: UInt = #line
    ) throws -> SUT {
        let deviceStore = FakeStore()
        let iCloudStore = FakeStore()
        let transport = FlakyTransport(stored: stored)
        let keys = UserKeyStore(provider: FailingProvider(), secrets: deviceStore)
        let enroller = ClientKeyEnroller(
            transport: transport, iCloudStore: iCloudStore, recoveryCodeFactory: { code }
        )
        let defaults = try XCTUnwrap(UserDefaults(suiteName: "KeyEnrollmentServiceTests.\(UUID().uuidString)"),
                                     file: file, line: line)
        let service = KeyEnrollmentService(
            keys: keys, enroller: enroller, transport: transport, defaults: defaults
        )
        return SUT(service: service, keys: keys, transport: transport,
                   deviceStore: deviceStore, iCloudStore: iCloudStore, defaults: defaults)
    }

    /// A pre-existing account's wraps, as the server would hold them.
    private func existingWraps(dek: SymmetricKey, kek: SymmetricKey, code: String) -> MultiWrappedDEK {
        MultiWrappedDEK(
            icloud: WrappedKey.wrapping(dek: dek, under: kek),
            recovery: RecoveryCode.wrap(dek: dek, code: code)
        )
    }

    // MARK: - Already unlockable

    func testUnlocksFromDeviceCacheWithoutTouchingTheNetwork() async throws {
        let sut = try makeSUT()
        let dek = SymmetricKey(size: .bits256)
        sut.deviceStore.set(dek.rawData, for: "dek.u1")

        await sut.service.resolve(userId: "u1")

        XCTAssertEqual(sut.service.state, .unlocked)
        XCTAssertEqual(sut.transport.uploads, 0)          // did NOT re-enroll an existing user
        XCTAssertEqual(sut.keys.currentDataKey?.rawData, dek.rawData)
    }

    // MARK: - First-run enrollment

    func testEnrollsBrandNewAccountAndShowsTheRecoveryCodeOnce() async throws {
        let sut = try makeSUT()   // no wraps on the server → brand-new account

        await sut.service.resolve(userId: "u1")

        XCTAssertEqual(sut.service.state, .showingRecoveryCode("AAAA-BBBB-CCCC-DDDD"))
        // Wraps are durably stored BEFORE the key becomes usable.
        let fetched = try await sut.transport.fetchWraps()
        let wraps = try XCTUnwrap(fetched)
        let dek = try XCTUnwrap(sut.keys.currentDataKey)
        XCTAssertEqual(try RecoveryCode.unwrap(wraps.recovery, code: "AAAA-BBBB-CCCC-DDDD").rawData,
                       dek.rawData, "the displayed code must actually recover the installed DEK")
        let kek = SymmetricKey(data: try XCTUnwrap(sut.iCloudStore.data(for: SyncedKeychainStore.account(forUserId: "u1"))))
        XCTAssertEqual(try wraps.icloud.unwrapping(under: kek).rawData, dek.rawData)
        // Cached to the device Keychain so the next launch unlocks silently.
        XCTAssertEqual(sut.deviceStore.data(for: "dek.u1"), dek.rawData)
    }

    func testAcknowledgingTheCodeUnlocks() async throws {
        let sut = try makeSUT()
        await sut.service.resolve(userId: "u1")
        sut.service.acknowledgeRecoveryCode(userId: "u1")
        XCTAssertEqual(sut.service.state, .unlocked)
    }

    /// The user killed the app on the code screen. The code is not stored
    /// anywhere (by design), so we rotate to a fresh one and show it again
    /// rather than leaving them with a backstop they never saw.
    func testInterruptedEnrollmentReshowsAFreshCodeOnNextLaunch() async throws {
        let sut = try makeSUT()
        await sut.service.resolve(userId: "u1")
        let dek = try XCTUnwrap(sut.keys.currentDataKey)
        XCTAssertEqual(sut.service.state, .showingRecoveryCode("AAAA-BBBB-CCCC-DDDD"))
        // …app killed: same defaults + Keychain, fresh service, different code.
        let relaunched = KeyEnrollmentService(
            keys: sut.keys,
            enroller: ClientKeyEnroller(transport: sut.transport, iCloudStore: sut.iCloudStore,
                                        recoveryCodeFactory: { "NEW1-NEW2-NEW3-NEW4" }),
            transport: sut.transport,
            defaults: sut.defaults
        )

        await relaunched.resolve(userId: "u1")

        XCTAssertEqual(relaunched.state, .showingRecoveryCode("NEW1-NEW2-NEW3-NEW4"))
        // Same DEK — rotating the code must never orphan already-encrypted data.
        XCTAssertEqual(sut.keys.currentDataKey?.rawData, dek.rawData)
        let fetched = try await sut.transport.fetchWraps()
        let wraps = try XCTUnwrap(fetched)
        XCTAssertEqual(try RecoveryCode.unwrap(wraps.recovery, code: "NEW1-NEW2-NEW3-NEW4").rawData, dek.rawData)

        relaunched.acknowledgeRecoveryCode(userId: "u1")
        let after = KeyEnrollmentService(
            keys: sut.keys,
            enroller: ClientKeyEnroller(transport: sut.transport, iCloudStore: sut.iCloudStore),
            transport: sut.transport, defaults: sut.defaults
        )
        await after.resolve(userId: "u1")
        XCTAssertEqual(after.state, .unlocked, "acknowledged — never nag again")
    }

    func testUploadFailureLeavesNothingInstalled() async throws {
        let sut = try makeSUT()
        sut.transport.uploadError = Offline()

        await sut.service.resolve(userId: "u1")

        guard case .failed = sut.service.state else {
            return XCTFail("expected .failed, got \(sut.service.state)")
        }
        XCTAssertNil(sut.keys.currentCipher, "must not encrypt with a key that has no backup")
        XCTAssertNil(sut.deviceStore.data(for: "dek.u1"))
    }

    /// Offline must NOT look like "brand-new account" — minting a second DEK
    /// would orphan every entry the user already wrote.
    func testTransientFetchFailureNeverEnrolls() async throws {
        let sut = try makeSUT()
        sut.transport.fetchError = Offline()

        await sut.service.resolve(userId: "u1")

        guard case .failed = sut.service.state else {
            return XCTFail("expected .failed, got \(sut.service.state)")
        }
        XCTAssertEqual(sut.transport.uploads, 0)
        XCTAssertNil(sut.keys.currentCipher)
    }

    // MARK: - Recovery-code unlock

    func testWrapsExistButDeviceHasNoKeyAsksForTheRecoveryCode() async throws {
        let dek = SymmetricKey(size: .bits256)
        let sut = try makeSUT(stored: existingWraps(dek: dek, kek: SymmetricKey(size: .bits256), code: "OLD1-OLD2"))

        await sut.service.resolve(userId: "u1")

        XCTAssertEqual(sut.service.state, .needsRecoveryCode(failedAttempt: false))
        XCTAssertEqual(sut.transport.uploads, 0)
        XCTAssertNil(sut.keys.currentCipher)
    }

    func testCorrectRecoveryCodeUnlocksAndRebindsThisDevice() async throws {
        let dek = SymmetricKey(size: .bits256)
        let sut = try makeSUT(stored: existingWraps(dek: dek, kek: SymmetricKey(size: .bits256), code: "OLD1-OLD2"))
        await sut.service.resolve(userId: "u1")

        // Entered with the formatting a human would use — normalization handles it.
        await sut.service.submitRecoveryCode(" old1 old2 ", userId: "u1")

        XCTAssertEqual(sut.service.state, .unlocked)
        XCTAssertEqual(sut.keys.currentDataKey?.rawData, dek.rawData, "recovered the ORIGINAL DEK")
        // This device is now enrolled: a fresh iCloud KEK that opens the new wrap.
        let kek = SymmetricKey(data: try XCTUnwrap(sut.iCloudStore.data(for: SyncedKeychainStore.account(forUserId: "u1"))))
        let fetched = try await sut.transport.fetchWraps()
        let wraps = try XCTUnwrap(fetched)
        XCTAssertEqual(try wraps.icloud.unwrapping(under: kek).rawData, dek.rawData)
        // …and the user's existing code still works — it was NOT rotated under them.
        XCTAssertEqual(try RecoveryCode.unwrap(wraps.recovery, code: "OLD1-OLD2").rawData, dek.rawData)
    }

    func testWrongRecoveryCodeFailsClosed() async throws {
        let dek = SymmetricKey(size: .bits256)
        let sut = try makeSUT(stored: existingWraps(dek: dek, kek: SymmetricKey(size: .bits256), code: "OLD1-OLD2"))
        await sut.service.resolve(userId: "u1")

        await sut.service.submitRecoveryCode("WRON-GCOD-E123", userId: "u1")

        XCTAssertEqual(sut.service.state, .needsRecoveryCode(failedAttempt: true))
        XCTAssertNil(sut.keys.currentCipher)
        XCTAssertEqual(sut.transport.uploads, 0, "a bad guess must not touch the stored wraps")
    }

    func testSignOutResetsToResolving() async throws {
        let sut = try makeSUT()
        await sut.service.resolve(userId: "u1")
        sut.service.reset()
        XCTAssertEqual(sut.service.state, .resolving)
    }
}
