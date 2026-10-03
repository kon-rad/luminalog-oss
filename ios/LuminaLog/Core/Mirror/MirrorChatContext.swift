import Foundation

/// Builds the context a chat or voice call about one Mirror reflection starts
/// with: the reflection itself plus the journal excerpts it was written from,
/// exactly as the model saw them. The generation instructions are left out:
/// they tell a model how to write an echo and would confuse a conversation.
enum MirrorChatContext {

    static func focalText(message: EncouragementMessage, inputs: MirrorInputs?, timeZone: TimeZone = .current) -> String {
        let posted = message.deliveredAt ?? message.createdAt
        var text = "MIRROR REFLECTION (a one-sentence reflection Argo sent the user as a \(message.timeOfDay.label) notification on \(format(posted, "yyyy-MM-dd", timeZone)) at \(format(posted, "h:mm a", timeZone)); the user wants to talk about it):\n\(message.text)"
        if let sources = inputs?.sources, !sources.isEmpty {
            let blocks = sources.map { source in
                "[\(source.type) · \(source.title) · \(format(source.createdAt, "yyyy-MM-dd", timeZone))]\n\(source.content)"
            }
            text += "\n\nIT WAS WRITTEN FROM THESE JOURNAL ENTRIES (exact excerpts the model saw):\n"
                + blocks.joined(separator: "\n\n---\n\n")
        }
        return text
    }

    /// "Mirror · Morning, Oct 3": the chat's display label.
    static func chatLabel(_ message: EncouragementMessage, timeZone: TimeZone = .current) -> String {
        "Mirror · \(message.timeOfDay.label), \(format(message.deliveredAt ?? message.createdAt, "MMM d", timeZone))"
    }

    private static func format(_ date: Date, _ pattern: String, _ timeZone: TimeZone) -> String {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = pattern
        return formatter.string(from: date)
    }
}
