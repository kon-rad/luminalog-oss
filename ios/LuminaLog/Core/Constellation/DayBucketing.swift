import Foundation

struct DayBucket {
    let dayIndex: Int
    let date: String
    /// The day's entries as (id, text) so a caller can reuse an already-computed
    /// vector by id before falling back to embedding the text.
    let entries: [(id: String, text: String)]
    let wordTotal: Int
}

/// Groups journal entries into UTC calendar days (matching the server's
/// `dayIndex = days since epoch` convention) and derives per-day totals.
enum DayBucketing {
    static func dayIndex(for date: Date) -> Int {
        Int(floor(date.timeIntervalSince1970 / 86_400))
    }

    static func dateString(forDayIndex index: Int) -> String {
        let d = Date(timeIntervalSince1970: Double(index) * 86_400)
        let f = DateFormatter()
        f.calendar = Calendar(identifier: .gregorian)
        f.timeZone = TimeZone(identifier: "UTC")
        f.dateFormat = "yyyy-MM-dd"
        return f.string(from: d)
    }

    static func bucket(entries: [(id: String, text: String, wordCount: Int, createdAt: Date)]) -> [DayBucket] {
        var byDay: [Int: (entries: [(id: String, text: String)], words: Int)] = [:]
        for e in entries {
            let i = dayIndex(for: e.createdAt)
            var slot = byDay[i] ?? (entries: [], words: 0)
            slot.entries.append((id: e.id, text: e.text))
            slot.words += e.wordCount
            byDay[i] = slot
        }
        return byDay.keys.sorted().map { i in
            DayBucket(dayIndex: i, date: dateString(forDayIndex: i),
                      entries: byDay[i]!.entries, wordTotal: byDay[i]!.words)
        }
    }

    /// Consecutive-day run length ending at each qualifying day (input sorted ascending).
    static func streaks(sortedQualifyingDayIndices days: [Int]) -> [Int: Int] {
        var out: [Int: Int] = [:]
        var run = 0
        var prev: Int? = nil
        for d in days {
            run = (prev != nil && d == prev! + 1) ? run + 1 : 1
            out[d] = run
            prev = d
        }
        return out
    }
}
