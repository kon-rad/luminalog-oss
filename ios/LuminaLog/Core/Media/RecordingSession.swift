import AVFoundation
import Combine
import Foundation

/// Owns an in-progress, multi-segment voice recording: drives the segment
/// recorder, handles forced interruptions (pause + wait for user), keeps a
/// durable manifest on the draft, reports true cumulative duration, and merges
/// segments into one `.m4a` on stop. Replaces `AudioRecorderController` for the
/// Create-entry flow (that class still backs the JournalDetail transcript
/// re-record flow in `TranscriptEditorView`).
@MainActor
final class RecordingSession: ObservableObject {

    enum PauseReason: Equatable { case interruption, manual }
    enum State: Equatable { case idle, recording, paused(PauseReason) }

    @Published private(set) var state: State = .idle {
        didSet { RecordingState.shared.setRecording(state != .idle) }
    }
    @Published private(set) var cumulativeElapsed: TimeInterval = 0
    @Published private(set) var levels: [CGFloat] = []
    /// Set when mic permission is denied (view shows the Settings alert).
    @Published var permissionDenied = false

    var isRecording: Bool { state == .recording }
    var isActive: Bool { state != .idle }

    var elapsedLabel: String {
        let s = Int(cumulativeElapsed)
        return String(format: "%d:%02d", s / 60, s % 60)
    }

    private let recorder: SegmentRecording
    private let merger: RecordingMerging

    private var draftId: String = ""
    private var drafts: DraftStore?

    /// The in-flight background merge started by `finishAndBeginMerge()`, if any.
    /// `awaitPendingMerge()` awaits its result; multiple awaiters share it.
    private var mergeTask: Task<AudioAttachment?, Never>?

    /// Ordered finalized segment filenames (mirrors the persisted manifest).
    private var segmentFileNames: [String] = []
    /// Summed duration of finalized segments (measured from disk).
    private var finalizedDuration: TimeInterval = 0
    private var timer: Timer?
    private var interruptionObserver: NSObjectProtocol?

    convenience init() {
        self.init(recorder: SegmentRecorder(), merger: RecordingMerger())
    }

    init(recorder: SegmentRecording, merger: RecordingMerging) {
        self.recorder = recorder
        self.merger = merger
    }

    deinit {
        if let interruptionObserver {
            NotificationCenter.default.removeObserver(interruptionObserver)
        }
    }

    func configure(draftId: String, drafts: DraftStore) {
        self.draftId = draftId
        self.drafts = drafts
    }

    // MARK: Lifecycle

    func start() async -> Bool {
        guard state == .idle else { return false }
        segmentFileNames = []
        finalizedDuration = 0
        cumulativeElapsed = 0
        observeInterruptions()
        return await beginSegment()
    }

    func resume() async -> Bool {
        guard case .paused = state else { return false }
        return await beginSegment()
    }

    private func beginSegment() async -> Bool {
        guard let drafts,
              let url = drafts.recordingSegmentURL(draftId: draftId, index: segmentFileNames.count)
        else { return false }
        do {
            try await recorder.begin(url: url)
            // Persist an (unchanged) manifest so the draft json exists immediately.
            persistManifest(isFinalized: false)
            state = .recording
            startTimer()
            return true
        } catch SegmentRecorderError.permissionDenied {
            permissionDenied = true
            state = .idle
            return false
        } catch {
            state = .idle
            return false
        }
    }

    /// Finalizes the current segment (if any) and enters `paused`. The audio
    /// session is deactivated; resume() reactivates it. Idempotent when not
    /// recording (safe if the interruption + a view backstop both fire).
    func pause(reason: PauseReason) {
        guard state == .recording else { return }
        stopTimer()
        finalizeCurrentSegment()
        recorder.deactivateSession()
        state = .paused(reason)
    }

    /// Finalizes the recording and returns to `.idle` **synchronously**, then
    /// merges the segments into one `.m4a` on a background task. Returning to
    /// `.idle` immediately is what lets the UI dismiss the recorder panel and
    /// un-gray Save the instant Stop is tapped — the (potentially slow)
    /// `AVAssetExportSession` merge no longer blocks the button. The merged clip
    /// is retrieved with `awaitPendingMerge()`.
    ///
    /// Segments + manifest are retained until the merge SUCCEEDS: on failure the
    /// recorder returns to `.paused(.manual)` (so the panel re-presents and the
    /// launch recovery sweep can retry) rather than losing the audio.
    func finishAndBeginMerge() {
        guard state == .recording || isPaused else { return }
        stopTimer()
        if state == .recording { finalizeCurrentSegment(); recorder.deactivateSession() }

        let urls = segmentFileNames.compactMap { drafts?.mediaURL(draftId: draftId, fileName: $0) }
        // Idle immediately so `isActive` is false the moment Stop is tapped.
        state = .idle
        guard !urls.isEmpty else {
            clearManifestAndSegments()
            mergeTask = nil
            return
        }
        mergeTask = Task { [weak self] in
            await self?.performMerge(urls) ?? nil
        }
    }

