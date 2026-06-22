import Foundation

/// Detects today's word count crossing the daily target and decides when to
/// present the milestone popup: once per calendar day (persisted), deferred
/// until any active recording finishes.
@MainActor
final class MilestoneCoordinator {
    var onShouldPresent: (() -> Void)?

    private let uid: String
    private let target: Int
    private let defaults: UserDefaults
    private let today: () -> String   // "yyyy-MM-dd" in the user's timezone

    private var pending = false       // crossed, waiting for recording to end

    init(uid: String, target: Int, defaults: UserDefaults = .standard, today: @escaping () -> String) {
        self.uid = uid; self.target = target; self.defaults = defaults; self.today = today
    }

    private var key: String { "milestoneShown.\(uid)" }
    private var alreadyShownToday: Bool { defaults.string(forKey: key) == today() }

    /// Call on every profile-stats emission (and when recording state flips).
    func update(goalWords: Int, isRecording: Bool) {
        if alreadyShownToday { pending = false; return }
        if goalWords >= target { pending = true }
        guard pending, !isRecording else { return }
        pending = false
        defaults.set(today(), forKey: key)
        onShouldPresent?()
    }
}
