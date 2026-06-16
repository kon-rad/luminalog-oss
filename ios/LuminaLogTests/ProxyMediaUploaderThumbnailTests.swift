import XCTest
import UIKit
@testable import LuminaLog

final class ProxyMediaUploaderThumbnailTests: XCTestCase {

    private func writeJPEG(width: Int, height: Int) throws -> URL {
        let size = CGSize(width: width, height: height)
        let renderer = UIGraphicsImageRenderer(size: size)
        let image = renderer.image { ctx in
            UIColor.systemTeal.setFill()
            ctx.fill(CGRect(origin: .zero, size: size))
        }
        let data = try XCTUnwrap(image.jpegData(compressionQuality: 0.9))
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("thumb-src-\(UUID().uuidString).jpg")
        try data.write(to: url)
        return url
    }

    func testThumbnailRespectsMaxEdge() throws {
        let src = try writeJPEG(width: 2000, height: 1000)
        defer { try? FileManager.default.removeItem(at: src) }

        let data = try XCTUnwrap(ProxyMediaUploader.thumbnailData(from: src, maxEdge: 400))
        let image = try XCTUnwrap(UIImage(data: data))
        let maxSide = max(image.size.width * image.scale, image.size.height * image.scale)
        XCTAssertLessThanOrEqual(maxSide, 400, "longest edge should be downscaled to <= maxEdge")
        XCTAssertGreaterThan(maxSide, 0)
    }

    func testThumbnailReturnsNilForNonImage() throws {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("not-an-image-\(UUID().uuidString).bin")
        try Data("not an image".utf8).write(to: url)
        defer { try? FileManager.default.removeItem(at: url) }

        XCTAssertNil(ProxyMediaUploader.thumbnailData(from: url, maxEdge: 400))
    }
}
