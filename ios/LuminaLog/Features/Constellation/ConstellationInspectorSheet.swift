import SwiftUI

/// Bottom card shown when a constellation node is tapped: title + summary,
/// with a button into the full entry detail. The summary is read from the
/// entry's already-decrypted `summary` field (no plaintext on the graph wire).
struct ConstellationInspectorSheet: View {

    let entryId: String
    let journals: JournalRepository
    let onOpenEntry: (String) -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var entry: JournalEntry?
    @State private var loadFailed = false

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.m) {
            if let entry {
                Text(entry.title.isEmpty ? "Untitled" : entry.title)
                    .font(.headline)
                Text(summaryText(for: entry))
                    .font(.body)
                    .foregroundStyle(.secondary)
                Button {
                    dismiss()
                    onOpenEntry(entry.id)
                } label: {
                    Label("View full entry", systemImage: "arrow.up.right.square")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
            } else if loadFailed {
                Text("Couldn't load this entry.")
                    .foregroundStyle(.secondary)
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity)
            }
        }
        .padding(Spacing.l)
        .presentationDetents([.medium])
        .task(id: entryId) { await load() }
    }

    private func summaryText(for entry: JournalEntry) -> String {
        if let text = entry.summary?.text, !text.isEmpty { return text }
        return "No summary yet for this entry."
    }

    private func load() async {
        entry = nil
        loadFailed = false
        // entry(id:) is a live stream; take the first emission.
        for await value in journals.entry(id: entryId) {
            if let value {
                entry = value
            } else {
                loadFailed = true
            }
            return
        }
    }
}
