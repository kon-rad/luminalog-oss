import XCTest
@testable import LuminaLog

final class CreditPackTests: XCTestCase {

    func testMinutesIsSixPerCredit() {
        let pack = CreditPack(id: "com.luminalog.credits.5", credits: 5, price: "$4.99", popular: false)
        XCTAssertEqual(CreditPack.minutesPerCredit, 6)
        XCTAssertEqual(pack.minutes, 30)
    }

    func testLargePackMinutes() {
        let pack = CreditPack(id: "com.luminalog.credits.50", credits: 50, price: "$49.99", popular: false)
        XCTAssertEqual(pack.minutes, 300)
    }
}
