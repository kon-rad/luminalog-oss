import SwiftUI

/// Full-screen global constellation map of every entry. Presented from the
/// Journal list. Owns its own NavigationStack so it can push entry detail.
struct JournalConstellationView: View {

    @StateObject private var viewModel: JournalConstellationViewModel

    private let journals: JournalRepository
    private let profiles: ProfileRepository
    private let ai: AIService
    private let media: MediaUploader
    private let onPrompt: (CreateEntryRequest) -> Void
    private let onRetryProcessing: ((String) -> Void)?

    @State private var path: [JournalDetailRoute] = []
    @State private var selectedEntryId: String?
    @Environment(\.dismiss) private var dismiss

    init(
        journals: JournalRepository,
        profiles: ProfileRepository,
        ai: AIService,
        media: MediaUploader,
        onPrompt: @escaping (CreateEntryRequest) -> Void,
        onRetryProcessing: ((String) -> Void)? = nil
    ) {
        _viewModel = StateObject(wrappedValue: JournalConstellationViewModel(ai: ai))
        self.journals = journals
        self.profiles = profiles
        self.ai = ai
        self.media = media
        self.onPrompt = onPrompt
        self.onRetryProcessing = onRetryProcessing
    }

    var body: some View {
        NavigationStack(path: $path) {
            content
                .navigationTitle("Constellation")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .navigationBarLeading) {
                        Button("Done") { dismiss() }
                    }
                }
                .navigationDestination(for: JournalDetailRoute.self) { route in
                    JournalDetailView(
                        entryId: route.entryId,
                        journals: journals,
                        profiles: profiles,
                        ai: ai,
                        media: media,
                        onPrompt: onPrompt,
                        onRetryProcessing: onRetryProcessing
                    )
                }
        }
        .task { await viewModel.load() }
        .sheet(item: Binding(
            get: { selectedEntryId.map(IdentifiedString.init) },
            set: { selectedEntryId = $0?.value }
        )) { wrapper in
            ConstellationInspectorSheet(
                entryId: wrapper.value,
                journals: journals,
                onOpenEntry: { id in path.append(JournalDetailRoute(entryId: id)) }
            )
        }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle, .loading:
            ProgressView("Mapping your journal…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(Color.appBackground.ignoresSafeArea())
        case .loaded(let graph):
            GraphWebView(graph: graph) { id in selectedEntryId = id }
                .ignoresSafeArea(edges: .bottom)
        case .empty:
            EmptyStateView(
                systemImage: "sparkles",
                title: "Your map is forming",
                message: "Write a few more entries and your journal will connect into a constellation you can explore."
            )
        case .failed:
            EmptyStateView(
                systemImage: "wifi.exclamationmark",
                title: "Couldn't build your map",
                message: "Something went wrong. Check your connection and try again.",
                actionTitle: "Retry",
                action: { Task { await viewModel.retry() } }
            )
        }
    }
}

/// Tiny Identifiable wrapper so a `String?` can drive `.sheet(item:)`.
private struct IdentifiedString: Identifiable {
    let value: String
    var id: String { value }
}
