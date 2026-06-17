import SwiftUI

/// The Journal Detail "Related" tab: up to 20 semantically similar entries.
/// Lazy-loads on first appearance; tapping a row pushes that entry's detail
/// screen via the enclosing NavigationStack's JournalDetailRoute destination.
struct RelatedTabView: View {

    @StateObject private var viewModel: RelatedViewModel

    init(entryId: String, ai: AIService) {
        _viewModel = StateObject(wrappedValue: RelatedViewModel(entryId: entryId, ai: ai))
    }

    var body: some View {
        Group {
            switch viewModel.state {
            case .idle, .loading:
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: 120)
            case .loaded(let items) where items.isEmpty:
                emptyState
            case .loaded(let items):
                VStack(spacing: Spacing.s) {
                    ForEach(items) { entry in
                        NavigationLink(value: JournalDetailRoute(entryId: entry.journalId)) {
                            row(entry)
                        }
                        .buttonStyle(.plain)
                    }
                }
            case .failed:
                retryState
            }
        }
        .task { await viewModel.load() }
    }

    private func row(_ entry: RelatedEntry) -> some View {
        HStack(alignment: .top, spacing: Spacing.s) {
            Image(systemName: icon(for: entry.type))
                .font(.system(size: 13, weight: .semibold))
                .foregroundStyle(Color.accentWarm)
                .frame(width: 22)
            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text(entry.title.isEmpty ? "Untitled" : entry.title)
                    .font(.uiBody.weight(.semibold))
                    .foregroundStyle(Color.textPrimary)
                if !entry.snippet.isEmpty {
                    Text(entry.snippet)
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                        .lineLimit(2)
                }
                Text(entry.date)
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary.opacity(0.7))
            }
            Spacer(minLength: 0)
        }
        .padding(Spacing.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.cardBackground)
        )
        .contentShape(Rectangle())
    }

    private func icon(for type: JournalType) -> String {
        switch type {
        case .text: return "doc.text"
        case .voice: return "waveform"
        case .video: return "video"
        case .image: return "photo"
        }
    }

    private var emptyState: some View {
        VStack(spacing: Spacing.s) {
            Image(systemName: "sparkle.magnifyingglass")
                .font(.system(size: 28))
                .foregroundStyle(Color.textSecondary)
            Text("No related entries yet")
                .font(.uiBody.weight(.semibold))
                .foregroundStyle(Color.textPrimary)
            Text("Write a few more entries to discover connections.")
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
        }
        .frame(maxWidth: .infinity, minHeight: 160)
        .padding()
    }

    private var retryState: some View {
        VStack(spacing: Spacing.s) {
            Text("Couldn't load related entries.")
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
            Button("Try again") { Task { await viewModel.retry() } }
                .font(.captionText.weight(.semibold))
                .foregroundStyle(Color.accentWarm)
        }
        .frame(maxWidth: .infinity, minHeight: 120)
    }
}
