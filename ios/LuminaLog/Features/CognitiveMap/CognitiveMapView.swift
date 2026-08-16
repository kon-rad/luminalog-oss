import SwiftUI

/// The Map tab. Four states: a map, generating, failed with a retry, and nothing to
/// map.
///
/// Generation is best-effort and asynchronous, so the tab is honest about waiting
/// rather than pretending to be broken. Entries written before this feature shipped
/// generate on first open, which is why `onGenerate` fires from `task` and not only
/// from a button.
struct CognitiveMapView: View {

    let entry: JournalEntry
    /// Returns true when a map was generated and persisted.
    let onGenerate: () async -> Bool

    @Environment(\.colorScheme) private var colorScheme
    @State private var isGenerating = false
    @State private var didFail = false
    @State private var selectedBeat: Beat?

    var body: some View {
        Group {
            if let map = entry.cognitiveMap?.map, !map.drawnBeats.isEmpty {
                mapBody(map)
            } else if isGenerating {
                statusView("Reading your entry…", showsSpinner: true)
            } else if didFail {
                retryView
            } else if entry.content.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
                statusView("Nothing to map yet.", showsSpinner: false)
            } else {
                statusView("Not enough here to map yet.", showsSpinner: false)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.appBackground)
        .task(id: entry.id) { await generateIfNeeded() }
        .sheet(item: $selectedBeat) { beat in
            BeatInspectorSheet(beat: beat, entryContent: entry.content)
        }
    }

    private func mapBody(_ map: CognitiveMap) -> some View {
        CognitiveMapWebView(map: map, colorScheme: colorScheme) { beatId in
            selectedBeat = map.beat(id: beatId)
        }
        .accessibilityLabel("Cognitive map with \(map.drawnBeats.count) beats")
    }

    private func statusView(_ message: String, showsSpinner: Bool) -> some View {
        VStack(spacing: Spacing.m) {
            if showsSpinner { ProgressView() }
            Text(message)
                .font(.uiBody)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
        }
        .padding(Spacing.l)
    }

    private var retryView: some View {
        VStack(spacing: Spacing.m) {
            Text("Couldn't build the map.")
                .font(.uiBody)
                .foregroundStyle(Color.textSecondary)
            Button("Try again") {
                didFail = false
                Task { await generateIfNeeded(force: true) }
            }
            .font(.uiBody.weight(.semibold))
            .foregroundStyle(Color.accentWarm)
        }
        .padding(Spacing.l)
    }

    private func generateIfNeeded(force: Bool = false) async {
        guard force || entry.needsCognitiveMap else { return }
        guard !isGenerating else { return }
        isGenerating = true
        let produced = await onGenerate()
        isGenerating = false
        // A false result means skipped OR failed, and the view cannot tell them apart.
        // Only claim failure when there is still nothing to draw: the entry's own live
        // stream delivers the map if one landed.
        didFail = !produced && entry.cognitiveMap == nil
    }
}
