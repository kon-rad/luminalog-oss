import Foundation

enum StoryPromptType: String, CaseIterable {
    case scene, title, wisdom, choice, connection, tellSomeone, energy, yourself

    var layer: String {
        switch self {
        case .scene, .title, .wisdom: return "author"
        case .choice, .connection, .tellSomeone: return "agent"
        case .energy, .yourself: return "actor"
        }
    }
    var fallback: DailyPromptItem {
        let pair: (String, String)
        switch self {
        case .scene: pair = ("Scene", "What is one moment from today you would want to remember?")
        case .title: pair = ("Title the day", "If today were a chapter, what would you call it?")
        case .wisdom: pair = ("Wisdom", "What is one thing you handled well today?")
        case .choice: pair = ("Deliberate choice", "What is one thing you deliberately chose to do today?")
        case .connection: pair = ("Connection", "What moment with another person stands out from today?")
        case .tellSomeone: pair = ("Tell someone", "What moment from today would you like to tell someone about?")
        case .energy: pair = ("Energy", "What is one thing that gave you energy today?")
        case .yourself: pair = ("Most like yourself", "When did you feel most like yourself today?")
        }
        return DailyPromptItem(area: pair.0, text: pair.1, storyType: rawValue)
    }
}

/// Local, account-scoped preferences contain type identifiers only.
struct StoryPromptRotation {
    var defaults: UserDefaults = .standard
    let userID: String
    var calendar: Calendar = .current
    private var prefix: String { "story-prompts.\(userID)." }
    var muted: Set<String> { Set(defaults.stringArray(forKey: prefix + "muted") ?? []) }
    func dayKey(_ date: Date) -> String {
        let c = calendar.dateComponents([.era, .year, .month, .day], from: date)
        return "\(c.era ?? 0)-\(c.year ?? 0)-\(c.month ?? 0)-\(c.day ?? 0)"
    }
    func mute(_ type: String) {
        defaults.set(Array(muted.union([type])), forKey: prefix + "muted")
    }
    func restore() { defaults.removeObject(forKey: prefix + "muted") }

    func selection(on date: Date) -> StoryPromptType? {
        let available = StoryPromptType.allCases.filter { !muted.contains($0.rawValue) }
        guard !available.isEmpty else { return nil }
        var history = defaults.dictionary(forKey: prefix + "history") as? [String: String] ?? [:]
        let today = dayKey(date)
        if let cached = history[today].flatMap(StoryPromptType.init(rawValue:)), available.contains(cached) { return cached }
        let previous = (1...6).compactMap { days -> String? in
            guard let d = calendar.date(byAdding: .day, value: -days, to: date) else { return nil }
            return history[dayKey(d)]
        }
        let weekday = calendar.component(.weekday, from: date)
        // Sun: agent, Mon: author, Tue: agent, Wed: author, Thu: agent,
        // Fri: actor, Sat: author. Weekends prefer gentle scene/connection.
        let layer = ["agent", "author", "agent", "author", "agent", "actor", "author"][weekday - 1]
        let day = calendar.ordinality(of: .day, in: .era, for: date) ?? 0
        let preferred = available.filter { $0.layer == layer }
        let eligible = available.filter { $0.rawValue != previous.first }
        let underCap = eligible.filter { candidate in previous.filter { $0 == candidate.rawValue }.count < 2 }
        let candidates = underCap.isEmpty ? (eligible.isEmpty ? available : eligible) : underCap
        let preferredCandidates = candidates.filter { preferred.contains($0) }
        let pool = preferredCandidates.isEmpty ? candidates : preferredCandidates
        let weekend: StoryPromptType? = weekday == 7 ? .scene : (weekday == 1 ? .connection : nil)
        let chosen = weekend.flatMap { pool.contains($0) ? $0 : nil } ?? pool[(day / 7 + weekday) % pool.count]
        // Bounded seven-day history, not usage analytics.
        let keep = Set((0...6).compactMap { offset in calendar.date(byAdding: .day, value: -offset, to: date).map(dayKey) })
        history = history.filter { keep.contains($0.key) }
        history[today] = chosen.rawValue
        defaults.set(history, forKey: prefix + "history")
        return chosen
    }
}
