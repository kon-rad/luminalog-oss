import XCTest
@testable import LuminaLog

final class PeriodPyramidMappingTests: XCTestCase {
    func testPeriodNarrativeBodyEncodesFieldNamesTheServerExpects() throws {
        let body = Model1Requests.PeriodNarrativeBody(
            periodType: "week", periodIndex: 42,
            days: [PeriodNarrativeDayInput(dayIndex: 100, beats: [
                PeriodNarrativeBeatInput(text: "Shipped the beta", kind: "event", domain: "craft", isSpine: true),
            ])]
        )
        let data = try JSONEncoder().encode(body)
        let obj = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        XCTAssertEqual(obj["periodType"] as? String, "week")
        XCTAssertEqual(obj["periodIndex"] as? Int, 42)
        let days = obj["days"] as! [[String: Any]]
        XCTAssertEqual(days.first?["dayIndex"] as? Int, 100)
    }

    func testPeriodPositionPointDecodesTheRouteShape() throws {
        let json = """
        {"periodIndex": 1, "x": 0.1, "y": 0.2, "z": 0.3, "childCount": 2, "parentIndex": 202601}
        """.data(using: .utf8)!
        let point = try JSONDecoder().decode(PeriodPositionPoint.self, from: json)
        XCTAssertEqual(point.parentIndex, 202601)
    }

    func testPeriodPositionPointDecodesANullParentIndex() throws {
        let json = """
        {"periodIndex": 1, "x": 0.1, "y": 0.2, "z": 0.3, "childCount": 2, "parentIndex": null}
        """.data(using: .utf8)!
        let point = try JSONDecoder().decode(PeriodPositionPoint.self, from: json)
        XCTAssertNil(point.parentIndex)
    }
}