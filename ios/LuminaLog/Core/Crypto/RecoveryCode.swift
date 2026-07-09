import Foundation
import CryptoKit

/// Pure-crypto helper for the one-time **recovery code** backstop (spec §2).
///
/// The recovery code is a high-entropy secret shown to the user exactly once at
/// setup. It is never stored; instead a KEK is derived from it via HKDF-SHA256
/// and used to wrap the DEK (`WrappedKey`). If the iCloud Keychain KEK is ever
/// unavailable, the user re-enters the code, we re-derive the same KEK, and
/// unwrap the DEK.
///
/// Encoding is Crockford base32 (no ambiguous `I`, `L`, `O`, `U`) grouped in
/// fours (`XXXX-XXXX-…`). Normalization strips separators, upper-cases, and maps
/// the ambiguous glyphs a human might type back to their canonical digits.
enum RecoveryCode {

    /// Crockford base32 alphabet — 32 symbols, excludes I, L, O, U.
    static let alphabet = Array("0123456789ABCDEFGHJKMNPQRSTVWXYZ")

    /// Fixed application salt for the recovery-KEK derivation. Constant across
    /// all users/devices so the same code always derives the same KEK.
    static let hkdfSalt = Data("luminalog-recovery-kek-salt-v1".utf8)

    /// HKDF `info` (domain separation) for the recovery KEK.
    static let hkdfInfo = Data("luminalog-recovery-kek-v1".utf8)

    /// Bytes of entropy in a generated code (256-bit).
    static let entropyBytes = 32

    // MARK: - Generation

    /// Generate a fresh 256-bit recovery code in grouped Crockford base32.
    /// 256 bits → 52 base32 chars → 13 groups of 4 (`XXXX-XXXX-…`).
    static func generate() -> String {
        var bytes = [UInt8](repeating: 0, count: entropyBytes)
        let status = SecRandomCopyBytes(kSecRandomDefault, entropyBytes, &bytes)
        precondition(status == errSecSuccess, "SecRandomCopyBytes failed")
        return group(base32Encode(Data(bytes)))
    }

    // MARK: - KEK derivation

    /// Normalize a user-entered code: strip separators/whitespace, upper-case,
    /// and map ambiguous glyphs (`O`→`0`, `I`/`L`→`1`, `U`→`V`) to canonical
    /// symbols so a mistyped-but-unambiguous code still derives the right KEK.
    static func normalize(_ code: String) -> String {
        let stripped = code.uppercased().filter { $0 != "-" && !$0.isWhitespace }
        var mapped = ""
        mapped.reserveCapacity(stripped.count)
        for ch in stripped {
            switch ch {
            case "O": mapped.append("0")
            case "I", "L": mapped.append("1")
            case "U": mapped.append("V")
            default: mapped.append(ch)
            }
        }
        return mapped
    }

    /// Derive a 256-bit KEK from a recovery code via HKDF-SHA256 over the
    /// normalized code, with the fixed app salt and versioned info string.
    static func deriveKEK(from code: String) -> SymmetricKey {
        let ikm = SymmetricKey(data: Data(normalize(code).utf8))
        return HKDF<SHA256>.deriveKey(
            inputKeyMaterial: ikm,
            salt: hkdfSalt,
            info: hkdfInfo,
            outputByteCount: 32
        )
    }

    // MARK: - Wrap / unwrap

    /// Wrap `dek` under the KEK derived from `code`.
    static func wrap(dek: SymmetricKey, code: String) -> WrappedKey {
        WrappedKey.wrapping(dek: dek, under: deriveKEK(from: code))
    }

    /// Unwrap a recovery wrap using `code`. Fails closed on a wrong code.
    static func unwrap(_ wrap: WrappedKey, code: String) throws -> SymmetricKey {
        try wrap.unwrapping(under: deriveKEK(from: code))
    }

    // MARK: - Crockford base32

    /// Encode arbitrary bytes as an (ungrouped) Crockford base32 string.
    static func base32Encode(_ data: Data) -> String {
        var output = ""
        output.reserveCapacity((data.count * 8 + 4) / 5)
        var buffer = 0
        var bitsLeft = 0
        for byte in data {
            buffer = (buffer << 8) | Int(byte)
            bitsLeft += 8
            while bitsLeft >= 5 {
                let index = (buffer >> (bitsLeft - 5)) & 0x1F
                bitsLeft -= 5
                output.append(alphabet[index])
            }
        }
        if bitsLeft > 0 {
            let index = (buffer << (5 - bitsLeft)) & 0x1F
            output.append(alphabet[index])
        }
        return output
    }

    /// Insert a `-` every 4 characters for readability.
    static func group(_ s: String, size: Int = 4) -> String {
        var result = ""
        for (i, ch) in s.enumerated() {
            if i > 0 && i % size == 0 { result.append("-") }
            result.append(ch)
        }
        return result
    }
}
