import Foundation

/// One of Mirror's three fixed daily delivery windows. Each carries its own
/// tone (see `PROMPTS.mirrorEcho` server-side): morning is about intention and
/// grounding, afternoon about calibration and momentum, evening about
/// decompression and synthesis.
enum TimeOfDay: String, Sendable {
    case morning, afternoon, evening

    /// Shown on the Message History row ("Morning", "Afternoon", "Evening").
    var label: String { rawValue.capitalized }
}

/// One AI-generated Mirror Echo: a single sentence written for one time-of-day
/// slot, stored client-encrypted at
/// `dailyEncouragements/{uid}/messages/{dateKey}_{timeOfDay}`.
///
/// Exactly one is generated per slot per day (never a queue, never a rollover):
/// a slot either gets today's echo, or it is skipped. `deliveredAt` is set when
/// the message is handed to `UNUserNotificationCenter`, which is the closest
/// signal the client has: iOS never tells the app whether a notification was
/// actually presented.
struct EncouragementMessage: Identifiable, Equatable, Sendable {
    /// Firestore document id. Lexical order is chronological (see `EncouragementIds`).
    var id: String
    var timeOfDay: TimeOfDay
    /// The Echo sentence. At most 220 characters so iOS does not truncate it.
    var text: String
    var createdAt: Date
    /// The slot fire time this message was scheduled into, or nil until armed.
    var deliveredAt: Date?

    var isDelivered: Bool { deliveredAt != nil }
}

/// Document-id construction and parsing, kept separate so the scheduling tests
/// can rely on ordering without touching Firestore.
enum EncouragementIds {

    /// `{yyyy-MM-dd}_{timeOfDay}`: one document per slot per day, so a re-run of
    /// the same day's cycle overwrites rather than duplicates.
    static func documentId(dateKey: String, timeOfDay: TimeOfDay) -> String {
        "\(dateKey)_\(timeOfDay.rawValue)"
    }

    /// The `yyyy-MM-dd` prefix of a document id, or "" if it is malformed.
    static func dateKeyPrefix(_ id: String) -> String {
        id.split(separator: "_").first.map(String.init) ?? ""
    }
}
