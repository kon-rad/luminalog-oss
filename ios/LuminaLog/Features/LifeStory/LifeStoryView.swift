import SwiftUI

/// Life Story: what the interview is, a button to start a new one, and the list
/// of every interview the user has taken.
struct LifeStoryView: View {

    @StateObject private var viewModel: LifeStoryViewModel
    private let services: AppServices

    @State private var openInterviewId: String?

    init(services: AppServices) {
        self.services = services
        _viewModel = StateObject(wrappedValue: LifeStoryViewModel(services: services))
    }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.l) {
                introCard

                if let script = viewModel.script {
                    startButton(script)
                    if !viewModel.interviews.isEmpty {
                        Text("Your interviews")
                            .font(.uiBody.weight(.semibold))
                            .foregroundStyle(Color.textPrimary)
                        ForEach(viewModel.interviews) { interview in
                            interviewRow(interview, script: script)
                        }
                    }
                } else if let error = viewModel.loadError {
                    loadFailed(error)
                } else {
                    ProgressView()
                        .tint(Color.accentWarm)
                        .frame(maxWidth: .infinity)
                        .padding(.top, Spacing.l)
                }
            }
            .padding(Spacing.m)
        }
        .background(Color.appBackground.ignoresSafeArea())
        .navigationTitle("Life story")
        .navigationBarTitleDisplayMode(.inline)
        .navigationDestination(item: $openInterviewId) { id in
            LifeInterviewDetailView(viewModel: viewModel, services: services, interviewId: id)
        }
        .task { await viewModel.start() }
    }

    // MARK: - Intro

    private var introCard: some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            Text("The story of your life, in your words")
                .font(.journalTitle)
                .foregroundStyle(Color.textPrimary)
            Text("A guided voice interview in seven parts: the chapters of your life, the scenes that stand out, where it's going, and what you believe. Take one part at a time and stop whenever you like.")
                .font(.uiBody)
                .foregroundStyle(Color.textSecondary)
            VStack(alignment: .leading, spacing: Spacing.xs) {
                introPoint("person.wave.2", "You're talking with an AI. It asks and listens. It won't analyse or advise you.")
                introPoint("heart.text.square", "This isn't therapy, and there are no right or wrong answers.")
                introPoint("forward.end", "Some questions are about hard times. Say \u{201C}skip\u{201D} to pass on any question.")
                introPoint("lock", "Your voice stays on this iPhone. The text of what you say goes to the AI model to get the next question, and your transcript is saved encrypted.")
            }
            .padding(.top, Spacing.xs)
        }
        .padding(Spacing.m)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.cardBackground)
        )
    }

    private func introPoint(_ symbol: String, _ text: String) -> some View {
        HStack(alignment: .top, spacing: Spacing.s) {
            Image(systemName: symbol)
                .font(.system(size: 13, weight: .medium))
                .foregroundStyle(Color.accentWarm)
                .frame(width: 20)
            Text(text)
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    // MARK: - Start

    private func startButton(_ script: LifeInterviewScript) -> some View {
        Button {
            openInterviewId = viewModel.newInterviewId()
        } label: {
            VStack(spacing: 2) {
                Text(viewModel.interviews.isEmpty ? "Start your interview" : "Start a new interview")
                    .font(.uiBody.weight(.semibold))
                Text("\(script.sections.count) parts, about \(script.totalMinutes) minutes in all")
                    .font(.captionText)
                    .opacity(0.85)
            }
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity, minHeight: 56)
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                    .fill(Color.accentWarm)
            )
        }
        .buttonStyle(.plain)
        .accessibilityHint("Opens the seven parts of a new interview")
    }

    // MARK: - List

    private func interviewRow(_ interview: LifeInterview, script: LifeInterviewScript) -> some View {
        let done = interview.completedSections(in: script)
        let complete = interview.isComplete(in: script)
        return Button {
            openInterviewId = interview.id
        } label: {
            HStack(spacing: Spacing.m) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Interview \(interview.number)")
                        .font(.uiBody)
                        .foregroundStyle(Color.textPrimary)
                    Text("Started \(interview.startedAt.formatted(date: .abbreviated, time: .omitted))")
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }
                Spacer()
                Text(complete ? "Complete" : "\(done) of \(script.sections.count) parts")
                    .font(.captionText.weight(.medium))
                    .foregroundStyle(complete ? Color.accentWarm : Color.textSecondary)
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .semibold))
                    .foregroundStyle(Color.textSecondary.opacity(0.6))
            }
            .padding(Spacing.m)
            .background(
                RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                    .fill(Color.cardBackground)
            )
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
    }

    private func loadFailed(_ message: String) -> some View {
        VStack(spacing: Spacing.m) {
            Text(message)
                .font(.uiBody)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
            Button("Try again") {
                Task { await viewModel.reloadScript() }
            }
            .font(.uiBody.weight(.semibold))
            .foregroundStyle(Color.accentWarm)
        }
        .frame(maxWidth: .infinity)
        .padding(.top, Spacing.l)
    }
}

