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

    /// True when `streamChatReply` ALSO persists both the user message and the
    /// assistant reply to the chat store server-side (the production proxy,
    /// spec §5.4). When true the view model must NOT persist either side
    /// itself — otherwise every message is written twice and the conversation
    /// shows each message and reply doubled. Demo mode never writes back, so it
    /// leaves this `false` (the extension default) and the view model persists.
    var persistsChatReplies: Bool { get }

    /// Fire-and-forget request to (re)index an entry into the RAG store.
    /// Failures are swallowed; a server-side reconcile retries later.
    func requestIndex(journalId: String) async

    /// Server-side transcription via Together AI Whisper for voice/video entries.
    /// Downloads audio from S3, transcribes, updates Firestore
    /// content+transcriptStatus to ready, then re-indexes to Chroma.
    /// Throws on network or server error; the entry stays with
    /// transcriptStatus = failed when the server itself catches the error.
    func transcribeJournal(journalId: String) async throws

    /// Transcribe a recorded audio clip without persisting anything.
    /// POSTs raw audio bytes to `/v1/ai/transcribe-clip`; returns the transcript
    /// text. Used by the transcript editor to turn a voice memo into text.
    func transcribeClip(audio: Data, contentType: String) async throws -> String

    /// The 20 most semantically similar other entries (summary-embedding search).
    func relatedEntries(journalId: String, limit: Int) async throws -> [RelatedEntry]

    /// Best-effort server-side purge of an entry's remote artifacts: S3 media
    /// objects, RAG chunk embeddings, and the summary embedding. Does NOT delete
    /// the Firestore record — the client owns that.
    func deleteEntry(journalId: String) async throws
}

extension AIService {
    /// Default: the service does not persist chat messages, so the caller
    /// owns persistence. Only the production proxy overrides this to `true`.
    var persistsChatReplies: Bool { false }
}
