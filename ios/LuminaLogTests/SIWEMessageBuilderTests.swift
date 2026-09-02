import XCTest
@testable import LuminaLog

final class SIWEMessageBuilderTests: XCTestCase {
    func testBuildProducesAParseableEIP4361Message() {
        let message = SIWEMessageBuilder.build(
            nonce: "abc123nonce",
            address: "0x1234567890123456789012345678901234567890",
            chainId: 1
        )
        XCTAssertTrue(message.contains("myargoquest.com wants you to sign in with your Ethereum account:"))
        XCTAssertTrue(message.contains("0x1234567890123456789012345678901234567890"))
        XCTAssertTrue(message.contains("URI: https://myargoquest.com"))
        XCTAssertTrue(message.contains("Version: 1"))
        XCTAssertTrue(message.contains("Chain ID: 1"))
        XCTAssertTrue(message.contains("Nonce: abc123nonce"))
        XCTAssertTrue(message.contains("Issued At:"))
    }

    func testDifferentNoncesProduceDifferentMessages() {
        let a = SIWEMessageBuilder.build(nonce: "aaa", address: "0xabc", chainId: 1)
        let b = SIWEMessageBuilder.build(nonce: "bbb", address: "0xabc", chainId: 1)
        XCTAssertNotEqual(a, b)
    }
}
