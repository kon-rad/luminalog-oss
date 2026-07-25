import AVFoundation
import XCTest
@testable import LuminaLog

@MainActor
final class DraftStoreRecordingTests: XCTestCase {

    private var dir: URL!
    private var store: DraftStore!

    override func setUpWithError() throws {
        dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("dstore-\(UUID().uuidString)", isDirectory: true)
        store = DraftStore(directory: dir)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: dir)
    }

    private func writeSilentCAF(seconds: Double, to url: URL) throws {
        let settings: [String: Any] = [
            AVFormatIDKey: Int(kAudioFormatMPEG4AAC),
            AVSampleRateKey: 44_100,
            AVNumberOfChannelsKey: 1,
            AVEncoderAudioQualityKey: AVAudioQuality.high.rawValue,
        ]
        let file = try AVAudioFile(forWriting: url, settings: settings)
        let frames = AVAudioFrameCount(seconds * 44_100)
        let buffer = AVAudioPCMBuffer(pcmFormat: file.processingFormat, frameCapacity: frames)!
        buffer.frameLength = frames
        try file.write(from: buffer)
    }

    func testUpdateRecordingPreservesExistingTextAndAttachments() {
        store.upsert(DraftEntry(draftId: "d1", text: "hello", promptText: nil,
                                createdAtEpoch: 1, updatedAtEpoch: 1, attachments: []))
        store.updateRecording(draftId: "d1",
                              DraftRecording(segmentFileNames: ["rec-0.caf"], isFinalized: false))
        let loaded = store.load("d1")
        XCTAssertEqual(loaded?.text, "hello")
        XCTAssertEqual(loaded?.recording?.segmentFileNames, ["rec-0.caf"])
    }

    func testUpdateRecordingNilClearsManifest() {
        store.upsert(DraftEntry(draftId: "d1", text: "hi", promptText: nil,
                                createdAtEpoch: 1, updatedAtEpoch: 1, attachments: [],
                                recording: DraftRecording(segmentFileNames: ["rec-0.caf"], isFinalized: false)))
        store.updateRecording(draftId: "d1", nil)
        XCTAssertNil(store.load("d1")?.recording)
    }

    func testRecoverySweepConvertsDanglingRecordingToVoiceDraft() async throws {
        // Two segment fixtures in the draft media dir.
        let mediaDir = store.mediaDirectory(for: "d1")!
        try FileManager.default.createDirectory(at: mediaDir, withIntermediateDirectories: true)
        try writeSilentCAF(seconds: 1.0, to: mediaDir.appendingPathComponent("rec-0.caf"))
        try writeSilentCAF(seconds: 2.0, to: mediaDir.appendingPathComponent("rec-1.caf"))
        store.upsert(DraftEntry(draftId: "d1", text: "", promptText: nil,
                                createdAtEpoch: 1, updatedAtEpoch: 1, attachments: [],
                                recording: DraftRecording(segmentFileNames: ["rec-0.caf", "rec-1.caf"],
                                                          isFinalized: false)))

        await store.recoverDanglingRecordings(using: RecordingMerger())

        let recovered = store.load("d1")
        XCTAssertNil(recovered?.recording, "manifest should be cleared after recovery")
        XCTAssertEqual(recovered?.attachments.count, 1)
        let audio = recovered?.attachments.first
        XCTAssertEqual(audio?.kind, .audio)
        XCTAssertEqual(audio?.durationSec ?? 0, 3.0, accuracy: 0.5)
        // Merged file exists in the media dir.
        XCTAssertNotNil(store.mediaURL(draftId: "d1", fileName: audio!.fileName))
    }

    func testRecoverySweepIgnoresFinalizedManifests() async {
        store.upsert(DraftEntry(draftId: "d1", text: "hi", promptText: nil,
                                createdAtEpoch: 1, updatedAtEpoch: 1, attachments: [],
                                recording: DraftRecording(segmentFileNames: ["rec-0.caf"], isFinalized: true)))
        await store.recoverDanglingRecordings(using: RecordingMerger())
        // A finalized manifest is left for normal loading paths; not swept here.
        XCTAssertEqual(store.load("d1")?.recording?.isFinalized, true)
    }
}
