import XCTest
@testable import LuminaLog

@MainActor
final class AudioRecorderControllerTests: XCTestCase {

    func testAppendMeterSampleNormalizesDecibelsToUnitRange() {
        let controller = AudioRecorderController()

        controller.appendMeterSample(power: 0)     // loudest → 1.0
        controller.appendMeterSample(power: -50)   // floor   → 0.0
        controller.appendMeterSample(power: -200)  // below floor clamps → 0.0
        controller.appendMeterSample(power: -25)   // midpoint → 0.5

        XCTAssertEqual(controller.levels[0], 1.0, accuracy: 0.0001)
        XCTAssertEqual(controller.levels[1], 0.0, accuracy: 0.0001)
        XCTAssertEqual(controller.levels[2], 0.0, accuracy: 0.0001)
        XCTAssertEqual(controller.levels[3], 0.5, accuracy: 0.0001)
    }

    func testLevelsBufferCapsAtMaxSamples() {
        let controller = AudioRecorderController()

        for _ in 0..<(AudioRecorderController.maxLevelSamples + 20) {
            controller.appendMeterSample(power: -10)
        }

        XCTAssertEqual(controller.levels.count, AudioRecorderController.maxLevelSamples)
    }
}
