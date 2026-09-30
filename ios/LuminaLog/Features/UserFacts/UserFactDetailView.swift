import SwiftUI

/// One fact: when it was true, where it came from, and every action on it.
struct UserFactDetailView: View {

    let factId: String
    @ObservedObject var viewModel: UserFactsViewModel
    @Environment(\.dismiss) private var dismiss
    @State private var editing: UserFact?
    @State private var ending: UserFact?
    @State private var confirmDelete = false

    var body: some View {
        if let fact = viewModel.fact(id: factId), fact.status != .rejected {
            List {
                Section {
                    VStack(alignment: .leading, spacing: Spacing.s) {
                        Text(fact.statement).font(.journalDetailTitle).foregroundStyle(Color.textPrimary)
                        Text(fact.subject.isEmpty ? fact.category.singular : "\(fact.category.singular) \u{00B7} \(fact.subject)")
                            .font(.captionText).foregroundStyle(Color.textSecondary)
                    }
                    .padding(.vertical, Spacing.xs)
                }
                Section("When") {
                    LabeledContent("True since", value: fact.validFrom.map { UserFactFormat.day($0) } ?? "Not known")
                    if let end = fact.validTo { LabeledContent("Ended", value: UserFactFormat.day(end)) }
                    if !fact.evidence.isEmpty {
                        LabeledContent("First mentioned", value: UserFactFormat.day(fact.firstObservedAt))
                        LabeledContent("Last mentioned", value: UserFactFormat.day(fact.lastConfirmedAt))
                    }
                }
                if !fact.evidence.isEmpty {
                    Section("From your journal") {
                        ForEach(viewModel.sources(for: fact)) { source in
                            if let date = source.date {
                                NavigationLink(value: UserFactsRoute.entry(source.id)) {
                                    VStack(alignment: .leading, spacing: 2) {
                                        Text(source.title).font(.uiBody)
                                        Text(UserFactFormat.day(date)).font(.captionText).foregroundStyle(Color.textSecondary)
                                    }
                                }
                            } else {
                                Text("Entry deleted").font(.uiBody).foregroundStyle(Color.textSecondary)
                            }
                        }
                    }
                }
                Section {
                    Button("Edit") { editing = fact }
                    if fact.status == .active {
                        Button("Not true anymore") { ending = fact }
                    } else {
                        Button("Still true") { Task { await viewModel.restore(fact) } }
                    }
                    Button("Delete", role: .destructive) { confirmDelete = true }
                }
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color.appBackground.ignoresSafeArea())
            .navigationTitle(fact.category.singular)
            .navigationBarTitleDisplayMode(.inline)
            .sheet(item: $editing) { fact in
                UserFactEditorView(title: "Edit", draft: UserFactDraft(fact: fact)) { draft in
                    Task { await viewModel.edit(fact, category: draft.category, subject: draft.subject,
                                                statement: draft.statement, validFrom: draft.validFrom) }
                }
            }
            .sheet(item: $ending) { fact in
                NotTrueAnymoreSheet(fact: fact) { date in Task { await viewModel.markNotTrue(fact, endedOn: date) } }
            }
            .confirmationDialog("Delete this fact?", isPresented: $confirmDelete, titleVisibility: .visible) {
                Button("Delete", role: .destructive) {
                    Task {
                        await viewModel.delete(fact)
                        dismiss()
                    }
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("Argo won't suggest it again.")
            }
        } else {
            EmptyStateView(systemImage: "questionmark.circle", title: "Not found",
                           message: "This fact may have been deleted.")
        }
    }
}
