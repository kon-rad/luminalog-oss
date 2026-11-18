import Foundation

/// Wall-clock helpers for voice calls.
enum VoiceCallClock {

    /// Device-local wall clock, e.g. `2026-07-13 14:29 PDT`. Sent to the server so
    /// `PROMPTS.voiceChat` can anchor the assistant's "today"/"now" against the
    /// local timestamps carried in each journal block.
    static func localNowStamp(_ date: Date = Date(), timeZone: TimeZone = .current) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = "yyyy-MM-dd HH:mm zzz"
        return formatter.string(from: date)
    }
}

/// Thread-safe one-shot guard so exactly one of two racing tasks resumes a
/// continuation (resuming a `CheckedContinuation` twice would crash). Used by
/// `ProxyAIService.withBudget` to race a search against its timeout.
final class ResumeOnce: @unchecked Sendable {
    private let lock = NSLock()
    private var claimed = false
    func claim() -> Bool {
        lock.lock(); defer { lock.unlock() }
        if claimed { return false }
        claimed = true
        return true
    }
}
