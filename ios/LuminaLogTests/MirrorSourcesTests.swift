import XCTest
@testable import LuminaLog

final class MirrorSourcesTests: XCTestCase {

    private let now = Date(timeIntervalSince1970: 1_790_000_000)

    private func entry(_ id: String, daysAgo: Double, title: String = "T", content: String = "body") -> JournalEntry {
        JournalEntry(id: id, userId: "u", type: .text, title: title,
                     createdAt: now.addingTimeInterval(-daysAgo * 86_400), content: content)
    }

    func testFiltersToTheWindowCapsAndTruncates() {
        let since = now.addingTimeInterval(-7 * 86_400)
        let entries = [entry("new", daysAgo: 1, title: "", content: String(repeating: "x", count: 900)),
                       entry("old", daysAgo: 9)]
        let sources = Model1Requests.mirrorSources(from: entries, since: since)
        XCTAssertEqual(sources.map(\.id), ["new"])
        XCTAssertEqual(sources[0].title, "Untitled")
        XCTAssertEqual(sources[0].content.count, 800)
        XCTAssertEqual(sources[0].createdAt, entries[0].createdAt)
    }

    func testEncouragementEntriesAreExactlyTheSources() {
        let since = now.addingTimeInterval(-7 * 86_400)
        let entries = (0..<25).map { entry("e\($0)", daysAgo: 0.1, content: "c\($0)") }
        let sources = Model1Requests.mirrorSources(from: entries, since: since)
        let wire = Model1Requests.encouragementEntries(from: entries, since: since)
        XCTAssertEqual(sources.count, 20)
        XCTAssertEqual(wire.map(\.id), sources.map(\.id))
        XCTAssertEqual(wire.map(\.content), sources.map(\.content))
    }

    func testPromptDecodesFromServerJSON() throws {
        let json = #"{"system":"S","user":"U","model":"m","attempts":1,"fallbackSlots":["evening"]}"#
        let prompt = try JSONDecoder().decode(MirrorPrompt.self, from: Data(json.utf8))
        XCTAssertEqual(prompt.fallbackSlots, ["evening"])
        XCTAssertEqual(prompt.attempts, 1)
    }

    func testEchoesDefaultToNoSourcesAndNoPrompt() {
        let echoes = GeneratedMirrorEchoes(morning: "a", afternoon: nil, evening: nil)
        XCTAssertTrue(echoes.sources.isEmpty)
        XCTAssertNil(echoes.prompt)
    }
}
