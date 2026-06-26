import Foundation

/// App-wide source of truth for whether it is safe to interrupt the user with a
/// modal (e.g. the 750-word milestone popup). Aggregates every "busy" signal so
/// interruptions are held until the user is back on an idle Home screen.
///
/// "Not in a voice call" and "not composing" come for free from
/// `presentedSurfaceCount`: a voice/text chat call and the Create screen are
/// always presented surfaces, so the gate is closed while any is up.
@MainActor
final class AppActivityMonitor: ObservableObject {

    /// True when the Home tab is the selected tab.
    @Published private(set) var isOnHomeTab = true
    /// Number of interrupting surfaces currently presented (CreateEntry,
    /// JournalDetail, voice/text chat covers). Zero means none.
    @Published private(set) var presentedSurfaceCount = 0
    /// True while an audio/video recording is in progress.
    @Published private(set) var isRecording = false
    /// True while any entry is still uploading/transcribing/saving.
    @Published private(set) var isProcessingEntry = false

    /// The single gate: only true when the user is on an idle Home screen with
    /// nothing recording, presented, or processing.
    var canPresentInterruption: Bool {
        isOnHomeTab
            && presentedSurfaceCount == 0
            && !isRecording
            && !isProcessingEntry
    }

    func setOnHomeTab(_ value: Bool) { isOnHomeTab = value }
    func beginSurface() { presentedSurfaceCount += 1 }
    func endSurface() { presentedSurfaceCount = max(0, presentedSurfaceCount - 1) }
    func setRecording(_ value: Bool) { isRecording = value }
    func setProcessingEntry(_ value: Bool) { isProcessingEntry = value }
}
