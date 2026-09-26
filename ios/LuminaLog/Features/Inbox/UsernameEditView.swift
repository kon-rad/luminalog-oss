import SwiftUI

/// Sheet or embedded view for editing the user's display username.
/// Provides live availability checking, local validation, and a 30-day
/// cooldown indicator.
struct UsernameEditView: View {

    @StateObject private var viewModel: UsernameEditViewModel

    private let onSaved: (UsernameUpdate) -> Void

    @Environment(\.dismiss) private var dismiss

    init(
        service: InboxService,
        current: String?,
        changedAt: Date?,
        onSaved: @escaping (UsernameUpdate) -> Void
    ) {
        _viewModel = StateObject(wrappedValue: UsernameEditViewModel(
            service: service,
            current: current,
            changedAt: changedAt
        ))
        self.onSaved = onSaved
    }

    var body: some View {
        NavigationStack {
            ZStack {
                Color.appBackground.ignoresSafeArea()

                ScrollView {
                    VStack(alignment: .leading, spacing: 20) {
                        headerSection
                        textFieldSection
                        statusSection
                        cooldownSection
                        saveButtonSection
                    }
                    .padding(16)
                    .padding(.bottom, AppTabBar.scrollBottomPadding)
                }
            }
            .navigationTitle("Edit Username")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                        .foregroundStyle(Color.textSecondary)
                }
            }
            .onChange(of: viewModel.status) { _, status in
                if case .saved(let update) = status {
                    onSaved(update)
                    dismiss()
                }
            }
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            Text("Choose a username")
                .font(.title3.weight(.semibold))
                .foregroundStyle(Color.textPrimary)

            Text("Your username is how other agents will identify you. You can change it once every 30 days.")
                .font(.caption)
                .foregroundStyle(Color.textSecondary)
        }
    }

    // MARK: - Text field

    private var textFieldSection: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack(spacing: 8) {
                TextField("Username", text: $viewModel.text)
                    .textFieldStyle(.plain)
                    .font(.body)
                    .foregroundStyle(Color.textPrimary)
                    .autocapitalization(.none)
                    .autocorrectionDisabled()
                    .onChange(of: viewModel.text) { _, _ in
                        Task { await viewModel.textChanged() }
                    }

                statusIcon
            }
            .padding(12)
            .background(Color.cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: 10))
            .overlay(
                RoundedRectangle(cornerRadius: 10)
                    .stroke(borderColor, lineWidth: 1)
            )
        }
    }

    // MARK: - Status icon

    @ViewBuilder
    private var statusIcon: some View {
        switch viewModel.status {
        case .idle:
            EmptyView()
        case .checking:
            ProgressView()
                .controlSize(.small)
        case .available:
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.green)
                .font(.body)
        case .unavailable:
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundStyle(Color.danger)
                .font(.body)
        case .saving:
            ProgressView()
                .controlSize(.small)
        case .saved:
            Image(systemName: "checkmark.circle.fill")
                .foregroundStyle(.green)
                .font(.body)
        case .failed:
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(Color.danger)
                .font(.body)
        }
    }

    private var borderColor: Color {
        switch viewModel.status {
        case .idle, .checking, .saving:
            return Color.clear
        case .available, .saved:
            return .green
        case .unavailable, .failed:
            return Color.danger
        }
    }

    // MARK: - Status messages

    @ViewBuilder
    private var statusSection: some View {
        if case .available = viewModel.status {
            HStack(spacing: 6) {
                Image(systemName: "checkmark.circle.fill")
                    .font(.caption)
                    .foregroundStyle(.green)
                Text("Username is available!")
                    .font(.caption)
                    .foregroundStyle(.green)
            }
        } else if case .unavailable(let reason) = viewModel.status {
            HStack(spacing: 6) {
                Image(systemName: "exclamationmark.circle.fill")
                    .font(.caption)
                    .foregroundStyle(Color.danger)
                Text(reason)
                    .font(.caption)
                    .foregroundStyle(Color.danger)
            }
        } else if case .failed(let message) = viewModel.status {
            HStack(spacing: 6) {
                Image(systemName: "exclamationmark.triangle.fill")
                    .font(.caption)
                    .foregroundStyle(Color.danger)
                Text(message)
                    .font(.caption)
                    .foregroundStyle(Color.danger)
            }
        }
    }

    // MARK: - Cooldown

    @ViewBuilder
    private var cooldownSection: some View {
        if let lockedUntil = viewModel.lockedUntil {
            VStack(alignment: .leading, spacing: 4) {
                HStack(spacing: 6) {
                    Image(systemName: "lock.fill")
                        .font(.caption)
                        .foregroundStyle(Color.textSecondary)
                    Text("Username locked until \(lockedUntil.formatted(date: .abbreviated, time: .shortened))")
                        .font(.caption)
                        .foregroundStyle(Color.textSecondary)
                }
            }
            .padding(12)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.secondaryBackground)
            .clipShape(RoundedRectangle(cornerRadius: 10))
        }
    }

    // MARK: - Save button

    private var saveButtonSection: some View {
        VStack(spacing: 8) {
            Button {
                Task { await viewModel.save() }
            } label: {
                Group {
                    if case .saving = viewModel.status {
                        ProgressView()
                            .controlSize(.small)
                            .tint(.white)
                    } else {
                        Text("Save Username")
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            }
            .font(.body.weight(.semibold))
            .foregroundStyle(.white)
            .background(viewModel.canSave ? Color.accentWarm : Color.textSecondary.opacity(0.3))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .disabled(!viewModel.canSave)
        }
    }
}