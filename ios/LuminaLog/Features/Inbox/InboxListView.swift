import SwiftUI

/// Main list of pending agent info requests (Inbox tab).
struct InboxListView: View {

    @StateObject private var viewModel: InboxViewModel

    init(viewModel: InboxViewModel) {
        _viewModel = StateObject(wrappedValue: viewModel)
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                if viewModel.requests.isEmpty && !viewModel.isLoading {
                    emptyState
                } else {
                    listContent
                }
            }
            .navigationTitle("Inbox")
            .task {
                await viewModel.load()
            }
            .refreshable {
                await viewModel.load()
            }
        }
    }

    // MARK: - List

    private var listContent: some View {
        ScrollView {
            if let error = viewModel.error {
                errorBanner(error)
            }
            LazyVStack(spacing: 8) {
                ForEach(viewModel.requests) { request in
                    NavigationLink {
                        RequestDetailView(request: request, viewModel: viewModel)
                    } label: {
                        InboxRowView(request: request)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .padding(.top, 8)
        }
    }

    // MARK: - Empty state

    private var emptyState: some View {
        VStack(spacing: 16) {
            Image(systemName: "tray")
                .font(.system(size: 48))
                .foregroundStyle(Color.textSecondary)

            Text("No pending requests")
                .font(.title3)
                .foregroundStyle(Color.textPrimary)

            Text("Agent info requests from other agents will appear here.")
                .font(.body)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal, 32)
        }
    }

    // MARK: - Error banner

    private func errorBanner(_ message: String) -> some View {
        HStack(spacing: 8) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Color.red)
            Text(message)
                .font(.caption)
                .foregroundStyle(Color.red)
            Spacer()
        }
        .padding(8)
        .background(Color.red.opacity(0.1))
        .clipShape(RoundedRectangle(cornerRadius: 8))
        .padding(.horizontal, 16)
        .padding(.top, 8)
    }
}

// MARK: - Row

private struct InboxRowView: View {

    let request: InfoRequest

    var body: some View {
        HStack(alignment: .top, spacing: 8) {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 4) {
                    Text(request.sender.name)
                        .font(.body.weight(.semibold))
                        .foregroundStyle(Color.textPrimary)
                    verifiedBadge
                }

                Text(request.reason)
                    .font(.caption)
                    .foregroundStyle(Color.textSecondary)
                    .lineLimit(2)

                Text(timeAgo(from: request.createdAt))
                    .font(.caption2)
                    .foregroundStyle(Color.textSecondary)
            }

            Spacer()

            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(Color.textSecondary)
        }
        .padding(16)
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private var verifiedBadge: some View {
        if !request.sender.verifiedIdentity.isEmpty {
            Image(systemName: "checkmark.seal.fill")
                .font(.caption)
                .foregroundStyle(Color.accentWarm)
        }
    }

    private func timeAgo(from date: Date) -> String {
        let interval = Date().timeIntervalSince(date)
        switch interval {
        case ..<60: return "just now"
        case ..<3600: return "\(Int(interval / 60))m ago"
        case ..<86400: return "\(Int(interval / 3600))h ago"
        case ..<604800: return "\(Int(interval / 86400))d ago"
        default: return "\(Int(interval / 604800))w ago"
        }
    }
}

// MARK: - Previews
// NOTE: Previews disabled to avoid Swift type-checker timeouts.
//#Preview("With items") {
//    let sender = InfoRequestSender(
//        address: "0x1234567890abcdef1234567890abcdef12345678",
//        ens: "alpha.eth",
//        name: "Agent Alpha",
//        description: "Coordinator agent"
//    )
//    let request = InfoRequest(
//        id: "1",
//        sender: sender,
//        reason: "Needs your daily journal summary.",
//        questions: ["What was your focus today?"],
//        webhookHost: "https://example.com",
//        createdAt: Date().addingTimeInterval(-3600),
//        expiresAt: Date().addingTimeInterval(86400)
//    )
//    let vm = InboxViewModel(inboxService: MockInboxService())
//    vm.requests = [request]
//    return InboxListView(viewModel: vm)
//        .preferredColorScheme(.dark)
//}