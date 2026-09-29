import Foundation

/// In-memory `UserFactRepository` for mock wiring and tests.
@MainActor
final class InMemoryUserFactRepository: UserFactRepository {

    private(set) var store: [String: UserFact] = [:]
    private(set) var storedState = UserFactExtractionState()
    /// When set, `save` throws it (to exercise failure paths).
    var saveError: Error?

    init(_ facts: [UserFact] = []) {
        for fact in facts { store[fact.id] = fact }
    }

    /// Stable order (creation, then id) so tests are deterministic.
    func all() async throws -> [UserFact] {
        store.values.sorted { ($0.createdAt, $0.id) < ($1.createdAt, $1.id) }
    }

    func save(_ fact: UserFact) async throws {
        if let saveError { throw saveError }
        store[fact.id] = fact
    }

    func delete(id: String) async throws { store[id] = nil }

    func deleteAll() async throws { store = [:] }

    func state() async throws -> UserFactExtractionState { storedState }

    func saveState(_ state: UserFactExtractionState) async throws { storedState = state }
}
