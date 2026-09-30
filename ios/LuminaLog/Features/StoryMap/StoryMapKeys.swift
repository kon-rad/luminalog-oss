import Foundation

/// One dot address in the zoom pyramid: its tier name (`"lifetime"`, `"year"`,
/// `"quarter"`, `"month"`, `"week"`, `"day"`) and index in that tier's encoding.
struct PyramidTarget: Hashable, Sendable {
    let periodType: String
    let periodIndex: Int
}

/// Translation between the pyramid's addresses and period summary keys.
/// Spec: docs/superpowers/specs/2026-09-28-story-map-design.md, "Key translation".
/// Both use `PeriodIndex` encodings; they differ in the top tier's name (`lifetime`
/// vs `all`) and in month/quarter/year membership (Thursday-anchored weeks vs
/// calendar days), which the caption accepts by showing the calendar label.
enum StoryMapKeys {

    /// The summary for a pyramid dot, or nil for a tier name this build doesn't know.
    static func summaryKey(periodType: String, periodIndex: Int) -> PeriodKey? {
        switch periodType {
        case "lifetime": return PeriodKey(.all, 0)
        case "day": return PeriodKey(.day, periodIndex)
        case "week": return PeriodKey(.week, periodIndex)
        case "month": return PeriodKey(.month, periodIndex)
        case "quarter": return PeriodKey(.quarter, periodIndex)
        case "year": return PeriodKey(.year, periodIndex)
        default: return nil
        }
    }

    /// Where the Map opens for a period chosen in the Story view.
    static func pyramidTarget(for key: PeriodKey) -> PyramidTarget {
        key.type == .all
            ? PyramidTarget(periodType: "lifetime", periodIndex: PeriodIndex.lifetimeIndex)
            : PyramidTarget(periodType: key.type.rawValue, periodIndex: key.index)
    }

    /// A day inside `key` (its first day), for `PeriodSummaryIndex.label(for:sampleDay:)`.
    /// `all` returns 0, which its label ignores.
    static func sampleDay(for key: PeriodKey) -> Int {
        switch key.type {
        case .day:
            return key.index
        case .week:
            // ISO: week 1 is the week holding 4 January; weeks start on Monday.
            let jan4 = dayIndex(year: key.index / 100, month: 1, day: 4)
            let weekday = utc.component(.weekday, from: date(forDay: jan4))   // 1 = Sunday
            let mondayBasedDow = (weekday + 5) % 7
            return jan4 - mondayBasedDow + (key.index % 100 - 1) * 7
        case .month:
            return dayIndex(year: key.index / 12, month: key.index % 12 + 1, day: 1)
        case .quarter:
            return dayIndex(year: key.index / 4, month: (key.index % 4) * 3 + 1, day: 1)
        case .year:
            return dayIndex(year: key.index, month: 1, day: 1)
        case .all:
            return 0
        }
    }

    private static let utc: Calendar = {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        return cal
    }()

    private static func dayIndex(year: Int, month: Int, day: Int) -> Int {
        let date = utc.date(from: DateComponents(year: year, month: month, day: day))!
        return Int(floor(date.timeIntervalSince1970 / 86_400))
    }

    private static func date(forDay dayIndex: Int) -> Date {
        Date(timeIntervalSince1970: TimeInterval(dayIndex) * 86_400)
    }
}
