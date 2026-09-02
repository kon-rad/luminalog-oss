import SwiftUI

/// Settings > Message history: every daily-encouragement notification already
/// delivered to this device, newest first. Read-only; the on/off toggle for the
/// feature itself lives back on the Settings screen.
struct DailyMessagesHistoryView: View {

    let repository: EncouragementRepository

    @State private var messages: [EncouragementMessage] = []
    @State private var isLoading = false
    @State private var hasMore = true

    private static let pageSize = 20

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.l) {
                if messages.isEmpty && !isLoading {
                    emptyState
                } else {
                    card
                }
            }
            .padding(.horizontal, Spacing.m)
            .padding(.top, Spacing.s)
            .padding(.bottom, AppTabBar.scrollBottomPadding)
        }
        .background(Color.appBackground.ignoresSafeArea())
        .navigationTitle("Message History")
        .navigationBarTitleDisplayMode(.inline)
        .task { await loadMore() }
    }

    private var card: some View {
        VStack(spacing: 0) {
            ForEach(Array(messages.enumerated()), id: \.element.id) { index, message in
                if index > 0 { Divider().padding(.leading, Spacing.m) }
                row(message)
            }
            // Pagination sentinel: loads the next page as it scrolls into view.
            if hasMore {
                Color.clear
                    .frame(height: 1)
                    .onAppear {
                        guard !isLoading else { return }
                        Task { await loadMore() }
                    }
            }
        }
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.cardBackground)
        )
    }

    private func row(_ message: EncouragementMessage) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(Self.timestampLabel(message.deliveredAt ?? message.createdAt))
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
            Text(message.title)
                .font(.uiBody.weight(.semibold))
                .foregroundStyle(Color.textPrimary)
            Text(message.body)
                .font(.uiBody)
                .foregroundStyle(Color.textPrimary)
        }
        .padding(Spacing.m)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var emptyState: some View {
        VStack(spacing: Spacing.s) {
            Image(systemName: "sparkles")
                .font(.system(size: 32, weight: .light))
                .foregroundStyle(Color.accentWarm)
            Text("Your daily messages will show up here once they start arriving.")
                .font(.uiBody)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, Spacing.xl)
    }

    private func loadMore() async {
        guard hasMore, !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let batch = try await repository.recentDelivered(
                limit: Self.pageSize, before: Date(), after: messages.last?.deliveredAt
            )
            messages.append(contentsOf: batch)
            hasMore = batch.count == Self.pageSize
        } catch {
            hasMore = false
        }
    }

    /// "Today, 9:00 AM" / "Yesterday, 4:00 PM" / "Aug 28, 4:00 PM".
    private static func timestampLabel(_ date: Date) -> String {
        let calendar = Calendar.current
        let time = date.formatted(date: .omitted, time: .shortened)
        if calendar.isDateInToday(date) { return "Today, \(time)" }
        if calendar.isDateInYesterday(date) { return "Yesterday, \(time)" }
        return date.formatted(date: .abbreviated, time: .shortened)
    }
}

#Preview {
    NavigationStack {
        DailyMessagesHistoryView(repository: InMemoryEncouragementRepository())
    }
}
