import XCTest
@testable import LuminaLog

final class WalletSignInFlowTests: XCTestCase {

    private final class RecordingSIWEAuthClient: SIWEAuthClient {
        var nonce = "server-nonce"
        var verifyResult: Result<String, Error> = .success("custom-token-123")
        var linkResult: Result<String, Error> = .success("0xlinked")
        private(set) var verifiedMessages: [String] = []
        private(set) var linkedMessages: [String] = []

        func fetchNonce() async throws -> String { nonce }
        func verify(message: String, signature: String) async throws -> String {
            verifiedMessages.append(message)
            return try verifyResult.get()
        }
        func link(message: String, signature: String) async throws -> String {
            linkedMessages.append(message)
            return try linkResult.get()
        }
    }

    @MainActor
    func testSignInBuildsMessageWithFetchedNonceSignsItAndVerifies() async throws {
        let wallet = MockWalletConnectService()
        let auth = RecordingSIWEAuthClient()
        let flow = WalletSignInFlow(wallet: wallet, authClient: auth, chainId: 1)

        let token = try await flow.signIn()

        XCTAssertEqual(token, "custom-token-123")
        XCTAssertEqual(wallet.signedMessages.count, 1)
        XCTAssertTrue(wallet.signedMessages[0].contains("Nonce: server-nonce"))
        XCTAssertEqual(auth.verifiedMessages, wallet.signedMessages)
    }

    @MainActor
    func testLinkBuildsMessageSignsItAndLinks() async throws {
        let wallet = MockWalletConnectService()
        let auth = RecordingSIWEAuthClient()
        let flow = WalletSignInFlow(wallet: wallet, authClient: auth, chainId: 1)

        let address = try await flow.link()

        XCTAssertEqual(address, "0xlinked")
        XCTAssertEqual(auth.linkedMessages.count, 1)
    }

    @MainActor
    func testSignInConnectsTheWalletIfNotAlreadyConnected() async throws {
        let wallet = MockWalletConnectService(connectedAddress: nil)
        let auth = RecordingSIWEAuthClient()
        let flow = WalletSignInFlow(wallet: wallet, authClient: auth, chainId: 1)

        _ = try await flow.signIn()

        XCTAssertNotNil(wallet.connectedAddress) // connect() was called
    }
}
