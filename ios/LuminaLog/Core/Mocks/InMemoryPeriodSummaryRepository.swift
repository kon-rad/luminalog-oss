import Foundation

/// In-memory `PeriodSummaryRepository` for mock wiring and tests.
@MainActor
final class InMemoryPeriodSummaryRepository: PeriodSummaryRepository {

    private(set) var store: [PeriodKey: PeriodSummary] = [:]
    private(set) var deleted: [PeriodKey] = []
    /// When set, `save` throws it (to exercise failure paths).
    var saveError: Error?

    init(_ summaries: [PeriodSummary] = []) {
        for summary in summaries { store[summary.key] = summary }
    }

    func all() async throws -> [PeriodSummary] { Array(store.values) }

    func summaries(for periods: [PeriodKey]) async throws -> [PeriodSummary] {
        periods.compactMap { store[$0] }
    }

    func save(_ summary: PeriodSummary) async throws {
        if let saveError { throw saveError }
        store[summary.key] = summary
    }

    func delete(_ key: PeriodKey) async throws {
        store[key] = nil
        deleted.append(key)
    }
}
