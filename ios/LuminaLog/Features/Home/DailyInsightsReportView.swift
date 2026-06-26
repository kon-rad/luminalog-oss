import SwiftUI
import UIKit

/// Generates (or shows the cached) daily insights report and renders the
/// shareable card. Sharing rasterizes the card to an image.
struct DailyInsightsReportView: View {
    let ai: AIService
    let reports: DailyReportRepository
    let date: String?            // nil = today
    let failedReports: FailedReportStore
    /// Called after the report is deleted; caller should remove it from its list.
    var onDeleted: (() -> Void)? = nil
    /// When set, the view renders this exact report and skips the load/generate
    /// path. Used by the DEBUG-only dev tool to preview an in-memory card that
    /// isn't (uniquely) persisted by date.
    var preloadedReport: DailyInsightsReport? = nil

    @Environment(\.dismiss) private var dismiss
    @State private var phase: Phase = .loading
    @State private var shareImage: ShareableImage?
    /// Pre-loaded background photo — required so ImageRenderer captures it synchronously.
    @State private var backgroundImage: UIImage?
    @State private var showDeleteConfirmation = false

    enum Phase { case loading, loaded(DailyInsightsReport), failed }

    /// A concrete saved report (opened from a feed card) can be deleted; the
    /// generate/retry flow (date only, no preloaded report) cannot.
    private var canDelete: Bool { preloadedReport != nil }

    var body: some View {
        ZStack(alignment: .topTrailing) {
            Color.appBackground.ignoresSafeArea()
            switch phase {
            case .loading: loading
            case .failed: failure
            case .loaded(let report):
                ScrollView {
                    VStack(spacing: Spacing.m) {
                        InsightsCardView(report: report, backgroundImage: backgroundImage)
                            .frame(maxWidth: .infinity, alignment: .center)
                        Button {
                            shareImage = ShareableImage(
                                image: InsightsCardView(report: report, backgroundImage: backgroundImage)
                                    .renderAsUIImage()
                            )
                        } label: {
                            Label("Share", systemImage: "square.and.arrow.up")
                                .font(.uiBody.weight(.semibold)).frame(maxWidth: .infinity, minHeight: 48)
                        }
                        .buttonStyle(.borderedProminent).tint(Color.accentWarm)
                        .padding(.horizontal, Spacing.m)
                        if canDelete {
                            Button(role: .destructive) {
                                showDeleteConfirmation = true
                            } label: {
                                Label("Delete Reflection", systemImage: "trash")
                                    .font(.uiBody.weight(.semibold))
                                    .frame(maxWidth: .infinity, minHeight: 48)
                            }
                            .buttonStyle(.bordered)
                            .tint(.red)
                            .padding(.horizontal, Spacing.m)
                        }
                    }
                    .padding(.vertical, Spacing.m)
                }
                .task(id: report.imageUrl?.absoluteString) {
                    await loadBackgroundImage(from: report.imageUrl)
                }
            }
            closeButton
        }
        .sheet(item: $shareImage) { item in
            ActivityView(items: [item.image])
        }
        .alert("Delete Reflection", isPresented: $showDeleteConfirmation) {
            Button("Delete", role: .destructive) {
                Task {
                    if let id = preloadedReport?.id { try? await reports.deleteReport(id: id) }
                    onDeleted?()
                    dismiss()
                }
            }
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This daily reflection will be permanently deleted and cannot be recovered.")
        }
        .task { await load() }
    }

    private var closeButton: some View {
        Button { dismiss() } label: {
            Image(systemName: "xmark.circle.fill")
                .font(.title2)
                .symbolRenderingMode(.hierarchical)
                .foregroundStyle(Color.textSecondary)
                .padding(Spacing.m)
        }
        .accessibilityLabel("Close")
    }

    private var loading: some View {
        VStack(spacing: Spacing.m) {
            ProgressView().tint(Color.accentWarm)
            Text("Generating today's insights…").font(.uiBody).foregroundStyle(Color.textSecondary)
        }
    }
    private var failure: some View {
        VStack(spacing: Spacing.m) {
            Text("Couldn't generate your report.").font(.uiBody).foregroundStyle(Color.textPrimary)
            Button("Try again") { Task { await load(force: true) } }
                .buttonStyle(.borderedProminent).tint(Color.accentWarm)
        }
    }

    private func load(force: Bool = false) async {
        if let preloadedReport {
            phase = .loaded(preloadedReport); return
        }
        phase = .loading
        let key = date ?? Self.todayKey()
        if !force, let cached = try? await reports.report(for: key) {
            failedReports.clear(key)
            phase = .loaded(cached); return
        }
        do {
            let report = try await ai.generateDailyReport(date: date, force: force)
            failedReports.clear(key)
            phase = .loaded(report)
            // A new report was saved — tell Home's feed to reload so it shows.
            NotificationCenter.default.post(name: .dailyReportGenerated, object: nil)
        } catch {
            failedReports.record(key)
            phase = .failed
        }
    }

    private func loadBackgroundImage(from url: URL?) async {
        if let img = await CardImageLoader.load(url) { backgroundImage = img }
    }

    static func todayKey() -> String {
        let f = DateFormatter(); f.dateFormat = "yyyy-MM-dd"; return f.string(from: Date())
    }
}

/// Wrapper so a UIImage can drive `.sheet(item:)`.
private struct ShareableImage: Identifiable { let id = UUID(); let image: UIImage }

/// The visual card (matches the approved mockup): darkened themed photo behind
/// the three sections, stats, emotion bars, attribution.
struct InsightsCardView: View {
    let report: DailyInsightsReport
    /// Pre-loaded UIImage for the background; required for ImageRenderer to capture it synchronously.
    var backgroundImage: UIImage? = nil

