import SwiftUI

/// One Mirror reflection: the full text, when it was posted, exactly what went
/// into it, and a way to talk about it. Opened from a tapped notification
/// (presented by RootView) and from Mirror History (pushed).
struct MirrorDetailView: View {

    @StateObject private var viewModel: MirrorDetailViewModel
    /// Opens a source entry. Nil hides the entry links.
    private let onOpenEntry: ((String) -> Void)?

    @State private var showDetails = false
    @State private var showChatPicker = false
    /// Held until the picker has finished dismissing; presenting the chat cover
    /// mid-dismissal is silently dropped by UIKit.
    @State private var pendingChatKind: ChatKind?

    init(id: String, repository: EncouragementRepository, onOpenEntry: ((String) -> Void)? = nil) {
        _viewModel = StateObject(wrappedValue: MirrorDetailViewModel(id: id, repository: repository))
        self.onOpenEntry = onOpenEntry
    }

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            switch viewModel.state {
            case .loading:
                ProgressView().tint(Color.accentWarm)
            case .notFound:
                message("This reflection is no longer available.")
            case .failed:
                VStack(spacing: Spacing.m) {
                    message("Couldn't load this reflection.")
                    Button("Try again") { Task { await viewModel.load() } }
                        .foregroundStyle(Color.accentWarm)
                }
            case let .loaded(echo, inputs):
                loaded(echo, inputs)
            }
        }
        .navigationTitle(EncouragementPrefs.displayName)
        .navigationBarTitleDisplayMode(.inline)
        .task { await viewModel.load() }
    }

    private func loaded(_ echo: EncouragementMessage, _ inputs: MirrorInputs?) -> some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.l) {
                textCard(echo)
                Text("\(echo.timeOfDay.label) · \(Self.timestampLabel(echo.deliveredAt ?? echo.createdAt))")
                    .font(.captionText)
                    .foregroundStyle(Color.textSecondary)
                detailsSection(inputs)
                chatButton
            }
            .padding(.horizontal, Spacing.m)
            .padding(.top, Spacing.s)
            .padding(.bottom, AppTabBar.scrollBottomPadding)
        }
        .sheet(isPresented: $showChatPicker, onDismiss: {
            guard let kind = pendingChatKind else { return }
            pendingChatKind = nil
            MirrorRouter.shared.startChat(JournalChatRequest(
                journalId: nil, journalTitle: MirrorChatContext.chatLabel(echo), kind: kind, mirrorId: echo.id
            ))
        }) {
            JournalChatPickerSheet(
                journalTitle: MirrorChatContext.chatLabel(echo),
                onSelect: { kind in pendingChatKind = kind },
                heading: "Chat about this reflection",
                explainer: "Start a new text or voice call with your AI. This reflection and the journal entries it came from will be included as context."
            )
            .presentationDetents([.medium])
        }
    }

    private func textCard(_ echo: EncouragementMessage) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            HStack {
                Spacer()
                CopyButton(text: echo.text, accessibilityText: "Copy reflection")
            }
            Text(echo.text)
                .font(.uiBody)
                .foregroundStyle(Color.textPrimary)
                .textSelection(.enabled)
                .fixedSize(horizontal: false, vertical: true)
        }
        .padding(Spacing.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous).fill(Color.cardBackground))
    }

    @ViewBuilder
    private func detailsSection(_ inputs: MirrorInputs?) -> some View {
        VStack(alignment: .leading, spacing: Spacing.m) {
            Button {
                withAnimation(.easeInOut(duration: 0.2)) { showDetails.toggle() }
            } label: {
                HStack {
                    Text("Details").font(.uiBody.weight(.semibold))
                    Spacer()
                    Image(systemName: showDetails ? "chevron.up" : "chevron.down")
                }
                .foregroundStyle(Color.textPrimary)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityHint("Shows what went into this reflection")

            if showDetails {
                if let inputs {
                    sourcesList(inputs)
                    promptBlock(inputs)
                    CopyButton(text: MirrorDetailViewModel.detailsText(inputs), label: "Copy text",
                               accessibilityText: "Copy what went into this reflection")
                } else {
                    Text("Sources weren't recorded for this reflection.")
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }
            }
        }
        .padding(Spacing.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous).fill(Color.cardBackground))
    }

    private func sourcesList(_ inputs: MirrorInputs) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            if !inputs.sources.isEmpty {
                Text("SOURCE ENTRIES").font(.captionText.weight(.semibold)).foregroundStyle(Color.textSecondary)
            }
            ForEach(inputs.sources, id: \.id) { source in
                Button {
                    onOpenEntry?(source.id)
                } label: {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("\(source.type) · \(source.title) · \(source.createdAt.formatted(date: .abbreviated, time: .shortened))")
                            .font(.captionText.weight(.semibold))
                            .foregroundStyle(onOpenEntry == nil ? Color.textPrimary : Color.accentWarm)
                        Text(source.content)
                            .font(.captionText)
                            .foregroundStyle(Color.textPrimary)
                            .fixedSize(horizontal: false, vertical: true)
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                }
                .buttonStyle(.plain)
                .disabled(onOpenEntry == nil)
            }
        }
    }

    @ViewBuilder
    private func promptBlock(_ inputs: MirrorInputs) -> some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            Text("FULL PROMPT").font(.captionText.weight(.semibold)).foregroundStyle(Color.textSecondary)
            if let system = inputs.system, let user = inputs.user {
                Text("System").font(.captionText.weight(.semibold)).foregroundStyle(Color.textSecondary)
                Text(system).font(.system(.caption, design: .monospaced)).textSelection(.enabled)
                Text("User").font(.captionText.weight(.semibold)).foregroundStyle(Color.textSecondary)
                Text(user).font(.system(.caption, design: .monospaced)).textSelection(.enabled)
                if let model = inputs.model {
                    Text("Model: \(model)\(inputs.attempts.map { " · \($0) attempt\($0 == 1 ? "" : "s")" } ?? "")")
                        .font(.captionText).foregroundStyle(Color.textSecondary)
                }
                if !inputs.fallbackSlots.isEmpty {
                    Text("Canned fallback, not model output: \(inputs.fallbackSlots.map(\.label).joined(separator: ", "))")
                        .font(.captionText).foregroundStyle(Color.textSecondary)
                }
            } else {
                Text("Prompt text not recorded.").font(.captionText).foregroundStyle(Color.textSecondary)
            }
        }
        .foregroundStyle(Color.textPrimary)
    }

    private var chatButton: some View {
        Button { showChatPicker = true } label: {
            Label("Chat about this", systemImage: "bubble.left.and.text.bubble.right")
                .font(.uiBody.weight(.semibold))
                .foregroundStyle(Color.white)
                .frame(maxWidth: .infinity, minHeight: 48)
                .background(RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous).fill(Color.accentWarm))
        }
        .buttonStyle(.plain)
    }

    private func message(_ text: String) -> some View {
        Text(text)
            .font(.uiBody)
            .foregroundStyle(Color.textSecondary)
            .multilineTextAlignment(.center)
            .padding(Spacing.xl)
    }

    /// "Today, 9:00 AM" / "Yesterday, 4:00 PM" / "Aug 28, 4:00 PM", like Mirror History.
    private static func timestampLabel(_ date: Date) -> String {
        let calendar = Calendar.current
        let time = date.formatted(date: .omitted, time: .shortened)
        if calendar.isDateInToday(date) { return "Today, \(time)" }
        if calendar.isDateInYesterday(date) { return "Yesterday, \(time)" }
        return date.formatted(date: .abbreviated, time: .shortened)
    }
}
