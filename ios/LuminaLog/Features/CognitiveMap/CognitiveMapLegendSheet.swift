import SwiftUI

/// What the shapes, colors, and markers on the map mean.
///
/// Wording mirrors the canonical explainer, docs/cognitive-map.md §1, and the edge
/// definitions mirror the extraction prompt itself (server/src/services/prompts.ts)
/// rather than being redescribed, so the legend can never drift from what the model
/// was actually told each connection means.
struct CognitiveMapLegendSheet: View {

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.l) {
                    intro
                    shapesSection
                    Divider().overlay(Color.textSecondary.opacity(0.2))
                    colorsSection
                    Divider().overlay(Color.textSecondary.opacity(0.2))
                    spineAndKeeperSection
                    Divider().overlay(Color.textSecondary.opacity(0.2))
                    edgesSection
                }
                .padding(Spacing.m)
            }
            .background(Color.appBackground)
            .navigationTitle("Reading the map")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { dismiss() }
                }
            }
        }
    }

    private var intro: some View {
        Text("Every beat is a shape (what kind of thing it is) and a color (which area of your life it belongs to). Tap any beat on the map to see the exact sentence it came from.")
            .font(.uiBody)
            .foregroundStyle(Color.textSecondary)
    }

    // MARK: - Shapes

    private static let shapeRows: [(kind: BeatKind, name: String, test: String)] = [
        (.event, "Event", "Could a camera have recorded it?"),
        (.feeling, "Feeling", "Could you feel it without knowing why?"),
        (.belief, "Belief", "Could a reasonable person disagree?"),
        (.intent, "Intent", "Does it point at the future?"),
    ]

    private var shapesSection: some View {
        VStack(alignment: .leading, spacing: Spacing.m) {
            Text("Shape: what kind of thing it is")
                .font(.sectionHeader)
                .foregroundStyle(Color.textPrimary)

            ForEach(Self.shapeRows, id: \.kind) { row in
                HStack(alignment: .top, spacing: Spacing.m) {
                    LegendShapeSwatch(kind: row.kind)
                        .frame(width: 44, height: 28)
                    VStack(alignment: .leading, spacing: Spacing.xs) {
                        Text(row.name)
                            .font(.uiBody.weight(.semibold))
                            .foregroundStyle(Color.textPrimary)
                        Text(row.test)
                            .font(.captionText)
                            .foregroundStyle(Color.textSecondary)
                    }
                }
                .accessibilityElement(children: .combine)
            }
        }
    }

    // MARK: - Colors

    private var colorsSection: some View {
        VStack(alignment: .leading, spacing: Spacing.m) {
            Text("Color: which area of life")
                .font(.sectionHeader)
                .foregroundStyle(Color.textPrimary)

            // Grid rather than a list: six single-word labels read faster side by side
            // than stacked, and it keeps the sheet from growing too tall.
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible())], spacing: Spacing.s) {
                ForEach(LifeDomain.allCases, id: \.self) { domain in
                    HStack(spacing: Spacing.s) {
                        Circle()
                            .fill(CognitiveMapTheme.color(for: domain))
                            .frame(width: 12, height: 12)
                        Text(domain == .other ? "Other" : domain.rawValue.capitalized)
                            .font(.uiBody)
                            .foregroundStyle(Color.textPrimary)
                    }
                }
            }
        }
    }

    // MARK: - Spine & Keeper

    private var spineAndKeeperSection: some View {
        VStack(alignment: .leading, spacing: Spacing.m) {
            Text("Spine and keepers")
                .font(.sectionHeader)
                .foregroundStyle(Color.textPrimary)

            HStack(alignment: .top, spacing: Spacing.m) {
                VStack(spacing: Spacing.xs) {
                    RoundedRectangle(cornerRadius: 4)
                        .strokeBorder(Color.accentWarm, lineWidth: 1)
                        .frame(width: 44, height: 28)
                    RoundedRectangle(cornerRadius: 4)
                        .strokeBorder(Color.accentWarm, lineWidth: 1.75)
                        .frame(width: 44, height: 28)
                }
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text("Spine")
                        .font(.uiBody.weight(.semibold))
                        .foregroundStyle(Color.textPrimary)
                    Text("2 to 4 beats are the through-line of the day. They draw larger and heavier (like the lower box); the rest sit back.")
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }
            }
            .accessibilityElement(children: .combine)

            HStack(alignment: .top, spacing: Spacing.m) {
                ZStack {
                    RoundedRectangle(cornerRadius: 4)
                        .strokeBorder(Color.accentWarm, lineWidth: 1)
                    RoundedRectangle(cornerRadius: 3)
                        .strokeBorder(Color.goldSurface, lineWidth: 1)
                        .padding(3)
                }
                .frame(width: 44, height: 28)
                VStack(alignment: .leading, spacing: Spacing.xs) {
                    Text("Keeper")
                        .font(.uiBody.weight(.semibold))
                        .foregroundStyle(Color.textPrimary)
                    Text("Rare (0 to 2 per map): a thin gold hairline. The test is whether it survives stripping the date. “Only three people signed up” doesn’t. “I avoid the things that would tell me I’m wrong” does.")
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }
            }
            .accessibilityElement(children: .combine)
        }
    }

    // MARK: - Edges

    private static let edgeRows: [(type: EdgeType, name: String, meaning: String)] = [
        (.caused, "Caused", "This brought about that."),
        (.because, "Because", "This is the stated reason for that."),
        (.contradicts, "Contradicts", "These two pull against each other."),
        (.counters, "Counters", "This is a deliberate response to that."),
        (.evidenceFor, "Evidence for", "This supports that."),
        (.partOf, "Part of", "This belongs to that."),
    ]

    private var edgesSection: some View {
        VStack(alignment: .leading, spacing: Spacing.m) {
            Text("Lines: how beats connect")
                .font(.sectionHeader)
                .foregroundStyle(Color.textPrimary)

            ForEach(Self.edgeRows, id: \.type) { row in
                HStack(alignment: .top, spacing: Spacing.s) {
                    Text(row.name)
                        .font(.uiBody.weight(.semibold))
                        .foregroundStyle(Color.textPrimary)
                        .frame(width: 100, alignment: .leading)
                    Text(row.meaning)
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                }
            }

            Text("Every line also shows a + or −: + means it strengthens what it points at, − means it weakens it.")
                .font(.captionText)
                .foregroundStyle(Color.textSecondary)
                .padding(.top, Spacing.xs)
        }
    }
}

/// A small, neutral-ink illustration of one beat kind's shape, for the legend only.
/// The map itself colors shapes by domain; here the shape is the point, so it stays
/// uncolored.
private struct LegendShapeSwatch: View {
    let kind: BeatKind

    var body: some View {
        switch kind {
        case .feeling:
            Ellipse().strokeBorder(Color.textSecondary, lineWidth: 1.5)
        case .belief:
            Capsule().strokeBorder(Color.textSecondary, lineWidth: 1.5)
        case .intent:
            RoundedRectangle(cornerRadius: 4)
                .strokeBorder(Color.textSecondary, style: StrokeStyle(lineWidth: 1.5, dash: [4, 3]))
        case .event:
            RoundedRectangle(cornerRadius: 4).strokeBorder(Color.textSecondary, lineWidth: 1.5)
        }
    }
}

#Preview {
    CognitiveMapLegendSheet()
}
