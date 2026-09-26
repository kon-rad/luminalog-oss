import SwiftUI

/// Detail view for a single agent info request, with per-question answer fields.
struct RequestDetailView: View {

    let request: InfoRequest
    @ObservedObject var viewModel: InboxViewModel

    @Environment(\.dismiss) private var dismiss

    @State private var answers: [Int: String] = [:]
    @State private var declined: Set<Int> = []
    @State private var isSending = false
    @State private var isDrafting = false
    @State private var showIgnoreConfirm = false
    @State private var showError = false
    @State private var errorMessage = ""

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()

            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    headerSection
                    reasonSection
                    questionsSection
                    sendSection
                }
                .padding(16)
                .padding(.bottom, 32)
            }
        }
        .navigationTitle("Request")
        .navigationBarTitleDisplayMode(.inline)
        .confirmationDialog(
            "Ignore this request?",
            isPresented: $showIgnoreConfirm,
            titleVisibility: .visible
        ) {
            Button("Ignore", role: .destructive) { Task { await performIgnore() } }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("It's removed from your inbox and the sender gets no reply.")
        }
        .alert("Error", isPresented: $showError) {
            Button("OK") { showError = false }
        } message: {
            Text(errorMessage)
        }
    }

    // MARK: - Header

    private var headerSection: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack(spacing: 4) {
                Text(request.sender.name)
                    .font(.title2.weight(.bold))
                    .foregroundStyle(Color.textPrimary)

                if !request.sender.verifiedIdentity.isEmpty {
                    Image(systemName: "checkmark.seal.fill")
                        .font(.title3)
                        .foregroundStyle(Color.accentWarm)
                        .accessibilityLabel("Verified identity")
                }
            }

            Text("Agent requesting information")
                .font(.caption)
                .foregroundStyle(Color.textSecondary)

            Text("From: \(request.sender.verifiedIdentity)")
                .font(.caption2)
                .foregroundStyle(Color.textSecondary)
        }
    }

    // MARK: - Reason

    private var reasonSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Label("Reason", systemImage: "info.circle")
                .font(.headline)
                .foregroundStyle(Color.textPrimary)

            Text(request.reason)
                .font(.body)
                .foregroundStyle(Color.textSecondary)
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: 12))
        }
    }

    // MARK: - Questions

    private var questionsSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Label("Questions", systemImage: "questionmark.bubble")
                    .font(.headline)
                    .foregroundStyle(Color.textPrimary)
                Spacer()
                if viewModel.canDraft {
                    Button {
                        Task { await performDraft() }
                    } label: {
                        if isDrafting {
                            ProgressView().controlSize(.small)
                        } else {
                            Label("Draft with AI", systemImage: "sparkles")
                        }
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(Color.accentWarm)
                    .disabled(isDrafting || isSending)
                }
            }

            Text("Drafts come from your journal. Review and edit every answer before sending.")
                .font(.caption)
                .foregroundStyle(Color.textSecondary)

            ForEach(Array(request.questions.enumerated()), id: \.offset) { index, questionText in
                questionCard(index: index, text: questionText)
            }
        }
    }

    @ViewBuilder
    private func questionCard(index: Int, text: String) -> some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(text)
                .font(.body.weight(.medium))
                .foregroundStyle(Color.textPrimary)

            if declined.contains(index) {
                HStack {
                    Image(systemName: "slash.circle")
                        .foregroundStyle(Color.textSecondary)
                    Text("Declined to answer")
                        .font(.caption)
                        .foregroundStyle(Color.textSecondary)
                }
                .padding(.vertical, 4)
            } else {
                TextField("Your answer...", text: Binding(
                    get: { answers[index] ?? "" },
                    set: { answers[index] = $0 }
                ), axis: .vertical)
                .textFieldStyle(.plain)
                .font(.body)
                .foregroundStyle(Color.textPrimary)
                .padding(8)
                .background(Color.cardBackground)
                .clipShape(RoundedRectangle(cornerRadius: 8))
                .lineLimit(3...6)
            }

            Button(declined.contains(index) ? "Undecline" : "Decline") {
                withAnimation {
                    if declined.contains(index) {
                        declined.remove(index)
                    } else {
                        declined.insert(index)
                        answers.removeValue(forKey: index)
                    }
                }
            }
            .font(.caption)
            .foregroundStyle(declined.contains(index) ? Color.accentWarm : Color.red)
        }
        .padding(16)
        .background(Color.cardBackground)
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Send

    private var sendSection: some View {
        VStack(spacing: 8) {
            if let error = viewModel.error, !error.isEmpty {
                Text(error)
                    .font(.caption)
                    .foregroundStyle(Color.red)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button {
                Task { await performSend() }
            } label: {
                Group {
                    if isSending {
                        ProgressView()
                            .controlSize(.small)
                            .tint(.white)
                    } else {
                        Text("Send Answers")
                    }
                }
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
            }
            .font(.body.weight(.semibold))
            .foregroundStyle(.white)
            .background(Color.accentWarm)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .disabled(isSending || isDrafting)

            Button("Ignore Request") { showIgnoreConfirm = true }
                .font(.body)
                .foregroundStyle(Color.red)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 8)
                .disabled(isSending)
        }
    }

    // MARK: - Actions

    private func performSend() async {
        let payloads = InboxViewModel.payloads(
            questionCount: request.questions.count, answers: answers, declined: declined
        )
        guard payloads.contains(where: { $0.answer != nil }) else {
            errorMessage = "Please answer at least one question."
            showError = true
            return
        }

        isSending = true
        let success = await viewModel.respond(request.id, answers: payloads)
        isSending = false
        if success {
            dismiss()
        } else {
            errorMessage = viewModel.error ?? "Failed to send answers. Please try again."
            showError = true
        }
    }

    /// Fills every question that isn't declined and has no typed answer yet.
    private func performDraft() async {
        isDrafting = true
        defer { isDrafting = false }
        guard let drafts = await viewModel.draft(for: request) else {
            errorMessage = viewModel.error ?? "Couldn't draft answers. Please try again."
            showError = true
            return
        }
        for (index, draft) in drafts.enumerated() where !declined.contains(index) {
            let current = answers[index]?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
            if current.isEmpty { answers[index] = draft }
        }
    }

    private func performIgnore() async {
        if await viewModel.ignore(request.id) {
            dismiss()
        } else {
            errorMessage = viewModel.error ?? "Couldn't ignore this request. Please try again."
            showError = true
        }
    }
}
