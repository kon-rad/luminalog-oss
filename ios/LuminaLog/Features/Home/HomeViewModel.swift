import Foundation
import OSLog

/// Drives the Home screen (design §2): live recent entries, live profile
/// (greeting + stats), and the daily prompt hero card.
@MainActor
final class HomeViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.luminalog.app", category: "home")

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

    private let journals: JournalRepository
    private let profiles: ProfileRepository
    private let ai: AIService

    private var entriesTask: Task<Void, Never>?
    private var profileTask: Task<Void, Never>?

    /// In-memory cache for a prompt fetched from the AI service, so the
    /// service is called at most once per screen lifetime.
    private var fetchedPrompt: String?
    private var isResolvingPrompt = false

    private var hasStarted = false

    init(journals: JournalRepository, profiles: ProfileRepository, ai: AIService) {
        self.journals = journals
        self.profiles = profiles
        self.ai = ai
    }

    deinit {
        entriesTask?.cancel()
        profileTask?.cancel()
    }

    // MARK: - Lifecycle

    /// Starts the streams. Idempotent — Home stays mounted across tab
    /// switches, so this runs once per signed-in session.
    func start() {
        guard !hasStarted else { return }
        hasStarted = true

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
                // Resolve off the stream loop so a slow AI fetch never
                // blocks later profile emissions.
                Task { await self.resolveDailyPromptIfNeeded() }
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

    // MARK: - Daily prompt

    /// Uses `profile.dailyPrompt` when it was generated today (user's
    /// timezone); otherwise asks the AI service once and caches the result
    /// in memory.
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
