import SwiftUI

/// Placeholder for the archive list. Full implementation depends on
/// Task 9 (InfoArchiveEntry + InfoArchiveRepository).
/// Revisit when those types are available.
struct ArchiveListView: View {

    let entries: [Any]
    var onDelete: ((String) async -> Void)?

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            VStack(spacing: 16) {
                Image(systemName: "archivebox")
                    .font(.system(size: 48))
                    .foregroundStyle(.secondary)
                Text("Archive is empty")
                    .font(.title3)
                    .foregroundStyle(.primary)
                Text("Responses you send will appear here.")
                    .font(.body)
                    .foregroundStyle(.secondary)
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Color(.systemBackground))
            .navigationTitle("Archive")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }
}