import XCTest
@testable import LuminaLog

final class ConstellationSyncServiceTests: XCTestCase {
    func testUploadBodyEncodesPointsArray() throws {
        let pts = [ConstellationPoint(dayIndex: 20000, date: "2024-10-04",
                    x: 0.1, y: -0.2, z: 0.3, wordCount: 800, streakAtEarn: 1)]
        let data = try JSONEncoder().encode(ConstellationUploadBody(points: pts))
        let json = try JSONSerialization.jsonObject(with: data) as! [String: Any]
        let arr = json["points"] as! [[String: Any]]
        XCTAssertEqual(arr.count, 1)
        XCTAssertEqual(arr[0]["dayIndex"] as? Int, 20000)
        XCTAssertEqual(arr[0]["wordCount"] as? Int, 800)
    }
}
