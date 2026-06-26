import SwiftUI

/// Horizontally scrolling list of Daily Insights cards, newest first. Every
/// saved report — including the several a single day may hold — is one card in
/// the feed. A lead "generate" card appears when the goal is met but no report
/// exists for today yet, and error+retry cards surface failed generations.
/// Reports load 10 at a time and reload whenever a new one is generated.
struct DailyReflectionsScrollView: View {
    let repository: DailyReportRepository
    let ai: AIService
    /// "yyyy-MM-dd" of today in the user's timezone.
    let today: String
    /// True when the user has met their daily word goal (unlock to generate).
    let goalMet: Bool
    /// Device-local failed-generation records that drive the error cards.
    @ObservedObject var failedReports: FailedReportStore
    /// Called when the user taps the lead generate/error card — opens the report sheet.
    let onTapToday: () -> Void

    /// The unified report feed, newest first.
    @State private var reports: [DailyInsightsReport] = []
    @State private var isLoading = false
    @State private var hasMore = true
    @State private var selectedReport: DailyInsightsReport?
    @State private var retryTarget: RetryTarget?
    @State private var reportToDelete: DailyInsightsReport?

    /// Failed dates other than today (today is handled by the lead slot).
    private var pastFailedDates: [String] {
        failedReports.dates().filter { $0 != today }
    }
    /// Whether a report already exists for today (so the generate card hides).
    private var hasTodayReport: Bool { reports.contains { $0.date == today } }
    private var todayFailed: Bool { failedReports.failedDates.contains(today) }
    /// Lead slot: retry today's failed generation, or kick off the first one.
    private var showGenerateCard: Bool { goalMet && !hasTodayReport && !todayFailed }
    private var hasSomethingToShow: Bool {
        showGenerateCard || todayFailed || !reports.isEmpty || !pastFailedDates.isEmpty
    }

    var body: some View {
        Group {
            if hasSomethingToShow {
                VStack(alignment: .leading, spacing: Spacing.s) {
                    SectionHeader(title: "Daily Reflections")
                    ScrollView(.horizontal, showsIndicators: false) {
                        LazyHStack(spacing: Spacing.s) {
                            // Lead slot: today's error+retry, or the generate card.
                            if todayFailed {
                                Button { onTapToday() } label: {
                                    ReflectionErrorCard(date: today, badge: "TODAY")
                                }
                                .buttonStyle(.plain)
                            } else if showGenerateCard {
                                Button { onTapToday() } label: {
                                    GenerateInsightsCard()
                                }
                                .buttonStyle(.plain)
                            }

                            // Past failed dates (error cards) — retry regenerates that day.
                            ForEach(pastFailedDates, id: \.self) { failedDate in
                                Button { retryTarget = RetryTarget(id: failedDate) } label: {
                                    ReflectionErrorCard(date: failedDate)
                                }
                                .buttonStyle(.plain)
                            }

                            // Every saved report, newest first.
                            ForEach(reports) { report in
                                Button { selectedReport = report } label: {
                                    ReflectionThumbnailCard(
                                        report: report,
                                        badge: report.date == today ? "TODAY" : nil
                                    )
                                }
                                .buttonStyle(.plain)
                                .contextMenu {
                                    Button(role: .destructive) {
                                        reportToDelete = report
                                    } label: {
                                        Label("Delete", systemImage: "trash")
                                    }
                                }
                            }

                            // Pagination sentinel
                            if hasMore {
                                Color.clear
                                    .frame(width: 1, height: 150)
                                    .onAppear {
                                        guard !isLoading else { return }
                                        Task { await loadMore() }
                                    }
                            }
                        }
                        .padding(.horizontal, Spacing.m)
                    }
                    .padding(.horizontal, -Spacing.m)
                }
            }
        }
        .task { await loadMore() }
        // Reload from the top whenever a report is generated (milestone or dev tool).
        .onReceive(NotificationCenter.default.publisher(for: .dailyReportGenerated)) { _ in
            Task { await reload() }
        }
        .fullScreenCover(item: $selectedReport) { report in
            // Preview the exact report (a day can hold several, so loading by date
            // would be ambiguous).
            DailyInsightsReportView(
                ai: ai, reports: repository, date: report.date,
                failedReports: failedReports,
                onDeleted: { reports.removeAll { $0.id == report.id } },
                preloadedReport: report
            )
        }
        .fullScreenCover(item: $retryTarget) { target in
            DailyInsightsReportView(ai: ai, reports: repository, date: target.date, failedReports: failedReports)
        }
        .alert("Delete Reflection", isPresented: .init(
            get: { reportToDelete != nil },
            set: { if !$0 { reportToDelete = nil } }
        )) {
            Button("Delete", role: .destructive) {
                guard let r = reportToDelete else { return }
                reportToDelete = nil
                Task { await deleteReport(r) }
            }
            Button("Cancel", role: .cancel) { reportToDelete = nil }
        } message: {
            Text("This daily reflection will be permanently deleted.")
        }
    }

    /// Identifiable wrapper so a failed date can drive `.fullScreenCover(item:)`.
    private struct RetryTarget: Identifiable { let id: String; var date: String { id } }

    private func loadMore() async {
        guard hasMore, !isLoading else { return }
        isLoading = true
        defer { isLoading = false }
        do {
            let batch = try await repository.recentReports(limit: 10, after: reports.last?.id)
            reports.append(contentsOf: batch)
            hasMore = batch.count == 10
        } catch {
            hasMore = false
        }
    }

    /// Reset and reload the first page (after a new report is generated).
    private func reload() async {
        isLoading = false
        hasMore = true
        do {
            reports = try await repository.recentReports(limit: 10, after: nil)
            hasMore = reports.count == 10
        } catch {
            hasMore = false
        }
    }

    private func deleteReport(_ report: DailyInsightsReport) async {
        reports.removeAll { $0.id == report.id }
        try? await repository.deleteReport(id: report.id)
    }
}

// MARK: - Generate card

private struct GenerateInsightsCard: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color.accentWarm.opacity(0.35), .black],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            VStack(spacing: Spacing.xs) {
                Image(systemName: "sparkles")
                    .font(.title2)
                    .foregroundStyle(Color.accentWarm)
                Text("Generate\nInsights")
                    .font(.captionText.weight(.semibold))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(width: 120, height: 150)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous))
    }
}
