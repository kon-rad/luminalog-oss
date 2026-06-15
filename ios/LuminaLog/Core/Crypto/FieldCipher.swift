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
        } catch {
            throw FieldCipherError.decryptionFailed
        }
    }
}
