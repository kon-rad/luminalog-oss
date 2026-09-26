import Foundation
import CryptoKit

// MARK: - InfoArchiveEntry

/// An encrypted archive record of a responded info request.
struct InfoArchiveEntry: Codable, Equatable, Identifiable {

    /// One answered (or declined) question.
    struct Item: Codable, Equatable {
        let index: Int
        let question: String
        /// When nil the question was declined.
        let answer: String?
    }

    let sender: InfoRequestSender
    let reason: String
    let webhookHost: String
    let items: [Item]
    let respondedAt: Date

    /// Unique identifier derived from the response timestamp.
    var id: String { "\(respondedAt.timeIntervalSince1970)" }
}

// MARK: - InfoArchiveCodec

/// Encrypts/decrypts an `InfoArchiveEntry` as an AES-256-GCM sealed box
/// with the archive payload context.
enum InfoArchiveCodec {

    /// The AAD context bound to every archive ciphertext.
    private static let context = "infoArchive.payload"

    /// Serialize and encrypt `entry` using the given `key`.
    /// Returns the raw sealed data (nonce || ciphertext || tag).
    static func encode(_ entry: InfoArchiveEntry, key: SymmetricKey) throws -> Data {
        let encoder = JSONEncoder()
        let plaintext = try encoder.encode(entry)
        let nonce = AES.GCM.Nonce()
        let sealed = try AES.GCM.seal(
            plaintext,
            using: key,
            nonce: nonce,
            authenticating: Data(context.utf8)
        )
        // Concatenate nonce + ciphertext + tag
        var combined = Data(nonce)
        combined.append(sealed.ciphertext)
        combined.append(sealed.tag)
        return combined
    }

    /// Decrypt and deserialize `data` using the given `key`.
    /// `data` must be the concatenation produced by `encode`.
    static func decode(_ data: Data, key: SymmetricKey) throws -> InfoArchiveEntry {
        let nonceSize = 12
        let tagSize = 16
        guard data.count >= nonceSize + tagSize else {
            throw FieldCipherError.decryptionFailed
        }
        let nonceData = data.prefix(nonceSize)
        let tagData = data.suffix(tagSize)
        let ciphertext = data.dropFirst(nonceSize).dropLast(tagSize)

        let nonce = try AES.GCM.Nonce(data: nonceData)
        let box = try AES.GCM.SealedBox(
            nonce: nonce,
            ciphertext: ciphertext,
            tag: tagData
        )
        let plaintext = try AES.GCM.open(box, using: key, authenticating: Data(context.utf8))
        let decoder = JSONDecoder()
        return try decoder.decode(InfoArchiveEntry.self, from: plaintext)
    }
}

// MARK: - InfoArchiveRepository

/// Persistence for the encrypted info-request archive.
protocol InfoArchiveRepository: AnyObject {
    /// Persist an entry to the archive.
    func save(_ entry: InfoArchiveEntry) async throws
    /// List all archived entries, newest first.
    func list() async throws -> [InfoArchiveEntry]
    /// Remove an entry from the archive.
    func delete(_ entry: InfoArchiveEntry) async throws
}

// MARK: - FirestoreInfoArchiveRepository

/// Firestore-backed archive repository. Entries are stored as encrypted blobs
/// in the user's archive collection.
@MainActor
final class FirestoreInfoArchiveRepository: InfoArchiveRepository {

    // MARK: - Dependencies (injected, not resolved in init)

    /// Set after construction to break the service-construction cycle.
    /// Must be non-nil before any read/write call.
    var keys: UserKeyStore?

    // MARK: - Initialization

    init(keys: UserKeyStore? = nil) {
        self.keys = keys
    }

    // MARK: - InfoArchiveRepository

    func save(_ entry: InfoArchiveEntry) async throws {
        // Reserved for Firestore integration; the mock is the primary test surface.
        fatalError("Not yet implemented: FirestoreInfoArchiveRepository.save")
    }

    func list() async throws -> [InfoArchiveEntry] {
        // Reserved for Firestore integration; the mock is the primary test surface.
        fatalError("Not yet implemented: FirestoreInfoArchiveRepository.list")
    }

    func delete(_ entry: InfoArchiveEntry) async throws {
        // Reserved for Firestore integration; the mock is the primary test surface.
        fatalError("Not yet implemented: FirestoreInfoArchiveRepository.delete")
    }
}

// MARK: - MockInfoArchiveRepository

/// In-memory archive repository for tests and previews.
final class MockInfoArchiveRepository: InfoArchiveRepository {

    private var store: [InfoArchiveEntry] = []

    func save(_ entry: InfoArchiveEntry) async throws {
        store.append(entry)
        store.sort { $0.respondedAt > $1.respondedAt }
    }

    func list() async throws -> [InfoArchiveEntry] {
        store
    }

    func delete(_ entry: InfoArchiveEntry) async throws {
        store.removeAll { $0.id == entry.id }
    }
}