    var body: some View {
        // The photo + gradient are applied as a `.background` (not as ZStack
        // siblings) so the `scaledToFill` image cannot report an oversized layout
        // and push the leading-aligned text off the card's left edge. The content
        // owns the fixed frame; the background fills exactly that.
        //
        // Layout: the main content is vertically CENTERED in the card, which —
        // on this tall canvas — leaves roughly the top third empty so it clears
        // Instagram's story chrome. The footer branding is overlaid pinned to the
        // bottom and keeps its position regardless of where the content lands.
        ZStack(alignment: .leading) {
            VStack(alignment: .leading, spacing: Spacing.m) {
                VStack(alignment: .leading, spacing: 2) {
                    Text("DAILY INSIGHTS").font(.captionText.weight(.semibold))
                        .foregroundStyle(Color.accentWarm).kerning(2)
                    Text(formattedDate).font(.uiBody.weight(.semibold))
                        .foregroundStyle(.white)
                }
                section("Insights", report.insights)
                section("A Gem", report.gem)
                statsRow
                emotionBars
            }
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)

            VStack(spacing: 0) {
                Spacer(minLength: 0)
                footer
            }
        }
        .padding(.horizontal, Spacing.l)
        .padding(.vertical, Spacing.l)
        .frame(width: 320, height: 820, alignment: .topLeading)
        .foregroundStyle(.white)
        .background {
            ZStack {
                background
                LinearGradient(colors: [.black.opacity(0.55), .black.opacity(0.9)],
                               startPoint: .top, endPoint: .bottom)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.xLarge, style: .continuous))
    }

    @ViewBuilder private var background: some View {
        if let img = backgroundImage {
            // Use the synchronously-available UIImage so ImageRenderer captures it.
            Image(uiImage: img)
                .resizable()
                .scaledToFill()
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .clipped()
        } else if let url = report.imageUrl {
            AsyncImage(url: url) { img in
                img.resizable()
                    .scaledToFill()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .clipped()
            } placeholder: {
                gradient
            }
        } else {
            gradient
        }
    }
    private var gradient: some View {
        LinearGradient(colors: [Color.accentWarm.opacity(0.5), .black],
                       startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    /// "Thursday, June 25, 2026" from the report's `yyyy-MM-dd` date; falls back
    /// to the raw stored value if it ever fails to parse.
    private var formattedDate: String {
        let parser = DateFormatter()
        parser.calendar = Calendar(identifier: .gregorian)
        parser.locale = Locale(identifier: "en_US_POSIX")
        parser.dateFormat = "yyyy-MM-dd"
        guard let day = parser.date(from: report.date) else { return report.date }
        let out = DateFormatter()
        out.dateFormat = "EEEE, MMMM d, yyyy"
        return out.string(from: day)
    }

    private func section(_ title: String, _ body: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title.uppercased()).font(.captionText.weight(.semibold))
                .foregroundStyle(Color.accentWarm).kerning(1)
            Text(body).font(.uiBody)
        }
    }

    private var statsRow: some View {
        HStack(spacing: Spacing.s) {
            stat("🔥 \(report.streakCount)", "day streak")
            stat("\(report.wordsToday.formatted())", "words today")
            stat("\(report.totalWords.formatted())", "total words")
        }
    }
    private func stat(_ v: String, _ l: String) -> some View {
        VStack(spacing: 2) {
            Text(v).font(.uiBody.weight(.bold))
            Text(l.uppercased()).font(.system(size: 9)).foregroundStyle(.white.opacity(0.8))
        }
        .frame(maxWidth: .infinity).padding(Spacing.s)
        .background(RoundedRectangle(cornerRadius: CornerRadius.medium).fill(.white.opacity(0.12)))
    }

    @ViewBuilder private var emotionBars: some View {
        if !report.emotions.isEmpty {
            VStack(alignment: .leading, spacing: 6) {
                ForEach(report.emotions, id: \.name) { e in
                    HStack(spacing: 8) {
                        Text(e.name).font(.captionText).frame(width: 90, alignment: .leading)
                        GeometryReader { geo in
                            Capsule().fill(.white.opacity(0.18))
                                .overlay(alignment: .leading) {
                                    Capsule().fill(Color.accentWarm)
                                        .frame(width: geo.size.width * min(1, max(0, e.score)))
                                }
                        }.frame(height: 7)
                    }
                }
            }
        }
    }

    private var footer: some View {
        HStack(alignment: .center, spacing: Spacing.s) {
            Image("LogoIcon")
                .resizable()
                .scaledToFill()
                .frame(width: 34, height: 34)
                .clipShape(Circle())
                .overlay(Circle().stroke(.white.opacity(0.25), lineWidth: 1))
            VStack(alignment: .leading, spacing: 1) {
                Text("luminalog.com").font(.captionText.weight(.semibold)).kerning(1)
                Text("journaling companion").font(.system(size: 9))
                    .foregroundStyle(.white.opacity(0.85))
            }
            Spacer()
        }
    }
}

extension View {
    /// Rasterize a view to a UIImage at 3x for sharing.
    @MainActor func renderAsUIImage() -> UIImage {
        let renderer = ImageRenderer(content: self)
        renderer.scale = 3
        return renderer.uiImage ?? UIImage()
    }
}

struct ActivityView: UIViewControllerRepresentable {
    let items: [Any]
    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: items, applicationActivities: nil)
    }
    func updateUIViewController(_ vc: UIActivityViewController, context: Context) {}
}
