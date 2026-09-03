import Foundation

/// Period-index functions for the zoom pyramid's week/month/quarter/year tiers,
/// ported from `server/src/services/periodCentroid/periodIndex.ts`. Must stay
/// byte-for-byte equivalent to that file: both server and client filter entries
/// into the same tiers from the same `dayIndex`, and any drift here silently
/// misfiles a day into the wrong week/month/quarter/year on this client only.
///
/// `dayIndex` (see `ServerSemanticIndex.dayIndex(for:)`) is UTC days-since-epoch.
/// Every function here recovers (y, m, d) with UTC calendar components, exactly
/// like the server's `dateForDayIndex`, so no timezone parameter is needed.
enum PeriodIndex {
    static let lifetimeIndex = 0

    private static var utcCalendar: Calendar = {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        return cal
    }()

    private static func date(forDayIndex dayIndex: Int) -> Date {
        Date(timeIntervalSince1970: TimeInterval(dayIndex) * 86_400)
    }

    /// `year * 12 + zeroBasedMonth`.
    static func monthIndex(forDayIndex dayIndex: Int) -> Int {
        let comps = utcCalendar.dateComponents([.year, .month], from: date(forDayIndex: dayIndex))
        return comps.year! * 12 + (comps.month! - 1)
    }

    /// `year * 4 + zeroBasedQuarter`.
    static func quarterIndex(forDayIndex dayIndex: Int) -> Int {
        let comps = utcCalendar.dateComponents([.year, .month], from: date(forDayIndex: dayIndex))
        return comps.year! * 4 + (comps.month! - 1) / 3
    }

    /// The calendar year.
    static func yearIndex(forDayIndex dayIndex: Int) -> Int {
        utcCalendar.component(.year, from: date(forDayIndex: dayIndex))
    }

    /// The day-index of the Thursday of the ISO week containing `dayIndex`.
    static func thursdayDayIndex(forDayIndex dayIndex: Int) -> Int {
        let d = date(forDayIndex: dayIndex)
        let weekday = utcCalendar.component(.weekday, from: d) // 1 = Sunday ... 7 = Saturday
        let mondayBasedDow = (weekday + 5) % 7 // Mon = 0 .. Sun = 6
        let thursday = utcCalendar.date(byAdding: .day, value: 3 - mondayBasedDow, to: d)!
        return Int(floor(thursday.timeIntervalSince1970 / 86_400))
    }

    /// `isoYear * 100 + isoWeek`, per ISO 8601 (weeks start Monday, week 1 contains
    /// the year's first Thursday).
    static func weekIndex(forDayIndex dayIndex: Int) -> Int {
        let thursdayIdx = thursdayDayIndex(forDayIndex: dayIndex)
        let thursday = date(forDayIndex: thursdayIdx)
        let isoYear = utcCalendar.component(.year, from: thursday)

        var jan4Comps = DateComponents()
        jan4Comps.year = isoYear; jan4Comps.month = 1; jan4Comps.day = 4
        let jan4 = utcCalendar.date(from: jan4Comps)!
        let jan4Weekday = utcCalendar.component(.weekday, from: jan4)
        let jan4MondayBasedDow = (jan4Weekday + 5) % 7
        let week1Monday = utcCalendar.date(byAdding: .day, value: -jan4MondayBasedDow, to: jan4)!

        let days = utcCalendar.dateComponents([.day], from: week1Monday, to: thursday).day!
        let isoWeek = Int((Double(days) / 7.0).rounded()) + 1
        return isoYear * 100 + isoWeek
    }
}