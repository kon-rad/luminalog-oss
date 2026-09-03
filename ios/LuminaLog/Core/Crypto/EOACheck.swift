import Foundation

/// Detects whether an address is an EOA (empty on-chain code) or a
/// smart-contract wallet (non-empty code), via `eth_getCode` (spec section 4).
/// Smart-contract wallets and passkey-backed accounts do not produce a
/// deterministic `personal_sign` signature (no RFC 6979 guarantee), so this
/// check MUST pass before offering the key-wrap enrollment (Global Constraints).
protocol EOACheck {
    func isEOA(address: String) async throws -> Bool
}

enum EOACheckError: LocalizedError {
    case malformedResponse
    case httpError(statusCode: Int)

    var errorDescription: String? {
        switch self {
        case .malformedResponse: return "Couldn't verify this wallet's account type."
        case .httpError(let statusCode): return "Couldn't verify this wallet's account type (\(statusCode))."
        }
    }
}

/// Queries a public Ethereum JSON-RPC endpoint directly (not routed through
/// the connected wallet: not every wallet forwards arbitrary read-only RPC
/// methods, while a public endpoint answers `eth_getCode` unconditionally and
/// needs no wallet round trip or user interaction).
final class RPCEOACheck: EOACheck {
    private let rpcURL: URL
    private let session: URLSession

    /// A well-known public Ethereum mainnet RPC gateway. No API key needed for
    /// a single low-volume read call per key-wrap enrollment attempt.
    static let defaultMainnetRPCURL = URL(string: "https://cloudflare-eth.com")!

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
        guard
            let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let code = json["result"] as? String
        else {
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
