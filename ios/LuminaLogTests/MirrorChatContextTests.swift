import XCTest
@testable import LuminaLog

final class MirrorChatContextTests: XCTestCase {

    private let tz = TimeZone(identifier: "Asia/Tokyo")!
    // 2026-10-03 09:00 Tokyo
    private let delivered = Date(timeIntervalSince1970: 1_790_985_600)

    private var message: EncouragementMessage {
        EncouragementMessage(id: "2026-10-03_morning", timeOfDay: .morning,
                             text: "Name the call you keep avoiding.", createdAt: delivered.addingTimeInterval(-14_400),
                             deliveredAt: delivered)
    }

    func testIncludesMirrorAndEverySourceExactly() {
        let inputs = MirrorInputs(
            dateKey: "2026-10-03",
            sources: [
                MirrorSource(id: "a", type: "text", title: "Monday", createdAt: delivered.addingTimeInterval(-172_800), content: "I kept avoiding the hard call."),
                MirrorSource(id: "b", type: "voice", title: "Walk", createdAt: delivered.addingTimeInterval(-86_400), content: "Felt lighter after the walk."),
            ],
            system: "SYSTEM", user: "U", model: "m", attempts: 1, fallbackSlots: [], createdAt: delivered
        )
        let text = MirrorChatContext.focalText(message: message, inputs: inputs, timeZone: tz)
        XCTAssertTrue(text.contains("Morning notification on 2026-10-03 at 9:00 AM"))
        XCTAssertTrue(text.contains("Name the call you keep avoiding."))
        XCTAssertTrue(text.contains("[text · Monday · 2026-10-01]\nI kept avoiding the hard call."))
        XCTAssertTrue(text.contains("[voice · Walk · 2026-10-02]\nFelt lighter after the walk."))
        XCTAssertFalse(text.contains("SYSTEM"), "generation instructions are not chat context")
    }

    func testWithoutInputsIsTheMirrorOnly() {
        let text = MirrorChatContext.focalText(message: message, inputs: nil, timeZone: tz)
        XCTAssertTrue(text.contains("Name the call you keep avoiding."))
        XCTAssertFalse(text.contains("IT WAS WRITTEN FROM"))
    }

    func testChatLabel() {
        XCTAssertEqual(MirrorChatContext.chatLabel(message, timeZone: tz), "Mirror · Morning, Oct 3")
    }
}
