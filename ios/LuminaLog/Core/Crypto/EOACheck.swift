import Foundation
import OSLog

/// Detects whether an address is an EOA (empty on-chain code) or a
/// smart-contract wallet (non-empty code), via `eth_getCode` (spec §4).
/// Smart-contract wallets and passkey-backed accounts do not produce a
/// deterministic `personal_sign` signature (no RFC 6979 guarantee), so this
/// check MUST pass before offering the key-wrap enrollment (Global Constraints).
protocol EOACheck {
    func isEOA(address: String) async throws -> Bool
}

enum EOACheckError: LocalizedError {
    case malformedResponse
    case httpError(statusCode: Int)
    /// The endpoint answered with a well-formed JSON-RPC `error` member instead
    /// of a `result`. Distinct from `.malformedResponse` on purpose: a gateway
    /// that stops serving `eth_*` (or rate-limits us) returns HTTP 200 with this
    /// shape, and collapsing it into "malformed" is what let a dead default RPC
    /// endpoint ship undetected.
    case rpcError(code: Int, message: String)

    var errorDescription: String? {
        switch self {
        case .malformedResponse: return "Couldn't verify this wallet's account type."
        case .httpError(let statusCode): return "Couldn't verify this wallet's account type (\(statusCode))."
        case .rpcError(let code, _): return "Couldn't verify this wallet's account type (RPC \(code))."
        }
    }
}

/// Queries a public Ethereum JSON-RPC endpoint directly (not routed through
/// the connected wallet: not every wallet forwards arbitrary read-only RPC
/// methods, while a public endpoint answers `eth_getCode` unconditionally and
/// needs no wallet round trip or user interaction).
final class RPCEOACheck: EOACheck {
    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "keys")

    private let rpcURL: URL
    private let session: URLSession

    /// A well-known public Ethereum mainnet RPC gateway. No API key needed for
    /// a single low-volume read call per key-wrap enrollment attempt.
    ///
    /// Note: the previous default (`cloudflare-eth.com`) stopped serving `eth_*`
    /// methods and now answers HTTP 200 with a JSON-RPC error, which is why
    /// `isEOA` parses the `error` member explicitly and logs it.
    static let defaultMainnetRPCURL = URL(string: "https://ethereum-rpc.publicnode.com")!

    init(rpcURL: URL = RPCEOACheck.defaultMainnetRPCURL, session: URLSession = .shared) {
        self.rpcURL = rpcURL
        self.session = session
    }

    func isEOA(address: String) async throws -> Bool {
        var request = URLRequest(url: rpcURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = try JSONSerialization.data(withJSONObject: [
            "jsonrpc": "2.0",
            "id": 1,
            "method": "eth_getCode",
            "params": [address, "latest"],
        ])

        let (data, response) = try await session.data(for: request)
        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            throw EOACheckError.httpError(statusCode: (response as? HTTPURLResponse)?.statusCode ?? -1)
        }
        guard let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any] else {
            throw EOACheckError.malformedResponse
        }
        // A JSON-RPC error is a well-formed 200 response with no `result`, so it
        // must be recognised before the `result` extraction below, or a gateway
        // that has stopped serving `eth_getCode` looks indistinguishable from
        // garbage on the wire.
        if let rpcError = json["error"] as? [String: Any] {
            let code = rpcError["code"] as? Int ?? 0
            let message = rpcError["message"] as? String ?? "unknown JSON-RPC error"
            Self.logger.error(
                "eth_getCode RPC error from \(self.rpcURL.host ?? "unknown", privacy: .public): \(code, privacy: .public) \(message, privacy: .public)"
            )
            throw EOACheckError.rpcError(code: code, message: message)
        }
        guard let code = json["result"] as? String else {
            throw EOACheckError.malformedResponse
        }
        // An EOA's code is exactly "0x" (empty). Any other value is deployed
        // bytecode, i.e. a smart-contract wallet.
        return code == "0x"
    }
}

/// Test double: fixed answer, no network.
final class MockEOACheck: EOACheck {
    var result: Result<Bool, Error>
    init(isEOA: Bool = true) { self.result = .success(isEOA) }
    func isEOA(address: String) async throws -> Bool { try result.get() }
}
