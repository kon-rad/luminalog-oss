import SwiftUI

/// Settings → Config: customize the AI summary length and system prompt.
struct ConfigSettingsView: View {

    @StateObject private var viewModel: ConfigSettingsViewModel
    @Environment(\.dismiss) private var dismiss

    init(profile: UserProfile, profiles: ProfileRepository) {
        _viewModel = StateObject(
            wrappedValue: ConfigSettingsViewModel(profile: profile, profiles: profiles)
        )
    }

    var body: some View {
        Form {
            Section("Summary length") {
                Stepper("Approx. \(viewModel.wordLength) words",
                        value: $viewModel.wordLength, in: 10...300, step: 5)
            }

            Section("Summary system prompt") {
                TextEditor(text: $viewModel.systemPrompt)
                    .frame(minHeight: 160)
                    .font(.body)
                Text("Use {type} where the entry type (text, voice, …) should appear.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
                Button("Reset to default") { viewModel.resetToDefaults() }
            }

            if viewModel.saveFailed {
                Text("Couldn't save. Try again.")
                    .foregroundStyle(.red)
                    .font(.caption)
            }
        }
        .navigationTitle("Config")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .confirmationAction) {
                Button("Save") {
                    Task { await viewModel.save(); if !viewModel.saveFailed { dismiss() } }
                }
                .disabled(viewModel.isSaving)
            }
        }
    }
}
