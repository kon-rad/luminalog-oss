import Foundation

/// All AI features — backed by the proxy API in production
/// (routes per spec §4.1), canned responses in demo mode.
@MainActor
protocol AIService: AnyObject {

    /// Generate (and server-side persist) a summary for an entry.
    func generateSummary(journalId: String) async throws -> AIGeneration

    /// Generate (and server-side persist) insights for an entry.
    func generateInsights(journalId: String) async throws -> AIGeneration

    /// Generate 5 follow-up journaling prompts for an entry.
    func generatePrompts(journalId: String) async throws -> [String]

    /// Today's personalized prompt (server caches one per day).
    func dailyPrompt() async throws -> String

    /// Streaming assistant reply — yields token/word deltas as they arrive.
    func streamChatReply(chatId: String, message: String) -> AsyncThrowingStream<String, Error>

    /// Fire-and-forget request to (re)index an entry into the RAG store.
    /// Failures are swallowed; a server-side reconcile retries later.
    func requestIndex(journalId: String) async

    /// Server-side transcription via Together AI Whisper for voice/video entries.
    /// Downloads audio from S3, transcribes, updates Firestore
    /// content+transcriptStatus to ready, then re-indexes to Chroma.
    /// Throws on network or server error; the entry stays with
    /// transcriptStatus = failed when the server itself catches the error.
    func transcribeJournal(journalId: String) async throws
}
