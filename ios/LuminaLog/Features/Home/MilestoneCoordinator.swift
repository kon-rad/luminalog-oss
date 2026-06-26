import Foundation

/// Decides when to present the 750-word milestone popup. Fires once per calendar
/// day (persisted), and only when the app-activity gate is open (`canPresent`).
/// Captures the date the goal was first reached so the popup copy can say
/// "today" only when it is still that day (the gate may open on a later day).
@MainActor
final class MilestoneCoordinator {
    /// Called when the popup should be presented; carries the "yyyy-MM-dd" date
    /// the goal was first reached.
    var onShouldPresent: ((_ earnedDate: String) -> Void)?

    private let uid: String
    private let target: Int
    private let defaults: UserDefaults
    private let today: () -> String   // "yyyy-MM-dd" in the user's timezone

    /// First day the target was crossed and not yet shown. Held until presented.
    private var earnedDate: String?

    init(uid: String, target: Int, defaults: UserDefaults = .standard, today: @escaping () -> String) {
        self.uid = uid; self.target = target; self.defaults = defaults; self.today = today
    }

    private var key: String { "milestoneShown.\(uid)" }
    private var alreadyShownToday: Bool { defaults.string(forKey: key) == today() }

    /// Call on every profile-stats emission and whenever the gate changes.
    /// - Parameters:
    ///   - goalWords: words journaled today.
    ///   - canPresent: the `AppActivityMonitor.canPresentInterruption` gate.
    func update(goalWords: Int, canPresent: Bool) {
        if alreadyShownToday { earnedDate = nil; return }
        if goalWords >= target, earnedDate == nil { earnedDate = today() }
        guard let earned = earnedDate, canPresent else { return }
        earnedDate = nil
        defaults.set(today(), forKey: key)
        onShouldPresent?(earned)
    }
}
