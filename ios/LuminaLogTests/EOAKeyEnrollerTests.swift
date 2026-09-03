import XCTest
import CryptoKit
@testable import LuminaLog

final class EOAKeyEnrollerTests: XCTestCase {

    private final class InMemoryEOAWrapTransport: EOAWrapTransport {
        private(set) var uploaded: WrappedKey?
        var tamperOnFetch = false
        func uploadEOAWrap(_ wrap: WrappedKey) async throws { uploaded = wrap }
        func fetchEOAWrap() async throws -> WrappedKey? {
            guard let uploaded else { return nil }
            if tamperOnFetch {
                return WrappedKey.wrapping(dek: SymmetricKey(size: .bits256), under: SymmetricKey(size: .bits256))
            }
            return uploaded
        }
    }

    @MainActor
    private func makeSUT(isEOA: Bool = true, signature: String = "0xsig")
        -> (EOAKeyEnroller, InMemoryEOAWrapTransport, MockWalletConnectService) {
        let transport = InMemoryEOAWrapTransport()
        let wallet = MockWalletConnectService()
        wallet.signatureToReturn = signature
        let check = MockEOACheck(isEOA: isEOA)
        let sut = EOAKeyEnroller(wallet: wallet, eoaCheck: check, transport: transport)
        return (sut, transport, wallet)
    }

    @MainActor
    func testHappyPathSignsWrapsUploadsAndVerifies() async throws {
        let (sut, transport, wallet) = makeSUT()
        let dek = SymmetricKey(size: .bits256)

        try await sut.enroll(userId: "u1", dek: dek)

        XCTAssertEqual(wallet.signedMessages, [EOAKeyDerivation.fixedMessage])
        let uploaded = try XCTUnwrap(transport.uploaded)
        let kek = EOAKeyDerivation.deriveKEK(fromSignature: wallet.signatureToReturn)
        XCTAssertEqual(try uploaded.unwrapping(under: kek).rawData, dek.rawData)
    }

    @MainActor
    func testRejectsNonEOAAddressBeforeSigning() async throws {
        let (sut, transport, wallet) = makeSUT(isEOA: false)
        do {
            try await sut.enroll(userId: "u1", dek: SymmetricKey(size: .bits256))
            XCTFail("expected EOAKeyEnrollerError.notAnEOA")
        } catch EOAKeyEnrollerError.notAnEOA {
            // expected
        }
        XCTAssertTrue(wallet.signedMessages.isEmpty) // never signed
        XCTAssertNil(transport.uploaded)              // never uploaded
    }

    @MainActor
    func testAbortsWhenVerifyGateFindsATamperedWrap() async throws {
        let (sut, transport, _) = makeSUT()
        transport.tamperOnFetch = true
        do {
            try await sut.enroll(userId: "u1", dek: SymmetricKey(size: .bits256))
            XCTFail("expected verificationFailed")
        } catch KeyEnrollmentError.verificationFailed {
            // expected
        }
    }
}
