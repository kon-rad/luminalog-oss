import XCTest
@testable import LuminaLog

final class StoryPromptRotationTests: XCTestCase {
    private var defaults: UserDefaults!
    private var suite: String!
    private var calendar: Calendar!
    override func setUp() {
        suite = "story-tests-" + UUID().uuidString
        defaults = UserDefaults(suiteName: suite)!
        calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(secondsFromGMT: 0)!
    }
    override func tearDown() { defaults.removePersistentDomain(forName: suite) }
    private var monday: Date { calendar.date(from: DateComponents(year: 2026, month: 11, day: 16))! }

    func testRotationMixStableAcrossRelaunchAndNoConsecutiveRepeats() throws {
        let rotation = StoryPromptRotation(defaults: defaults, userID: "a", calendar: calendar)
        var types: [StoryPromptType] = []
        for offset in 0..<28 {
            let date = calendar.date(byAdding: .day, value: offset, to: monday)!
            let choice = try XCTUnwrap(rotation.selection(on: date))
            XCTAssertEqual(rotation.selection(on: date), choice)
            if let last = types.last { XCTAssertNotEqual(last, choice) }
            types.append(choice)
            if offset >= 6 {
                let week = Array(types.suffix(7))
                for type in StoryPromptType.allCases { XCTAssertLessThanOrEqual(week.filter { $0 == type }.count, 2) }
                XCTAssertEqual(week.filter { $0.layer == "author" }.count, 3)
                XCTAssertEqual(week.filter { $0.layer == "agent" }.count, 3)
                XCTAssertEqual(week.filter { $0.layer == "actor" }.count, 1)
            }
        }
    }
    func testMuteIsImmediateAccountScopedAndCanBeRestored() throws {
        let a = StoryPromptRotation(defaults: defaults, userID: "a", calendar: calendar)
        let selected = try XCTUnwrap(a.selection(on: monday))
        a.mute(selected.rawValue)
        XCTAssertNotEqual(a.selection(on: monday), selected)
        let b = StoryPromptRotation(defaults: defaults, userID: "b", calendar: calendar)
        XCTAssertEqual(b.selection(on: monday), selected)
        for type in StoryPromptType.allCases { a.mute(type.rawValue) }
        XCTAssertNil(a.selection(on: monday))
        a.restore()
        XCTAssertNotNil(a.selection(on: monday))
    }
    func testDayKeyUsesLocalMidnightAndHistoryIsBounded() throws {
        var local = calendar!
        local.timeZone = TimeZone(identifier: "Asia/Kuala_Lumpur")!
        let rotation = StoryPromptRotation(defaults: defaults, userID: "a", calendar: local)
        let before = calendar.date(from: DateComponents(year: 2026, month: 11, day: 16, hour: 15, minute: 59))!
        XCTAssertNotEqual(rotation.dayKey(before), rotation.dayKey(before.addingTimeInterval(60)))
        for n in 0..<40 { _ = rotation.selection(on: monday.addingTimeInterval(Double(n) * 86400)) }
        let history = defaults.dictionary(forKey: "story-prompts.a.history")!
        XCTAssertLessThanOrEqual(history.count, 7)
    }
    func testOldAreaPromptDecodesAndStoryAttributionIncludesTypeAndQuestion() throws {
        let old = try JSONDecoder().decode(DailyPromptItem.self, from: Data(#"{"area":"Work","text":"Question?"}"#.utf8))
        XCTAssertNil(old.storyType)
        XCTAssertEqual(old.entryPrompt, "Question?")
        let story = StoryPromptType.scene.fallback
        XCTAssertEqual(story.entryPrompt, "Story: Scene\n" + story.text)
        XCTAssertTrue(CreateEntryRequest(promptText: story.entryPrompt, startWithAudio: true).startWithAudio)
    }
}
