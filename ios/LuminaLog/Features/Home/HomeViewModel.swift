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

    /// Daily prompt card state.
    enum PromptState: Equatable {
        case loading
        case loaded(String)
    }

    /// nil while the first emission is in flight (skeleton state).
    @Published private(set) var recentEntries: [JournalEntry]?
    @Published private(set) var profile: UserProfile?
    @Published private(set) var promptState: PromptState = .loading

    @Published var showMilestone = false
    @Published var showReport = false
    @Published private(set) var todaysReport: DailyInsightsReport?

    private let journals: JournalRepository
    private let profiles: ProfileRepository
    private let ai: AIService
    private let dailyReports: DailyReportRepository
    private let recording = RecordingState.shared
    private var coordinator: MilestoneCoordinator?
    private var recordingCancellable: AnyCancellable?

    /// Exposes the report repository for the view's report sheet.
    var dailyReportsRepo: DailyReportRepository { dailyReports }

    private var entriesTask: Task<Void, Never>?
    private var profileTask: Task<Void, Never>?
    /// The latest per-emission daily-prompt resolution, tracked so deinit
    /// cancels an in-flight AI fetch instead of leaking it.
    private var promptResolutionTask: Task<Void, Never>?

    /// In-memory cache for a prompt fetched from the AI service, so the
    /// service is called at most once per screen lifetime.
    private var fetchedPrompt: String?
    private var isResolvingPrompt = false

    private var hasStarted = false

    init(journals: JournalRepository, profiles: ProfileRepository, ai: AIService, dailyReports: DailyReportRepository) {
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
    }

    // MARK: - Lifecycle

    /// Starts the streams. Idempotent — Home stays mounted across tab
    /// switches, so this runs once per signed-in session.
    func start() {
        guard !hasStarted else { return }
        hasStarted = true

        recordingCancellable = recording.$isRecording
            .receive(on: RunLoop.main)
            .sink { [weak self] isRec in
                guard let self else { return }
                self.coordinator?.update(goalWords: self.goalProgressWords, isRecording: isRec)
            }

        entriesTask = Task { [weak self] in
            guard let stream = self?.journals.recentEntries(limit: Self.recentLimit) else { return }
            for await entries in stream {
                guard let self, !Task.isCancelled else { return }
                self.recentEntries = entries
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

    /// "yyyy-MM-dd" in the user's timezone.
    private func todayKey() -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"
        if let tz = TimeZone(identifier: profile?.timezone ?? "") { f.timeZone = tz }
        return f.string(from: Date())
    }

    private func handleProfileUpdate() {
        if coordinator == nil, let id = profile?.id {
            let c = MilestoneCoordinator(uid: id, target: goalTarget, today: { [weak self] in self?.todayKey() ?? "" })
            c.onShouldPresent = { [weak self] in self?.showMilestone = true }
            coordinator = c
        }
        coordinator?.update(goalWords: goalProgressWords, isRecording: recording.isRecording)
        if todaysReport == nil {
            Task { [weak self] in
                guard let self else { return }
                self.todaysReport = try? await self.dailyReports.report(for: self.todayKey())
            }
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
        if let prompt = todaysProfilePrompt() {
            promptState = .loaded(prompt)
            return
        }
        if let fetchedPrompt {
            promptState = .loaded(fetchedPrompt)
            return
        }
        guard !isResolvingPrompt else { return }
        isResolvingPrompt = true
        defer { isResolvingPrompt = false }
        do {
            let prompt = try await ai.dailyPrompt()
            fetchedPrompt = prompt
            // A profile prompt that arrived while fetching wins.
            if case .loading = promptState {
                promptState = .loaded(prompt)
            }
            // Persist so subsequent app launches skip the LLM call.
            if var updated = profile {
                updated.dailyPrompt = UserProfile.DailyPrompt(text: prompt)
                try? await profiles.update(updated)
            }
        } catch {
            Self.logger.error("dailyPrompt failed: \(error.localizedDescription, privacy: .public)")
            if case .loading = promptState {
                promptState = .loaded("What's on your mind today?")
            }
        }
    }

    /// The profile's cached prompt, only if its date is today in the user's timezone.
    private func todaysProfilePrompt() -> String? {
        guard let profile, let dailyPrompt = profile.dailyPrompt else { return nil }
        var calendar = Calendar.current
        if let timezone = TimeZone(identifier: profile.timezone) {
            calendar.timeZone = timezone
        }
        guard calendar.isDate(dailyPrompt.date, inSameDayAs: Date()) else { return nil }
        return dailyPrompt.text
    }

    /// The currently displayed prompt, if resolved — passed to the Create flow.
    var currentPromptText: String? {
        if case .loaded(let text) = promptState { return text }
        return nil
    }
}
