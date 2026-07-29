import XCTest
@testable import LuminaLog

@MainActor
final class DraftMediaHydratorTests: XCTestCase {

    private func tempDir() -> URL {
        let u = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try? FileManager.default.createDirectory(at: u, withIntermediateDirectories: true)
        return u
    }

    func testHydrateTextOnlyDraftHasNoAttachments() {
        let store = DraftStore(directory: tempDir())
        let draft = DraftEntry(draftId: "d1", text: "hi", promptText: nil,
                               createdAtEpoch: 1, updatedAtEpoch: 1, attachments: [])
        store.upsert(draft)
        let result = DraftMediaHydrator.hydrate(draft: draft, store: store)
        XCTAssertTrue(result.attachments.isEmpty)
        XCTAssertTrue(result.hydratedDescriptorIds.isEmpty)
    }

    func testHydrateAudioDraftProducesAudioAttachmentFromTempCopy() throws {
        let store = DraftStore(directory: tempDir())
        let draftId = "d2"
        // Stage a fake audio file into the draft media dir.
        let src = FileManager.default.temporaryDirectory.appendingPathComponent("\(UUID().uuidString).m4a")
        try Data([0, 1, 2, 3]).write(to: src)
        let audioId = UUID()
        let fileName = "\(audioId.uuidString).m4a"
        _ = try store.importMedia(draftId: draftId, fileName: fileName, from: src)
        let desc = DraftAttachment(id: audioId, kind: .audio, fileName: fileName,
                                   durationSec: 5, pixelWidth: nil, pixelHeight: nil, order: 0)
        let draft = DraftEntry(draftId: draftId, text: "", promptText: nil,
                               createdAtEpoch: 1, updatedAtEpoch: 1, attachments: [desc])
        store.upsert(draft)

        let result = DraftMediaHydrator.hydrate(draft: draft, store: store)

        XCTAssertNotNil(result.attachments.audio, "audio attachment must be materialized")
        XCTAssertTrue(result.hydratedDescriptorIds.contains(audioId))
        // Must point at a temp copy, NOT the durable draft media (so pipeline
        // cleanup never deletes the retry source).
        let audioURL = try XCTUnwrap(result.attachments.audio?.url)
        XCTAssertFalse(audioURL.path.contains("/Drafts/"), "hydrated audio must be a temp copy")
        XCTAssertTrue(FileManager.default.fileExists(atPath: audioURL.path))
        // The durable draft media still exists after hydration.
        XCTAssertNotNil(store.mediaURL(draftId: draftId, fileName: fileName))
    }
}
