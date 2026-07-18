import UniformTypeIdentifiers
import XCTest
@testable import LuminaLog

final class UploadFileKindTests: XCTestCase {
    func testAudioTypesClassifyAsAudio() {
        XCTAssertEqual(UploadFileKind.classify(.mpeg4Audio), .audio)
        XCTAssertEqual(UploadFileKind.classify(.mp3), .audio)
        XCTAssertEqual(UploadFileKind.classify(.wav), .audio)
    }

    func testVideoTypesClassifyAsVideo() {
        XCTAssertEqual(UploadFileKind.classify(.mpeg4Movie), .video)
        XCTAssertEqual(UploadFileKind.classify(.quickTimeMovie), .video)
    }

    func testImageTypesClassifyAsImage() {
        XCTAssertEqual(UploadFileKind.classify(.jpeg), .image)
        XCTAssertEqual(UploadFileKind.classify(.png), .image)
        XCTAssertEqual(UploadFileKind.classify(.heic), .image)
    }

    func testUnsupportedAndNilClassifyAsUnsupported() {
        XCTAssertEqual(UploadFileKind.classify(.pdf), .unsupported)
        XCTAssertEqual(UploadFileKind.classify(nil), .unsupported)
    }

    func testAllowedContentTypesAreTheConservativeSet() {
        XCTAssertEqual(
            Set(UploadFileKind.allowedContentTypes),
            [.mpeg4Audio, .mp3, .wav, .mpeg4Movie, .quickTimeMovie, .jpeg, .png, .heic]
        )
    }
}
