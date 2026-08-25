import Foundation

/// One AI-generated encouragement message, stored client-encrypted at
/// `dailyEncouragements/{uid}/messages/{dateKey}_{millis}_{index}`.
///
/// Five are generated each morning; three are delivered per day as local
/// notifications, oldest undelivered first, and anything still undelivered after
/// `EncouragementExpiry.days` is pruned. `deliveredAt` is set when the message is
/// handed to `UNUserNotificationCenter`, which is the closest signal the client
/// has: iOS never tells the app whether a notification was actually presented.
struct EncouragementMessage: Identifiable, Equatable, Sendable {
    /// Firestore document id. Lexical order is chronological (see `EncouragementIds`).
    var id: String
    /// Notification title. At most 40 characters so iOS does not truncate it.
    var title: String
    /// Notification body. At most 180 characters for the same reason.
    var body: String
    var createdAt: Date
    /// The slot fire time this message was scheduled into, or nil while queued.
    var deliveredAt: Date?

    var isDelivered: Bool { deliveredAt != nil }
}

/// Document-id construction and parsing, kept separate so the scheduling tests
/// can rely on ordering without touching Firestore.
enum EncouragementIds {

    /// `{yyyy-MM-dd}_{millisSince1970}_{index}` so that sorting document ids
    /// lexically sorts messages chronologically, the same trick
    /// `DailyReportRepository` uses. The millis are zero-padded to 13 digits so
    /// string comparison matches numeric comparison.
    static func documentId(dateKey: String, generatedAt: Date, index: Int) -> String {
        let millis = Int(generatedAt.timeIntervalSince1970 * 1000)
        let padded = String(format: "%013d", millis)
        return "\(dateKey)_\(padded)_\(index)"
    }

    /// The `yyyy-MM-dd` prefix of a document id, or "" if it is malformed.
    static func dateKeyPrefix(_ id: String) -> String {
        id.split(separator: "_").first.map(String.init) ?? ""
    }
}

/// How long an undelivered message stays in the queue before it is pruned.
enum EncouragementExpiry {
    static let days = 3
}
