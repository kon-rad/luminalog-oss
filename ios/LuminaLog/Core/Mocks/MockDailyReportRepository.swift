import Foundation

/// In-memory `DailyReportRepository` for demo mode and tests.
@MainActor
final class MockDailyReportRepository: DailyReportRepository {
    var stored: DailyInsightsReport?
    func report(for date: String) async throws -> DailyInsightsReport? { stored }
}
