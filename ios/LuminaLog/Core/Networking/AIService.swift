import Foundation

/// All AI features — backed by the proxy API in production
/// (routes per spec §4.1), canned responses in demo mode.
@MainActor
protocol AIService: AnyObject {

    /// Generate (and server-side persist) a summary for an entry.
    ///
    /// Insights and follow-up prompts are NOT generated on demand: the server
    /// produces them together with the summary in one call at index time and
    /// stores them on the entry (see `ensureEntryAIIndexed`). The Insights and
    /// Prompts tabs are read-only displays of those stored fields.
    func generateSummary(journalId: String) async throws -> AIGeneration

    /// Today's five personalized prompts — one per life area — generated in a
    /// single server-side LLM call. The client caches them for the day.
    func dailyPrompt() async throws -> [DailyPromptItem]

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

    /// The whole-corpus similarity graph (entries = nodes, summary-vector
    /// similarity = edges) for the global constellation map.
    func journalGraph() async throws -> JournalGraph

    /// Best-effort server-side purge of an entry's remote artifacts: S3 media
    /// objects, RAG chunk embeddings, and the summary embedding. Does NOT delete
    /// the Firestore record — the client owns that.
    func deleteEntry(journalId: String) async throws

    /// Full-corpus keyword search across all user journals (server-side).
    /// Returns up to 100 results newest-first, each with a decrypted snippet.
    func searchKeyword(query: String) async throws -> [SearchResult]

    /// Semantic vector search across journal chunks and summaries (server-side).
    /// Returns the top 20 results ranked by cosine similarity.
    func searchSemantic(query: String) async throws -> [SearchResult]

    /// Generates (or returns the cached) daily insights report for `date` ("yyyy-MM-dd", default today).
    func generateDailyReport(date: String?, force: Bool) async throws -> DailyInsightsReport
}

extension AIService {
    /// Default: the service does not persist chat messages, so the caller
    /// owns persistence. Only the production proxy overrides this to `true`.
    var persistsChatReplies: Bool { false }
}
