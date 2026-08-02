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

    /// Staged upload ciphertext must live in a DURABLE location (Application
    /// Support/PendingUploads), NOT the purgeable temporary directory — otherwise a
    /// bad-connection upload's bytes can be purged across relaunches and become
    /// unrecoverable (regression guard for the "Upload didn't finish / Retry does
    /// nothing" bug).
    func testStagingDirectoryIsDurableNotTemp() throws {
        let dir = ProxyMediaUploader.stagingDirectory()
        XCTAssertTrue(dir.path.contains("PendingUploads"), "should stage under PendingUploads")

        let appSupport = FileManager.default.urls(for: .applicationSupportDirectory, in: .userDomainMask)[0]
        XCTAssertTrue(dir.path.hasPrefix(appSupport.path), "must be under Application Support (durable)")

        let tmp = FileManager.default.temporaryDirectory.path
        XCTAssertFalse(dir.path.hasPrefix(tmp), "must NOT be under the purgeable temporary directory")

        XCTAssertTrue(FileManager.default.fileExists(atPath: dir.path), "directory should be created")

        // Excluded from iCloud backup (transient upload artifact).
        let values = try dir.resourceValues(forKeys: [.isExcludedFromBackupKey])
        XCTAssertEqual(values.isExcludedFromBackup, true)
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
