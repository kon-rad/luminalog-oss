import SwiftUI

/// Routes pushed inside "What Argo knows". A type of its own, so these destinations
/// never clash with a parent stack's routes.
enum UserFactsRoute: Hashable {
    case fact(String)
    case entry(String)
}

/// Settings > "What Argo knows": the facts Argo has noted from the journal, grouped by
/// category, with proposals, history and every edit.
/// Spec: docs/superpowers/specs/2026-09-28-user-facts-design.md (workspace root).
struct UserFactsView: View {

    @EnvironmentObject private var services: AppServices
    @StateObject private var viewModel: UserFactsViewModel
    private let onPrompt: (CreateEntryRequest) -> Void

    @State private var showAdd = false
    @State private var editing: UserFact?
    @State private var ending: UserFact?
    @State private var deleting: UserFact?
    @State private var showForget = false
    @State private var showHistory = false

    init(viewModel: @autoclosure @escaping () -> UserFactsViewModel,
         onPrompt: @escaping (CreateEntryRequest) -> Void = { _ in }) {
        _viewModel = StateObject(wrappedValue: viewModel())
        self.onPrompt = onPrompt
    }

    var body: some View {
        List {
            Section { privacyCard }
                .listRowBackground(Color.cardBackground)
            content
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color.appBackground.ignoresSafeArea())
        .contentMargins(.bottom, AppTabBar.scrollBottomPadding, for: .scrollContent)
        .navigationTitle("What Argo knows")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                Button { showAdd = true } label: { Image(systemName: "plus") }
                    .accessibilityLabel("Add a fact")
            }
            ToolbarItem(placement: .secondaryAction) {
                Button("Forget everything", role: .destructive) { showForget = true }
            }
        }
        .refreshable { await viewModel.start() }
        .task { await viewModel.start() }
        .navigationDestination(for: UserFactsRoute.self) { route in
            switch route {
            case .fact(let id):
                UserFactDetailView(factId: id, viewModel: viewModel)
            case .entry(let id):
                JournalDetailView(entryId: id, journals: services.journals, profiles: services.profiles,
                                  ai: services.ai, media: services.media, onPrompt: onPrompt)
            }
        }
        .sheet(isPresented: $showAdd) {
            UserFactEditorView(title: "Add a fact") { draft in
                Task { await viewModel.add(category: draft.category, subject: draft.subject,
                                           statement: draft.statement, validFrom: draft.validFrom) }
            }
        }
        .sheet(item: $editing) { fact in
            UserFactEditorView(title: "Edit", draft: UserFactDraft(fact: fact)) { draft in
                Task { await viewModel.edit(fact, category: draft.category, subject: draft.subject,
                                            statement: draft.statement, validFrom: draft.validFrom) }
            }
        }
        .sheet(item: $ending) { fact in
            NotTrueAnymoreSheet(fact: fact) { date in Task { await viewModel.markNotTrue(fact, endedOn: date) } }
        }
        .confirmationDialog("Delete this fact?", isPresented: Binding(
            get: { deleting != nil }, set: { if !$0 { deleting = nil } }
        ), titleVisibility: .visible, presenting: deleting) { fact in
            Button("Delete", role: .destructive) { Task { await viewModel.delete(fact) } }
            Button("Cancel", role: .cancel) {}
        } message: { _ in
            Text("Argo won't suggest it again.")
        }
        .confirmationDialog("Delete everything Argo knows?", isPresented: $showForget, titleVisibility: .visible) {
            Button("Delete everything", role: .destructive) { Task { await viewModel.forgetEverything() } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This also turns off learning, so nothing comes back until you turn it on again.")
        }
        .alert("Something went wrong", isPresented: Binding(
            get: { viewModel.errorMessage != nil }, set: { if !$0 { viewModel.errorMessage = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(viewModel.errorMessage ?? "")
        }
    }

    // MARK: - Privacy card

    private var privacyCard: some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            Text(privacyText)
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
            if viewModel.hasConsent {
                Toggle("Learn from my journal", isOn: Binding(
                    get: { viewModel.learning },
                    set: { on in Task { await viewModel.setLearning(on) } }
                ))
                .font(.uiBody)
                .tint(Color.accentWarm)
            }
            if let progress = viewModel.progress {
                Text("Read \(progress.read) of \(progress.total) entries")
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
            }
        }
        .padding(.vertical, Spacing.xs)
    }

    private var privacyText: String {
        if !viewModel.hasConsent {
            return "Argo AI is off, so nothing is learned from your journal. You can still add facts yourself."
        }
        if !viewModel.learning {
            return "Learning is paused. Facts you have are kept."
        }
        return "Argo notes the people, places and goals in your entries so it can remember them. The list is encrypted on this phone; Argo's server reads new entries only to suggest changes and keeps nothing."
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        switch viewModel.loadState {
        case .loading:
            Section {
                ForEach(0..<3, id: \.self) { _ in
                    UserFactRow(fact: .placeholder).redacted(reason: .placeholder)
                }
            }
        case .failed:
            Section {
                EmptyStateView(systemImage: "exclamationmark.triangle", title: "Couldn't load what Argo knows",
                               message: "Check your connection and try again.", actionTitle: "Try again") {
                    Task { await viewModel.start() }
                }
            }
            .listRowBackground(Color.clear)
        case .loaded:
            if viewModel.isEmpty {
                Section { emptyState }.listRowBackground(Color.clear)
            }
            if !viewModel.proposals.isEmpty {
                Section("Argo noticed") {
                    ForEach(viewModel.proposals) { fact in ProposalCard(fact: fact, viewModel: viewModel) }
                }
            }
            ForEach(viewModel.sections) { section in
                Section {
                    ForEach(section.facts) { fact in
                        NavigationLink(value: UserFactsRoute.fact(fact.id)) { UserFactRow(fact: fact) }
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                Button(role: .destructive) { deleting = fact } label: { Label("Delete", systemImage: "trash") }
                                Button { ending = fact } label: { Label("Not true anymore", systemImage: "clock.arrow.circlepath") }
                                    .tint(Color.accentWarm)
                            }
                    }
                } header: {
                    Label(section.category.label, systemImage: section.category.systemImage)
                        .font(.sectionHeader)
                }
            }
            if !viewModel.history.isEmpty {
                Section {
                    DisclosureGroup("No longer true (\(viewModel.history.count))", isExpanded: $showHistory) {
                        ForEach(viewModel.history) { fact in
                            NavigationLink(value: UserFactsRoute.fact(fact.id)) { HistoryRow(fact: fact, viewModel: viewModel) }
                        }
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var emptyState: some View {
        if !viewModel.hasEntries {
            EmptyStateView(systemImage: "person.text.rectangle", title: "Nothing yet",
                           message: "Argo learns from your entries. Write a few and the people, places and goals in your life will appear here.")
        } else if viewModel.learning && viewModel.hasConsent {
            EmptyStateView(systemImage: "person.text.rectangle", title: "Reading your journal",
                           message: "Argo is reading your journal. Facts appear here as it goes.")
        } else {
            EmptyStateView(systemImage: "person.text.rectangle", title: "Nothing yet",
                           message: "Tap + to add something you want Argo to remember.")
        }
    }
}

// MARK: - Rows

struct UserFactRow: View {
    let fact: UserFact

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            if !fact.subject.isEmpty {
                Text(fact.subject).font(.entryTitle).foregroundStyle(Color.textPrimary)
            }
            Text(fact.statement).font(.journalBody).foregroundStyle(Color.textPrimary)
            Text(UserFactFormat.caption(for: fact)).font(.captionText).foregroundStyle(Color.textSecondary)
        }
        .padding(.vertical, Spacing.xs)
        .accessibilityElement(children: .combine)
    }
}

private struct HistoryRow: View {
    let fact: UserFact
    @ObservedObject var viewModel: UserFactsViewModel

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(fact.statement).font(.journalBody).foregroundStyle(Color.textSecondary)
            Text(UserFactFormat.span(for: fact)).font(.captionText).foregroundStyle(Color.textSecondary)
            if let next = fact.supersededBy.flatMap(viewModel.fact(id:)) {
                Text("Then: \(next.statement)").font(.captionText).foregroundStyle(Color.textSecondary)
            }
        }
        .accessibilityElement(children: .combine)
    }
}

