import XCTest
@testable import LuminaLog

@MainActor
final class HomeListMergeTests: XCTestCase {
    func testMergeSortsByDateDescWithDraftsInline() {
        let entryOld = JournalEntry(id: "e-old", userId: "u", type: .text, title: "t",
                                    createdAt: Date(timeIntervalSince1970: 10), content: "c",
                                    wordCount: 1)
        let entryNew = JournalEntry(id: "e-new", userId: "u", type: .text, title: "t",
                                    createdAt: Date(timeIntervalSince1970: 30), content: "c",
                                    wordCount: 1)
        let draftMid = DraftEntry(draftId: "d-mid", text: "x", promptText: nil,
                                  createdAtEpoch: 20, updatedAtEpoch: 20, attachments: [])
        let items = HomeViewModel.mergeListItems(entries: [entryOld, entryNew], drafts: [draftMid])
        XCTAssertEqual(items.map(\.id), ["e-new", "d-mid", "e-old"])
    }
}
