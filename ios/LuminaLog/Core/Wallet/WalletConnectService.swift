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
    /// Neither a response nor a session-delete arrived within the wait window.
    case timeout

    var errorDescription: String? {
        switch self {
        case .notConfigured: return "Wallet connect is not configured."
        case .cancelled: return "Wallet connection was cancelled."
        case .noActiveSession: return "No wallet is connected."
        case .signRejected: return "The wallet declined to sign."
        case .invalidResponse: return "The wallet returned an unexpected response."
        case .timeout: return "The wallet did not respond in time."
        }
    }
}

/// Wallet-connect session + raw `personal_sign` primitive, shared by SIWE
/// sign-in/link (this plan) and the EOA key-wrap derivation (a later plan).
/// Deliberately narrow: this type never builds a SIWE message and never knows
/// about HKDF, so it is safe to reuse for both signing use cases (spec §3).
@MainActor
protocol WalletConnectService: AnyObject {
    /// The connected wallet's EIP-55 checksummed address, or nil if nothing is connected.
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
/// internally for EIP-55 address checksumming and ENS lookups in its own UI
/// (and this file reuses it below for its own EIP-55 checksumming).
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

/// EIP-55 mixed-case checksum encoding. `Account.address` arrives verbatim
/// from the wallet (most send lowercase); SIWE downstream (Task 3+) needs the
/// checksummed form, and strict verifiers reject a lowercase address.
/// Uppercases each hex letter of the lowercased address whose corresponding
/// nibble in `keccak256(lowercased_address_without_0x)` is >= 8; digits are
/// left as-is.
private func eip55Checksum(_ address: String) -> String {
    let stripped = address.hasPrefix("0x") || address.hasPrefix("0X") ? String(address.dropFirst(2)) : address
    let lower = stripped.lowercased()
    let hashHex = AppKitCryptoProvider().keccak256(Data(lower.utf8))
        .map { String(format: "%02x", $0) }
        .joined()

    var result = "0x"
    for (character, hashDigit) in zip(lower, hashHex) {
        if character.isLetter, let nibble = hashDigit.hexDigitValue, nibble >= 8 {
            result.append(Character(character.uppercased()))
        } else {
            result.append(character)
        }
    }
    return result
}

@MainActor
final class LiveWalletConnectService: WalletConnectService {

    /// Only the `eip155` (Ethereum-family) namespace is requested. AppKit's
    /// own `SessionParams.default` also proposes `solana`; if a wallet
    /// approved both, `Session.accounts` (which flattens a Dictionary with
    /// undefined iteration order) could hand back a Solana account instead
    /// of an EVM one. Restricting the proposal itself is the first layer of
    /// defense; `connectedAddress` and `personalSign` below additionally read
    /// `namespaces["eip155"]` explicitly rather than trusting iteration order.
    private static let eip155SessionParams: SessionParams = {
        // Mirrors the EVM chain set reown-swift's own (internal, so not
        // reusable here) `ChainPresets.ethChains` proposes, so scoping the
        // namespace to `eip155` does not also narrow which EVM chains a
        // wallet can pick from.
        let chainIds = [
            "eip155:1", "eip155:42161", "eip155:137", "eip155:43114",
            "eip155:56", "eip155:10", "eip155:100", "eip155:324",
            "eip155:7777777", "eip155:8453", "eip155:42220", "eip155:1313161554"
        ]
        let namespace = ProposalNamespace(
            chains: chainIds.compactMap(Blockchain.init),
            methods: ["personal_sign", "eth_signTypedData", "eth_sendTransaction", "wallet_switchEthereumChain", "wallet_addEthereumChain"],
            events: ["chainChanged", "accountsChanged"]
        )
        return SessionParams(namespaces: ["eip155": namespace], sessionProperties: nil)
    }()

    /// Set at the end of `configure(projectId:metadata:)`, and only when
    /// `projectId` is non-empty. `AppKit.instance` is a lazy static that
    /// `fatalError`s if `.configure` was never called, so every method below
    /// must check this flag and fail closed with `.notConfigured` before
    /// touching `AppKit.instance` at all.
    private static var isConfigured = false

    private var session: Session?
    private var cancellables = Set<AnyCancellable>()

    var connectedAddress: String? {
        guard Self.isConfigured, let account = session?.namespaces["eip155"]?.accounts.first else {
            return nil
        }
        return eip55Checksum(account.address)
    }

