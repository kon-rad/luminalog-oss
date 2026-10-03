import Foundation

/// Hands Mirror navigation to `RootView` from places that can't reach it: the
/// notification delegate (a tapped Echo, possibly before any view exists) and
/// Mirror detail screens (a chat to start once the sheet is gone). Values stay
/// pending until `RootView` consumes them, so a cold-start tap isn't lost.
@MainActor
final class MirrorRouter: ObservableObject {

    static let shared = MirrorRouter()

    /// The Echo whose detail should open next.
    @Published var pendingMirrorId: String?
    /// A chat or call about a Mirror, to present once nothing covers RootView.
    @Published var pendingChat: JournalChatRequest?

    /// A nil id (a tap on a non-Mirror notification) leaves any pending one alone.
    func open(mirrorId: String?) {
        guard let mirrorId else { return }
        pendingMirrorId = mirrorId
    }

    func startChat(_ request: JournalChatRequest) {
        pendingChat = request
    }

    nonisolated static func mirrorId(from userInfo: [AnyHashable: Any]) -> String? {
        guard let id = userInfo[EncouragementPrefs.messageIdUserInfoKey] as? String, !id.isEmpty else { return nil }
        return id
    }
}
