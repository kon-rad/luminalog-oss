import XCTest
@testable import LuminaLog

/// `ProxyAPIError.isPayloadTooLarge` classifies the deterministic 413 so the
/// transcription pipeline marks an over-limit clip terminal (`.unsupported`)
/// instead of re-uploading the same bytes on every launch.
final class ProxyAPIErrorTests: XCTestCase {

    func test413IsPayloadTooLarge() {
        XCTAssertTrue(ProxyAPIError.httpError(statusCode: 413, body: "too large").isPayloadTooLarge)
    }

    func testOtherStatusesAreNotPayloadTooLarge() {
        XCTAssertFalse(ProxyAPIError.httpError(statusCode: 500, body: "").isPayloadTooLarge)
        XCTAssertFalse(ProxyAPIError.httpError(statusCode: 400, body: "").isPayloadTooLarge)
        XCTAssertFalse(ProxyAPIError.emptyResponse.isPayloadTooLarge)
        XCTAssertFalse(ProxyAPIError.invalidURL("/x").isPayloadTooLarge)
    }
}
