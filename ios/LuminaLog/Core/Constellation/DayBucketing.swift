import Foundation

struct DayBucket {
    let dayIndex: Int
    let date: String
    let texts: [String]
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

    static func bucket(entries: [(text: String, wordCount: Int, createdAt: Date)]) -> [DayBucket] {
        var byDay: [Int: (texts: [String], words: Int)] = [:]
        for e in entries {
            let i = dayIndex(for: e.createdAt)
            var slot = byDay[i] ?? (texts: [], words: 0)
            slot.texts.append(e.text)
            slot.words += e.wordCount
            byDay[i] = slot
        }
        return byDay.keys.sorted().map { i in
            DayBucket(dayIndex: i, date: dateString(forDayIndex: i),
                      texts: byDay[i]!.texts, wordTotal: byDay[i]!.words)
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
