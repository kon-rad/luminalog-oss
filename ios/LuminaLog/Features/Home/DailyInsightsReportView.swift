import SwiftUI
import UIKit

/// Generates (or shows the cached) daily insights report and renders the
/// shareable card. Sharing rasterizes the card to an image.
struct DailyInsightsReportView: View {
    let ai: AIService
    let reports: DailyReportRepository
    let date: String?            // nil = today

    @State private var phase: Phase = .loading
    @State private var shareImage: ShareableImage?

    enum Phase { case loading, loaded(DailyInsightsReport), failed }

    var body: some View {
        ZStack {
            Color.appBackground.ignoresSafeArea()
            switch phase {
            case .loading: loading
            case .failed: failure
            case .loaded(let report):
                VStack(spacing: Spacing.m) {
                    InsightsCardView(report: report)
                    Button {
                        shareImage = ShareableImage(image: InsightsCardView(report: report).renderAsUIImage())
                    } label: {
                        Label("Share", systemImage: "square.and.arrow.up")
                            .font(.uiBody.weight(.semibold)).frame(maxWidth: .infinity, minHeight: 48)
                    }
                    .buttonStyle(.borderedProminent).tint(Color.accentWarm)
                    .padding(.horizontal, Spacing.m)
                }
            }
        }
        .sheet(item: $shareImage) { item in
            ActivityView(items: [item.image])
        }
        .task { await load() }
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
        phase = .loading
        let key = date ?? Self.todayKey()
        if !force, let cached = try? await reports.report(for: key) {
            phase = .loaded(cached); return
        }
        do { phase = .loaded(try await ai.generateDailyReport(date: date, force: force)) }
        catch { phase = .failed }
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

    var body: some View {
        ZStack(alignment: .topLeading) {
            background
            LinearGradient(colors: [.black.opacity(0.55), .black.opacity(0.9)],
                           startPoint: .top, endPoint: .bottom)
            VStack(alignment: .leading, spacing: Spacing.m) {
                Text("DAILY INSIGHTS").font(.captionText.weight(.semibold))
                    .foregroundStyle(Color.accentWarm).kerning(2)
                section("Insights", report.insights)
                section("A new perspective", report.findings)
                section("Reflect on", report.question)
                statsRow
                emotions
                Spacer(minLength: 0)
                footer
            }
            .padding(Spacing.l)
            .foregroundStyle(.white)
        }
        .frame(width: 320, height: 580)
        .clipShape(RoundedRectangle(cornerRadius: CornerRadius.xLarge, style: .continuous))
    }

    @ViewBuilder private var background: some View {
        if let url = report.imageUrl {
            AsyncImage(url: url) { img in img.resizable().scaledToFill() }
                placeholder: { gradient }
        } else { gradient }
    }
    private var gradient: some View {
        LinearGradient(colors: [Color.accentWarm.opacity(0.5), .black],
                       startPoint: .topLeading, endPoint: .bottomTrailing)
    }

    private func section(_ title: String, _ body: String) -> some View {
        VStack(alignment: .leading, spacing: 3) {
            Text(title.uppercased()).font(.captionText.weight(.semibold))
                .foregroundStyle(Color.accentWarm).kerning(1)
            Text(body).font(.uiBody)
        }
    }

    private var statsRow: some View {
        HStack(spacing: Spacing.m) {
            stat("\(report.totalWords.formatted())", "total words")
            stat("🔥 \(report.streakCount)", "day streak")
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

    @ViewBuilder private var emotions: some View {
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
            if !report.emotionSummary.isEmpty {
                Text(report.emotionSummary).font(.captionText).foregroundStyle(.white.opacity(0.85))
            }
        }
    }

    private var footer: some View {
        HStack(alignment: .bottom) {
            Text("LUMINALOG").font(.captionText.weight(.semibold)).kerning(2)
            Spacer()
            if let name = report.photographerName, !name.isEmpty {
                Text("Photo: \(name) / Unsplash")
                    .font(.system(size: 8)).foregroundStyle(.white.opacity(0.7))
            }
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