private struct ProposalCard: View {
    let fact: UserFact
    @ObservedObject var viewModel: UserFactsViewModel

    var body: some View {
        if let proposal = fact.proposal {
            VStack(alignment: .leading, spacing: Spacing.s) {
                Text(fact.statement).font(.journalBody)
                switch proposal.kind {
                case .update:
                    Text("Your journal now says:").font(.captionText).foregroundStyle(Color.textSecondary)
                    Text(proposal.statement ?? "").font(.journalBody)
                case .invalidate:
                    Text(invalidateLine(proposal)).font(.captionText).foregroundStyle(Color.textSecondary)
                }
                HStack {
                    Button(proposal.kind == .update ? "Update" : "Mark not true") {
                        Task { await viewModel.acceptProposal(fact) }
                    }
                    .buttonStyle(.borderedProminent)
                    .tint(Color.accentWarm)
                    Button("Keep as is") { Task { await viewModel.dismissProposal(fact) } }
                        .buttonStyle(.bordered)
                }
            }
            .padding(.vertical, Spacing.xs)
        }
    }

    private func invalidateLine(_ proposal: UserFactProposal) -> String {
        let when = proposal.validTo.map { " on \(UserFactFormat.day($0))" } ?? ""
        let why = proposal.reason.map { " \($0)" } ?? ""
        return "This may have stopped being true\(when).\(why)"
    }
}

extension UserFact {
    /// Redacted placeholder for the loading state.
    static let placeholder = UserFact(
        id: "placeholder", category: .person, subject: "Someone", statement: "A fact Argo remembers about your life.",
        status: .active, origin: .extracted, userAuthored: false, evidence: [],
        firstObservedAt: Date(), lastConfirmedAt: Date(), validFrom: nil, validTo: nil,
        supersededBy: nil, proposal: nil, createdAt: Date(), updatedAt: Date(), model: "", promptVersion: 0
    )
}
