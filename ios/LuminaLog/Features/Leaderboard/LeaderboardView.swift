import SwiftUI

/// Global leaderboard with two tabs (longest streak, total words), reached from
/// the Settings screen. Reads precomputed stats via `GET /v1/leaderboards`.
struct LeaderboardView: View {

    @StateObject private var viewModel: LeaderboardViewModel

    init(service: LeaderboardService, currentUserId: String?) {
        _viewModel = StateObject(
            wrappedValue: LeaderboardViewModel(service: service, currentUserId: currentUserId)
        )
    }

    var body: some View {
        ScrollView {
            VStack(spacing: Spacing.m) {
                Picker("Board", selection: $viewModel.selected) {
                    ForEach(LeaderboardViewModel.Board.allCases) { board in
                        Text(board.title).tag(board)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal, Spacing.m)

                content
            }
            .padding(.vertical, Spacing.m)
        }
        .background(Color.appBackground.ignoresSafeArea())
        .navigationTitle("Leaderboard")
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.load() }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .loading:
            ProgressView()
                .padding(.top, Spacing.xl)
        case .failed(let message):
            VStack(spacing: Spacing.m) {
                Text("Couldn't load the leaderboard.")
                    .font(.uiBody)
                    .foregroundStyle(Color.textPrimary)
                Text(message)
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
                    .multilineTextAlignment(.center)
                Button("Retry") { Task { await viewModel.load() } }
                    .buttonStyle(.borderedProminent)
            }
            .padding(Spacing.l)
        case .loaded:
            if viewModel.entries.isEmpty {
                Text("No rankings yet.")
                    .font(.uiBody)
                    .foregroundStyle(Color.textSecondary)
                    .padding(.top, Spacing.xl)
            } else {
                LazyVStack(spacing: Spacing.s) {
                    ForEach(viewModel.entries) { entry in
                        LeaderboardRow(
                            entry: entry,
                            board: viewModel.selected,
                            isCurrentUser: viewModel.isCurrentUser(entry)
                        )
                    }
                }
                .padding(.horizontal, Spacing.m)
            }
        }
    }
}

/// A single rank row: rank · avatar · name · value.
private struct LeaderboardRow: View {
    let entry: LeaderboardEntry
    let board: LeaderboardViewModel.Board
    let isCurrentUser: Bool

    var body: some View {
        HStack(spacing: Spacing.m) {
            Text("\(entry.rank)")
                .font(.uiBody.weight(.semibold).monospacedDigit())
                .foregroundStyle(Color.textSecondary)
                .frame(minWidth: 28, alignment: .trailing)

            avatar
                .frame(width: 40, height: 40)
                .clipShape(Circle())

            Text(displayName)
                .font(.uiBody)
                .foregroundStyle(Color.textPrimary)
                .lineLimit(1)

            Spacer(minLength: Spacing.s)

            Text(valueText)
                .font(.uiBody.weight(.semibold).monospacedDigit())
                .foregroundStyle(Color.accentWarm)
        }
        .padding(Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(isCurrentUser ? Color.accentWarm.opacity(0.14) : Color.cardBackground)
        )
    }

    private var displayName: String {
        entry.displayName.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
            ? "Anonymous"
            : entry.displayName
    }

    private var valueText: String {
        switch board {
        case .streak:
            return "\(entry.value)"
        case .words:
            return entry.value.formatted(.number.grouping(.automatic))
        case .prompts:
            return entry.value.formatted(.number.grouping(.automatic))
        }
    }

    @ViewBuilder
    private var avatar: some View {
        if let url = entry.photoURL {
            AsyncImage(url: url) { phase in
                if case .success(let image) = phase {
                    image.resizable().scaledToFill()
                } else {
                    avatarPlaceholder
                }
            }
        } else {
            avatarPlaceholder
        }
    }

    private var avatarPlaceholder: some View {
        ZStack {
            Circle().fill(Color.accentWarm.opacity(0.18))
            if initials.isEmpty {
                Image(systemName: "person.fill")
                    .font(.system(size: 16, weight: .light))
                    .foregroundStyle(Color.accentWarm)
            } else {
                Text(initials)
                    .font(.system(.subheadline, design: .serif).weight(.semibold))
                    .foregroundStyle(Color.accentWarm)
            }
        }
    }

    private var initials: String {
        entry.displayName
            .split(separator: " ")
            .prefix(2)
            .compactMap { $0.first.map(String.init) }
            .joined()
            .uppercased()
    }
}
