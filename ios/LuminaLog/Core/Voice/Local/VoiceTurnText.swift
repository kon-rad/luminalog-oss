import Foundation

/// Splits a streamed LLM reply into speakable sentences so text-to-speech can
/// start on the first sentence while the rest is still arriving.
struct VoiceSentenceChunker {

    /// Sentences shorter than this are held and joined with the next one, so
    /// "Hi." or "1." is not synthesized as its own clip.
    private let minimumLength: Int
    private var buffer = ""

    init(minimumLength: Int = 12) {
        self.minimumLength = minimumLength
    }

    /// Feed one streamed delta; returns every sentence it completed.
    mutating func feed(_ delta: String) -> [String] {
        buffer += delta
        var out: [String] = []
        while let end = Self.sentenceEnd(in: buffer, minimumLength: minimumLength) {
            let sentence = buffer[..<end].trimmingCharacters(in: .whitespacesAndNewlines)
            buffer = String(buffer[end...])
            if !sentence.isEmpty { out.append(sentence) }
        }
        return out
    }

    /// The trailing text once the stream is over (may lack end punctuation).
    mutating func flush() -> String? {
        let rest = buffer.trimmingCharacters(in: .whitespacesAndNewlines)
        buffer = ""
        return rest.isEmpty ? nil : rest
    }

    /// Index just past the first sentence terminator that is followed by
    /// whitespace. Requiring the following whitespace keeps "3.5" and "e.g."
    /// mid-token from splitting, and means the final sentence waits for `flush`.
    private static func sentenceEnd(in text: String, minimumLength: Int) -> String.Index? {
        var index = text.startIndex
        var count = 0
        while index < text.endIndex {
            let character = text[index]
            let next = text.index(after: index)
            count += 1
            if character == "\n" && count > minimumLength {
                return next
            }
            if ".!?".contains(character), next < text.endIndex, count >= minimumLength {
                // Swallow closing quotes or brackets that belong to the sentence.
                var end = next
                while end < text.endIndex, "\"')]”’".contains(text[end]) {
                    end = text.index(after: end)
                }
                if end < text.endIndex, text[end].isWhitespace {
                    return end
                }
            }
            index = next
        }
        return nil
    }
}

/// Text rules shared by the local voice call.
enum VoiceTurnText {

    /// Spoken locally the instant the call connects. Mirrors the server's
    /// `buildFirstMessage` (vapi.ts), which `PROMPTS.voiceChat` assumes was said.
    static func firstMessage(name: String) -> String {
        let trimmed = name.trimmingCharacters(in: .whitespacesAndNewlines)
        let who = trimmed.isEmpty ? "" : ", \(trimmed)"
        return "Hi\(who). I'm your private AI journal companion. What's on your mind?"
    }

    /// Spoken when the reply cannot be fetched. The call stays up and stays local:
    /// there is no fallback to another provider or to a cloud voice service.
    static let unreachableLine = "I can't reach the model right now. Give me a moment and try again."

    private static let backchannelWords: Set<String> = [
        "yeah", "yes", "yep", "yup", "no", "nope", "ok", "okay", "sure", "right",
        "mhm", "mm", "mmhmm", "uh", "uhhuh", "huh", "oh", "ah", "hm", "hmm", "um", "er",
        "thanks", "thank", "you", "cool", "nice", "wow", "true", "exactly", "totally",
        "i", "see", "got", "it", "good", "great", "fine", "well", "so", "and",
    ]

    /// True when a turn is pure backchannel ("yeah", "mhm", "got it") and so cannot
    /// usefully drive retrieval. Same conservative rule as the server's
    /// `isBackchannel` (ADR-0109): at most 3 words, every one of them filler.
    static func isBackchannel(_ text: String) -> Bool {
        let cleaned = text.lowercased().map { character -> Character in
            (character.isLetter && character.isASCII) || character == "'" || character.isWhitespace ? character : " "
        }
        let words = String(cleaned).split(whereSeparator: \.isWhitespace).map { $0.replacingOccurrences(of: "'", with: "") }
        if words.isEmpty { return true }
        if words.count > 3 { return false }
        return words.allSatisfy { backchannelWords.contains($0) }
    }
}

/// Body of `POST /v1/ai/voice-turn`. Everything is plaintext built on device;
/// there is deliberately no audio and no key field.
struct VoiceTurnRequest: Encodable, Equatable {
    struct Turn: Encodable, Equatable {
        let role: String
        let content: String
    }

    let chatId: String
    let message: String
    let history: [Turn]
    var name: String?
    var bio: String?
    var profile: [String: String]?
    var todayContext: String?
    var ragContext: String?
    var memoryContext: String?
    var focalEntry: String?
    var now: String?

    /// How many prior messages ride along with each turn.
    static let historyLimit = 20

    init(
        chatId: String,
        message: String,
        history: [ChatMessage],
        context: VoiceCallContext?,
        ragContext: String,
        now: String
    ) {
        self.chatId = chatId
        self.message = message
        self.history = history.suffix(Self.historyLimit).map {
            Turn(role: $0.role == .assistant ? "assistant" : "user", content: $0.text)
        }
        self.name = context?.name
        self.bio = context?.bio
        self.profile = context?.profile
        self.todayContext = context?.todayContext
        self.memoryContext = context?.memoryContext
        self.focalEntry = context?.focalEntry
        // Per-turn retrieval wins; fall back to the call-start retrieval when the
        // turn has none (backchannel, slow search, empty index).
        self.ragContext = ragContext.isEmpty ? context?.ragContext : ragContext
        self.now = now
    }
}
