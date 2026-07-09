import Foundation
import CryptoKit

enum WrappedKeyError: LocalizedError {
    case unwrapFailed

    var errorDescription: String? {
        switch self {
        case .unwrapFailed: return "Could not unwrap the encryption key."
        }
    }
}

/// A Data Encryption Key (DEK) wrapped (encrypted) under some Key Encryption Key
/// (KEK). Mirrors the server `WrappedDEK` shape `{ v, iv, ct, tag }` with base64
/// blobs (see `server/src/crypto/keyService.ts`), so a wrap produced on-device
/// round-trips through Firestore and stays interoperable with the server model.
///
/// Pure value type. AES-256-GCM is used with NO additional authenticated data,
/// matching the server's `wrapDEK`/`unwrapDEK` so a wrap is portable either way.
struct WrappedKey: Equatable {

    static let version = 1

    let v: Int
    let iv: Data   // 12-byte GCM nonce
    let ct: Data   // wrapped-DEK ciphertext
    let tag: Data  // 16-byte GCM tag

    var firestoreData: [String: Any] {
        [
            "v": v,
            "iv": iv.base64EncodedString(),
            "ct": ct.base64EncodedString(),
            "tag": tag.base64EncodedString(),
        ]
    }

    init(iv: Data, ct: Data, tag: Data, v: Int = WrappedKey.version) {
        self.v = v
        self.iv = iv
        self.ct = ct
        self.tag = tag
    }

    /// Parse from a Firestore value. Returns nil for anything that is not a
    /// well-formed v1 wrap.
    init?(data: Any?) {
        guard
            let dict = data as? [String: Any],
            let v = dict["v"] as? Int, v == Self.version,
            let ivB64 = dict["iv"] as? String, let iv = Data(base64Encoded: ivB64),
            let ctB64 = dict["ct"] as? String, let ct = Data(base64Encoded: ctB64),
            let tagB64 = dict["tag"] as? String, let tag = Data(base64Encoded: tagB64),
            // Reject malformed envelopes early: 12-byte GCM nonce, 16-byte tag.
            iv.count == 12, tag.count == 16, !ct.isEmpty
        else { return nil }
        self.v = v
        self.iv = iv
        self.ct = ct
        self.tag = tag
    }
}

extension WrappedKey {

    /// Wrap a 256-bit DEK under a KEK using AES-256-GCM (no AAD).
    /// Seal with a fresh nonce + a valid 256-bit key never fails, so this is
    /// non-throwing; a failure here would be a programmer error, not runtime.
    static func wrapping(dek: SymmetricKey, under kek: SymmetricKey) -> WrappedKey {
        let nonce = AES.GCM.Nonce()
        // Force-unwrap is safe: fresh nonce + valid key + small plaintext.
        let sealed = try! AES.GCM.seal(dek.rawData, using: kek, nonce: nonce)
        return WrappedKey(iv: Data(nonce), ct: sealed.ciphertext, tag: sealed.tag)
    }

    /// Unwrap this wrap back into a DEK under `kek`. Fails closed: any tag
    /// mismatch (wrong KEK / tampered blob) or wrong key length throws.
    func unwrapping(under kek: SymmetricKey) throws -> SymmetricKey {
        do {
            let box = try AES.GCM.SealedBox(
                nonce: AES.GCM.Nonce(data: iv),
                ciphertext: ct,
                tag: tag
            )
            let raw = try AES.GCM.open(box, using: kek)
            guard raw.count == 32 else { throw WrappedKeyError.unwrapFailed }
            return SymmetricKey(data: raw)
        } catch {
            throw WrappedKeyError.unwrapFailed
        }
    }
}

extension SymmetricKey {
    /// The raw key bytes as `Data`.
    var rawData: Data { withUnsafeBytes { Data($0) } }
}
