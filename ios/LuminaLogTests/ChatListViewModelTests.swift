import XCTest
@testable import LuminaLog

final class ChatListViewModelTests: XCTestCase {

    /// Minimal repository whose `chats()` yields exactly what it was given
    /// (deliberately unsorted) so the view model's display sort is exercised.
    @MainActor
    private final class UnsortedChatRepository: ChatRepository {

        var stored: [Chat]

        init(chats: [Chat]) {
            stored = chats
        }

        func chats() -> AsyncStream<[Chat]> {
            AsyncStream { continuation in
                continuation.yield(stored)
            }
        }

        func messages(chatId: String) -> AsyncStream<[ChatMessage]> {
            AsyncStream { $0.yield([]) }
        }

        func createChat(kind: ChatKind, title: String, journalId: String?, journalTitle: String?) async throws -> Chat {
            Chat(userId: "u", kind: kind, title: title)
        }

        func appendMessage(_ message: ChatMessage, to chatId: String) async throws {}
        func updateChatTitle(id: String, title: String) async throws {}
        func deleteChat(id: String) async throws {}
    }

    @MainActor
    private func chat(id: String, daysAgo: Int) -> Chat {
        Chat(
            id: id,
            userId: "u",
            kind: .text,
            title: "Chat \(id)",
            lastMessageAt: Date().addingTimeInterval(-Double(daysAgo) * 86_400)
        )
    }

    // MARK: - Sorting

    @MainActor
    func testChatsSortedByLastMessageDescending() async {
        let repo = UnsortedChatRepository(chats: [
            chat(id: "old", daysAgo: 5),
            chat(id: "newest", daysAgo: 0),
            chat(id: "middle", daysAgo: 2)
        ])
        let viewModel = ChatListViewModel(chats: repo)
        await viewModel.start()

        XCTAssertTrue(viewModel.hasLoaded)
        XCTAssertEqual(viewModel.chats.map(\.id), ["newest", "middle", "old"])
    }

    // MARK: - Delete

    @MainActor
    func testDeleteCallsRepository() async {
        let target = chat(id: "doomed", daysAgo: 1)
        let repo = SpyChatRepository(chats: [target], messages: ["doomed": []])
        let viewModel = ChatListViewModel(chats: repo)
        await viewModel.start()

        await viewModel.delete(target)

        XCTAssertEqual(repo.deletedIds, ["doomed"])
        try? await waitUntil { viewModel.chats.isEmpty }
        XCTAssertTrue(viewModel.chats.isEmpty, "Live stream reflects the deletion")
    }

    // MARK: - Start text chat

    @MainActor
    func testStartTextChatCreatesTextChatWithDefaultTitle() async {
        let repo = SpyChatRepository()
        let viewModel = ChatListViewModel(chats: repo)
        await viewModel.start()

        let chat = await viewModel.startTextChat()

        XCTAssertEqual(chat?.kind, .text)
        XCTAssertEqual(chat?.title, "New chat")
        XCTAssertEqual(repo.createdKinds, [.text])
    }
}
