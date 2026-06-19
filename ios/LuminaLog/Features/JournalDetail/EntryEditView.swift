import SwiftUI

/// Text-only entry edit sheet (spec §iOS components 3). Edits title + canonical
/// content. Media, assets, and entry type are immutable here.
struct EntryEditView: View {

    @StateObject private var viewModel: EntryEditViewModel
    @Environment(\.dismiss) private var dismiss

    init(entry: JournalEntry, journals: JournalRepository, ai: AIService) {
        _viewModel = StateObject(
            wrappedValue: EntryEditViewModel(entry: entry, journals: journals, ai: ai)
        )
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Title") {
                    TextField("Title", text: $viewModel.title, axis: .vertical)
                }

                Section(viewModel.contentLabel) {
                    TextEditor(text: $viewModel.content)
                        .frame(minHeight: 200)
                }

                if viewModel.hasMedia {
                    Section {
                        Label(
                            "Photos, audio, and video can't be changed after creation.",
                            systemImage: "lock"
                        )
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                    }
                }

                if let errorMessage = viewModel.errorMessage {
                    Section {
                        Text(errorMessage).foregroundStyle(Color.danger)
                    }
                }
            }
            .navigationTitle("Edit Entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        Task { await viewModel.save() }
                    }
                    .disabled(viewModel.saveState == .loading)
                }
            }
            .onChange(of: viewModel.didSave) { _, didSave in
                if didSave { dismiss() }
            }
        }
    }
}

#Preview {
    EntryEditView(
        entry: JournalEntry(id: "e1", userId: "u", type: .text, title: "A day", content: "Body text here."),
        journals: MockJournalRepository(),
        ai: MockAIService()
    )
}
