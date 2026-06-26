import XCTest
@testable import LuminaLog

final class DraftEntryCodableTests: XCTestCase {
    func testRoundTrips() throws {
        let draft = DraftEntry(
            draftId: "d1",
            text: "hello",
            promptText: "What happened?",
            createdAtEpoch: 100,
            updatedAtEpoch: 200,
            attachments: [
                DraftAttachment(id: UUID(), kind: .photo, fileName: "a.jpg",
                                durationSec: nil, pixelWidth: 800, pixelHeight: 600, order: 0),
                DraftAttachment(id: UUID(), kind: .audio, fileName: "b.m4a",
                                durationSec: 3.5, pixelWidth: nil, pixelHeight: nil, order: 1),
            ]
        )
        let data = try JSONEncoder().encode(draft)
        let decoded = try JSONDecoder().decode(DraftEntry.self, from: data)
        XCTAssertEqual(decoded, draft)
        XCTAssertEqual(decoded.createdAt, Date(timeIntervalSince1970: 100))
        XCTAssertEqual(decoded.updatedAt, Date(timeIntervalSince1970: 200))
    }
}
