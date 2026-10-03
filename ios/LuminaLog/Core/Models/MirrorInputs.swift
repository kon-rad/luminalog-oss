import Foundation

/// One journal entry exactly as it was sent to the model for a Mirror batch:
/// the excerpt, not the entry's current text, which may have been edited since.
struct MirrorSource: Codable, Equatable, Sendable {
    let id: String
    let type: String
    let title: String
    let createdAt: Date
    let content: String
}

/// The exact prompt `/v1/ai/daily-mirror` sent to the model. Absent from older servers.
struct MirrorPrompt: Decodable, Equatable, Sendable {
    let system: String
    let user: String
    let model: String
    let attempts: Int
    /// Raw slot names whose text is canned fallback, not model output.
    let fallbackSlots: [String]
}

/// Everything that went into one day's Mirror batch, stored client-encrypted at
/// `dailyEncouragements/{uid}/inputs/{dateKey}`. The three messages of that day
/// share it. `system`/`user`/`model`/`attempts` are nil when the server predates
/// the `prompt` field.
struct MirrorInputs: Equatable, Sendable {
    var dateKey: String
    var sources: [MirrorSource]
    var system: String?
    var user: String?
    var model: String?
    var attempts: Int?
    var fallbackSlots: [TimeOfDay]
    var createdAt: Date
}
