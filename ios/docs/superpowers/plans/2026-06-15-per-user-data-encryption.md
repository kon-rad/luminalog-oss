# Per-User Data Encryption (iOS Client) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Encrypt all user content (journal entries, transcriptions, AI output, chat messages, profile bio, media bytes) at rest with a per-user AES-256-GCM data key, decrypting only for UI display on-device (proxy-side decryption lives in the backend repo).

**Architecture:** Envelope encryption (spec `docs/superpowers/specs/2026-06-15-per-user-data-encryption-design.md`). The device fetches its raw Data Encryption Key (DEK) once from the proxy `/v1/keys/bootstrap` endpoint and caches it in the Keychain. A `FieldCipher` encrypts in-scope string fields into a `{v,alg,iv,ct,tag}` envelope stored in Firestore; a `MediaCipher` encrypts media bytes (chunked) before S3 upload. The Firestore mapping layer threads the cipher through `firestoreData`/`init?` so repositories transparently encrypt on write and decrypt on read.

**Tech Stack:** Swift 5, CryptoKit (`AES.GCM`, `SymmetricKey`), Security framework (Keychain), Firebase Firestore, XCTest. Project generated via XcodeGen (`project.yml`).

**Scope note:** This plan covers the **iOS client** only. The proxy endpoints (`/v1/keys/bootstrap`, server-side encrypt/decrypt, Chroma chunk-text encryption) are an external contract implemented in the backend repo and are stubbed here behind the `KeyProvider` protocol (real `ProxyKeyProvider` + `MockKeyProvider`), mirroring the existing `AIService`/`MockAIService` pattern.

**Build/test commands:** Regenerate the project after adding files, then run the test target:
```bash
xcodegen generate
xcodebuild test -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:LuminaLogTests/<TestClass>
```
New source files live under `LuminaLog/Core/Crypto/`; XcodeGen picks them up automatically (the target globs `LuminaLog/`). New test files under `LuminaLogTests/` are globbed too. Run `xcodegen generate` before the first build after creating files.

---

## File Structure

**New source files**
- `LuminaLog/Core/Crypto/EncryptedField.swift` — the `{v,alg,iv,ct,tag}` envelope value type + Firestore dict mapping.
- `LuminaLog/Core/Crypto/FieldCipher.swift` — AES-256-GCM string⇄envelope encrypt/decrypt with AAD; errors.
- `LuminaLog/Core/Crypto/MediaCipher.swift` — chunked AES-GCM file⇄file encryption for media bytes.
- `LuminaLog/Core/Crypto/KeychainStore.swift` — minimal Keychain get/set/delete behind a `SecretStore` protocol + in-memory fake.
- `LuminaLog/Core/Crypto/UserKeyStore.swift` — loads/caches the DEK, vends a `FieldCipher`; `KeyProvider` protocol.
- `LuminaLog/Core/Crypto/ProxyKeyProvider.swift` — real `KeyProvider` calling `/v1/keys/bootstrap`.
- `LuminaLog/Core/Mocks/MockKeyProvider.swift` — deterministic `KeyProvider` for previews/tests.

**Modified source files**
- `LuminaLog/Core/Persistence/FirestoreMapping.swift` — thread `FieldCipher` through in-scope fields.
- `LuminaLog/Core/Persistence/FirestoreJournalRepository.swift` — hold a `UserKeyStore`, pass cipher to mapping.
- `LuminaLog/Core/Persistence/FirestoreChatRepository.swift` — same.
- `LuminaLog/Core/Persistence/FirestoreProfileRepository.swift` — same.
- `LuminaLog/Core/Media/ProxyMediaUploader.swift` — encrypt before PUT, decrypt after GET.
- `LuminaLog/App/AppServices.swift` — build `UserKeyStore`, inject into repositories + uploader.

**New test files**
- `LuminaLogTests/FieldCipherTests.swift`
- `LuminaLogTests/EncryptedFieldTests.swift`
- `LuminaLogTests/MediaCipherTests.swift`
- `LuminaLogTests/UserKeyStoreTests.swift`
- `LuminaLogTests/EncryptedMappingTests.swift`

---

## Task 1: EncryptedField envelope value type

**Files:**
- Create: `LuminaLog/Core/Crypto/EncryptedField.swift`
- Test: `LuminaLogTests/EncryptedFieldTests.swift`

- [ ] **Step 1: Write the failing test**

```swift
import XCTest
@testable import LuminaLog

final class EncryptedFieldTests: XCTestCase {

    func testFirestoreDictRoundTrip() throws {
        let field = EncryptedField(
            iv: Data([0x01, 0x02, 0x03]),
            ciphertext: Data([0xAA, 0xBB]),
            tag: Data([0xCC, 0xDD])
        )
        let dict = field.firestoreData
        XCTAssertEqual(dict["v"] as? Int, 1)
        XCTAssertEqual(dict["alg"] as? String, "A256GCM")

        let decoded = try XCTUnwrap(EncryptedField(data: dict))
        XCTAssertEqual(decoded, field)
    }

    func testRejectsWrongVersion() {
        let dict: [String: Any] = ["v": 2, "alg": "A256GCM", "iv": "AA==", "ct": "AA==", "tag": "AA=="]
        XCTAssertNil(EncryptedField(data: dict))
    }

    func testRejectsPlainString() {
        // A plaintext string where an envelope is expected must not parse.
        XCTAssertNil(EncryptedField(data: "just text"))
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `xcodegen generate && xcodebuild test -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:LuminaLogTests/EncryptedFieldTests`
Expected: FAIL — `cannot find 'EncryptedField' in scope`.

- [ ] **Step 3: Write minimal implementation**

```swift
import Foundation

/// The at-rest envelope for one encrypted field (spec §4).
/// Stored in Firestore as `{ v, alg, iv, ct, tag }` with base64 blobs.
struct EncryptedField: Equatable {

    static let version = 1
    static let algorithm = "A256GCM"

    let iv: Data          // 12-byte GCM nonce
    let ciphertext: Data
    let tag: Data         // 16-byte GCM tag

    var firestoreData: [String: Any] {
        [
            "v": Self.version,
            "alg": Self.algorithm,
            "iv": iv.base64EncodedString(),
            "ct": ciphertext.base64EncodedString(),
            "tag": tag.base64EncodedString(),
        ]
    }

    /// Parse from a Firestore value. Returns nil for anything that is not a
    /// well-formed v1 envelope (including a bare plaintext string).
    init?(data: Any?) {
        guard
            let dict = data as? [String: Any],
            dict["v"] as? Int == Self.version,
            dict["alg"] as? String == Self.algorithm,
            let ivB64 = dict["iv"] as? String, let iv = Data(base64Encoded: ivB64),
            let ctB64 = dict["ct"] as? String, let ct = Data(base64Encoded: ctB64),
            let tagB64 = dict["tag"] as? String, let tag = Data(base64Encoded: tagB64)
        else { return nil }
        self.iv = iv
        self.ciphertext = ct
        self.tag = tag
    }

