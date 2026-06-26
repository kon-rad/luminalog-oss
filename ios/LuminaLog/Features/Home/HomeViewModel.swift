import Foundation
import OSLog
import Combine

/// Drives the Home screen (design §2): live recent entries, live profile
/// (greeting + stats), and the daily prompt hero card.
@MainActor
final class HomeViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "home")

    /// How many entries the "Recent entries" section shows (design §2).
    static let recentLimit = 10

    /// Daily prompt carousel state.
    enum PromptState: Equatable {
        case loading
        case loaded([DailyPromptItem])
    }

    /// nil while the first emission is in flight (skeleton state).
    @Published private(set) var recentEntries: [JournalEntry]?
    @Published private(set) var profile: UserProfile?
    @Published private(set) var promptState: PromptState = .loading

    @Published var showMilestone = false
    /// The "yyyy-MM-dd" the goal was reached, for popup copy. Set when the
    /// coordinator fires.
    @Published private(set) var milestoneEarnedDate: String?
    @Published var showReport = false
    /// Set to true when the user taps "Generate" in the milestone sheet so
    /// the report sheet is presented after the milestone sheet fully dismisses.
    @Published var pendingShowReport = false

    private let journals: JournalRepository
    private let profiles: ProfileRepository
    private let ai: AIService
    private let dailyReports: DailyReportRepository
    private let activity: AppActivityMonitor
    private let recording = RecordingState.shared
    private var coordinator: MilestoneCoordinator?
    private var recordingCancellable: AnyCancellable?
    private var activityCancellable: AnyCancellable?

    private var entriesTask: Task<Void, Never>?
    private var profileTask: Task<Void, Never>?
    /// The latest per-emission daily-prompt resolution, tracked so deinit
    /// cancels an in-flight AI fetch instead of leaking it.
    private var promptResolutionTask: Task<Void, Never>?

    /// In-memory cache for the prompts fetched from the AI service, so the
    /// service is called at most once per screen lifetime.
    private var fetchedPrompts: [DailyPromptItem]?
    private var isResolvingPrompt = false

    private var hasStarted = false

    init(journals: JournalRepository, profiles: ProfileRepository, ai: AIService, dailyReports: DailyReportRepository, activity: AppActivityMonitor) {
        self.activity = activity
        self.journals = journals
        self.profiles = profiles
        self.ai = ai
        self.dailyReports = dailyReports
    }

    deinit {
        entriesTask?.cancel()
        profileTask?.cancel()
        promptResolutionTask?.cancel()
        recordingCancellable = nil
        activityCancellable = nil
    }

    // MARK: - Lifecycle

    /// Starts the streams. Idempotent — Home stays mounted across tab
    /// switches, so this runs once per signed-in session.
    func start() {
        guard !hasStarted else { return }
        hasStarted = true

        // Bridge the legacy recording flag into the shared monitor.
        recordingCancellable = recording.$isRecording
            .receive(on: RunLoop.main)
            .sink { [weak self] isRec in self?.activity.setRecording(isRec) }

        // Re-evaluate the milestone whenever the interruption gate changes.
        activityCancellable = activity.objectWillChange
            .receive(on: RunLoop.main)            // value is settled on the next runloop tick
            .sink { [weak self] in
                guard let self else { return }
                self.coordinator?.update(goalWords: self.goalProgressWords, canPresent: self.activity.canPresentInterruption)
            }

        entriesTask = Task { [weak self] in
            guard let stream = self?.journals.recentEntries(limit: Self.recentLimit) else { return }
            for await entries in stream {
                guard let self, !Task.isCancelled else { return }
                self.recentEntries = entries
                self.activity.setProcessingEntry(Self.anyProcessing(entries))
            }
        }

        profileTask = Task { [weak self] in
            guard let stream = self?.profiles.profile() else { return }
            for await profile in stream {
                guard let self, !Task.isCancelled else { return }
                self.profile = profile
                self.handleProfileUpdate()
                // Resolve off the stream loop so a slow AI fetch never
                // blocks later profile emissions.
                self.promptResolutionTask = Task { await self.resolveDailyPromptIfNeeded() }
            }
        }
    }

    // MARK: - Milestone + daily report

    var todayKeyPublic: String { todayKey() }

    /// "yyyy-MM-dd" in the user's timezone.
    private func todayKey() -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        if let tz = TimeZone(identifier: profile?.timezone ?? "") { f.timeZone = tz }
        return f.string(from: Date())
    }

    private func handleProfileUpdate() {
        if coordinator == nil, let id = profile?.id {
            let c = MilestoneCoordinator(uid: id, target: goalTarget, today: { [weak self] in self?.todayKey() ?? "" })
            c.onShouldPresent = { [weak self] earnedDate in
                guard let self else { return }
                self.milestoneEarnedDate = earnedDate
                self.showMilestone = true
            }
            coordinator = c
        }
        coordinator?.update(goalWords: goalProgressWords, canPresent: activity.canPresentInterruption)
    }

    /// Whether the milestone is being shown on the same day it was earned.
    var milestoneEarnedToday: Bool {
        milestoneEarnedDate == nil || milestoneEarnedDate == todayKey()
    }

    /// True when any entry is still in a non-settled processing state, so the
    /// milestone popup waits until uploads/transcriptions finish.
    static func anyProcessing(_ entries: [JournalEntry]) -> Bool {
        entries.contains { entry in
            if let p = entry.processingStatus,
               p == .processing || p == .uploading || p == .saving || p == .transcribing {
                return true
            }
            return entry.transcriptStatus == .processing
        }
    }

    // MARK: - Greeting

    /// Warm, time-aware greeting using the first name ("Good morning, Demo").
    var greeting: String {
        let salutation: String
        switch Calendar.current.component(.hour, from: Date()) {
        case 0..<12: salutation = "Good morning"
        case 12..<17: salutation = "Good afternoon"
        default: salutation = "Good evening"
        }
        if let firstName, !firstName.isEmpty {
            return "\(salutation), \(firstName)"
        }
        return salutation
    }

    private var firstName: String? {
        profile?.displayName
            .split(separator: " ")
            .first
            .map(String.init)
    }

    // MARK: - Stats

    var streakText: String {
        "\(profile?.stats.streakCount ?? 0)-day"
    }

    var totalWordsText: String {
        (profile?.stats.totalWords ?? 0).formatted()
    }

    // MARK: - Daily goal progress

    var goalTarget: Int { DailyGoal.wordTarget }

    /// Words journaled today (user timezone); 0 if the cached goal-day is stale.
    var goalProgressWords: Int {
        guard let stats = profile?.stats, let day = stats.goalDayDate else { return 0 }
        var calendar = Calendar.current
        if let tz = TimeZone(identifier: profile?.timezone ?? "") { calendar.timeZone = tz }
        return calendar.isDate(day, inSameDayAs: Date()) ? stats.goalDayWords : 0
    }

    var goalMet: Bool { goalProgressWords >= goalTarget }

    /// 0...1 progress fraction for the goal ring/bar.
    var goalFraction: Double {
        guard goalTarget > 0 else { return 0 }
        return min(1, Double(goalProgressWords) / Double(goalTarget))
    }

    /// Trailing label: remaining words, or a met confirmation.
    var goalProgressLabel: String {
        goalMet ? "Goal met" : "\(max(0, goalTarget - goalProgressWords)) words to go"
    }

    // MARK: - Daily prompt

    /// Uses `profile.dailyPrompt` when it was generated today (user's
    /// timezone); otherwise asks the AI service once and caches the result
    /// in memory.
    ///
    /// Known limitation: resolution only runs on profile emissions, so if
    /// the app stays open across midnight the displayed prompt is not
    /// refreshed until the next emission or screen recreation (v1 tradeoff).
    private func resolveDailyPromptIfNeeded() async {
        if let prompts = todaysProfilePrompts() {
            promptState = .loaded(prompts)
            return
        }
        if let fetchedPrompts {
            promptState = .loaded(fetchedPrompts)
            return
        }
        guard !isResolvingPrompt else { return }
        isResolvingPrompt = true
        defer { isResolvingPrompt = false }
        do {
            let prompts = try await ai.dailyPrompt()
            guard !prompts.isEmpty else {
                if case .loading = promptState { promptState = .loaded(Self.fallbackPrompts) }
                return
            }
            fetchedPrompts = prompts
            // A profile prompt that arrived while fetching wins.
            if case .loading = promptState {
                promptState = .loaded(prompts)
            }
            // Persist so subsequent app launches skip the LLM call.
            if var updated = profile {
                updated.dailyPrompt = UserProfile.DailyPrompt(items: prompts)
                try? await profiles.update(updated)
            }
        } catch {
            Self.logger.error("dailyPrompt failed: \(error.localizedDescription, privacy: .public)")
            if case .loading = promptState {
                promptState = .loaded(Self.fallbackPrompts)
            }
        }
    }

    /// Shown when the AI service fails and there is no cached set for today.
    private static let fallbackPrompts: [DailyPromptItem] = [
        DailyPromptItem(area: "Reflection", text: "Take a moment to reflect — what thought or feeling has been quietly sitting with you that you haven't had a chance to put into words yet?"),
    ]

    /// The profile's cached prompts, only if their date is today in the user's timezone.
    private func todaysProfilePrompts() -> [DailyPromptItem]? {
        guard let profile, let dailyPrompt = profile.dailyPrompt else { return nil }
        var calendar = Calendar.current
        if let timezone = TimeZone(identifier: profile.timezone) {
            calendar.timeZone = timezone
        }
        guard calendar.isDate(dailyPrompt.date, inSameDayAs: Date()) else { return nil }
        let items = dailyPrompt.items
        return items.isEmpty ? nil : items
    }

    /// The first resolved prompt's text, if any — used to seed the Create flow
    /// from the empty state. The carousel itself seeds from the visible card.
    var currentPromptText: String? {
        if case .loaded(let prompts) = promptState { return prompts.first?.text }
        return nil
    }
}
