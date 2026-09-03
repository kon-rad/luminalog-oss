import Foundation
import CryptoKit

enum EOAKeyEnrollerError: LocalizedError {
    /// The connected address is a smart-contract wallet, not an EOA (spec §4).
    /// `personal_sign` is not deterministic for these, so key-wrap is refused
    /// rather than silently producing an unrecoverable wrap.
    case notAnEOA

    var errorDescription: String? {
        switch self {
        case .notAnEOA:
            return "This wallet can't be used to unlock your journal. Only individually-held wallets (not smart-contract wallets) support this."
        }
    }
}

/// Binds a DEK to a wallet-signature-derived KEK, as the third, additive wrap
/// slot (spec §6.2). Single-slot analogue of `ClientKeyEnroller`: same
/// upload-then-verify-gate discipline, but for exactly one slot, and it never
/// touches the icloud/recovery pair.
final class EOAKeyEnroller {
    private let wallet: WalletConnectService
    private let eoaCheck: EOACheck
    private let transport: EOAWrapTransport

    init(wallet: WalletConnectService, eoaCheck: EOACheck, transport: EOAWrapTransport) {
        self.wallet = wallet
        self.eoaCheck = eoaCheck
        self.transport = transport
    }

    /// Wrap `dek` under a KEK derived from the connected wallet's signature,
    /// upload it, and prove it recovers `dek` before returning. Throws
    /// `.notAnEOA` (nothing signed, nothing uploaded) if the connected address
    /// is a smart-contract wallet, or `KeyEnrollmentError.verificationFailed`
    /// (uploaded but unusable) if the verify-gate fails.
    ///
    /// The wallet is asked to sign the fixed message TWICE: see the verify gate
    /// below. That is one extra prompt on a once-per-account opt-in flow, in
    /// exchange for catching a non-deterministic signer before the wrap is
    /// trusted as a real unlock slot.
    @MainActor
    func enroll(userId: String, dek: SymmetricKey) async throws {
        guard let address = wallet.connectedAddress else { throw WalletConnectError.noActiveSession }

        guard try await eoaCheck.isEOA(address: address) else {
            throw EOAKeyEnrollerError.notAnEOA
        }

        let signature = try await wallet.personalSign(message: EOAKeyDerivation.fixedMessage)
        let kek = EOAKeyDerivation.deriveKEK(fromSignature: signature)
        let wrap = WrappedKey.wrapping(dek: dek, under: kek)

        try await transport.uploadEOAWrap(wrap)

        // VERIFY GATE (spec §6.2 step 6): re-fetch and prove it unwraps to
        // the exact same DEK before this call is allowed to report success.
        guard
            let fetched = try await transport.fetchEOAWrap(),
            let recovered = try? fetched.unwrapping(under: kek),
            recovered.rawData == dek.rawData
        else {
            throw KeyEnrollmentError.verificationFailed
        }

        // DETERMINISM GATE: unwrapping under the `kek` we already hold only
        // proves the storage round trip. What actually has to hold is that a
        // FUTURE unlock, which re-derives the KEK from a fresh signature, opens
        // this wrap. So sign the same fixed message a second time, derive a
        // second KEK independently, and require the fetched wrap to open under
        // that one too. A wallet whose `personal_sign` is not deterministic
        // (smart-contract / ERC-6492 / passkey-backed) yields a different
        // signature here, a different KEK, and a failed unwrap: we refuse the
        // slot now rather than stranding the user at unlock time.
        //
        // This is chain-agnostic on purpose. `EOACheck`'s `eth_getCode` probe
        // only sees Ethereum mainnet, but a wallet session may settle on any of
        // the EVM chains we request, so mainnet-empty bytecode is not proof.
        // Re-signing tests the property we actually depend on, directly.
        let secondSignature = try await wallet.personalSign(message: EOAKeyDerivation.fixedMessage)
        let secondKEK = EOAKeyDerivation.deriveKEK(fromSignature: secondSignature)
        guard
            let reRecovered = try? fetched.unwrapping(under: secondKEK),
            reRecovered.rawData == dek.rawData
        else {
            throw KeyEnrollmentError.verificationFailed
        }
    }
}
