import XCTest
@testable import LuminaLog

@MainActor
final class DraftStoreTests: XCTestCase {

    private func tempDir() -> URL {
        let u = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        try? FileManager.default.createDirectory(at: u, withIntermediateDirectories: true)
        return u
    }

    private func sample(_ id: String = "d1") -> DraftEntry {
        DraftEntry(draftId: id, text: "hi", promptText: nil,
                   createdAtEpoch: 1, updatedAtEpoch: 1, attachments: [])
    }

    func testUpsertAndLoadRoundTripAcrossInstances() throws {
        let dir = tempDir()
        let s1 = DraftStore(directory: dir)
        s1.upsert(sample())
        let s2 = DraftStore(directory: dir)             // simulates relaunch
        XCTAssertEqual(s2.load("d1"), sample())
        XCTAssertEqual(s2.all().map(\.draftId), ["d1"])
    }

    func testAllSortedNewestFirst() {
        let s = DraftStore(directory: tempDir())
        s.upsert(DraftEntry(draftId: "old", text: "a", promptText: nil,
                            createdAtEpoch: 1, updatedAtEpoch: 10, attachments: []))
        s.upsert(DraftEntry(draftId: "new", text: "b", promptText: nil,
                            createdAtEpoch: 1, updatedAtEpoch: 20, attachments: []))
        XCTAssertEqual(s.all().map(\.draftId), ["new", "old"])
    }

    func testPublishedDraftsUpdateOnUpsertAndDelete() {
        let s = DraftStore(directory: tempDir())
        s.upsert(sample())
        XCTAssertEqual(s.drafts.map(\.draftId), ["d1"])
        s.delete("d1")
        XCTAssertTrue(s.drafts.isEmpty)
    }

    func testSaveMediaThenDeleteRemovesMediaDir() throws {
        let dir = tempDir()
        let s = DraftStore(directory: dir)
        s.upsert(sample())
        let url = try s.saveMedia(draftId: "d1", fileName: "a.jpg", data: Data([1, 2, 3]))
        XCTAssertTrue(FileManager.default.fileExists(atPath: url.path))
        s.delete("d1")
        XCTAssertFalse(FileManager.default.fileExists(atPath: url.path))
        XCTAssertNil(s.load("d1"))
    }

    func testImportMediaCopiesFile() throws {
        let dir = tempDir()
        let s = DraftStore(directory: dir)
        s.upsert(sample())
        let src = tempDir().appendingPathComponent("src.m4a")
        try Data([9, 9]).write(to: src)
        let dest = try s.importMedia(draftId: "d1", fileName: "b.m4a", from: src)
        XCTAssertEqual(try Data(contentsOf: dest), Data([9, 9]))
    }

    func testUnsafeDraftIdIsRejected() {
        let s = DraftStore(directory: tempDir())
        s.upsert(DraftEntry(draftId: "../escape", text: "x", promptText: nil,
                            createdAtEpoch: 1, updatedAtEpoch: 1, attachments: []))
        XCTAssertTrue(s.all().isEmpty)                  // unsafe id is a safe no-op
    }
}