    /// Call once at app launch, before any `connect()`/`personalSign()` call.
    /// A `nil`/empty `projectId` (Local.xcconfig not configured) makes every
    /// call fail closed with `.notConfigured` rather than crash.
    static func configure(projectId: String, metadata: AppMetadata) {
        guard !projectId.isEmpty else { return }
        AppKit.configure(
            projectId: projectId,
            metadata: metadata,
            crypto: AppKitCryptoProvider(),
            sessionParams: eip155SessionParams,
            // One-Click Auth (SIWE folded into the connect handshake) is a
            // different flow from this plan's explicit connect-then-sign;
            // reown-swift 1.8.0 requires this argument explicitly (no default).
            authRequestParams: nil,
            // Coinbase Wallet's native-SDK path never creates a WalletConnect
            // Session (AppKit tracks it separately via store.connectedWith
            // instead), and AppKit.instance.request(params:) has no branch
            // for it, so this service's session-based connect()/personalSign()
            // cannot drive it. Coinbase Wallet stays reachable the same way
            // as any other wallet, through the standard WalletConnect
            // protocol connection; this only removes the redundant
            // native-SDK shortcut that this service does not implement.
            coinbaseEnabled: false
        )
        isConfigured = true
    }

    init() {
        guard Self.isConfigured else { return }
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
        guard Self.isConfigured else { throw WalletConnectError.notConfigured }
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
        guard Self.isConfigured else { throw WalletConnectError.notConfigured }
        guard let session else { return }
        try await AppKit.instance.disconnect(topic: session.topic)
        self.session = nil
    }

    func personalSign(message: String) async throws -> String {
        guard Self.isConfigured else { throw WalletConnectError.notConfigured }
        guard let session, let account = session.namespaces["eip155"]?.accounts.first else {
            throw WalletConnectError.noActiveSession
        }
        let checksummedAddress = eip55Checksum(account.address)
        let hexMessage = "0x" + Data(message.utf8).map { String(format: "%02x", $0) }.joined()
        let params = AnyCodable([hexMessage, checksummedAddress])
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
            var timeoutTask: Task<Void, Never>?

            func resume(_ result: Result<String, Error>) {
                guard !didResume else { return }
                didResume = true
                responseCancellable?.cancel()
                deleteCancellable?.cancel()
                timeoutTask?.cancel()
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

            // Bound the wait to match connect()'s 20s poll bound. Without
            // this, a user who opens the wallet, ignores the sign sheet, and
            // returns to Argo leaves this continuation hanging forever:
            // neither of the publishers above ever fires.
            timeoutTask = Task {
                try? await Task.sleep(nanoseconds: 20_000_000_000)
                guard !Task.isCancelled else { return }
                resume(.failure(WalletConnectError.timeout))
            }

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

/// Orchestrates "connect (if needed) -> fetch nonce -> build SIWE message ->
/// sign -> call the server" for both the sign-in and link paths (spec §5.2).
/// Extracted from `FirebaseAuthService` so it is testable without a live
/// `Auth.auth()`.
@MainActor
final class WalletSignInFlow {
    private let wallet: WalletConnectService
    private let authClient: SIWEAuthClient
    private let chainId: Int

    init(wallet: WalletConnectService, authClient: SIWEAuthClient, chainId: Int = 1) {
        self.wallet = wallet
        self.authClient = authClient
        self.chainId = chainId
    }

    /// Returns a Firebase custom token, per `SIWEAuthClient.verify`.
    func signIn() async throws -> String {
        let address = try await connectedAddress()
        let (message, signature) = try await signSIWEMessage(address: address)
        return try await authClient.verify(message: message, signature: signature)
    }

    /// Returns the linked address, per `SIWEAuthClient.link`.
    func link() async throws -> String {
        let address = try await connectedAddress()
        let (message, signature) = try await signSIWEMessage(address: address)
        return try await authClient.link(message: message, signature: signature)
    }

    private func connectedAddress() async throws -> String {
        if let address = wallet.connectedAddress { return address }
        try await wallet.connect()
        guard let address = wallet.connectedAddress else { throw WalletConnectError.noActiveSession }
        return address
    }

    private func signSIWEMessage(address: String) async throws -> (message: String, signature: String) {
        let nonce = try await authClient.fetchNonce()
        let message = SIWEMessageBuilder.build(nonce: nonce, address: address, chainId: chainId)
        let signature = try await wallet.personalSign(message: message)
        return (message, signature)
    }
}
