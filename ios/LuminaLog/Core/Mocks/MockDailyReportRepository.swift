import Foundation

/// In-memory `DailyReportRepository` for demo mode and tests.
@MainActor
final class MockDailyReportRepository: DailyReportRepository {
    /// Today's latest report (drives `report(for:)`); included in the recent feed.
    var stored: DailyInsightsReport?
    /// Older reports, newest first.
    var storedHistory: [DailyInsightsReport] = []

    private var all: [DailyInsightsReport] {
        ((stored.map { [$0] }) ?? []) + storedHistory
    }

    func report(for date: String) async throws -> DailyInsightsReport? {
        all.first { $0.date == date }
    }

    func recentReports(limit: Int, after lastId: String?) async throws -> [DailyInsightsReport] {
        let feed = all
        let start: Int
        if let lastId, let idx = feed.firstIndex(where: { $0.id == lastId }) {
            start = idx + 1
        } else if lastId != nil {
            return []
        } else {
            start = 0
        }
        return Array(feed[min(start, feed.count)...].prefix(limit))
    }

    func deleteReport(id: String) async throws {
        storedHistory.removeAll { $0.id == id }
        if stored?.id == id { stored = nil }
    }
}
