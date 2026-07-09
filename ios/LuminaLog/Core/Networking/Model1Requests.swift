import Foundation

/// Plaintext request bodies + context assembly for the server "Model 1"
/// (zero-knowledge) AI path — increment 1c-C of the encryption migration.
///
/// On this path the client decrypts its own context locally (entries, bio,
/// profile, chat history via the existing repositories/`UserKeyStore`) and sends
/// it as PLAINTEXT; the server never touches the DEK. Everything here is used
/// only when `DevFlags.aiModel1` is ON — OFF in production until the 1d cutover,
/// so the legacy ID-based request shape is unchanged today.
///
/// The field names below mirror the server contract EXACTLY:
/// - chat:         server/src/routes/chat.ts       (name, bio, profile, history[], journalContext, focalEntry)
/// - summary:      server/src/routes/ai.ts          (content, type)
/// - daily-prompt: server/src/routes/ai.ts          (entries[], profile, name)
/// - daily-report: server/src/routes/dailyReport.ts (todayText, relatedContext, sourceEntryIds, name)
/// Do NOT rename a field here without changing the matching server branch.
///
/// This type is a **pure** value: no networking, no Firestore, no crypto, no
/// global state, and it never reads `Date()` internally (callers inject `now`),
/// so it is deterministically unit-testable.
enum Model1Requests {

    // MARK: - Profile fields (server `ProfileFields`)

    /// The onboarding profile as the server's `ProfileFields` object
    /// (services/profileContext.ts). Only non-empty fields are included — the
    /// server treats a missing key the same as an empty value.
    static func profileFields(from details: UserProfile.ProfileDetails) -> [String: String] {
        var out: [String: String] = [:]
        func add(_ key: String, _ value: String?) {
            guard let trimmed = value?.trimmingCharacters(in: .whitespacesAndNewlines),
                  !trimmed.isEmpty else { return }
            out[key] = trimmed
        }
        add("goals", details.goals)
        add("hobbies", details.hobbies)
        add("age", details.age)
        add("gender", details.gender)
        add("challenges", details.challenges)
        add("dailyHabits", details.dailyHabits)
        add("starSign", details.starSign)
        add("maritalStatus", details.maritalStatus)
        add("location", details.location)
        add("education", details.education)
        add("work", details.work)
        add("favoriteMovies", details.favoriteMovies)
        add("favoriteArtists", details.favoriteArtists)
        add("favoriteBooks", details.favoriteBooks)
        add("languages", details.languages)
        add("friendsDescribe", details.friendsDescribe)
        return out
    }

    // MARK: - Request bodies

    /// Model-1 chat body. Presence of the `history` array is what triggers the
    /// server's Model-1 branch (legacy clients never send one).
    struct ChatBody: Encodable {
        let chatId: String
        let message: String
        let name: String
        let bio: String
        let profile: [String: String]
        let history: [Turn]
        let journalContext: String
        let focalEntry: String?

        struct Turn: Encodable {
            let role: String
            let content: String
        }
    }

    /// Model-1 summary body. Presence of `content` triggers the server branch.
    struct SummaryBody: Encodable {
        /// Still sent so the legacy server (flag off) can fall back to it.
        let journalId: String
        let content: String
        let type: String
    }

    /// Model-1 daily-prompt body. Presence of `entries` triggers the server branch.
    struct DailyPromptBody: Encodable {
        let name: String
        let profile: [String: String]
        let entries: [Entry]

        struct Entry: Encodable {
            let id: String
            let type: String
            let title: String
            let content: String
        }
    }

    /// Model-1 daily-report body. Presence of `todayText` triggers the server branch.
    struct DailyReportBody: Encodable {
        let date: String?
        let force: Bool
        let name: String
        let todayText: String
        let relatedContext: String
        let sourceEntryIds: [String]
    }

    // MARK: - Assembly helpers

