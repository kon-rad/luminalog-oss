import XCTest
@testable import LuminaLog

final class AnchoredProjectionTests: XCTestCase {
    private let tol = 1e-6

    // Golden: feeding each pinned axis vector through the projection gives fixed,
    // model-independent coordinates. These values pin the axes, gains, and tanh
    // transform. If any pinned constant changes, these break — that is the point.
    func testValenceAxisGolden() {
        let v = AnchorConstants.axes[0].map { Float($0) }
        let p = AnchoredProjection.project(v)
        XCTAssertEqual(p.x, 0.99984463, accuracy: tol)
        XCTAssertEqual(p.y, -0.49158103, accuracy: tol)
        XCTAssertEqual(p.z, 0.00178618, accuracy: tol)
    }

    func testInwardAxisGolden() {
        let v = AnchorConstants.axes[1].map { Float($0) }
        let p = AnchoredProjection.project(v)
        XCTAssertEqual(p.x, -0.41746122, accuracy: tol)
        XCTAssertEqual(p.y, 0.99997877, accuracy: tol)
        XCTAssertEqual(p.z, -0.37671752, accuracy: tol)
    }

    func testArousalAxisGolden() {
        let v = AnchorConstants.axes[2].map { Float($0) }
        let p = AnchoredProjection.project(v)
        XCTAssertEqual(p.x, 0.00170664, accuracy: tol)
        XCTAssertEqual(p.y, -0.42863689, accuracy: tol)
        XCTAssertEqual(p.z, 0.99990004, accuracy: tol)
    }

    func testZeroCentroidMapsToOrigin() {
        let p = AnchoredProjection.project([Float](repeating: 0, count: 512))
        XCTAssertEqual(p.x, 0, accuracy: tol)
        XCTAssertEqual(p.y, 0, accuracy: tol)
        XCTAssertEqual(p.z, 0, accuracy: tol)
    }

    func testCoordinatesAlwaysBounded() {
        let big = [Float](repeating: 3, count: 512) // large dot products
        let p = AnchoredProjection.project(big)
        for c in [p.x, p.y, p.z] { XCTAssert(c > -1 && c < 1 && c.isFinite) }
    }

    func testWrongDimensionReturnsOrigin() {
        let p = AnchoredProjection.project([Float](repeating: 1, count: 10))
        XCTAssertEqual(p.x, 0, accuracy: tol)
        XCTAssertEqual(p.y, 0, accuracy: tol)
        XCTAssertEqual(p.z, 0, accuracy: tol)
    }
}
