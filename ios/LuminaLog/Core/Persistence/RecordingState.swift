import Foundation

/// App-wide "is a voice/video recording in progress" signal, so the milestone
/// popup can be deferred until recording finishes.
@MainActor
final class RecordingState: ObservableObject {
    static let shared = RecordingState()
    @Published private(set) var isRecording = false
    func setRecording(_ value: Bool) { isRecording = value }
}
