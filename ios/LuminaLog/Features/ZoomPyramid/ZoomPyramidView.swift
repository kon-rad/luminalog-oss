import SwiftUI

/// The zoom-pyramid screen: day-through-lifetime spatial navigation over the whole
/// journal, opened from a dedicated `JournalListView` toolbar icon (separate from
/// the existing Soul Constellation icon; see the design spec's Components section).
/// Owns the WebView plus a caption bar showing the focused dot's narrative, since the
/// renderer draws dots only and never narrative text (see the renderer package's
/// README, "The zoom pyramid: push in, pull requests out").
struct ZoomPyramidView: View {

    let journals: JournalRepository
    let ai: AIService

    @Environment(\.colorScheme) private var colorScheme
    @Environment(\.dismiss) private var dismiss
    @State private var focusInfo: FocusInfo?
    @State private var selectedBeat: Beat?
    @State private var selectedBeatEntryContent: String = ""

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                ZoomPyramidWebView(
                    journals: journals, ai: ai, colorScheme: colorScheme,
                    onFocusChange: { focusInfo = $0 },
                    onSelectBeat: { beat, content in
                        selectedBeat = beat
                        selectedBeatEntryContent = content
                    }
                )
                captionBar
            }
            .background(Color.appBackground.ignoresSafeArea())
            .navigationTitle("Zoom")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .navigationBarLeading) {
                    Button("Close") { dismiss() }
                }
            }
            .sheet(item: $selectedBeat) { beat in
                BeatInspectorSheet(beat: beat, entryContent: selectedBeatEntryContent)
            }
        }
    }

    @ViewBuilder
    private var captionBar: some View {
        if let info = focusInfo {
            VStack(alignment: .leading, spacing: Spacing.xs) {
                Text(info.periodType.capitalized)
                    .font(.captionText.weight(.semibold))
                    .foregroundStyle(Color.textSecondary)
                Text(info.narrative ?? "Still gathering this period's story...")
                    .font(.uiBody)
                    .foregroundStyle(info.narrative == nil ? Color.textSecondary : Color.textPrimary)
                    .lineLimit(6)
            }
            .padding(Spacing.m)
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.cardBackground)
            .transition(.opacity)
        }
    }
}