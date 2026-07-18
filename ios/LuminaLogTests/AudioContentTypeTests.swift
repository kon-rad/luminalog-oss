import XCTest
@testable import LuminaLog

final class AudioContentTypeTests: XCTestCase {
    func testKnownExtensionsMapToMime() {
        XCTAssertEqual(AudioContentType.mime(forPathExtension: "m4a"), "audio/m4a")
        XCTAssertEqual(AudioContentType.mime(forPathExtension: "mp3"), "audio/mpeg")
        XCTAssertEqual(AudioContentType.mime(forPathExtension: "wav"), "audio/wav")
    }

    func testExtensionIsCaseInsensitive() {
        XCTAssertEqual(AudioContentType.mime(forPathExtension: "MP3"), "audio/mpeg")
        XCTAssertEqual(AudioContentType.mime(forPathExtension: "WAV"), "audio/wav")
    }

    func testUnknownOrEmptyExtensionFallsBackToM4A() {
        XCTAssertEqual(AudioContentType.mime(forPathExtension: "aiff"), "audio/m4a")
        XCTAssertEqual(AudioContentType.mime(forPathExtension: ""), "audio/m4a")
    }
}
