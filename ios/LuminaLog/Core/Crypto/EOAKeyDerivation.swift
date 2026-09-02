import Foundation
import CryptoKit

/// Pure-crypto helper for the EOA-derived key-wrap third slot (spec s6).
///
/// Signs a FIXED, versioned message (no server nonce, unlike SIWE) so the same
/// wallet always reproduces the same signature (RFC 6979 determinism, EOAs
/// only) and therefore the same KEK. Same derivation SHAPE as
/// `RecoveryCode.swift`, reused rather than re-invented (spec s6.2 step 4): the
/// only difference is the input key material (a signature, not a typed code),
/// so there is no normalization step here.
enum EOAKeyDerivation {

    /// The fixed message signed for key derivation. Versioned so it can change
    /// later without silently breaking old wraps (spec s6.2 step 2) - a version
    /// bump requires re-deriving and re-wrapping under a new HKDF `info` below.
    static let fixedMessage = "Argo key derivation v1"

    /// Fixed application salt, distinct from `RecoveryCode.hkdfSalt` so the two
    /// derivations can never collide even if the input material ever did.
    static let hkdfSalt = Data("luminalog-eoa-kek-salt-v1".utf8)

    /// HKDF `info` (domain separation), versioned alongside `fixedMessage`.
    static let hkdfInfo = Data("luminalog-eoa-kek-v1".utf8)

    /// Derive a 256-bit KEK via HKDF-SHA256 over the raw signature bytes (the
    /// UTF-8 encoding of the `0x`-prefixed hex signature string, taken as-is:
    /// wallets return a canonical lowercase-or-not hex string, and any
    /// wallet-to-wallet casing difference would only matter if this were later
    /// re-signed by a DIFFERENT wallet, which unlock never does).
    static func deriveKEK(fromSignature signature: String) -> SymmetricKey {
        let ikm = SymmetricKey(data: Data(signature.utf8))
        return HKDF<SHA256>.deriveKey(
            inputKeyMaterial: ikm,
            salt: hkdfSalt,
            info: hkdfInfo,
            outputByteCount: 32
        )
    }
}
