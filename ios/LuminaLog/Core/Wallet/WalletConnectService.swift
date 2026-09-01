import Foundation
import Combine
import CryptoSwift
import ReownAppKit

/// Errors from the wallet-connect layer (spec §5.2, §6.2).
enum WalletConnectError: LocalizedError {
    /// `REOWN_PROJECT_ID` is empty (Local.xcconfig not configured).
    case notConfigured
    /// The user dismissed the connect modal or the wallet's sign sheet.
    case cancelled
    /// `personalSign` was called with no connected session.
    case noActiveSession
    /// The wallet returned an error response instead of a signature.
    case signRejected
    /// The wallet's response could not be parsed as a hex signature.
    case invalidResponse

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "Wallet connect is not configured."
        case .cancelled: return "Wallet connection was cancelled."
        case .noActiveSession: return "No wallet is connected."
        case .signRejected: return "The wallet declined to sign."
        case .invalidResponse: return "The wallet returned an unexpected response."
        }
    }
}

/// Wallet-connect session + raw `personal_sign` primitive, shared by SIWE
/// sign-in/link (this plan) and the EOA key-wrap derivation (a later plan).
/// Deliberately narrow: this type never builds a SIWE message and never knows
/// about HKDF, so it is safe to reuse for both signing use cases (spec §3).
@MainActor
protocol WalletConnectService: AnyObject {
    /// The connected wallet's checksummed address, or nil if nothing is connected.
    var connectedAddress: String? { get }
    /// Present the connect modal and wait for a wallet session. Idempotent: a
    /// second call while already connected returns immediately.
    func connect() async throws
    /// Tear down the active session, if any.
    func disconnect() async throws
    /// Request `personal_sign` of `message` from the connected wallet.
    /// Returns a `0x`-prefixed hex signature. Throws `.noActiveSession` if
    /// `connect()` was never called or the session has ended.
    func personalSign(message: String) async throws -> String
}

/// The `CryptoProvider` reown-swift's `AppKit.configure(...)` requires.
/// reown-swift ships no default implementation in the library itself (its
/// own Example app vendors one backed by CryptoSwift + Web3 + HDWalletKit);
/// this app only needs `keccak256` to be correct, since AppKit uses it
/// internally for EIP-55 address checksumming and ENS lookups in its own UI.
/// `recoverPubKey` (secp256k1 signature recovery) has no reachable caller on
/// this service's plain connect / request / session-response path: it is
/// only used by reown-swift's `EIP191Verifier`, which nothing in the SDK's
/// dApp-side flow invokes, and this app verifies SIWE signatures server-side
/// (Task 3+), not via on-device ECDSA recovery. Throwing here keeps this
/// provider to a single, well-understood dependency (CryptoSwift) rather than
/// also vendoring a secp256k1 library for a code path this app never hits.
private struct AppKitCryptoProvider: CryptoProvider {
    enum ProviderError: Error {
        case recoverPubKeyUnsupported
    }

    func recoverPubKey(signature: EthereumSignature, message: Data) throws -> Data {
        throw ProviderError.recoverPubKeyUnsupported
    }

    func keccak256(_ data: Data) -> Data {
        Data(SHA3(variant: .keccak256).calculate(for: [UInt8](data)))
    }
}

@MainActor
final class LiveWalletConnectService: WalletConnectService {

    private var session: Session?
    private var cancellables = Set<AnyCancellable>()

    var connectedAddress: String? {
        session?.accounts.first?.address
    }

    /// Call once at app launch, before any `connect()`/`personalSign()` call.
    /// A `nil`/empty `projectId` (Local.xcconfig not configured) makes every
    /// call fail closed with `.notConfigured` rather than crash: reown-swift's
    /// `AppKit.instance` traps if `.configure` was never called.
    static func configure(projectId: String, metadata: AppMetadata) {
        guard !projectId.isEmpty else { return }
        AppKit.configure(
            projectId: projectId,
            metadata: metadata,
            crypto: AppKitCryptoProvider(),
            // One-Click Auth (SIWE folded into the connect handshake) is a
            // different flow from this plan's explicit connect-then-sign;
            // reown-swift 1.8.0 requires this argument explicitly (no default).
            authRequestParams: nil
        )
    }

    init() {
        AppKit.instance.sessionSettlePublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] session in self?.session = session }
            .store(in: &cancellables)
        AppKit.instance.sessionDeletePublisher
            .receive(on: DispatchQueue.main)
            .sink { [weak self] _ in self?.session = nil }
            .store(in: &cancellables)
    }

    func connect() async throws {
        if session != nil { return }
        if let existing = AppKit.instance.getSessions().first {
            session = existing
            return
        }
        AppKit.present()
        // sessionSettlePublisher (wired in init) sets `session` asynchronously;
        // poll briefly rather than block indefinitely on a Combine bridge here.
        for _ in 0..<200 {
            if session != nil { return }
            try await Task.sleep(nanoseconds: 100_000_000)
        }
        throw WalletConnectError.cancelled
    }

    func disconnect() async throws {
        guard let session else { return }
        try await AppKit.instance.disconnect(topic: session.topic)
        self.session = nil
    }

    func personalSign(message: String) async throws -> String {
        guard let session, let account = session.accounts.first else {
            throw WalletConnectError.noActiveSession
        }
        let hexMessage = "0x" + Data(message.utf8).map { String(format: "%02x", $0) }.joined()
        let params = AnyCodable([hexMessage, account.address])
        let request: Request
        do {
            request = try Request(topic: session.topic, method: "personal_sign", params: params, chainId: account.blockchain)
        } catch {
            throw WalletConnectError.invalidResponse
        }

        return try await withCheckedThrowingContinuation { continuation in
            var didResume = false
            var responseCancellable: AnyCancellable?
            var deleteCancellable: AnyCancellable?

            func resume(_ result: Result<String, Error>) {
                guard !didResume else { return }
                didResume = true
                responseCancellable?.cancel()
                deleteCancellable?.cancel()
                continuation.resume(with: result)
            }

            // The response to `request` arrives asynchronously on this
            // publisher (AppKit.instance.request(params:) itself only
            // confirms the request was sent, not what the wallet answered);
            // match it by request id since the publisher carries every
            // session response, not just this one.
            responseCancellable = AppKit.instance.sessionResponsePublisher
                .receive(on: DispatchQueue.main)
                .sink { response in
                    guard response.id == request.id else { return }
                    switch response.result {
                    case .response(let value):
                        guard let signature = try? value.get(String.self), signature.hasPrefix("0x") else {
                            resume(.failure(WalletConnectError.invalidResponse))
                            return
                        }
                        resume(.success(signature))
                    case .error:
                        resume(.failure(WalletConnectError.signRejected))
                    }
                }
            responseCancellable?.store(in: &cancellables)

            // Give up if the session dies mid-request (e.g. the wallet drops
            // the connection without ever answering) rather than hang forever.
            deleteCancellable = AppKit.instance.sessionDeletePublisher
                .receive(on: DispatchQueue.main)
                .sink { topic, _ in
                    guard topic == session.topic else { return }
                    resume(.failure(WalletConnectError.noActiveSession))
                }
            deleteCancellable?.store(in: &cancellables)

            Task {
                do {
                    try await AppKit.instance.request(params: request)
                } catch {
                    resume(.failure(WalletConnectError.signRejected))
                }
            }
        }
    }
}
