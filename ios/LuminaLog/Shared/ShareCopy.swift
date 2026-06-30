import Foundation

/// User-facing share text. Client-side UI copy only — this is unrelated to the
/// server's LLM system prompts (which live in the server's `prompts.ts`).
enum ShareCopy {
    /// Default caption carried by the system share sheet and the X deep link.
    static let reportCardCaption = "Reflecting on my day with LuminaLog ☀️ #LuminaLog"
}
