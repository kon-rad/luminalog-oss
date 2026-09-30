import Foundation

/// Backs "What Argo knows". Every edit here is authoritative: it sets `userAuthored`,
/// so extraction can never rewrite the fact afterwards (see `UserFactMerger`).
/// Dependencies are closures so tests need no Firebase.
@MainActor
final class UserFactsViewModel: ObservableObject {

    enum LoadState: Equatable { case loading, loaded, failed }

    struct Section: Identifiable, Equatable {
        let category: UserFactCategory
        let facts: [UserFact]
        var id: String { category.rawValue }
    }

    struct Progress: Equatable {
        let read: Int
        let total: Int
    }

    struct Source: Identifiable, Equatable {
        /// The entry id.
        let id: String
        let title: String
        /// nil when the entry has been deleted.
        let date: Date?
        var exists: Bool { date != nil }
    }

    @Published private(set) var loadState: LoadState = .loading
    @Published private(set) var facts: [UserFact] = []
    @Published private(set) var learning = true
    @Published private(set) var progress: Progress?
    @Published private(set) var hasEntries = false
    @Published var errorMessage: String?

    private let repository: UserFactRepository
    private let loadEntries: @MainActor () async throws -> [JournalEntry]
    private let consent: @MainActor () -> Bool
    private let reconcile: @MainActor () async -> Int
    /// Tells a run in flight to stop writing (`UserFactReconciler.pause()`).
    private let pauseLearning: @MainActor () -> Void
    private let now: @MainActor () -> Date
    private let makeId: () -> String
    private var entriesById: [String: JournalEntry] = [:]
    private var didStart = false

    init(
        repository: UserFactRepository,
        loadEntries: @escaping @MainActor () async throws -> [JournalEntry],
        hasConsent: @escaping @MainActor () -> Bool,
        reconcile: @escaping @MainActor () async -> Int,
        pauseLearning: @escaping @MainActor () -> Void = {},
        now: @escaping @MainActor () -> Date = Date.init,
        makeId: @escaping () -> String = { UUID().uuidString }
    ) {
        self.repository = repository
        self.loadEntries = loadEntries
        self.consent = hasConsent
        self.reconcile = reconcile
        self.pauseLearning = pauseLearning
        self.now = now
        self.makeId = makeId
    }

    /// Production wiring. `reconcile` returns the number of batches read, so the screen
    /// reloads only when something could have changed.
    convenience init(services: AppServices) {
        let reconciler = services.userFactReconciler
        self.init(
            repository: services.userFacts,
            loadEntries: { [journals = services.journals] in try await journals.fetchAllEntries() },
            hasConsent: { [consentStore = services.consentStore] in consentStore.hasConsentedAI },
            reconcile: { await reconciler?.run(budget: UserFactReconciler.screenBudget, force: true).batches ?? 0 },
            pauseLearning: { reconciler?.pause() }
        )
    }

    var hasConsent: Bool { consent() }

    var sections: [Section] {
        UserFactCategory.allCases.compactMap { category in
            let list = facts
                .filter { $0.status == .active && $0.category == category }
                .sorted { $0.lastConfirmedAt > $1.lastConfirmedAt }
            return list.isEmpty ? nil : Section(category: category, facts: list)
        }
    }

    var proposals: [UserFact] {
        facts.filter { $0.status == .active && $0.proposal != nil }
    }

    var history: [UserFact] {
        facts.filter { $0.status == .invalidated }
            .sorted { ($0.validTo ?? .distantPast) > ($1.validTo ?? .distantPast) }
    }

    /// True when there is nothing to show: tombstones don't count.
    var isEmpty: Bool { !facts.contains { $0.status != .rejected } }

    func fact(id: String) -> UserFact? { facts.first { $0.id == id } }

    /// The entries a fact rests on, newest first.
    func sources(for fact: UserFact) -> [Source] {
        fact.evidence.reversed().map { id in
            guard let entry = entriesById[id] else { return Source(id: id, title: "Entry deleted", date: nil) }
            return Source(id: id, title: entry.title.isEmpty ? "Untitled" : entry.title, date: entry.createdAt)
        }
    }

    /// The screen's `.task`. Runs `start()` on the first appearance only: `.task` fires
    /// again on every back navigation, and pull to refresh is the explicit trigger.
    func appear() async {
        guard !didStart else { return }
        didStart = true
        await start()
    }

    /// First appearance and pull to refresh: show what is stored, then read a little more.
    func start() async {
        await load()
        guard loadState == .loaded, learning, hasConsent else { return }
        if await reconcile() > 0 { await load() }
    }

    func load() async {
        do {
            let all = try await repository.all()
            let state = try await repository.state()
            let entries = (try? await loadEntries()) ?? []
            entriesById = Dictionary(entries.map { ($0.id, $0) }, uniquingKeysWith: { first, _ in first })
            facts = all
            learning = state.learning
            hasEntries = !entries.isEmpty
            // Only what the reader will read (settled, not empty) counts, and a skipped
            // entry is done, so the line can finish.
            let date = now()
            let readable = entries.filter { UserFactPlanner.isEligible($0, now: date) }
            let read = readable.filter { state.processed[$0.id] != nil || state.skipped[$0.id] != nil }.count
            progress = (learning && read < readable.count) ? Progress(read: read, total: readable.count) : nil
            loadState = .loaded
        } catch {
            loadState = .failed
        }
    }

    // MARK: - Edits (all authoritative)

