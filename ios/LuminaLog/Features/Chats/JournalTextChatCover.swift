import SwiftUI

/// Value type carrying the details of a journal-linked chat or call request.
struct JournalChatRequest: Identifiable {
    let id = UUID()
    let journalId: String
    let journalTitle: String
    let kind: ChatKind
}

/// Full-screen cover that creates a journal-linked text chat then shows `ChatView`.
/// Used by `RootView` for journal chats initiated from the Home and Journal tabs.
@MainActor
struct JournalTextChatCover: View {

    let request: JournalChatRequest
    let chats: ChatRepository
    let ai: AIService
    let speech: SpeechTranscriber

    @State private var chat: Chat?
    @State private var hasFailed = false
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        if let chat {
            NavigationStack {
                ChatView(
                    chatId: chat.id,
                    kind: .text,
                    title: chat.title,
                    journalTitle: request.journalTitle,
                    chats: chats,
                    ai: ai,
                    speech: speech
                )
                .toolbar {
                    ToolbarItem(placement: .topBarLeading) {
                        Button("Done") { dismiss() }
                            .foregroundStyle(Color.accentWarm)
                    }
                }
            }
        } else if hasFailed {
            VStack(spacing: Spacing.m) {
                Image(systemName: "exclamationmark.triangle")
                    .font(.system(size: 32))
                    .foregroundStyle(Color.textSecondary)
                Text("Couldn't start chat")
                    .font(.uiBody)
                    .foregroundStyle(Color.textPrimary)
                Button("Dismiss") { dismiss() }
                    .foregroundStyle(Color.accentWarm)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color.appBackground.ignoresSafeArea())
        } else {
            ProgressView()
                .tint(Color.accentWarm)
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.appBackground.ignoresSafeArea())
                .task {
                    do {
                        chat = try await chats.createChat(
                            kind: .text,
                            title: "New chat",
                            journalId: request.journalId,
                            journalTitle: request.journalTitle
                        )
                    } catch {
                        hasFailed = true
                    }
                }
        }
    }
}
