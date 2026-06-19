import Foundation

/// The daily journaling goal. ~3 handwritten pages ≈ "Morning Pages"
/// (Julia Cameron) ≈ 750 words. Fixed (not user-configurable) — single
/// source of truth for the goal-gated streak (DailyGoalStreak) and the
/// Home progress UI.
enum DailyGoal {
    static let wordTarget = 750
}