    func add(category: UserFactCategory, subject: String, statement: String, validFrom: Date?) async {
        let stamp = now()
        await persist(UserFact(
            id: makeId(), category: category, subject: Self.clean(subject), statement: Self.clean(statement),
            status: .active, origin: .user, userAuthored: true, evidence: [],
            firstObservedAt: stamp, lastConfirmedAt: stamp, validFrom: validFrom, validTo: nil,
            supersededBy: nil, proposal: nil, createdAt: stamp, updatedAt: stamp,
            model: "", promptVersion: UserFactPlanner.promptVersion
        ))
    }

    func edit(_ fact: UserFact, category: UserFactCategory, subject: String, statement: String, validFrom: Date?) async {
        var changed = fact
        changed.category = category
        changed.subject = Self.clean(subject)
        changed.statement = Self.clean(statement)
        changed.validFrom = validFrom
        await persist(authored(changed))
    }

    /// "Not true anymore". The end date is clamped so it never precedes the start.
    func markNotTrue(_ fact: UserFact, endedOn date: Date) async {
        var changed = fact
        changed.status = .invalidated
        changed.validTo = max(date, fact.validFrom ?? date)
        await persist(authored(changed))
    }

    /// "Still true".
    func restore(_ fact: UserFact) async {
        var changed = fact
        changed.status = .active
        changed.validTo = nil
        changed.supersededBy = nil
        await persist(authored(changed))
    }

    /// A tombstone: hidden everywhere, and sent to the model as "never add this".
    func delete(_ fact: UserFact) async {
        var changed = fact
        changed.status = .rejected
        await persist(authored(changed))
    }

    func acceptProposal(_ fact: UserFact) async {
        guard let proposal = fact.proposal else { return }
        var changed = fact
        switch proposal.kind {
        case .update:
            if let statement = proposal.statement { changed.statement = statement }
        case .invalidate:
            changed.status = .invalidated
            changed.validTo = max(proposal.validTo ?? now(), fact.validFrom ?? .distantPast)
        }
        changed.evidence = UserFactMerger.appendingEvidence(fact.evidence, proposal.evidence)
        await persist(authored(changed))
    }

    func dismissProposal(_ fact: UserFact) async {
        await persist(authored(fact))
    }

    func setLearning(_ on: Bool) async {
        if !on { pauseLearning() }
        do {
            var state = try await repository.state()
            state.learning = on
            try await repository.saveState(state)
            learning = on
        } catch {
            errorMessage = "Couldn't save that. Try again."
            return
        }
        if on { await start() }
    }

    /// Hard-deletes every fact, tombstones included, resets what has been read, and
    /// turns learning off so nothing comes back until the user turns it on. Learning goes
    /// off first (in this process and in the store), so a run can't refill the facts.
    func forgetEverything() async {
        pauseLearning()
        do {
            try await repository.saveState(UserFactExtractionState(learning: false,
                                                                   promptVersion: UserFactPlanner.promptVersion))
            try await repository.deleteAll()
            facts = []
            learning = false
            progress = nil
        } catch {
            errorMessage = "Couldn't delete everything. Try again."
        }
    }

    // MARK: - Private

    /// Marks a change as the user's: authoritative from now on, and any pending
    /// proposal is answered by it.
    private func authored(_ fact: UserFact) -> UserFact {
        var changed = fact
        changed.userAuthored = true
        changed.proposal = nil
        changed.updatedAt = now()
        return changed
    }

    private func persist(_ fact: UserFact) async {
        do {
            try await repository.save(fact)
            if let index = facts.firstIndex(where: { $0.id == fact.id }) {
                facts[index] = fact
            } else {
                facts.append(fact)
            }
        } catch {
            errorMessage = "Couldn't save that. Try again."
        }
    }

    private static func clean(_ text: String) -> String {
        text.trimmingCharacters(in: .whitespacesAndNewlines)
    }
}

/// Display strings for facts. Pure; the timezone is a parameter for tests.
enum UserFactFormat {

    private static func formatter(_ format: String, _ timeZone: TimeZone) -> DateFormatter {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.timeZone = timeZone
        formatter.dateFormat = format
        return formatter
    }

    /// "12 Sep 2026".
    static func day(_ date: Date, timeZone: TimeZone = .current) -> String {
        formatter("d MMM yyyy", timeZone).string(from: date)
    }

    /// The row caption: provenance for the user's own facts, dates for extracted ones.
    static func caption(for fact: UserFact, timeZone: TimeZone = .current) -> String {
        if fact.userAuthored { return fact.origin == .user ? "Added by you" : "Edited by you" }
        let since = fact.validFrom.map { "Since \(formatter("MMM yyyy", timeZone).string(from: $0))" }
        let last = "last mentioned \(day(fact.lastConfirmedAt, timeZone: timeZone))"
        return [since, last].compactMap { $0 }.joined(separator: " \u{00B7} ")
    }

    /// "Mar to Jun 2026", "Mar 2026 to Feb 2027", "Until Feb 2027".
    static func span(for fact: UserFact, timeZone: TimeZone = .current) -> String {
        let monthYear = formatter("MMM yyyy", timeZone)
        guard let end = fact.validTo else {
            return fact.validFrom.map { "Since \(monthYear.string(from: $0))" } ?? ""
        }
        guard let start = fact.validFrom else { return "Until \(monthYear.string(from: end))" }
        let year = formatter("yyyy", timeZone)
        if year.string(from: start) == year.string(from: end) {
            return "\(formatter("MMM", timeZone).string(from: start)) to \(monthYear.string(from: end))"
        }
        return "\(monthYear.string(from: start)) to \(monthYear.string(from: end))"
    }
}
