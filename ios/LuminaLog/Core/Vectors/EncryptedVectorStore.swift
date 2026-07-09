import Foundation
import CryptoKit

enum EncryptedVectorError: LocalizedError {
    case dimensionMismatch
    case decryptionFailed

    var errorDescription: String? {
        switch self {
        case .dimensionMismatch: return "The embedding vector had an unexpected dimension."
        case .decryptionFailed: return "Could not decrypt the embedding vector."
        }
    }
}

/// Seals an `EmbeddingVector`'s raw bytes under the user's DEK using AES-256-GCM
/// and reproduces the existing `{ iv, ct, tag }` envelope (`WrappedKey`) so the
/// opaque blob syncs to the backend exactly like every other wrapped secret — the
/// server never sees the plaintext vector (zero-knowledge, increment 1c-D).
///
/// This deliberately reuses `WrappedKey` as the on-the-wire envelope (no new
/// storage shape) and CryptoKit's GCM primitives (no re-implemented crypto). No AAD
/// is bound, matching `WrappedKey.wrapping`.
///
/// Fails **closed**: wrapping a wrong-dimension vector, unwrapping with the wrong
/// key, unwrapping a tampered blob, or unwrapping bytes that decode to the wrong
/// dimension all throw — never returning a bogus vector.
struct EncryptedVectorStore {

    /// The dimension every vector wrapped/unwrapped by this store must have.
    let dimension: Int

    init(dimension: Int = EmbeddingVector.dimension) {
        self.dimension = dimension
    }

    /// Seal `vector` under `dek`. Throws `dimensionMismatch` if the vector is not of
    /// this store's `dimension`.
    func wrap(_ vector: EmbeddingVector, dek: SymmetricKey) throws -> WrappedKey {
        guard vector.dimension == dimension else {
            throw EncryptedVectorError.dimensionMismatch
        }
        let nonce = AES.GCM.Nonce()
        // Fresh nonce + valid key: seal of a small buffer does not fail in practice,
        // but we surface any error as a fail-closed throw rather than force-unwrap.
        do {
            let sealed = try AES.GCM.seal(vector.data, using: dek, nonce: nonce)
            return WrappedKey(iv: Data(nonce), ct: sealed.ciphertext, tag: sealed.tag)
        } catch {
            throw EncryptedVectorError.decryptionFailed
        }
    }

    /// Open a blob produced by `wrap` back into an `EmbeddingVector`. Throws
    /// `decryptionFailed` for a wrong key or any tampering (GCM tag mismatch), and
    /// `dimensionMismatch` if the decrypted bytes do not decode to this store's
    /// `dimension`.
    func unwrap(_ blob: WrappedKey, dek: SymmetricKey) throws -> EmbeddingVector {
        let raw: Data
        do {
            let box = try AES.GCM.SealedBox(
                nonce: AES.GCM.Nonce(data: blob.iv),
                ciphertext: blob.ct,
                tag: blob.tag
            )
            raw = try AES.GCM.open(box, using: dek)
        } catch {
            throw EncryptedVectorError.decryptionFailed
        }

        guard let vector = EmbeddingVector(data: raw), vector.dimension == dimension else {
            throw EncryptedVectorError.dimensionMismatch
        }
        return vector
    }
}
