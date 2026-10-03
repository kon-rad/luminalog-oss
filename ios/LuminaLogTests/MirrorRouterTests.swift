import XCTest
@testable import LuminaLog

@MainActor
final class MirrorRouterTests: XCTestCase {

    func testExtractsTheMirrorIdFromUserInfo() {
        XCTAssertEqual(MirrorRouter.mirrorId(from: ["mirrorMessageId": "2026-10-03_morning"]), "2026-10-03_morning")
    }

    func testIgnoresOtherNotifications() {
        XCTAssertNil(MirrorRouter.mirrorId(from: [:]))
        XCTAssertNil(MirrorRouter.mirrorId(from: ["mirrorMessageId": ""]))
        XCTAssertNil(MirrorRouter.mirrorId(from: ["other": "x"]))
    }

    func testOpenHoldsTheIdUntilConsumed() {
        let router = MirrorRouter()
        router.open(mirrorId: "2026-10-03_evening")
        XCTAssertEqual(router.pendingMirrorId, "2026-10-03_evening")
        router.open(mirrorId: nil)
        XCTAssertEqual(router.pendingMirrorId, "2026-10-03_evening", "a non-mirror tap must not clear a pending mirror")
    }

    func testStartChatQueuesTheRequest() {
        let router = MirrorRouter()
        router.startChat(JournalChatRequest(journalId: nil, journalTitle: "Mirror · Morning, Oct 3", kind: .voice, mirrorId: "x"))
        XCTAssertEqual(router.pendingChat?.mirrorId, "x")
    }
}
