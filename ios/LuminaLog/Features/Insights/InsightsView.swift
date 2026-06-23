import SwiftUI

/// Full-screen Insights dashboard, presented from the Journal list. All
/// computation is on-device (ADR-0032).
struct InsightsView: View {

    @StateObject private var viewModel: InsightsViewModel
    @Environment(\.dismiss) private var dismiss

    init(journals: JournalRepository) {
        _viewModel = StateObject(wrappedValue: InsightsViewModel(journals: journals))
    }

    var body: some View {
        NavigationStack {
            content
                .background(Color.appBackground.ignoresSafeArea())
                .navigationTitle("Insights")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .navigationBarLeading) {
                        Button("Done") { dismiss() }
                    }
                }
        }
        .task { await viewModel.load() }
    }

    @ViewBuilder
    private var content: some View {
        switch viewModel.state {
        case .idle, .loading:
            ProgressView("Reading your journal…")
                .frame(maxWidth: .infinity, maxHeight: .infinity)
        case .empty:
            EmptyStateView(
                systemImage: "chart.bar.xaxis",
                title: "No insights yet",
                message: "Write a few entries and your journal’s patterns will appear here."
            )
        case .failed:
            EmptyStateView(
                systemImage: "wifi.exclamationmark",
                title: "Couldn’t load your insights",
                message: "Something went wrong reading your journal. Check your connection and try again.",
                actionTitle: "Retry",
                action: { Task { await viewModel.retry() } }
            )
        case .loaded(let insights):
            ScrollView {
                VStack(spacing: Spacing.m) {
                    if !insights.words.isEmpty {
                        InsightsCard(title: "Your words", subtitle: "Most-used words across your journal") {
                            WordCloudView(words: insights.words)
                        }
                    }
                    if !insights.emotionTrend.isEmpty {
                        InsightsCard(title: "Emotional trends", subtitle: "Dominant emotion by day") {
                            EmotionTrendChart(points: insights.emotionTrend)
                        }
                    }
                    InsightsCard(title: "Activity", subtitle: "Your journaling over the last few months") {
                        ActivityHeatmap(days: insights.activity)
                    }
                    InsightsCard(title: "How you journal", subtitle: "Entries by type") {
                        EntryTypeChart(slices: insights.types)
                    }
                }
                .padding(Spacing.m)
            }
        }
    }
}
