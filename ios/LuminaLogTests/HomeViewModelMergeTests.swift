import XCTest
@testable import LuminaLog

@MainActor
final class HomeViewModelMergeTests: XCTestCase {
    func testHandedOffDraftsAreHiddenFromHomeList() {
        var handed = DraftEntry(draftId: "d1", text: "a", promptText: nil,
                                createdAtEpoch: 10, updatedAtEpoch: 10, attachments: [])
        handed.handedOff = true
        let editable = DraftEntry(draftId: "d2", text: "b", promptText: nil,
                                  createdAtEpoch: 20, updatedAtEpoch: 20, attachments: [])
        let items = HomeViewModel.mergeListItems(entries: [], drafts: [handed, editable])
        XCTAssertEqual(items.map(\.id), ["d2"])
    }
}