/// One interview: its seven parts, how far each has got, and its past sittings.
struct LifeInterviewDetailView: View {

    @ObservedObject var viewModel: LifeStoryViewModel
    let services: AppServices
    let interviewId: String

    /// Identifiable wrapper so a sitting can drive `fullScreenCover(item:)`.
    private struct SittingRequest: Identifiable {
        let id = UUID()
        let sitting: LifeInterviewSitting
    }

    @State private var activeSitting: SittingRequest?
    /// A sensitive section waiting for the user to confirm.
    @State private var pendingSensitive: LifeInterviewSection?
    @State private var transcriptChatId: String?
    @State private var isCreditsPresented = false
    @State private var isDeleteConfirmPresented = false
    @Environment(\.dismiss) private var dismiss

    private var interview: LifeInterview { viewModel.interview(id: interviewId) }

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: Spacing.m) {
                if let script = viewModel.script {
                    header(script)
                    if let error = viewModel.deleteError {
                        Text(error)
                            .font(.captionText)
                            .foregroundStyle(Color.textSecondary)
                    }
                    ForEach(script.sections) { section in
                        sectionCard(section)
                    }
                }
            }
            .padding(Spacing.m)
        }
        .background(Color.appBackground.ignoresSafeArea())
        .navigationTitle("Interview \(interview.number)")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            if !interview.sittings.isEmpty {
                ToolbarItem(placement: .topBarTrailing) {
                    Button(role: .destructive) {
                        isDeleteConfirmPresented = true
                    } label: {
                        Image(systemName: "trash")
                    }
                    .accessibilityLabel("Delete this interview")
                }
            }
        }
        .navigationDestination(item: $transcriptChatId) { chatId in
            VoiceCallDetailView(
                chatId: chatId,
                repository: services.chats,
                media: services.media,
                importer: services.voiceRecordingImporter
            )
        }
        .fullScreenCover(item: $activeSitting) { request in
            VoiceCallView(
                voice: services.voice,
                chats: services.chats,
                credits: services.credits,
                interview: request.sitting,
                onViewTranscript: { chat in
                    activeSitting = nil
                    transcriptChatId = chat.id
                },
                onInsufficientCredits: {
                    isCreditsPresented = true
                }
            )
        }
        .sheet(isPresented: $isCreditsPresented) {
            CreditsView(credits: services.credits)
        }
        .alert(
            "This part asks about hard times",
            isPresented: Binding(
                get: { pendingSensitive != nil },
                set: { if !$0 { pendingSensitive = nil } }
            ),
            presenting: pendingSensitive
        ) { section in
            Button("Begin") { begin(section) }
            Button("Not now", role: .cancel) {}
        } message: { _ in
            Text("You can skip any question by saying \u{201C}skip\u{201D}, and end the call at any time.")
        }
        .confirmationDialog(
            "Delete this interview?",
            isPresented: $isDeleteConfirmPresented,
            titleVisibility: .visible
        ) {
            Button("Delete interview and transcripts", role: .destructive) {
                let target = interview
                Task {
                    if await viewModel.delete(target) { dismiss() }
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("Every part of this interview and its transcripts will be removed. This can't be undone.")
        }
    }

    // MARK: - Header

    private func header(_ script: LifeInterviewScript) -> some View {
        let done = interview.completedSections(in: script)
        return VStack(alignment: .leading, spacing: Spacing.xs) {
            Text(interview.isComplete(in: script) ? "Complete" : "\(done) of \(script.sections.count) parts done")
                .font(.uiBody.weight(.semibold))
                .foregroundStyle(Color.textPrimary)
            Text("Take the parts in order or pick any one. Each is its own call.")
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
        }
    }

    // MARK: - Sections

    private func sectionCard(_ section: LifeInterviewSection) -> some View {
        let progress = interview.progress(for: section.key)
        let past = interview.sittings(for: section.key)
        return VStack(alignment: .leading, spacing: Spacing.s) {
            HStack(alignment: .firstTextBaseline, spacing: Spacing.s) {
                Text(section.key)
                    .font(.captionText.weight(.semibold))
                    .foregroundStyle(Color.accentWarm)
                    .frame(width: 18, alignment: .leading)
                VStack(alignment: .leading, spacing: 2) {
                    Text(section.title)
                        .font(.uiBody)
                        .foregroundStyle(Color.textPrimary)
                    Text(subtitle(section, progress: progress))
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }
                Spacer()
                statusBadge(progress)
            }

            Button {
                if section.sensitive {
                    pendingSensitive = section
                } else {
                    begin(section)
                }
            } label: {
                Text(actionTitle(progress))
                    .font(.uiBody.weight(.semibold))
                    .foregroundStyle(progress == .done ? Color.accentWarm : .white)
                    .frame(maxWidth: .infinity, minHeight: 44)
                    .background(
                        RoundedRectangle(cornerRadius: CornerRadius.medium, style: .continuous)
                            .fill(progress == .done ? Color.accentWarm.opacity(0.12) : Color.accentWarm)
                    )
            }
            .buttonStyle(.plain)

            ForEach(past) { sitting in
                Button {
                    transcriptChatId = sitting.id
                } label: {
                    HStack {
                        Image(systemName: "text.bubble")
                            .font(.system(size: 12, weight: .medium))
                        Text(sitting.createdAt.formatted(date: .abbreviated, time: .shortened))
                            .font(.captionText)
                        Spacer()
                        Text("Transcript")
                            .font(.captionText)
                        Image(systemName: "chevron.right")
                            .font(.system(size: 11, weight: .semibold))
                    }
                    .foregroundStyle(Color.textSecondary)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
            }
        }
        .padding(Spacing.m)
        .background(
            RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                .fill(Color.cardBackground)
        )
    }

    private func subtitle(_ section: LifeInterviewSection, progress: LifeInterviewSectionProgress) -> String {
        var parts = ["\(section.items.count) \(section.items.count == 1 ? "question" : "questions")", "about \(section.minutes) min"]
        if section.sensitive { parts.append("includes hard topics") }
        if case .inProgress(let item) = progress, let title = section.item(item)?.title {
            parts.append("stopped at \(title)")
        }
        return parts.joined(separator: " · ")
    }

    private func actionTitle(_ progress: LifeInterviewSectionProgress) -> String {
        switch progress {
        case .notStarted: return "Begin"
        case .inProgress: return "Continue"
        case .done: return "Take this part again"
        }
    }

    @ViewBuilder
    private func statusBadge(_ progress: LifeInterviewSectionProgress) -> some View {
        switch progress {
        case .notStarted:
            EmptyView()
        case .inProgress:
            Text("In progress")
                .font(.captionText.weight(.medium))
                .foregroundStyle(Color.textSecondary)
        case .done:
            Label("Done", systemImage: "checkmark.circle.fill")
                .font(.captionText.weight(.medium))
                .foregroundStyle(Color.accentWarm)
        }
    }

    private func begin(_ section: LifeInterviewSection) {
        // A finished part taken again starts from its first question.
        let sitting = interview.progress(for: section.key) == .done
            ? LifeInterviewSitting(interviewId: interviewId, section: section)
            : interview.sitting(for: section)
        activeSitting = SittingRequest(sitting: sitting)
    }
}
