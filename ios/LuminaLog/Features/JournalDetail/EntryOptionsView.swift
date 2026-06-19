import SwiftUI

/// The entry "…" options sheet (spec §iOS components 2): read-only metadata
/// (created date + edit history) and the Edit / Delete actions.
struct EntryOptionsView: View {

    let entry: JournalEntry
    /// Called when the user chooses Edit (the parent presents the edit sheet).
    let onEdit: () -> Void
    /// Called when the user confirms deletion.
    let onDelete: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var isConfirmingDelete = false

    var body: some View {
        NavigationStack {
            List {
                Section("Details") {
                    LabeledContent("Created", value: Self.format(entry.createdAt))
                }

                Section("Edits") {
                    if entry.editHistory.isEmpty {
                        Text("No edits yet.")
                            .foregroundStyle(Color.textSecondary)
                    } else {
                        ForEach(Array(entry.editHistory.reversed().enumerated()), id: \.offset) { _, record in
                            VStack(alignment: .leading, spacing: Spacing.xs) {
                                Text(Self.format(record.editedAt))
                                    .font(.uiBody)
                                Text(Self.fieldsLabel(record.fields))
                                    .font(.captionText)
                                    .foregroundStyle(Color.textSecondary)
                            }
                        }
                    }
                }

                Section {
                    Button {
                        dismiss()
                        onEdit()
                    } label: {
                        Label("Edit", systemImage: "pencil")
                    }

                    Button(role: .destructive) {
                        isConfirmingDelete = true
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }
            .navigationTitle("Options")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .confirmationDialog(
                "Delete this entry?",
                isPresented: $isConfirmingDelete,
                titleVisibility: .visible
            ) {
                Button("Delete", role: .destructive) {
                    dismiss()
                    onDelete()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This can't be undone. The entry, its media, and all related data will be permanently removed.")
            }
        }
    }

    private static func format(_ date: Date) -> String {
        date.formatted(date: .abbreviated, time: .shortened)
    }

    private static func fieldsLabel(_ fields: [String]) -> String {
        let set = Set(fields)
        if set.contains("title") && set.contains("content") { return "Title & content" }
        if set.contains("title") { return "Title" }
        if set.contains("content") { return "Content" }
        return "Edited"
    }
}

#Preview("With history") {
    EntryOptionsView(
        entry: JournalEntry(
            id: "e1", userId: "u", type: .text, title: "A day",
            content: "Body",
            editHistory: [
                EditRecord(editedAt: Date().addingTimeInterval(-3600), fields: ["title"]),
                EditRecord(editedAt: Date(), fields: ["title", "content"]),
            ]
        ),
        onEdit: {}, onDelete: {}
    )
}

#Preview("No history") {
    EntryOptionsView(
        entry: JournalEntry(id: "e1", userId: "u", type: .text, title: "A day", content: "Body"),
        onEdit: {}, onDelete: {}
    )
}
