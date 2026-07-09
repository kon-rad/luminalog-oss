import XCTest
import CryptoKit
@testable import LuminaLog

final class EncryptedVectorStoreTests: XCTestCase {

    private func vector(dim: Int) -> EmbeddingVector {
        EmbeddingVector((0..<dim).map { Float($0) * 0.01 - 0.5 })
    }

    func testWrapUnwrapRoundTrip() throws {
        let store = EncryptedVectorStore(dimension: 8)
        let dek = SymmetricKey(size: .bits256)
        let v = vector(dim: 8)

        let blob = try store.wrap(v, dek: dek)
        let opened = try store.unwrap(blob, dek: dek)
        XCTAssertEqual(opened, v)
    }

    func testRoundTripAtFullDimension() throws {
        let store = EncryptedVectorStore()   // default 768
        let dek = SymmetricKey(size: .bits256)
        let v = vector(dim: EmbeddingVector.dimension)

        let opened = try store.unwrap(store.wrap(v, dek: dek), dek: dek)
        XCTAssertEqual(opened, v)
    }

    func testWrapProducesWellFormedEnvelope() throws {
        let store = EncryptedVectorStore(dimension: 4)
        let blob = try store.wrap(vector(dim: 4), dek: SymmetricKey(size: .bits256))
        // Reuses the WrappedKey {iv,ct,tag} shape: 12-byte nonce, 16-byte tag.
        XCTAssertEqual(blob.iv.count, 12)
        XCTAssertEqual(blob.tag.count, 16)
        XCTAssertFalse(blob.ct.isEmpty)
    }

    func testFreshNoncePerWrap() throws {
        let store = EncryptedVectorStore(dimension: 4)
        let dek = SymmetricKey(size: .bits256)
        let v = vector(dim: 4)
        let a = try store.wrap(v, dek: dek)
        let b = try store.wrap(v, dek: dek)
        XCTAssertNotEqual(a.iv, b.iv)
        XCTAssertNotEqual(a.ct, b.ct)
    }

    func testWrongKeyFailsClosed() throws {
        let store = EncryptedVectorStore(dimension: 8)
        let blob = try store.wrap(vector(dim: 8), dek: SymmetricKey(size: .bits256))
        XCTAssertThrowsError(try store.unwrap(blob, dek: SymmetricKey(size: .bits256)))
    }

    func testTamperedTagFailsClosed() throws {
        let store = EncryptedVectorStore(dimension: 8)
        let dek = SymmetricKey(size: .bits256)
        let blob = try store.wrap(vector(dim: 8), dek: dek)
        let tampered = WrappedKey(iv: blob.iv, ct: blob.ct,
                                  tag: Data(repeating: 0, count: blob.tag.count))
        XCTAssertThrowsError(try store.unwrap(tampered, dek: dek))
    }

    func testTamperedCiphertextFailsClosed() throws {
        let store = EncryptedVectorStore(dimension: 8)
        let dek = SymmetricKey(size: .bits256)
        let blob = try store.wrap(vector(dim: 8), dek: dek)
        var ct = blob.ct
        ct[ct.startIndex] ^= 0xFF
        let tampered = WrappedKey(iv: blob.iv, ct: ct, tag: blob.tag)
        XCTAssertThrowsError(try store.unwrap(tampered, dek: dek))
    }

    func testWrapDimensionMismatchThrows() {
        let store = EncryptedVectorStore(dimension: 8)
        XCTAssertThrowsError(try store.wrap(vector(dim: 4), dek: SymmetricKey(size: .bits256))) { error in
            XCTAssertEqual(error as? EncryptedVectorError, .dimensionMismatch)
        }
    }

    func testWrongLengthDecryptedDataThrows() throws {
        // Seal a 4-dim vector, then unwrap with a store that expects 8 dims: the
        // ciphertext opens cleanly but decodes to the wrong dimension → throws.
        let dek = SymmetricKey(size: .bits256)
        let blob = try EncryptedVectorStore(dimension: 4).wrap(vector(dim: 4), dek: dek)
        let store8 = EncryptedVectorStore(dimension: 8)
        XCTAssertThrowsError(try store8.unwrap(blob, dek: dek)) { error in
            XCTAssertEqual(error as? EncryptedVectorError, .dimensionMismatch)
        }
    }
}

extension EncryptedVectorError: Equatable {
    public static func == (lhs: EncryptedVectorError, rhs: EncryptedVectorError) -> Bool {
        switch (lhs, rhs) {
        case (.dimensionMismatch, .dimensionMismatch), (.decryptionFailed, .decryptionFailed):
            return true
        default:
            return false
        }
    }
}
