import Foundation
@testable import LuminaLog

/// Test double for `WalletConnectService`. Fixed address, records every
/// `personalSign` call, and lets a test inject a failure on either method.
@MainActor
final class MockWalletConnectService: WalletConnectService {
    var connectedAddress: String?
    var connectError: Error?
    var signError: Error?
    private(set) var signedMessages: [String] = []
    /// Signature returned by `personalSign` on success. A fixed, valid-looking
    /// hex string is enough: `SIWEAuthClient` only checks the prefix.
    var signatureToReturn = "0x" + String(repeating: "ab", count: 65)

    init(connectedAddress: String? = "0x1234567890123456789012345678901234567890") {
        self.connectedAddress = connectedAddress
    }

    func connect() async throws {
        if let connectError { throw connectError }
        if connectedAddress == nil { connectedAddress = "0x1234567890123456789012345678901234567890" }
    }

    func disconnect() async throws {
        connectedAddress = nil
    }

    func personalSign(message: String) async throws -> String {
        if let signError { throw signError }
        guard connectedAddress != nil else { throw WalletConnectError.noActiveSession }
        signedMessages.append(message)
        return signatureToReturn
    }
}