    /// Awaits the background merge started by `finishAndBeginMerge()`. Returns the
    /// merged clip, or nil when there was no in-flight merge (e.g. a text entry)
    /// or the merge failed. Safe to call from multiple sites — they share one
    /// task and see the same result. The task is consumed (cleared) once awaited so
    /// a later Save (after the clip was already attached, or after the user removed
    /// it) can't re-attach a stale result.
    func awaitPendingMerge() async -> AudioAttachment? {
        let result = await mergeTask?.value ?? nil
        mergeTask = nil
        return result
    }

    /// Runs the actual segment merge (background). On success clears the manifest
    /// and returns the clip; on failure re-enters `.paused(.manual)` and preserves
    /// the segments for recovery.
    private func performMerge(_ urls: [URL]) async -> AudioAttachment? {
        let out = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(UUID().uuidString).m4a")
        do {
            try await merger.merge(urls, to: out)
            let duration = await merger.duration(of: out)
            clearManifestAndSegments()   // only on success
            return AudioAttachment(url: out, durationSec: duration)
        } catch {
            // A cancelled merge (explicit discard) must not resurrect `.paused`.
            guard !Task.isCancelled else { return nil }
            // Preserve segments + manifest so the launch recovery sweep can retry
            // the merge; surface as paused so the UI re-presents the panel.
            state = .paused(.manual)
            return nil
        }
    }

    /// Discards the whole in-progress recording (segments + manifest).
    func cancel() {
        stopTimer()
        // Drop any in-flight merge so a late failure can't flip us back to
        // `.paused` after this explicit discard.
        mergeTask?.cancel()
        mergeTask = nil
        if recorder.isActive { _ = recorder.end() }
        recorder.deactivateSession()
        clearManifestAndSegments()
        removeInterruptionObserver()
        state = .idle
    }

    func refreshElapsed() {
        let live = state == .recording ? recorder.currentSegmentTime : 0
        cumulativeElapsed = finalizedDuration + live
        levels = recorder.levels
    }

    // MARK: Internals

    private var isPaused: Bool { if case .paused = state { return true }; return false }

    private func finalizeCurrentSegment() {
        guard let url = recorder.end() else { return }
        let name = url.lastPathComponent
        segmentFileNames.append(name)
        persistManifest(isFinalized: false)
        // Measure the finalized segment's true duration off the timer.
        Task { [weak self] in
            guard let self else { return }
            let d = await self.merger.duration(of: url)
            self.finalizedDuration += d
            self.refreshElapsed()
        }
    }

    private func persistManifest(isFinalized: Bool) {
        drafts?.updateRecording(
            draftId: draftId,
            DraftRecording(segmentFileNames: segmentFileNames, isFinalized: isFinalized)
        )
    }

    private func clearManifestAndSegments() {
        for name in segmentFileNames {
            if let u = drafts?.mediaURL(draftId: draftId, fileName: name) {
                try? FileManager.default.removeItem(at: u)
            }
        }
        segmentFileNames = []
        finalizedDuration = 0
        drafts?.updateRecording(draftId: draftId, nil)
        removeInterruptionObserver()
    }

    private func startTimer() {
        stopTimer()
        timer = Timer.scheduledTimer(withTimeInterval: 0.05, repeats: true) { [weak self] _ in
            MainActor.assumeIsolated { self?.refreshElapsed() }
        }
    }

    private func stopTimer() { timer?.invalidate(); timer = nil }

    private func observeInterruptions() {
        removeInterruptionObserver()
        interruptionObserver = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { [weak self] note in
            guard
                let raw = note.userInfo?[AVAudioSessionInterruptionTypeKey] as? UInt,
                AVAudioSession.InterruptionType(rawValue: raw) == .began
            else { return }   // .ended → no auto-resume (user chose manual)
            MainActor.assumeIsolated { self?.pause(reason: .interruption) }
        }
    }

    private func removeInterruptionObserver() {
        if let interruptionObserver {
            NotificationCenter.default.removeObserver(interruptionObserver)
            self.interruptionObserver = nil
        }
    }
}