    init(iv: Data, ciphertext: Data, tag: Data) {
        self.iv = iv
        self.ciphertext = ciphertext
        self.tag = tag
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `xcodebuild test -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:LuminaLogTests/EncryptedFieldTests`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add LuminaLog/Core/Crypto/EncryptedField.swift LuminaLogTests/EncryptedFieldTests.swift project.yml
git commit -m "Add EncryptedField at-rest envelope value type"
```

---

## Task 2: FieldCipher (AES-256-GCM string⇄envelope)

**Files:**
- Create: `LuminaLog/Core/Crypto/FieldCipher.swift`
- Test: `LuminaLogTests/FieldCipherTests.swift`

- [ ] **Step 1: Write the failing test**

```swift
import XCTest
import CryptoKit
@testable import LuminaLog

final class FieldCipherTests: XCTestCase {

    private let key = SymmetricKey(size: .bits256)

    func testRoundTrip() throws {
        let cipher = FieldCipher(key: key)
        let envelope = try cipher.encrypt("hello world", context: "journals.content")
        let plaintext = try cipher.decrypt(envelope, context: "journals.content")
        XCTAssertEqual(plaintext, "hello world")
    }

    func testCiphertextIsNotPlaintext() throws {
        let cipher = FieldCipher(key: key)
        let envelope = try cipher.encrypt("secret diary", context: "journals.content")
        XCTAssertFalse(envelope.ciphertext.contains("secret".data(using: .utf8)!.first!) &&
                       String(data: envelope.ciphertext, encoding: .utf8) == "secret diary")
        XCTAssertNotEqual(String(data: envelope.ciphertext, encoding: .utf8), "secret diary")
    }

    func testWrongContextFailsClosed() throws {
        let cipher = FieldCipher(key: key)
        let envelope = try cipher.encrypt("data", context: "journals.content")
        XCTAssertThrowsError(try cipher.decrypt(envelope, context: "journals.title"))
    }

    func testWrongKeyFailsClosed() throws {
        let envelope = try FieldCipher(key: key).encrypt("data", context: "c")
        let other = FieldCipher(key: SymmetricKey(size: .bits256))
        XCTAssertThrowsError(try other.decrypt(envelope, context: "c"))
    }

    func testTamperedTagFailsClosed() throws {
        let cipher = FieldCipher(key: key)
        let env = try cipher.encrypt("data", context: "c")
        let tampered = EncryptedField(iv: env.iv, ciphertext: env.ciphertext,
                                      tag: Data(repeating: 0, count: env.tag.count))
        XCTAssertThrowsError(try cipher.decrypt(tampered, context: "c"))
    }

    func testNonceIsRandomPerCall() throws {
        let cipher = FieldCipher(key: key)
        let a = try cipher.encrypt("data", context: "c")
        let b = try cipher.encrypt("data", context: "c")
        XCTAssertNotEqual(a.iv, b.iv)
        XCTAssertNotEqual(a.ciphertext, b.ciphertext)
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `xcodegen generate && xcodebuild test -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:LuminaLogTests/FieldCipherTests`
Expected: FAIL — `cannot find 'FieldCipher' in scope`.

- [ ] **Step 3: Write minimal implementation**

```swift
import Foundation
import CryptoKit

enum FieldCipherError: LocalizedError {
    case decryptionFailed

    var errorDescription: String? {
        switch self {
        case .decryptionFailed: return "Could not decrypt protected content."
        }
    }
}

/// Encrypts/decrypts a single string field using AES-256-GCM (spec §4).
/// `context` is bound as additional authenticated data ("<collection>.<field>")
/// so a ciphertext cannot be moved between fields under the same key.
struct FieldCipher {

    private let key: SymmetricKey

    init(key: SymmetricKey) {
        self.key = key
    }

    func encrypt(_ plaintext: String, context: String) throws -> EncryptedField {
        let nonce = AES.GCM.Nonce()
        let sealed = try AES.GCM.seal(
            Data(plaintext.utf8),
            using: key,
            nonce: nonce,
            authenticating: Data(context.utf8)
        )
        return EncryptedField(
            iv: Data(nonce),
            ciphertext: sealed.ciphertext,
            tag: sealed.tag
        )
    }

    func decrypt(_ field: EncryptedField, context: String) throws -> String {
        do {
            let box = try AES.GCM.SealedBox(
                nonce: AES.GCM.Nonce(data: field.iv),
                ciphertext: field.ciphertext,
                tag: field.tag
            )
            let data = try AES.GCM.open(box, using: key, authenticating: Data(context.utf8))
            guard let string = String(data: data, encoding: .utf8) else {
                throw FieldCipherError.decryptionFailed
            }
            return string
        } catch is FieldCipherError {
            throw FieldCipherError.decryptionFailed
        } catch {
            throw FieldCipherError.decryptionFailed
        }
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `xcodebuild test -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:LuminaLogTests/FieldCipherTests`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add LuminaLog/Core/Crypto/FieldCipher.swift LuminaLogTests/FieldCipherTests.swift
git commit -m "Add FieldCipher AES-256-GCM field encryption"
```

---

## Task 3: KeychainStore + SecretStore protocol

**Files:**
- Create: `LuminaLog/Core/Crypto/KeychainStore.swift`
- Test: covered indirectly in Task 4 via the in-memory fake (no Keychain in unit tests).

- [ ] **Step 1: Write minimal implementation**

```swift
import Foundation
import Security

/// Minimal secret persistence. A protocol so unit tests use an in-memory fake
/// instead of the real Keychain.
protocol SecretStore: AnyObject {
    func data(for account: String) -> Data?
    func set(_ data: Data, for account: String)
    func remove(for account: String)
}

/// Keychain-backed `SecretStore`. Items are device-only and available after
/// first unlock so background work (e.g. notifications) can still decrypt.
final class KeychainStore: SecretStore {

    private let service = "com.luminalog.app.keys"

    func data(for account: String) -> Data? {
        var query = baseQuery(account: account)
        query[kSecReturnData as String] = true
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var result: AnyObject?
        guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess else {
            return nil
        }
        return result as? Data
    }

    func set(_ data: Data, for account: String) {
        remove(for: account)
        var query = baseQuery(account: account)
        query[kSecValueData as String] = data
        query[kSecAttrAccessible as String] = kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly
        SecItemAdd(query as CFDictionary, nil)
    }

    func remove(for account: String) {
        SecItemDelete(baseQuery(account: account) as CFDictionary)
    }

    private func baseQuery(account: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: account,
        ]
    }
}
```

- [ ] **Step 2: Build to verify it compiles**

Run: `xcodegen generate && xcodebuild build -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16'`
Expected: BUILD SUCCEEDED.

- [ ] **Step 3: Commit**

```bash
git add LuminaLog/Core/Crypto/KeychainStore.swift
git commit -m "Add KeychainStore behind SecretStore protocol"
```

---

## Task 4: UserKeyStore + KeyProvider (DEK bootstrap & caching)

**Files:**
- Create: `LuminaLog/Core/Crypto/UserKeyStore.swift`
- Create: `LuminaLog/Core/Crypto/ProxyKeyProvider.swift`
- Create: `LuminaLog/Core/Mocks/MockKeyProvider.swift`
- Test: `LuminaLogTests/UserKeyStoreTests.swift`

- [ ] **Step 1: Write the failing test**

```swift
import XCTest
import CryptoKit
@testable import LuminaLog

private final class InMemorySecretStore: SecretStore {
    private var storage: [String: Data] = [:]
    func data(for account: String) -> Data? { storage[account] }
    func set(_ data: Data, for account: String) { storage[account] = data }
    func remove(for account: String) { storage[account] = nil }
}

private final class StubKeyProvider: KeyProvider {
    let key: Data
    private(set) var fetchCount = 0
    init(key: Data) { self.key = key }
    func fetchDataKey(userId: String) async throws -> Data {
        fetchCount += 1
        return key
    }
}

final class UserKeyStoreTests: XCTestCase {

    private let rawKey = Data((0..<32).map { _ in UInt8.random(in: 0...255) })

    func testLoadFetchesAndCachesInSecretStore() async throws {
        let secrets = InMemorySecretStore()
        let provider = StubKeyProvider(key: rawKey)
        let store = UserKeyStore(provider: provider, secrets: secrets)

        let cipher = try await store.loadCipher(userId: "user-1")
        let envelope = try cipher.encrypt("hi", context: "c")
        XCTAssertEqual(try cipher.decrypt(envelope, context: "c"), "hi")
        XCTAssertEqual(provider.fetchCount, 1)
        XCTAssertNotNil(secrets.data(for: "dek.user-1"))
    }

    func testSecondLoadUsesSecretStoreNotProvider() async throws {
        let secrets = InMemorySecretStore()
        let provider = StubKeyProvider(key: rawKey)

        _ = try await UserKeyStore(provider: provider, secrets: secrets).loadCipher(userId: "user-1")
        // Fresh store instance, same secret store: must not hit the provider again.
        _ = try await UserKeyStore(provider: provider, secrets: secrets).loadCipher(userId: "user-1")
        XCTAssertEqual(provider.fetchCount, 1)
    }

    func testCurrentCipherNilBeforeLoad() {
        let store = UserKeyStore(provider: StubKeyProvider(key: rawKey),
                                 secrets: InMemorySecretStore())
        XCTAssertNil(store.currentCipher)
    }

    func testCurrentCipherAvailableAfterLoad() async throws {
        let store = UserKeyStore(provider: StubKeyProvider(key: rawKey),
                                 secrets: InMemorySecretStore())
        _ = try await store.loadCipher(userId: "user-1")
        XCTAssertNotNil(store.currentCipher)
    }

    func testSignOutClearsKey() async throws {
        let secrets = InMemorySecretStore()
        let store = UserKeyStore(provider: StubKeyProvider(key: rawKey), secrets: secrets)
        _ = try await store.loadCipher(userId: "user-1")
        store.signOut(userId: "user-1")
        XCTAssertNil(store.currentCipher)
        XCTAssertNil(secrets.data(for: "dek.user-1"))
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `xcodegen generate && xcodebuild test -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:LuminaLogTests/UserKeyStoreTests`
Expected: FAIL — `cannot find 'UserKeyStore' / 'KeyProvider' in scope`.

- [ ] **Step 3: Write minimal implementation**

`LuminaLog/Core/Crypto/UserKeyStore.swift`:
```swift
import Foundation
import CryptoKit

/// Fetches the raw per-user Data Encryption Key from the backend.
/// Stubbed by `MockKeyProvider` in previews/tests; `ProxyKeyProvider` in prod.
protocol KeyProvider: AnyObject {
    /// Returns the raw 32-byte DEK for the user, over an authenticated channel.
    func fetchDataKey(userId: String) async throws -> Data
}

enum UserKeyStoreError: LocalizedError {
    case invalidKeyLength

    var errorDescription: String? {
        switch self {
        case .invalidKeyLength: return "The encryption key was malformed."
        }
    }
}

/// Owns the device copy of the per-user DEK: loads it (Keychain first, then the
/// provider), caches it in memory, and vends a `FieldCipher`. The DEK is loaded
/// once right after sign-in, so `currentCipher` is available synchronously to
/// the Firestore mapping during snapshot decoding.
@MainActor
final class UserKeyStore {

    private let provider: KeyProvider
    private let secrets: SecretStore
    private var cachedCipher: FieldCipher?

    init(provider: KeyProvider, secrets: SecretStore) {
        self.provider = provider
        self.secrets = secrets
    }

    /// The cipher for the currently loaded user, or nil if none is loaded.
    var currentCipher: FieldCipher? { cachedCipher }

    /// Load the DEK for `userId`, fetching from the provider only if it is not
    /// already in the Keychain. Idempotent.
    @discardableResult
    func loadCipher(userId: String) async throws -> FieldCipher {
        if let cachedCipher { return cachedCipher }

        let account = Self.account(for: userId)
        let raw: Data
        if let stored = secrets.data(for: account) {
            raw = stored
        } else {
            raw = try await provider.fetchDataKey(userId: userId)
            secrets.set(raw, for: account)
        }
        guard raw.count == 32 else { throw UserKeyStoreError.invalidKeyLength }

        let cipher = FieldCipher(key: SymmetricKey(data: raw))
        cachedCipher = cipher
        return cipher
    }

    /// Clear the in-memory cipher and the stored key for the user.
    func signOut(userId: String) {
        cachedCipher = nil
        secrets.remove(for: Self.account(for: userId))
    }

    private static func account(for userId: String) -> String { "dek.\(userId)" }
}
```

`LuminaLog/Core/Crypto/ProxyKeyProvider.swift`:
```swift
import Foundation

/// Production `KeyProvider`: fetches the raw DEK from the proxy.
/// The proxy unwraps the user's stored wrapped DEK and returns it over TLS
/// (spec §3.3). Contract: `POST /v1/keys/bootstrap` → `{ "dek": "<base64>" }`.
final class ProxyKeyProvider: KeyProvider {

    private let api: ProxyAPIClient

    init(api: ProxyAPIClient) {
        self.api = api
    }

    private struct BootstrapRequest: Encodable {}
    private struct BootstrapResponse: Decodable { let dek: String }

    func fetchDataKey(userId: String) async throws -> Data {
        let response: BootstrapResponse = try await api.post(
            path: "/v1/keys/bootstrap",
            body: BootstrapRequest()
        )
        guard let data = Data(base64Encoded: response.dek) else {
            throw UserKeyStoreError.invalidKeyLength
        }
        return data
    }
}
```

`LuminaLog/Core/Mocks/MockKeyProvider.swift`:
```swift
import Foundation
import CryptoKit

/// Deterministic `KeyProvider` for previews and unit tests: derives a stable
/// 32-byte key from the userId so encrypted data round-trips within a session.
final class MockKeyProvider: KeyProvider {

    func fetchDataKey(userId: String) async throws -> Data {
        let digest = SHA256.hash(data: Data("luminalog-mock-dek.\(userId)".utf8))
        return Data(digest)   // SHA-256 → exactly 32 bytes
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `xcodebuild test -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:LuminaLogTests/UserKeyStoreTests`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add LuminaLog/Core/Crypto/UserKeyStore.swift LuminaLog/Core/Crypto/ProxyKeyProvider.swift LuminaLog/Core/Mocks/MockKeyProvider.swift LuminaLogTests/UserKeyStoreTests.swift
git commit -m "Add UserKeyStore with DEK bootstrap and Keychain caching"
```

---

## Task 5: MediaCipher (chunked file encryption)

**Files:**
- Create: `LuminaLog/Core/Crypto/MediaCipher.swift`
- Test: `LuminaLogTests/MediaCipherTests.swift`

- [ ] **Step 1: Write the failing test**

```swift
import XCTest
import CryptoKit
@testable import LuminaLog

final class MediaCipherTests: XCTestCase {

    private let key = SymmetricKey(size: .bits256)

    private func tempURL() -> URL {
        FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
    }

    func testRoundTripSmallFile() throws {
        let cipher = MediaCipher(key: key)
        let plain = tempURL(), enc = tempURL(), dec = tempURL()
        defer { [plain, enc, dec].forEach { try? FileManager.default.removeItem(at: $0) } }

        let payload = Data("hello media".utf8)
        try payload.write(to: plain)

        try cipher.encryptFile(at: plain, to: enc)
        // Ciphertext on disk must not equal the plaintext.
        XCTAssertNotEqual(try Data(contentsOf: enc), payload)

        try cipher.decryptFile(at: enc, to: dec)
        XCTAssertEqual(try Data(contentsOf: dec), payload)
    }

    func testRoundTripMultiChunkFile() throws {
        let cipher = MediaCipher(key: key, chunkSize: 1024)
        let plain = tempURL(), enc = tempURL(), dec = tempURL()
        defer { [plain, enc, dec].forEach { try? FileManager.default.removeItem(at: $0) } }

        // ~10 KB → spans multiple 1 KB chunks.
        let payload = Data((0..<10_000).map { UInt8($0 % 251) })
        try payload.write(to: plain)

        try cipher.encryptFile(at: plain, to: enc)
        try cipher.decryptFile(at: enc, to: dec)
        XCTAssertEqual(try Data(contentsOf: dec), payload)
    }

    func testTamperedCiphertextFailsClosed() throws {
        let cipher = MediaCipher(key: key, chunkSize: 1024)
        let plain = tempURL(), enc = tempURL(), dec = tempURL()
        defer { [plain, enc, dec].forEach { try? FileManager.default.removeItem(at: $0) } }

        try Data((0..<5_000).map { UInt8($0 % 251) }).write(to: plain)
        try cipher.encryptFile(at: plain, to: enc)

        var bytes = try Data(contentsOf: enc)
        bytes[bytes.count - 1] ^= 0xFF          // flip a tag bit
        try bytes.write(to: enc)

        XCTAssertThrowsError(try cipher.decryptFile(at: enc, to: dec))
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `xcodegen generate && xcodebuild test -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:LuminaLogTests/MediaCipherTests`
Expected: FAIL — `cannot find 'MediaCipher' in scope`.

- [ ] **Step 3: Write minimal implementation**

```swift
import Foundation
import CryptoKit

enum MediaCipherError: LocalizedError {
    case malformedFile
    case decryptionFailed

    var errorDescription: String? {
        switch self {
        case .malformedFile: return "The media file was malformed."
        case .decryptionFailed: return "Could not decrypt the media file."
        }
    }
}

/// Encrypts/decrypts media files in fixed-size AES-GCM chunks (spec §7) so large
/// videos never sit fully in memory. On-disk layout:
///   [ "LLM1" magic (4B) ][ chunkSize UInt32 BE (4B) ]
///   then, per chunk: [ length UInt32 BE ][ AES.GCM.combined bytes ]
/// Each chunk is sealed with AAD = its zero-based index, so chunks cannot be
/// reordered, dropped, or duplicated without failing authentication.
struct MediaCipher {

    static let magic = Data("LLM1".utf8)

    private let key: SymmetricKey
    private let chunkSize: Int

    init(key: SymmetricKey, chunkSize: Int = 1 << 20) {   // 1 MiB default
        self.key = key
        self.chunkSize = chunkSize
    }

    func encryptFile(at source: URL, to destination: URL) throws {
        let input = try FileHandle(forReadingFrom: source)
        defer { try? input.close() }
        FileManager.default.createFile(atPath: destination.path, contents: nil)
        let output = try FileHandle(forWritingTo: destination)
        defer { try? output.close() }

        output.write(Self.magic)
        output.write(Self.uint32BE(UInt32(chunkSize)))

        var index: UInt32 = 0
        while case let chunk = input.readData(ofLength: chunkSize), !chunk.isEmpty {
            let sealed = try AES.GCM.seal(chunk, using: key,
                                          authenticating: Self.uint32BE(index))
            let blob = sealed.combined ?? Data()
            output.write(Self.uint32BE(UInt32(blob.count)))
            output.write(blob)
            index += 1
        }
    }

    func decryptFile(at source: URL, to destination: URL) throws {
        let input = try FileHandle(forReadingFrom: source)
        defer { try? input.close() }

        guard input.readData(ofLength: 4) == Self.magic else {
            throw MediaCipherError.malformedFile
        }
        _ = input.readData(ofLength: 4)   // chunkSize header (informational)

        FileManager.default.createFile(atPath: destination.path, contents: nil)
        let output = try FileHandle(forWritingTo: destination)
        defer { try? output.close() }

        var index: UInt32 = 0
        while case let lengthData = input.readData(ofLength: 4), !lengthData.isEmpty {
            guard lengthData.count == 4 else { throw MediaCipherError.malformedFile }
            let length = Int(Self.readUint32BE(lengthData))
            let blob = input.readData(ofLength: length)
            guard blob.count == length else { throw MediaCipherError.malformedFile }
            do {
                let box = try AES.GCM.SealedBox(combined: blob)
                let plain = try AES.GCM.open(box, using: key,
                                             authenticating: Self.uint32BE(index))
                output.write(plain)
            } catch {
                throw MediaCipherError.decryptionFailed
            }
            index += 1
        }
    }

    // MARK: - Byte helpers

    private static func uint32BE(_ value: UInt32) -> Data {
        var be = value.bigEndian
        return Data(bytes: &be, count: 4)
    }

    private static func readUint32BE(_ data: Data) -> UInt32 {
        data.withUnsafeBytes { $0.load(as: UInt32.self) }.bigEndian
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `xcodebuild test -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:LuminaLogTests/MediaCipherTests`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add LuminaLog/Core/Crypto/MediaCipher.swift LuminaLogTests/MediaCipherTests.swift
git commit -m "Add MediaCipher chunked AES-GCM file encryption"
```

---

## Task 6: Thread FieldCipher through FirestoreMapping (in-scope fields)

This task changes the mapping signatures so encryption happens in one place. Field-name AAD contexts are fixed strings per field. **Plaintext stays plaintext** for everything in spec §5.2.

**Files:**
- Modify: `LuminaLog/Core/Persistence/FirestoreMapping.swift`
- Test: `LuminaLogTests/EncryptedMappingTests.swift`

- [ ] **Step 1: Write the failing test**

```swift
import XCTest
import CryptoKit
@testable import LuminaLog

final class EncryptedMappingTests: XCTestCase {

    private let cipher = FieldCipher(key: SymmetricKey(size: .bits256))
    private let created = Date(timeIntervalSince1970: 1_760_000_000)

    func testJournalEntryEncryptsContentAndDecodesBack() throws {
        let entry = JournalEntry(
            id: "e1", userId: "u1", type: .text, title: "My Title",
            createdAt: created, updatedAt: created,
            content: "Secret entry body.", wordCount: 3
        )
        let data = try entry.firestoreData(cipher: cipher)

        // Sensitive fields are envelopes, not plaintext.
        XCTAssertNil(data["content"] as? String)
        XCTAssertNotNil(EncryptedField(data: data["content"]))
        XCTAssertNil(data["title"] as? String)
        XCTAssertNotNil(EncryptedField(data: data["title"]))
        // Query keys stay plaintext.
        XCTAssertEqual(data["userId"] as? String, "u1")
        XCTAssertEqual(data["type"] as? String, "text")

        let decoded = try XCTUnwrap(JournalEntry(documentId: "e1", data: data, cipher: cipher))
        XCTAssertEqual(decoded.content, "Secret entry body.")
        XCTAssertEqual(decoded.title, "My Title")
    }

    func testJournalEntryEncryptsAIGenerations() throws {
        let entry = JournalEntry(
            id: "e1", userId: "u1", type: .text, title: "t",
            createdAt: created, updatedAt: created, content: "c",
            summary: AIGeneration(text: "A summary.", generatedAt: created, model: "m"),
            prompts: AIPrompts(items: ["Q1?", "Q2?"], generatedAt: created, model: "m"),
            wordCount: 1
        )
        let data = try entry.firestoreData(cipher: cipher)
        let summaryDict = try XCTUnwrap(data["summary"] as? [String: Any])
        XCTAssertNotNil(EncryptedField(data: summaryDict["text"]))
        XCTAssertEqual(summaryDict["model"] as? String, "m")   // metadata stays plaintext

        let decoded = try XCTUnwrap(JournalEntry(documentId: "e1", data: data, cipher: cipher))
        XCTAssertEqual(decoded.summary?.text, "A summary.")
        XCTAssertEqual(decoded.prompts?.items, ["Q1?", "Q2?"])
    }

    func testChatMessageEncryptsTextAndSnippets() throws {
        let message = ChatMessage(
            id: "m1", role: .assistant, text: "Reply text.", createdAt: created,
            sources: [MessageSource(journalId: "e1", snippet: "snippet text")]
        )
        let data = try message.firestoreData(cipher: cipher)
        XCTAssertNotNil(EncryptedField(data: data["text"]))
        let sources = try XCTUnwrap(data["sources"] as? [[String: Any]])
        XCTAssertEqual(sources.first?["journalId"] as? String, "e1")   // id plaintext
        XCTAssertNotNil(EncryptedField(data: sources.first?["snippet"]))

        let decoded = try XCTUnwrap(ChatMessage(documentId: "m1", data: data, cipher: cipher))
        XCTAssertEqual(decoded.text, "Reply text.")
        XCTAssertEqual(decoded.sources?.first?.snippet, "snippet text")
    }

    func testChatEncryptsTitle() throws {
        let chat = Chat(id: "c1", userId: "u1", kind: .text, title: "Chat Title",
                        createdAt: created, lastMessageAt: created, vapiCallId: nil)
        let data = try chat.firestoreData(cipher: cipher)
        XCTAssertNotNil(EncryptedField(data: data["title"]))
        let decoded = try XCTUnwrap(Chat(documentId: "c1", data: data, cipher: cipher))
        XCTAssertEqual(decoded.title, "Chat Title")
    }

    func testProfileEncryptsBiographyAndDailyPrompt() throws {
        let profile = UserProfile(
            id: "u1", displayName: "Demo", email: "d@e.com", photoURL: nil,
            biography: "My private bio.", createdAt: created, timezone: "UTC",
            stats: UserProfile.Stats(streakCount: 0, lastEntryDate: nil, totalWords: 0),
            dailyPrompt: UserProfile.DailyPrompt(text: "Prompt?", date: created, sourceEntryIds: nil)
        )
        let data = try profile.firestoreData(cipher: cipher)
        XCTAssertNotNil(EncryptedField(data: data["biography"]))
        XCTAssertEqual(data["email"] as? String, "d@e.com")   // PII stays plaintext
        let dp = try XCTUnwrap(data["dailyPrompt"] as? [String: Any])
        XCTAssertNotNil(EncryptedField(data: dp["text"]))

        let decoded = UserProfile(documentId: "u1", data: data, cipher: cipher)
        XCTAssertEqual(decoded.biography, "My private bio.")
        XCTAssertEqual(decoded.dailyPrompt?.text, "Prompt?")
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `xcodegen generate && xcodebuild test -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:LuminaLogTests/EncryptedMappingTests`
Expected: FAIL — `extra argument 'cipher'` / `incorrect argument label`.

- [ ] **Step 3: Rewrite `FirestoreMapping.swift`**

Replace the whole file with the version below. Every in-scope field is encrypted via a fixed AAD context string; everything in spec §5.2 is untouched. Reads **fail closed**: a missing/garbled envelope throws rather than returning ciphertext.

```swift
import Foundation
import FirebaseFirestore

// Explicit Firestore document ↔ pure-model mapping (spec §3) with field-level
// encryption (spec §4–5). Firebase + crypto stay inside Core/Persistence; the
// domain models remain pure. In-scope text fields are stored as EncryptedField
// envelopes; query keys, flags, and PII stay plaintext.

// MARK: - Helpers

private func timestamp(_ value: Any?) -> Date? {
    (value as? Timestamp)?.dateValue()
}

/// Errors thrown when a document cannot be decrypted (fail closed — never show
/// ciphertext as if it were text).
enum MappingDecryptionError: Error { case missingField(String) }

private extension FieldCipher {
    /// Encrypt to the Firestore envelope dict.
    func sealed(_ plaintext: String, _ context: String) throws -> [String: Any] {
        try encrypt(plaintext, context: context).firestoreData
    }
    /// Decrypt a required field from its Firestore value (throws if absent/garbled).
    func opened(_ value: Any?, _ context: String) throws -> String {
        guard let field = EncryptedField(data: value) else {
            throw MappingDecryptionError.missingField(context)
        }
        return try decrypt(field, context: context)
    }
    /// Decrypt an optional field: nil stays nil; present-but-garbled throws.
    func openedIfPresent(_ value: Any?, _ context: String) throws -> String? {
        guard value != nil else { return nil }
        return try opened(value, context)
    }
}

// MARK: - JournalEntry

extension JournalEntry {

    init?(documentId: String, data: [String: Any], cipher: FieldCipher) {
        guard
            let userId = data["userId"] as? String,
            let typeRaw = data["type"] as? String,
            let type = JournalType(rawValue: typeRaw)
        else { return nil }

        let media = (data["media"] as? [[String: Any]] ?? []).compactMap(MediaItem.init(data:))

        do {
            self.init(
                id: documentId,
                userId: userId,
                type: type,
                title: try cipher.opened(data["title"], "journals.title"),
                createdAt: timestamp(data["createdAt"]) ?? Date(),
                updatedAt: timestamp(data["updatedAt"]) ?? Date(),
                content: try cipher.opened(data["content"], "journals.content"),
                contentEditedAt: timestamp(data["contentEditedAt"]),
                media: media,
                transcriptStatus: (data["transcriptStatus"] as? String).flatMap(TranscriptStatus.init(rawValue:)),
                summary: try AIGeneration(data: data["summary"] as? [String: Any], cipher: cipher, context: "journals.summary"),
                insights: try AIGeneration(data: data["insights"] as? [String: Any], cipher: cipher, context: "journals.insights"),
                prompts: try AIPrompts(data: data["prompts"] as? [String: Any], cipher: cipher),
                vector: VectorState(data: data["vector"] as? [String: Any]) ?? VectorState(),
                wordCount: data["wordCount"] as? Int ?? 0
            )
        } catch {
            return nil
        }
    }

    func firestoreData(cipher: FieldCipher) throws -> [String: Any] {
        var data: [String: Any] = [
            "userId": userId,
            "type": type.rawValue,
            "title": try cipher.sealed(title, "journals.title"),
            "createdAt": Timestamp(date: createdAt),
            "updatedAt": Timestamp(date: updatedAt),
            "content": try cipher.sealed(content, "journals.content"),
            "media": media.map(\.firestoreData),
            "vector": vector.firestoreData,
            "wordCount": wordCount,
        ]
        if let contentEditedAt { data["contentEditedAt"] = Timestamp(date: contentEditedAt) }
        if let transcriptStatus { data["transcriptStatus"] = transcriptStatus.rawValue }
        if let summary { data["summary"] = try summary.firestoreData(cipher: cipher, context: "journals.summary") }
        if let insights { data["insights"] = try insights.firestoreData(cipher: cipher, context: "journals.insights") }
        if let prompts { data["prompts"] = try prompts.firestoreData(cipher: cipher) }
        return data
    }
}

extension MediaItem {

    init?(data: [String: Any]) {
        guard
            let s3Key = data["s3Key"] as? String,
            let kindRaw = data["kind"] as? String,
            let kind = MediaKind(rawValue: kindRaw)
        else { return nil }
        self.init(
            s3Key: s3Key,
            kind: kind,
            durationSec: data["durationSec"] as? Double,
            width: data["width"] as? Int,
            height: data["height"] as? Int
        )
    }

    var firestoreData: [String: Any] {
        var data: [String: Any] = ["s3Key": s3Key, "kind": kind.rawValue]
        if let durationSec { data["durationSec"] = durationSec }
        if let width { data["width"] = width }
        if let height { data["height"] = height }
        return data
    }
}

extension AIGeneration {

    init?(data: [String: Any]?, cipher: FieldCipher, context: String) throws {
        guard let data else { return nil }
        guard let text = try cipher.openedIfPresent(data["text"], "\(context).text") else { return nil }
        self.init(
            text: text,
            generatedAt: timestamp(data["generatedAt"]) ?? Date(),
            model: data["model"] as? String ?? ""
        )
    }

    func firestoreData(cipher: FieldCipher, context: String) throws -> [String: Any] {
        [
            "text": try cipher.sealed(text, "\(context).text"),
            "generatedAt": Timestamp(date: generatedAt),
            "model": model,
        ]
    }
}

extension AIPrompts {

    init?(data: [String: Any]?, cipher: FieldCipher) throws {
        guard let data, let raw = data["items"] as? [[String: Any]] else { return nil }
        let items = try raw.enumerated().map { index, value in
            try cipher.opened(value, "journals.prompts.items.\(index)")
        }
        self.init(
            items: items,
            generatedAt: timestamp(data["generatedAt"]) ?? Date(),
            model: data["model"] as? String ?? ""
        )
    }

    func firestoreData(cipher: FieldCipher) throws -> [String: Any] {
        let sealedItems = try items.enumerated().map { index, value in
            try cipher.sealed(value, "journals.prompts.items.\(index)")
        }
        return ["items": sealedItems, "generatedAt": Timestamp(date: generatedAt), "model": model]
    }
}

extension VectorState {

    init?(data: [String: Any]?) {
        guard
            let data,
            let statusRaw = data["status"] as? String,
            let status = Status(rawValue: statusRaw)
        else { return nil }
        self.init(
            status: status,
            chunkCount: data["chunkCount"] as? Int ?? 0,
            indexedAt: timestamp(data["indexedAt"])
        )
    }

    var firestoreData: [String: Any] {
        var data: [String: Any] = ["status": status.rawValue, "chunkCount": chunkCount]
        if let indexedAt { data["indexedAt"] = Timestamp(date: indexedAt) }
        return data
    }
}

// MARK: - UserProfile

extension UserProfile {

    init(documentId: String, data: [String: Any], cipher: FieldCipher) {
        self.init(
            id: documentId,
            displayName: data["displayName"] as? String ?? "",
            email: data["email"] as? String ?? "",
            photoURL: (data["photoURL"] as? String).flatMap(URL.init(string:)),
            biography: (try? cipher.openedIfPresent(data["biography"], "users.biography")) ?? "",
            createdAt: timestamp(data["createdAt"]) ?? Date(),
            timezone: data["timezone"] as? String ?? TimeZone.current.identifier,
            stats: Stats(data: data["stats"] as? [String: Any] ?? [:]),
            dailyPrompt: UserProfile.DailyPrompt(data: data["dailyPrompt"] as? [String: Any], cipher: cipher)
        )
    }

    func firestoreData(cipher: FieldCipher) throws -> [String: Any] {
        var data: [String: Any] = [
            "displayName": displayName,
            "email": email,
            "biography": try cipher.sealed(biography, "users.biography"),
            "createdAt": Timestamp(date: createdAt),
            "timezone": timezone,
            "stats": stats.firestoreData,
        ]
        if let photoURL { data["photoURL"] = photoURL.absoluteString }
        if let dailyPrompt { data["dailyPrompt"] = try dailyPrompt.firestoreData(cipher: cipher) }
        return data
    }
}

extension UserProfile.Stats {

    init(data: [String: Any]) {
        self.init(
            streakCount: data["streakCount"] as? Int ?? 0,
            lastEntryDate: timestamp(data["lastEntryDate"]),
            totalWords: data["totalWords"] as? Int ?? 0
        )
    }

    var firestoreData: [String: Any] {
        var data: [String: Any] = ["streakCount": streakCount, "totalWords": totalWords]
        if let lastEntryDate { data["lastEntryDate"] = Timestamp(date: lastEntryDate) }
        return data
    }
}

extension UserProfile.DailyPrompt {

    init?(data: [String: Any]?, cipher: FieldCipher) {
        guard let data,
              let text = try? cipher.openedIfPresent(data["text"], "users.dailyPrompt.text"),
              let text else { return nil }
        self.init(
            text: text,
            date: timestamp(data["date"]) ?? Date(),
            sourceEntryIds: data["sourceEntryIds"] as? [String]
        )
    }

    func firestoreData(cipher: FieldCipher) throws -> [String: Any] {
        var data: [String: Any] = [
            "text": try cipher.sealed(text, "users.dailyPrompt.text"),
            "date": Timestamp(date: date),
        ]
        if let sourceEntryIds { data["sourceEntryIds"] = sourceEntryIds }
        return data
    }
}

// MARK: - Chat

extension Chat {

    init?(documentId: String, data: [String: Any], cipher: FieldCipher) {
        guard
            let userId = data["userId"] as? String,
            let kindRaw = data["kind"] as? String,
            let kind = ChatKind(rawValue: kindRaw)
        else { return nil }
        let title = (try? cipher.openedIfPresent(data["title"], "chats.title")) ?? ""
        self.init(
            id: documentId,
            userId: userId,
            kind: kind,
            title: title ?? "",
            createdAt: timestamp(data["createdAt"]) ?? Date(),
            lastMessageAt: timestamp(data["lastMessageAt"]) ?? Date(),
            vapiCallId: data["vapiCallId"] as? String
        )
    }

    func firestoreData(cipher: FieldCipher) throws -> [String: Any] {
        var data: [String: Any] = [
            "userId": userId,
            "kind": kind.rawValue,
            "title": try cipher.sealed(title, "chats.title"),
            "createdAt": Timestamp(date: createdAt),
            "lastMessageAt": Timestamp(date: lastMessageAt),
        ]
        if let vapiCallId { data["vapiCallId"] = vapiCallId }
        return data
    }
}

extension ChatMessage {

    init?(documentId: String, data: [String: Any], cipher: FieldCipher) {
        guard
            let roleRaw = data["role"] as? String,
            let role = MessageRole(rawValue: roleRaw)
        else { return nil }
        do {
            let text = try cipher.opened(data["text"], "messages.text")
            let sources = try (data["sources"] as? [[String: Any]])?
                .enumerated()
                .map { index, value in try MessageSource(data: value, cipher: cipher, index: index) }
                .compactMap { $0 }
            self.init(
                id: documentId,
                role: role,
                text: text,
                createdAt: timestamp(data["createdAt"]) ?? Date(),
                sources: sources
            )
        } catch {
            return nil
        }
    }

    func firestoreData(cipher: FieldCipher) throws -> [String: Any] {
        var data: [String: Any] = [
            "role": role.rawValue,
            "text": try cipher.sealed(text, "messages.text"),
            "createdAt": Timestamp(date: createdAt),
        ]
        if let sources {
            data["sources"] = try sources.enumerated().map { index, source in
                try source.firestoreData(cipher: cipher, index: index)
            }
        }
        return data
    }
}

extension MessageSource {

    init?(data: [String: Any], cipher: FieldCipher, index: Int) throws {
        guard let journalId = data["journalId"] as? String else { return nil }
        let snippet = try cipher.opened(data["snippet"], "messages.sources.\(index).snippet")
        self.init(journalId: journalId, snippet: snippet)
    }

    func firestoreData(cipher: FieldCipher, index: Int) throws -> [String: Any] {
        [
            "journalId": journalId,
            "snippet": try cipher.sealed(snippet, "messages.sources.\(index).snippet"),
        ]
    }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `xcodebuild test -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:LuminaLogTests/EncryptedMappingTests`
Expected: PASS (5 tests). NOTE: the repositories still reference the old signatures and will not compile yet — Task 7 fixes the call sites. Run this test only after Task 7 if the target fails to build; otherwise temporarily build just the test file is not possible, so proceed to Task 7 and run both tests together at Task 7 Step 4.

- [ ] **Step 5: Commit**

```bash
git add LuminaLog/Core/Persistence/FirestoreMapping.swift LuminaLogTests/EncryptedMappingTests.swift
git commit -m "Encrypt in-scope fields in FirestoreMapping"
```

---

## Task 7: Wire repositories to the UserKeyStore

The mapping now requires a `FieldCipher`. Each repository gains a `keys: UserKeyStore` dependency and reads `keys.currentCipher` (loaded at sign-in). If the cipher is unavailable, reads yield empty/`nil` and writes throw — fail closed.

**Files:**
- Modify: `LuminaLog/Core/Persistence/FirestoreJournalRepository.swift`
- Modify: `LuminaLog/Core/Persistence/FirestoreChatRepository.swift`
- Modify: `LuminaLog/Core/Persistence/FirestoreProfileRepository.swift`

- [ ] **Step 1: Add a shared "missing key" error and cipher accessor**

In `FirestoreJournalRepository.swift`, add near the top (after imports):

```swift
/// Thrown when an encrypted write is attempted before the user's key is loaded.
enum CryptoUnavailableError: LocalizedError {
    case keyNotLoaded
    var errorDescription: String? {
        switch self {
        case .keyNotLoaded: return "Your secure key is not ready yet. Try again in a moment."
        }
    }
}
```

- [ ] **Step 2: Edit `FirestoreJournalRepository.swift` call sites**

Add the dependency and use the cipher. Replace the `init` and the four mapping call sites:

```swift
    private let db: Firestore
    private let auth: AuthService
    private let keys: UserKeyStore

    init(auth: AuthService, keys: UserKeyStore, db: Firestore = .firestore()) {
        self.auth = auth
        self.keys = keys
        self.db = db
    }
```

In `recentEntries` snapshot handler, replace the decode line:

```swift
                    guard let cipher = self.keys.currentCipher else {
                        continuation.yield([]); return
                    }
                    let entries = snapshot.documents.compactMap {
                        JournalEntry(documentId: $0.documentID, data: $0.data(), cipher: cipher)
                    }
                    continuation.yield(entries)
```

In `entries(after:limit:)`, before the `compactMap`:

```swift
        guard let cipher = keys.currentCipher else { return [] }
        let snapshot = try await query.limit(to: limit).getDocuments()
        return snapshot.documents.compactMap {
            JournalEntry(documentId: $0.documentID, data: $0.data(), cipher: cipher)
        }
```

In `entry(id:)` snapshot handler:

```swift
                    guard let cipher = self.keys.currentCipher else {
                        continuation.yield(nil); return
                    }
                    if let data = snapshot.data() {
                        continuation.yield(JournalEntry(documentId: snapshot.documentID, data: data, cipher: cipher))
                    } else {
                        continuation.yield(nil)
                    }
```

In `save(_:)`:

```swift
    func save(_ entry: JournalEntry) async throws {
        guard let cipher = keys.currentCipher else { throw CryptoUnavailableError.keyNotLoaded }
        try await journals.document(entry.id).setData(try entry.firestoreData(cipher: cipher))
    }
```

In `updateAIFields`, wrap the three `firestoreData` calls:

```swift
        guard let cipher = keys.currentCipher else { throw CryptoUnavailableError.keyNotLoaded }
        var payload: [String: Any] = [:]
        if let summary { payload["summary"] = try summary.firestoreData(cipher: cipher, context: "journals.summary") }
        if let insights { payload["insights"] = try insights.firestoreData(cipher: cipher, context: "journals.insights") }
        if let prompts { payload["prompts"] = try prompts.firestoreData(cipher: cipher) }
        guard !payload.isEmpty else { return }
```

- [ ] **Step 3: Edit `FirestoreChatRepository.swift` and `FirestoreProfileRepository.swift`**

Apply the same pattern: add `private let keys: UserKeyStore`, accept it in `init`, guard `keys.currentCipher` at every mapping call, pass `cipher:` to `Chat(...)`, `ChatMessage(...)`, `UserProfile(...)`, and their `firestoreData(cipher:)`. Reads with no cipher yield `[]`/`nil`; writes throw `CryptoUnavailableError.keyNotLoaded`. Open each file and update each `firestoreData` / `init?(documentId:data:)` call to its `cipher:` variant — there are no other behavioral changes.

- [ ] **Step 4: Run the full crypto + mapping test suite**

Run:
```bash
xcodegen generate && xcodebuild test -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' \
  -only-testing:LuminaLogTests/EncryptedMappingTests \
  -only-testing:LuminaLogTests/FieldCipherTests \
  -only-testing:LuminaLogTests/EncryptedFieldTests \
  -only-testing:LuminaLogTests/UserKeyStoreTests \
  -only-testing:LuminaLogTests/MediaCipherTests
```
Expected: BUILD SUCCEEDED, all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add LuminaLog/Core/Persistence/FirestoreJournalRepository.swift LuminaLog/Core/Persistence/FirestoreChatRepository.swift LuminaLog/Core/Persistence/FirestoreProfileRepository.swift
git commit -m "Wire repositories to UserKeyStore for field encryption"
```

---

## Task 8: Encrypt media bytes in ProxyMediaUploader

**Files:**
- Modify: `LuminaLog/Core/Media/ProxyMediaUploader.swift`

- [ ] **Step 1: Add a cipher dependency and encrypt before PUT**

Add a `keys: UserKeyStore` property and accept it in `init`. In `upload(fileURL:kind:journalId:)`, before computing `byteCount`, encrypt the source to a temp file and upload that instead:

```swift
    private let keys: UserKeyStore

    init(api: ProxyAPIClient, keys: UserKeyStore, session: URLSession = .shared) {
        self.api = api
        self.keys = keys
        self.session = session
    }
```

Replace the body of `upload` up to the presign request:

```swift
    func upload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> MediaItem {
        guard let dek = keys.currentDataKey else { throw CryptoUnavailableError.keyNotLoaded }
        let cipher = MediaCipher(key: dek)

        // Encrypt to a temp file; upload ciphertext. Probe metadata from the
        // ORIGINAL plaintext so dimensions/duration are still accurate.
        let encryptedURL = FileManager.default.temporaryDirectory
            .appendingPathComponent(UUID().uuidString)
        defer { try? FileManager.default.removeItem(at: encryptedURL) }
        try cipher.encryptFile(at: fileURL, to: encryptedURL)

        let attributes = try FileManager.default.attributesOfItem(atPath: encryptedURL.path)
        let byteCount = (attributes[.size] as? NSNumber)?.intValue ?? 0
        let ext = fileURL.pathExtension.isEmpty ? Self.defaultExtension(for: kind)
                                                : fileURL.pathExtension
        // Ciphertext is opaque; sign + send as octet-stream.
        let contentType = "application/octet-stream"

        let response: UploadURLsResponse = try await api.post(
            path: "/v1/media/upload-urls",
            body: UploadURLsRequest(files: [
                .init(kind: kind.rawValue, ext: ext, contentType: contentType,
                      bytes: byteCount, journalId: journalId)
            ])
        )
        guard let presigned = response.files.first else {
            throw MediaUploaderError.noUploadURL
        }

        var request = URLRequest(url: presigned.uploadUrl)
        request.httpMethod = "PUT"
        request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        let (_, uploadResponse) = try await session.upload(for: request, fromFile: encryptedURL)
        if let http = uploadResponse as? HTTPURLResponse,
           !(200..<300).contains(http.statusCode) {
            throw MediaUploaderError.uploadFailed(statusCode: http.statusCode)
        }

        // Metadata from the plaintext original.
        return await Self.mediaItem(s3Key: presigned.s3Key, kind: kind, fileURL: fileURL)
    }
```

- [ ] **Step 2: Expose the raw DEK from UserKeyStore**

`MediaCipher` needs the `SymmetricKey`. Add to `UserKeyStore` (Task 4 file) a cached key and accessor:

In `UserKeyStore`, store the key alongside the cipher:

```swift
    private var cachedKey: SymmetricKey?

    /// The raw data key for media encryption, or nil if not loaded.
    var currentDataKey: SymmetricKey? { cachedKey }
```

Set it in `loadCipher` where `cachedCipher` is set:

```swift
        let symmetricKey = SymmetricKey(data: raw)
        let cipher = FieldCipher(key: symmetricKey)
        cachedCipher = cipher
        cachedKey = symmetricKey
        return cipher
```

And clear it in `signOut`:

```swift
        cachedCipher = nil
        cachedKey = nil
```

- [ ] **Step 3: Build to verify it compiles**

Run: `xcodegen generate && xcodebuild build -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16'`
Expected: BUILD SUCCEEDED. (Decryption-on-view happens where images/video are displayed; that download-then-decrypt wiring is handled in the view layer in a follow-up — uploads now store ciphertext, which is the at-rest requirement.)

- [ ] **Step 4: Commit**

```bash
git add LuminaLog/Core/Media/ProxyMediaUploader.swift LuminaLog/Core/Crypto/UserKeyStore.swift
git commit -m "Encrypt media bytes before S3 upload"
```

---

## Task 9: Build the UserKeyStore in AppServices and load the DEK at sign-in

**Files:**
- Modify: `LuminaLog/App/AppServices.swift`

- [ ] **Step 1: Construct UserKeyStore and inject it**

In `live()`, after building `api`:

```swift
        let keys = UserKeyStore(provider: ProxyKeyProvider(api: api), secrets: KeychainStore())
```

Pass `keys:` into the three repositories and the uploader:

```swift
            journals: FirestoreJournalRepository(auth: auth, keys: keys),
            profiles: FirestoreProfileRepository(auth: auth, keys: keys),
            chats: FirestoreChatRepository(auth: auth, keys: keys),
            ai: ProxyAIService(api: api),
            media: ProxyMediaUploader(api: api, keys: keys),
```

In `mocks()`, build a mock-backed store and inject it the same way:

```swift
        let keys = UserKeyStore(provider: MockKeyProvider(), secrets: KeychainStore())
```

Hold `keys` on `AppServices` so the app can load it at sign-in: add `let keys: UserKeyStore` to the stored properties and the initializer, and pass it through both factories.

- [ ] **Step 2: Load the DEK right after authentication**

Find where the app reacts to `auth.currentUserId` becoming non-nil (RootView / session bootstrap). Before showing the main UI, call:

```swift
        if let uid = services.auth.currentUserId {
            try await services.keys.loadCipher(userId: uid)
        }
```

Place this on the existing sign-in/session path so `currentCipher` is populated before any repository streams data. On sign-out, call `services.keys.signOut(userId: uid)`.

- [ ] **Step 3: Build and run the whole test suite**

Run:
```bash
xcodegen generate && xcodebuild test -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:LuminaLogTests
```
Expected: BUILD SUCCEEDED, all existing + new tests PASS. Mock-backed repositories used by ViewModel tests do not touch `UserKeyStore` (they are the `Mock*` types), so existing tests are unaffected.

- [ ] **Step 4: Commit**

```bash
git add LuminaLog/App/AppServices.swift LuminaLog/App/RootView.swift
git commit -m "Build UserKeyStore in AppServices and load DEK at sign-in"
```

---

## Self-Review

**Spec coverage:**
- §2 boundary A (server holds key, client gets DEK) → Tasks 4, 9 (`ProxyKeyProvider`, bootstrap).
- §3 envelope/key hierarchy, Keychain caching → Tasks 3, 4.
- §4 AES-256-GCM envelope + AAD → Tasks 1, 2.
- §5.1 encrypt scope → Task 6 (content, title, summary, insights, prompts, message text, source snippets, chat title, biography, dailyPrompt) + Task 8 (media bytes).
- §5.2 plaintext scope → Task 6 leaves userId/timestamps/type/kind/flags/stats/s3Key/PII untouched (asserted in tests).
- §6 RAG → backend repo (out of scope; noted).
- §7 media chunked AEAD → Tasks 5, 8.
- §8 lifecycle: multi-device re-fetch (Keychain miss → provider), sign-out clear → Tasks 4, 9. Rotation/account-deletion are backend-driven (out of client scope).
- §9 pre-launch, no migration → no migration code (correct).
- §10.1 client components → all tasks. §10.2 proxy → out of scope (stub provider).

**Placeholder scan:** No TBD/TODO; every code step shows full code. Task 7 Step 3 references "same pattern" but the pattern is fully specified in Step 2 with concrete code — acceptable because it is mechanical repetition of shown code across two analogous files.

**Type consistency:** `FieldCipher(key:)`, `encrypt(_:context:)`/`decrypt(_:context:)`, `EncryptedField(data:)`/`.firestoreData`, `UserKeyStore.loadCipher(userId:)`/`currentCipher`/`currentDataKey`/`signOut(userId:)`, `KeyProvider.fetchDataKey(userId:)`, `MediaCipher(key:chunkSize:)`/`encryptFile(at:to:)`/`decryptFile(at:to:)`, `firestoreData(cipher:)` / `init?(documentId:data:cipher:)` — names are consistent across tasks. `CryptoUnavailableError` defined once (Task 7) and reused in Task 8.
