import XCTest
@testable import LuminaLog

final class StoryMapDayTests: XCTestCase {

    private let kl = TimeZone(identifier: "Asia/Kuala_Lumpur")!

    private func day(_ y: Int, _ m: Int, _ d: Int) -> Int {
        var cal = Calendar(identifier: .gregorian)
        cal.timeZone = TimeZone(identifier: "UTC")!
        return Int(floor(cal.date(from: DateComponents(year: y, month: m, day: d))!.timeIntervalSince1970 / 86_400))
    }

    private func at(_ iso: String) -> Date { ISO8601DateFormatter().date(from: iso)! }

    private func entry(_ id: String, _ iso: String, title: String, content: String = "Body") -> JournalEntry {
        JournalEntry(
            id: id, userId: "u", type: .text, title: title,
            createdAt: at(iso), updatedAt: at(iso), content: content,
            summary: content.trimmingCharacters(in: .whitespaces).isEmpty
                ? nil : AIGeneration(text: "Entry \(id)", generatedAt: at(iso))
        )
    }

    func testEarlyMorningInUTCPlus8IsOfferedOnTheLocalDay() {
        // 07:30 Sat 26 Sep in Kuala Lumpur is 23:30 UTC Fri 25 Sep.
        let early = entry("e1", "2026-09-25T23:30:00Z", title: "  ")
        XCTAssertEqual(StoryMapDay.entries(onDay: day(2026, 9, 26), from: [early], timeZone: kl).map(\.id), ["e1"])
        XCTAssertTrue(StoryMapDay.entries(onDay: day(2026, 9, 25), from: [early], timeZone: kl).isEmpty)
        XCTAssertEqual(StoryMapDay.chips([early], timeZone: kl), [StoryMapDayChip(id: "e1", label: "07:30")])
    }

    func testNewestFirstWithTitlesAndBlankEntriesDropped() {
        let all = [
            entry("morning", "2026-09-26T00:00:00Z", title: "Coffee"),        // 08:00 local
            entry("evening", "2026-09-26T12:00:00Z", title: "Evening walk"),  // 20:00 local
            entry("blank", "2026-09-26T06:00:00Z", title: "Draft", content: "   "),
        ]
        let onDay = StoryMapDay.entries(onDay: day(2026, 9, 26), from: all, timeZone: kl)
        XCTAssertEqual(onDay.map(\.id), ["evening", "morning"])
        XCTAssertEqual(StoryMapDay.chips(onDay, timeZone: kl).map(\.label), ["Evening walk", "Coffee"])
    }
}
