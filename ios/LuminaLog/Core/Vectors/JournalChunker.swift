import Foundation

/// Deterministic, side-effect-free journal chunker. The SAME function runs at
/// index time (to produce the chunks the server embeds) and at retrieval time (to
/// re-extract `chunk[chunkIndex]` from a decrypted entry), so identical `content`
/// always yields identical chunks — no offsets are ever stored. Chunking over
/// `Array(content)` (grapheme clusters) keeps index and retrieval byte-for-byte
/// aligned within Swift. Bump `version` (and re-index) if this algorithm changes;
/// it mirrors the server's `CHUNKER_VERSION`.
enum JournalChunker {
    static let version = 1

    /// Entries at or under this many characters are stored as a single chunk.
    static let shortThreshold = 500
    /// Maximum characters per chunk when splitting a longer entry.
    static let chunkSize = 600
    /// Characters shared between adjacent chunks (context at boundaries).
    static let overlap = 100

    /// Split `content` into an ordered list of chunks. Empty/whitespace-only input
    /// yields no chunks. Short input yields exactly `[content]`. Longer input slides
    /// a `chunkSize` window forward by `chunkSize - overlap` each step.
    static func chunks(of content: String) -> [String] {
        let trimmed = content.trimmingCharacters(in: .whitespacesAndNewlines)
        if trimmed.isEmpty { return [] }

        let chars = Array(content)
        if chars.count <= shortThreshold { return [content] }

        let step = chunkSize - overlap
        var out: [String] = []
        var start = 0
        while start < chars.count {
            let end = min(start + chunkSize, chars.count)
            out.append(String(chars[start..<end]))
            if end == chars.count { break }
            start += step
        }
        return out
    }
}
