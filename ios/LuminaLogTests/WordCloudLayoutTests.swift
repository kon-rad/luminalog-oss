import XCTest
import SwiftUI
@testable import LuminaLog

final class WordCloudLayoutTests: XCTestCase {

    func testFontSizeMapsFrequencyToRange() {
        // Min frequency → min size; max frequency → max size.
        XCTAssertEqual(wordCloudFontSize(count: 1, minCount: 1, maxCount: 10), 14, accuracy: 0.01)
        XCTAssertEqual(wordCloudFontSize(count: 10, minCount: 1, maxCount: 10), 44, accuracy: 0.01)
        // A mid value lands between.
        let mid = wordCloudFontSize(count: 5, minCount: 1, maxCount: 10)
        XCTAssertTrue(mid > 14 && mid < 44)
    }

    func testFontSizeHandlesUniformFrequency() {
        // All words equal → a single mid-size, no divide-by-zero.
        let size = wordCloudFontSize(count: 4, minCount: 4, maxCount: 4)
        XCTAssertEqual(size, 24, accuracy: 0.01)
    }
}
