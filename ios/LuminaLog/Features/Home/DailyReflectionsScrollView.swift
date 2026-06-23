import SwiftUI

/// Horizontally scrolling list of past Daily Reflections thumbnail cards.
/// Loads 10 at a time; fires `loadMore()` when the trailing sentinel appears.
/// Hidden until at least one past report is loaded.
struct DailyReflectionsScrollView: View {
    let repository: DailyReportRepository
    let ai: AIService
    /// "yyyy-MM-dd" of today in the user's timezone — used to exclude today's
    /// report (which lives in the "Today's insights" tap-row above).
    let today: String

    @State private var reports: [DailyInsightsReport] = []
    @State private var isLoading = false
    @State private var hasMore = true
    @State private var selectedReport: DailyInsightsReport?

    var body: some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            if !reports.isEmpty {
                SectionHeader(title: "Daily Reflections")
                ScrollView(.horizontal, showsIndicators: false) {
                    LazyHStack(spacing: Spacing.s) {
                        ForEach(reports) { report in
                            Button { selectedReport = report } label: {
                                ReflectionThumbnailCard(report: report)
                            }
                            .buttonStyle(.plain)
                        }
                        if hasMore {
                            Color.clear
                                .frame(width: 1, height: 150)
                                .onAppear {
                                    guard !isLoading else { return }
                                    Task { await loadMore() }
                                }
                        }
                    }
                }
            }
        }
        .task { await loadMore() }
        .sheet(item: $selectedReport) { report in
            DailyInsightsReportView(ai: ai, reports: repository, date: report.date)
        }
    }

    private func loadMore() async {
        guard hasMore, !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        let cursor = reports.last?.date ?? today
        do {
            let batch = try await repository.reports(before: cursor, limit: 10)
            reports.append(contentsOf: batch)
            hasMore = batch.count == 10
        } catch {
            hasMore = false
        }
    }
}
