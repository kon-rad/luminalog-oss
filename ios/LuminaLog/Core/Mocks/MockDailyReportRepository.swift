import Foundation

/// In-memory `DailyReportRepository` for demo mode and tests.
@MainActor
final class MockDailyReportRepository: DailyReportRepository {
    var stored: DailyInsightsReport?
    var storedHistory: [DailyInsightsReport] = []

    func report(for date: String) async throws -> DailyInsightsReport? { stored }

    func reports(before date: String, limit: Int) async throws -> [DailyInsightsReport] {
        Array(
            storedHistory
                .filter { $0.date < date }
                .sorted { $0.date > $1.date }
                .prefix(limit)
        )
    }
}
