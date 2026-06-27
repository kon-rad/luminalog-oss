import SwiftUI
import UIKit

/// Horizontally scrolling list of Daily Insights cards, newest first. Every
/// saved report — including the several a single day may hold — is one card in
/// the feed. A lead generate affordance is always present: today's failed
/// generation (retry), the met-goal milestone card, or a "Generate new" card
/// that forces a fresh report. Each saved card's context menu offers
/// Download/Share and Delete. Reports load 10 at a time and reload whenever a
/// new one is generated.
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
    /// Drives the "Generate new" card — opens the generator forcing a fresh report.
    @State private var showGenerateNew = false
    /// Rasterized card pending share/download (drives the share sheet).
    @State private var shareItem: ShareImageItem?

    /// Failed dates other than today (today is handled by the lead slot).
    private var pastFailedDates: [String] {
        failedReports.dates().filter { $0 != today }
    }
    /// Whether a report already exists for today (so the generate card hides).
    private var hasTodayReport: Bool { reports.contains { $0.date == today } }
    private var todayFailed: Bool { failedReports.failedDates.contains(today) }
    /// Lead slot: retry today's failed generation, or kick off the first one.
    private var showGenerateCard: Bool { goalMet && !hasTodayReport && !todayFailed }
    /// The carousel is always shown: even with no saved reports it offers the
    /// lead "Generate new" card, so the user can always generate from Home.
    private var hasSomethingToShow: Bool { true }

    var body: some View {
        Group {
            if hasSomethingToShow {
                VStack(alignment: .leading, spacing: Spacing.s) {
                    SectionHeader(title: "Daily Reflections")
                    ScrollView(.horizontal, showsIndicators: false) {
                        LazyHStack(spacing: Spacing.s) {
                            // Lead slot — always a generate affordance up front (no
                            // scrolling needed to reach it): today's failed
                            // generation offers retry, a met goal offers the
                            // milestone generate card, otherwise "Generate new"
                            // forces a fresh report for today.
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
                            } else {
                                Button { showGenerateNew = true } label: {
                                    GenerateInsightsCard(title: "Generate\nnew", systemImage: "plus.circle")
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
                                    Button {
                                        Task { await share(report) }
                                    } label: {
                                        Label("Download / Share", systemImage: "square.and.arrow.up")
                                    }
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
        // "Generate new" forces a fresh report for today (in addition to any the
        // day already holds); on success it posts .dailyReportGenerated and the
        // feed reloads.
        .fullScreenCover(isPresented: $showGenerateNew) {
            DailyInsightsReportView(
                ai: ai, reports: repository, date: today,
                failedReports: failedReports, initialForce: true
            )
        }
        .sheet(item: $shareItem) { item in
            ActivityView(items: [item.image])
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

    /// Renders a saved report's card to an image and presents the share sheet
    /// (whose "Save Image" covers "download"). The background photo is loaded
    /// first so `ImageRenderer` captures it synchronously — same path the full
    /// report view uses for its Share button.
    @MainActor
    private func share(_ report: DailyInsightsReport) async {
        let background = await CardImageLoader.load(report.imageUrl)
        let image = InsightsCardView(report: report, backgroundImage: background)
            .renderAsUIImage()
        shareItem = ShareImageItem(image: image)
    }

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
    var title: String = "Generate\nInsights"
    var systemImage: String = "sparkles"

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color.accentWarm.opacity(0.35), .black],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
            VStack(spacing: Spacing.xs) {
                Image(systemName: systemImage)
                    .font(.title2)
                    .foregroundStyle(Color.accentWarm)
                Text(title)
                    .font(.captionText.weight(.semibold))
                    .foregroundStyle(.white)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(width: 120, height: 150)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous))
    }
}

/// Identifiable wrapper so a rendered card image can drive `.sheet(item:)`.
private struct ShareImageItem: Identifiable { let id = UUID(); let image: UIImage }
