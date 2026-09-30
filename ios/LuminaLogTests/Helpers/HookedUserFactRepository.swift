import Foundation
@testable import LuminaLog

/// Wraps `InMemoryUserFactRepository` so a test can act at an exact point in a run:
/// `onStateRead[n]` runs once, inside the n-th `state()` call, after the value has
/// been read and before it is returned (the caller holds the pre-hook state).
@MainActor
final class HookedUserFactRepository: UserFactRepository {

    let inner: InMemoryUserFactRepository
    private(set) var stateReads = 0
    var onStateRead: [Int: @MainActor () async -> Void] = [:]
    /// Runs at the start of `deleteAll()`, before anything is deleted.
    var onDeleteAll: (@MainActor () async -> Void)?

    init(_ inner: InMemoryUserFactRepository) {
        self.inner = inner
    }

    func all() async throws -> [UserFact] { try await inner.all() }

    func save(_ fact: UserFact) async throws { try await inner.save(fact) }

    func delete(id: String) async throws { try await inner.delete(id: id) }

    func deleteAll() async throws {
        await onDeleteAll?()
        try await inner.deleteAll()
    }

    func state() async throws -> UserFactExtractionState {
        stateReads += 1
        let state = try await inner.state()
        if let hook = onStateRead.removeValue(forKey: stateReads) { await hook() }
        return state
    }

    func saveState(_ state: UserFactExtractionState) async throws { try await inner.saveState(state) }

    func saveExtractionProgress(_ state: UserFactExtractionState) async throws {
        try await inner.saveExtractionProgress(state)
    }
}
