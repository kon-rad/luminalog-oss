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
