import XCTest
@testable import LuminaLog

@MainActor
final class RecordingSessionTests: XCTestCase {

    // Fake segment recorder: begin() records the target URL, end() returns it.
    final class FakeSegmentRecorder: SegmentRecording {
        var currentSegmentTime: TimeInterval = 0
        var levels: [CGFloat] = []
        var isActive: Bool { activeURL != nil }
        var beginError: Error?
        var beganURLs: [URL] = []
        private var activeURL: URL?

        func begin(url: URL) async throws {
            if let beginError { throw beginError }
            activeURL = url
            beganURLs.append(url)
        }
        func end() -> URL? { defer { activeURL = nil }; return activeURL }
        func deactivateSession() {}
    }

    // Fake merger: duration keyed by lastPathComponent; merge writes a stub file.
    final class FakeMerger: RecordingMerging {
        var durations: [String: TimeInterval] = [:]
        var mergedDuration: TimeInterval = 0
        func duration(of url: URL) async -> TimeInterval {
            durations[url.lastPathComponent] ?? mergedDuration
        }
        func merge(_ segments: [URL], to out: URL) async throws {
            try? Data("stub".utf8).write(to: out)
        }
    }

    private var dir: URL!
    private var drafts: DraftStore!
    private var recorder: FakeSegmentRecorder!
    private var merger: FakeMerger!
    private var session: RecordingSession!

    override func setUpWithError() throws {
        dir = FileManager.default.temporaryDirectory
            .appendingPathComponent("rs-\(UUID().uuidString)", isDirectory: true)
        drafts = DraftStore(directory: dir)
        recorder = FakeSegmentRecorder()
        merger = FakeMerger()
        session = RecordingSession(recorder: recorder, merger: merger)
        session.configure(draftId: "d1", drafts: drafts)
    }

    override func tearDownWithError() throws {
        try? FileManager.default.removeItem(at: dir)
    }

    func testStartEntersRecordingAndWritesManifest() async {
        let ok = await session.start()
        XCTAssertTrue(ok)
        XCTAssertEqual(session.state, .recording)
        XCTAssertEqual(drafts.load("d1")?.recording?.segmentFileNames, [])  // seg not ended yet
        XCTAssertEqual(recorder.beganURLs.first?.lastPathComponent, "rec-0.caf")
    }

    func testPermissionDenialSurfacesFlag() async {
        recorder.beginError = SegmentRecorderError.permissionDenied
        let ok = await session.start()
        XCTAssertFalse(ok)
        XCTAssertTrue(session.permissionDenied)
        XCTAssertEqual(session.state, .idle)
    }

    func testPauseFinalizesSegmentAndPersistsManifest() async {
        _ = await session.start()
        merger.durations["rec-0.caf"] = 4.0
        session.pause(reason: .interruption)
        XCTAssertEqual(session.state, .paused(.interruption))
        XCTAssertEqual(drafts.load("d1")?.recording?.segmentFileNames, ["rec-0.caf"])
        // cumulative reflects the finalized segment after async duration measure.
        try? await Task.sleep(nanoseconds: 50_000_000)
        XCTAssertEqual(session.cumulativeElapsed, 4.0, accuracy: 0.01)
    }

    func testResumeStartsNextSegment() async {
        _ = await session.start()
        session.pause(reason: .interruption)
        let ok = await session.resume()
        XCTAssertTrue(ok)
        XCTAssertEqual(session.state, .recording)
        XCTAssertEqual(recorder.beganURLs.map { $0.lastPathComponent }, ["rec-0.caf", "rec-1.caf"])
    }

    func testCumulativeElapsedSumsFinalizedPlusLiveSegment() async {
        _ = await session.start()
        merger.durations["rec-0.caf"] = 3.0
        session.pause(reason: .manual)
        try? await Task.sleep(nanoseconds: 50_000_000)
        _ = await session.resume()
        recorder.currentSegmentTime = 2.0
        session.refreshElapsed()
        XCTAssertEqual(session.cumulativeElapsed, 5.0, accuracy: 0.01)
    }

    func testStopMergesSegmentsClearsManifestReturnsAttachment() async {
        _ = await session.start()
        merger.durations["rec-0.caf"] = 3.0
        session.pause(reason: .manual)
        _ = await session.resume()
        merger.mergedDuration = 5.0   // merged output duration
        let audio = await session.stop()
        XCTAssertNotNil(audio)
        XCTAssertEqual(audio?.durationSec ?? 0, 5.0, accuracy: 0.01)
        XCTAssertEqual(audio?.url.pathExtension, "m4a")
        XCTAssertTrue(audio!.url.path.contains(FileManager.default.temporaryDirectory.lastPathComponent)
                      || audio!.url.path.hasPrefix(NSTemporaryDirectory()))
        XCTAssertNil(drafts.load("d1")?.recording, "manifest cleared on stop")
        XCTAssertEqual(session.state, .idle)
    }
}
