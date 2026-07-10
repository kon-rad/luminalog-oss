import XCTest
@testable import LuminaLog

final class ZKMigrationGateTests: XCTestCase {

    func testPromptsWhenAllConditionsMet() {
        XCTAssertTrue(ZKMigrationGate.shouldPrompt(
            flagOn: true, userId: "u1", hasServerWraps: false, locallyMarkedDone: false
        ))
    }

    func testDoesNotPromptWhenFlagOff() {
        XCTAssertFalse(ZKMigrationGate.shouldPrompt(
            flagOn: false, userId: "u1", hasServerWraps: false, locallyMarkedDone: false
        ))
    }

    func testDoesNotPromptWhenSignedOut() {
        XCTAssertFalse(ZKMigrationGate.shouldPrompt(
            flagOn: true, userId: nil, hasServerWraps: false, locallyMarkedDone: false
        ))
    }

    func testDoesNotPromptWhenServerWrapsAlreadyExist() {
        XCTAssertFalse(ZKMigrationGate.shouldPrompt(
            flagOn: true, userId: "u1", hasServerWraps: true, locallyMarkedDone: false
        ))
    }

    func testDoesNotPromptWhenLocallyMarkedDone() {
        XCTAssertFalse(ZKMigrationGate.shouldPrompt(
            flagOn: true, userId: "u1", hasServerWraps: false, locallyMarkedDone: true
        ))
    }
}
