import SwiftUI

/// What the editor collects. `validFrom` is nil unless the user sets a start date.
struct UserFactDraft: Equatable {
    var category: UserFactCategory = .person
    var subject = ""
    var statement = ""
    var hasSince = false
    var since = Date()

    static let statementLimit = 200

    var validFrom: Date? { hasSince ? since : nil }

    var isValid: Bool {
        let trimmed = statement.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmed.isEmpty && trimmed.count <= Self.statementLimit
    }

    init() {}

    init(fact: UserFact) {
        category = fact.category
        subject = fact.subject
        statement = fact.statement
        hasSince = fact.validFrom != nil
        since = fact.validFrom ?? Date()
    }
}

/// Add or edit a fact. Saving makes it the user's own: extraction never rewrites it.
struct UserFactEditorView: View {

    let title: String
    let onSave: (UserFactDraft) -> Void
    @State private var draft: UserFactDraft
    @Environment(\.dismiss) private var dismiss

    init(title: String, draft: UserFactDraft = UserFactDraft(), onSave: @escaping (UserFactDraft) -> Void) {
        self.title = title
        self.onSave = onSave
        _draft = State(initialValue: draft)
    }

    var body: some View {
        NavigationStack {
            Form {
                Picker("Kind", selection: $draft.category) {
                    ForEach(UserFactCategory.allCases, id: \.self) { category in
                        Label(category.singular, systemImage: category.systemImage).tag(category)
                    }
                }
                Section {
                    TextField("Who or what (optional)", text: $draft.subject)
                    TextField("What's true", text: $draft.statement, axis: .vertical)
                        .lineLimit(2...5)
                } footer: {
                    Text("Written the way you'd say it, for example \"Maya is my younger sister.\"")
                }
                Section {
                    Toggle("I know when it started", isOn: $draft.hasSince)
                    if draft.hasSince {
                        DatePicker("True since", selection: $draft.since, in: ...Date(), displayedComponents: .date)
                    }
                }
            }
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(draft)
                        dismiss()
                    }
                    .disabled(!draft.isValid)
                }
            }
        }
    }
}

/// "Not true anymore": when it stopped. Never earlier than when it started.
struct NotTrueAnymoreSheet: View {

    let fact: UserFact
    let onSave: (Date) -> Void
    @State private var endedOn = Date()
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    Text(fact.statement).font(.journalBody)
                } footer: {
                    Text("Argo keeps it in your history, with when it was true.")
                }
                DatePicker("Stopped being true on", selection: $endedOn,
                           in: (fact.validFrom ?? .distantPast)...Date(), displayedComponents: .date)
            }
            .navigationTitle("Not true anymore")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) { Button("Cancel") { dismiss() } }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Save") {
                        onSave(endedOn)
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium])
    }
}
