import Foundation

/// The six period-summary tiers, bottom-up.
/// Spec: docs/superpowers/specs/2026-09-26-period-summaries-design.md.
enum PeriodSummaryType: String, CaseIterable, Sendable {
    case day, week, month, quarter, year, all

    /// Generation order when two ready periods cover the same latest day: a day
    /// before its week, a week before its month.
    var rank: Int { Self.allCases.firstIndex(of: self)! }

    /// The tier this tier is summarized from. Weeks and months are both built from
    /// days because ISO weeks straddle month boundaries. Nil for `day`, whose
    /// inputs are entries.
    var childType: PeriodSummaryType? {
        switch self {
        case .day: return nil
        case .week, .month: return .day
        case .quarter: return .month
        case .year: return .quarter
        case .all: return .year
        }
    }
}

/// One period: its tier plus its index in that tier's encoding (see `PeriodSummaryIndex.key`).
struct PeriodKey: Hashable, Sendable, CustomStringConvertible {
    let type: PeriodSummaryType
    let index: Int

    init(_ type: PeriodSummaryType, _ index: Int) {
        self.type = type
        self.index = index
    }

    /// Firestore document id: `{type}_{index}`, e.g. `week_202639`.
    var docId: String { "\(type.rawValue)_\(index)" }

    init?(docId: String) {
        let parts = docId.split(separator: "_", maxSplits: 1)
        guard parts.count == 2,
              let type = PeriodSummaryType(rawValue: String(parts[0])),
              let index = Int(parts[1]) else { return nil }
        self.init(type, index)
    }

    var description: String { docId }
}

/// Period math for summaries. Days are LOCAL days in the user's profile timezone,
/// unlike `ServerSemanticIndex.dayIndex(for:)` (UTC), which files anything written
/// before 08:00 in UTC+8 under yesterday. Every higher tier reuses `PeriodIndex`,
/// which only needs a day index.
enum PeriodSummaryIndex {

    private static let utc: Calendar = {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        return cal
    }()

    /// Days since the Unix epoch of `date`'s calendar day in `timeZone`. Mirrors the
    /// server's `dailyGoalStreak.dayIndex(date, tz)`: the local (y, m, d) re-encoded
    /// as a UTC midnight, so it feeds straight into `PeriodIndex`, which reads
    /// (y, m, d) back with a UTC calendar.
    static func localDayIndex(for date: Date, in timeZone: TimeZone) -> Int {
        var local = Calendar(identifier: .gregorian)
        local.timeZone = timeZone
        let c = local.dateComponents([.year, .month, .day], from: date)
        let midnight = utc.date(from: DateComponents(year: c.year, month: c.month, day: c.day))!
        return Int(floor(midnight.timeIntervalSince1970 / 86_400))
    }

    /// The period of `type` containing day `dayIndex`.
    static func key(_ type: PeriodSummaryType, forDay dayIndex: Int) -> PeriodKey {
        switch type {
        case .day: return PeriodKey(.day, dayIndex)
        case .week: return PeriodKey(.week, PeriodIndex.weekIndex(forDayIndex: dayIndex))
        case .month: return PeriodKey(.month, PeriodIndex.monthIndex(forDayIndex: dayIndex))
        case .quarter: return PeriodKey(.quarter, PeriodIndex.quarterIndex(forDayIndex: dayIndex))
        case .year: return PeriodKey(.year, PeriodIndex.yearIndex(forDayIndex: dayIndex))
        case .all: return PeriodKey(.all, PeriodIndex.lifetimeIndex)
        }
    }

    /// Whether `key` is the period containing `today`, i.e. still in progress.
    /// `all` always is.
    static func isOpen(_ key: PeriodKey, today: Int) -> Bool {
        key == self.key(key.type, forDay: today)
    }

    static func dayOfMonth(_ dayIndex: Int) -> Int {
        utc.component(.day, from: date(forDay: dayIndex))
    }

    /// `Sat 26 Sep 2026`.
    static func dayLabel(_ dayIndex: Int) -> String {
        format(dayIndex, "EEE d MMM yyyy")
    }

    /// Human label for a period, sent to the model and shown in the voice ladder.
    /// `sampleDay` is any day inside the period: the week label needs it to find the
    /// Monday, the month label needs it for the name.
    static func label(for key: PeriodKey, sampleDay: Int) -> String {
        switch key.type {
        case .day:
            return dayLabel(key.index)
        case .week:
            let weekday = utc.component(.weekday, from: date(forDay: sampleDay)) // 1 = Sunday
            let mondayBasedDow = (weekday + 5) % 7
            return "Week of \(dayLabel(sampleDay - mondayBasedDow))"
        case .month:
            return format(sampleDay, "MMMM yyyy")
        case .quarter:
            return "Q\(key.index % 4 + 1) \(key.index / 4)"
        case .year:
            return "\(key.index)"
        case .all:
            return "All time"
        }
    }

    private static func date(forDay dayIndex: Int) -> Date {
        Date(timeIntervalSince1970: TimeInterval(dayIndex) * 86_400)
    }

    private static func format(_ dayIndex: Int, _ pattern: String) -> String {
        let formatter = DateFormatter()
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = TimeZone(identifier: "UTC")
        formatter.dateFormat = pattern
        return formatter.string(from: date(forDay: dayIndex))
    }
}