    /// Recent chat turns mapped to `{role, content}`, capped at `limit`.
    ///
    /// On the Model-1 chat path the client persists the just-sent user message
    /// BEFORE calling the AI, so it is already in `messages`. The server appends
    /// the current `message` itself, so we drop a trailing user turn equal to
    /// `excludingLatest` to avoid duplicating it in the prompt.
    static func historyTurns(
        from messages: [ChatMessage],
        excludingLatest latest: String?,
        limit: Int = 10
    ) -> [ChatBody.Turn] {
        var msgs = messages
        if let latest, let last = msgs.last, last.role == .user, last.text == latest {
            msgs.removeLast()
        }
        return msgs.suffix(limit).map { ChatBody.Turn(role: $0.role.rawValue, content: $0.text) }
    }

    /// Daily-prompt entry projections from the user's most-recent decrypted entries.
    static func promptEntries(
        from entries: [JournalEntry],
        limit: Int = 5,
        snippetChars: Int = 500
    ) -> [DailyPromptBody.Entry] {
        entries.prefix(limit).map { entry in
            DailyPromptBody.Entry(
                id: entry.id,
                type: entry.type.rawValue,
                title: entry.title.isEmpty ? "Untitled" : entry.title,
                content: String(entry.content.prefix(snippetChars))
            )
        }
    }

    /// Client-side RAG context string, mirroring the server retriever's format
    /// (journalRetriever.ts): `[#i — type · title · date]\n<snippet>` blocks
    /// joined by a blank line. Ranks with `EntryRetriever` (keyword + recency).
    ///
    /// This is the pure keyword path — kept as the fallback for the semantic
    /// overload below (and covered by its own tests). It is byte-identical to the
    /// pre-1c-D behavior.
    static func journalContext(
        from entries: [JournalEntry],
        query: String,
        now: Date,
        topK: Int = 5,
        snippetChars: Int = 500,
        retriever: EntryRetriever = EntryRetriever()
    ) -> String {
        let top = retriever.topK(topK, matching: query, in: entries, now: now)
        return format(top, snippetChars: snippetChars)
    }

    /// Semantic-first RAG context string (increment 1c-D / 19b). When `searcher`
    /// is non-nil it embeds `query`, takes the top-`topK` entry ids by cosine
    /// similarity, and formats the matching entries in that ranked order. Falls
    /// back to the pure keyword `journalContext` above whenever the semantic path
    /// yields nothing usable — an empty index, a thrown error, or ids that don't
    /// resolve to any of the supplied `entries` — so it is a HYBRID that is never
    /// worse than today. Passing `searcher: nil` is exactly the keyword path.
    ///
    /// Callers only reach this with a non-nil `searcher` when `DevFlags.aiModel1`
    /// is ON; with the flag OFF the legacy sync keyword path runs unchanged.
    static func journalContext(
        from entries: [JournalEntry],
        query: String,
        now: Date,
        topK: Int = 5,
        snippetChars: Int = 500,
        retriever: EntryRetriever = EntryRetriever(),
        searcher: SemanticIndexCoordinating?
    ) async -> String {
        if let searcher,
           let ids = try? await searcher.search(query: query, k: topK), !ids.isEmpty {
            let byId = Dictionary(entries.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
            let ranked = ids.compactMap { byId[$0] }
            if !ranked.isEmpty {
                return format(ranked, snippetChars: snippetChars)
            }
        }
        // Hybrid fallback: identical to the legacy keyword path.
        let top = retriever.topK(topK, matching: query, in: entries, now: now)
        return format(top, snippetChars: snippetChars)
    }

    /// Format ranked entries into the server-shaped RAG block string. Shared by the
    /// keyword and semantic paths so their output is byte-identical for the same
    /// entry ordering.
    private static func format(_ entries: [JournalEntry], snippetChars: Int) -> String {
        entries.enumerated().map { index, entry in
            let date = dayFormatter.string(from: entry.createdAt)
            let title = entry.title.isEmpty ? "Untitled" : entry.title
            let snippet = String(entry.content.prefix(snippetChars))
            return "[#\(index + 1) — \(entry.type.rawValue) · \(title) · \(date)]\n\(snippet)"
        }.joined(separator: "\n\n")
    }

    /// `yyyy-MM-dd` in UTC — matches the server's `indexedAt.slice(0, 10)` shape.
    static let dayFormatter: DateFormatter = {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter
    }()
}
