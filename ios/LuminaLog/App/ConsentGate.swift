import SwiftUI

@MainActor
final class ConsentGateViewModel: ObservableObject {
    @Published var needsConsent: Bool
    @Published var syncing = false
    @Published var syncFailed = false

    private let store: ConsentStore
    private let service: ConsentService

    init(store: ConsentStore, service: ConsentService) {
        self.store = store
        self.service = service
        self.needsConsent = !store.hasConsentedAI
    }

    func agree() async {
        store.recordLocalConsent()
        syncing = true; syncFailed = false
        do {
            try await service.sync()
            needsConsent = false
        } catch {
            syncFailed = true   // stay gated; user can retry
        }
        syncing = false
    }
}

/// Launch-level gate: renders `content` only once AI-data-sharing consent is
/// recorded AND synced to the server. New users pass instantly (consent set in
/// onboarding); already-onboarded users see `AIConsentView` once.
struct ConsentGate<Content: View>: View {
    @StateObject private var viewModel: ConsentGateViewModel
    private let content: () -> Content

    init(store: ConsentStore, service: ConsentService, @ViewBuilder content: @escaping () -> Content) {
        _viewModel = StateObject(wrappedValue: ConsentGateViewModel(store: store, service: service))
        self.content = content
    }

    var body: some View {
        if viewModel.needsConsent {
            AIConsentView(onAgree: { Task { await viewModel.agree() } })
                .overlay(alignment: .bottom) {
                    if viewModel.syncFailed {
                        Text("Couldn't save your choice — check your connection and tap again.")
                            .font(.captionText).foregroundStyle(Color.textSecondary)
                            .padding(.bottom, Spacing.xl)
                    }
                }
        } else {
            content()
        }
    }
}
