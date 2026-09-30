import SwiftUI
import WebKit
import os.log

private let storyMapLog = Logger(subsystem: "com.konradgnat.luminalog", category: "story-map")

/// What `StoryMapView` has loaded, handed to the bridge so it can answer the
/// renderer's pulls without its own reads.
struct StoryMapData {
    let entries: [JournalEntry]
    let entriesById: [String: JournalEntry]
    let summaries: [PeriodKey: PeriodSummary]
    let timeZone: TimeZone

    init(entries: [JournalEntry], summaries: [PeriodSummary], timeZone: TimeZone) {
        self.entries = entries
        self.entriesById = Dictionary(entries.map { ($0.id, $0) }, uniquingKeysWith: { a, _ in a })
        self.summaries = Dictionary(summaries.map { ($0.key, $0) }, uniquingKeysWith: { a, _ in a })
        self.timeZone = timeZone
    }
}

/// SwiftUI's handle on the bridge: pushes loaded data in and forwards chip taps. A
/// plain reference holder, kept in `@State`, so calling it never re-renders the view.
@MainActor
final class StoryMapController {
    fileprivate weak var coordinator: StoryMapWebView.Coordinator?
    fileprivate var latest: StoryMapData?

    func update(_ data: StoryMapData) {
        latest = data
        coordinator?.update(data)
    }

    /// Shows entry `id` for `day`: replaces the entry map if that day is on screen,
    /// otherwise caches it so drilling into the day shows it.
    func showEntry(day: Int, id: String) {
        Task { await coordinator?.showEntry(day: day, id: id) }
    }
}

/// Hosts the bundled `pyramid.html` (the shared `cognitive-map` package's zoom
/// pyramid) and answers its pull requests: `needTierData` from the server's
/// positions, `needNarrative` from the stored period summaries (never an LLM call),
/// `needEntry` from the local day's entries. See `packages/cognitive-map/README.md`,
/// "push in, pull requests out". Spec: docs/superpowers/specs/2026-09-28-story-map-design.md.
struct StoryMapWebView: UIViewRepresentable {

    let journals: JournalRepository
    let ai: AIService
    let controller: StoryMapController
    /// Where the map opens: a period the user was looking at in the Story view.
    /// Nil opens the week tier unfocused, the renderer's default.
    let initialFocus: PyramidTarget?
    let onFocusChange: (FocusInfo?) -> Void
    /// A tier's positions arrived; `true` when it has no dots.
    let onTierLoaded: (String, Bool) -> Void
    let onSelectBeat: (Beat, String) -> Void

    func makeCoordinator() -> Coordinator {
        let coordinator = Coordinator(
            journals: journals, ai: ai, initialFocus: initialFocus,
            onFocusChange: onFocusChange, onTierLoaded: onTierLoaded, onSelectBeat: onSelectBeat
        )
        controller.coordinator = coordinator
        if let latest = controller.latest { coordinator.update(latest) }
        return coordinator
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let userContent = WKUserContentController()
        for name in ["needTierData", "needNarrative", "needEntry", "focusChange", "selectBeat", "log"] {
            userContent.add(context.coordinator, name: name)
        }

        let bridge = """
        ['error','warn'].forEach(function (level) {
          var orig = console[level];
          console[level] = function () {
            try { window.webkit.messageHandlers.log.postMessage(level + ': ' + Array.prototype.join.call(arguments, ' ')); } catch (e) {}
            orig.apply(console, arguments);
          };
        });
        """
        userContent.addUserScript(WKUserScript(source: bridge, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController = userContent

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false

        guard let htmlURL = Bundle.main.url(forResource: "pyramid", withExtension: "html") else {
            storyMapLog.error("pyramid.html missing from the bundle. Run npm run sync:ios in packages/cognitive-map.")
            return webView
        }
        webView.loadFileURL(htmlURL, allowingReadAccessTo: htmlURL.deletingLastPathComponent())
        context.coordinator.webView = webView
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {}

    @MainActor
    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        private let journals: JournalRepository
        private let ai: AIService
        private let onFocusChange: (FocusInfo?) -> Void
        private let onTierLoaded: (String, Bool) -> Void
        private let onSelectBeat: (Beat, String) -> Void
        weak var webView: WKWebView?
        private var didLoad = false

        private let initialTier: String
        /// Focused once the initial tier's positions have been pushed.
        private var pendingFocus: PyramidTarget?
        private var data: StoryMapData?
        /// Narratives the renderer asked for before their summary was loaded. The
        /// renderer never re-asks, so `update(_:)` answers these when data arrives.
        private var pendingNarratives: Set<PyramidTarget> = []
        /// A day drilled into before entries were loaded.
        private var pendingEntryDay: Int?
        /// The chip chosen per day; absent means the newest entry.
        private var selectedEntryByDay: [Int: String] = [:]
        /// Entry maps generated during this session, so a chip switch back is instant.
        private var generatedMaps: [String: CognitiveMapGeneration] = [:]
        /// The map and content on screen, to resolve a `selectBeat` id for the inspector.
        private var currentEntryMap: CognitiveMap?
        private var currentEntryContent = ""

        init(
            journals: JournalRepository, ai: AIService, initialFocus: PyramidTarget?,
            onFocusChange: @escaping (FocusInfo?) -> Void,
            onTierLoaded: @escaping (String, Bool) -> Void,
            onSelectBeat: @escaping (Beat, String) -> Void
        ) {
            self.journals = journals
            self.ai = ai
            self.initialTier = initialFocus?.periodType ?? "week"
            self.pendingFocus = initialFocus
            self.onFocusChange = onFocusChange
            self.onTierLoaded = onTierLoaded
            self.onSelectBeat = onSelectBeat
        }

        // MARK: - Host data

        func update(_ data: StoryMapData) {
            self.data = data
            for target in Array(pendingNarratives) {
                guard let key = StoryMapKeys.summaryKey(periodType: target.periodType, periodIndex: target.periodIndex),
                      let sentence = data.summaries[key]?.sentence
                else { continue }
                pendingNarratives.remove(target)
                push(kind: "narrative", target.periodType, target.periodIndex, sentence)
            }
            if let day = pendingEntryDay {
                pendingEntryDay = nil
                Task { await handleNeedEntry(day: day) }
            }
        }

        // MARK: - Navigation

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            didLoad = true
            // `initialTier` is one of the six fixed tier names, never user text.
            webView.evaluateJavaScript("window.mountZoomPyramid('\(initialTier)');")
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            storyMapLog.error("Story map navigation failed: \(error.localizedDescription, privacy: .public)")
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            storyMapLog.error("Story map provisional navigation failed: \(error.localizedDescription, privacy: .public)")
        }

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            switch message.name {
            case "needTierData":
                guard let periodType = message.body as? String else { return }
                Task { await handleNeedTierData(periodType) }
            case "needNarrative":
                guard let raw = message.body as? String, let payload = decode(raw, as: NeedNarrativePayload.self)
                else { return }
                handleNeedNarrative(PyramidTarget(periodType: payload.periodType, periodIndex: payload.periodIndex))
            case "needEntry":
                guard let day = message.body as? Int else { return }
                Task { await handleNeedEntry(day: day) }
            case "focusChange":
                guard let raw = message.body as? String else { onFocusChange(nil); return }
                onFocusChange(decode(raw, as: FocusInfo.self))
            case "selectBeat":
                guard let beatId = message.body as? String, let map = currentEntryMap,
                      let beat = map.beat(id: beatId)
                else { return }
                onSelectBeat(beat, currentEntryContent)
            case "log":
                storyMapLog.error("Story map JS: \(String(describing: message.body), privacy: .public)")
            default:
                break
            }
        }

        // MARK: - Pull handlers

        private func handleNeedTierData(_ periodType: String) async {
            let points: [PeriodPositionPoint]
            do {
                points = try await ai.periodPositions(periodType: periodType)
            } catch {
                storyMapLog.error("positions failed for \(periodType, privacy: .public): \(error.localizedDescription, privacy: .public)")
                points = []
            }
            // Push even when empty so the renderer shows its empty state.
            push(kind: "tier", periodType, encodableToObject(points) ?? [])
            onTierLoaded(periodType, points.isEmpty)
            if let target = pendingFocus, target.periodType == periodType {
                pendingFocus = nil
                webView?.evaluateJavaScript("window.zoomPyramidFocus(\(target.periodIndex));", completionHandler: nil)
            }
        }

        /// The renderer only relays the narrative back through `onFocusChange` and
        /// never draws it (ADR-0147), so the summary's sentence is enough. No summary
        /// yet: remember the request and answer it in `update(_:)`. Never generates.
        private func handleNeedNarrative(_ target: PyramidTarget) {
            guard let key = StoryMapKeys.summaryKey(periodType: target.periodType, periodIndex: target.periodIndex) else {
                storyMapLog.error("unknown pyramid tier \(target.periodType, privacy: .public)")
                return
            }
            if let sentence = data?.summaries[key]?.sentence {
                push(kind: "narrative", target.periodType, target.periodIndex, sentence)
            } else {
                pendingNarratives.insert(target)
            }
        }

        private func handleNeedEntry(day: Int) async {
            guard let data else {
                pendingEntryDay = day
                return
            }
            let dayEntries = StoryMapDay.entries(onDay: day, from: data.entries, timeZone: data.timeZone)
            // The renderer doesn't report drilling in; move the caption to this day so
            // its chip row is the one on screen.
            onFocusChange(FocusInfo(periodType: "day", periodIndex: day, childCount: dayEntries.count, narrative: nil))
            guard let id = selectedEntryByDay[day] ?? dayEntries.first?.id else {
                push(kind: "entry", day, ["v": 1, "beats": [], "edges": []])
                return
            }
            await showEntry(day: day, id: id)
        }

        /// Pushes entry `id`'s map as day `day`'s entry map, generating it on demand
        /// (one entry-map job, only for the entry being looked at).
        func showEntry(day: Int, id: String) async {
            selectedEntryByDay[day] = id
            guard let entry = data?.entriesById[id] else { return }
            var generation = entry.cognitiveMap ?? generatedMaps[id]
            if generation == nil, let generated = try? await ai.generateEntryMap(journalId: id) {
                generation = generated
                generatedMaps[id] = generated
                try? await journals.updateCognitiveMap(id: id, map: generated)
            }
            // The user may have tapped another chip while this one generated.
            guard selectedEntryByDay[day] == id else { return }
            let map = generation?.map ?? CognitiveMap(v: 1, beats: [], edges: [])
            currentEntryMap = map
            currentEntryContent = entry.content
            push(kind: "entry", day, encodableToObject(map) ?? [:])
        }

        // MARK: - Push helpers

        private struct NeedNarrativePayload: Decodable { let periodType: String; let periodIndex: Int }

        private func decode<T: Decodable>(_ json: String, as type: T.Type) -> T? {
            guard let data = json.data(using: .utf8) else { return nil }
            return try? JSONDecoder().decode(T.self, from: data)
        }

        private func encodableToObject(_ value: some Encodable) -> Any? {
            guard let data = try? JSONEncoder().encode(value) else { return nil }
            return try? JSONSerialization.jsonObject(with: data)
        }

        /// Every push goes through one JSON-serialized varargs call, so summary text
        /// (model output, never trusted to be quote-safe) is never interpolated into JS.
        private func push(kind: String, _ args: Any...) {
            guard let webView, didLoad else { return }
            var all: [Any] = [kind]
            all.append(contentsOf: args)
            guard let data = try? JSONSerialization.data(withJSONObject: all),
                  let json = String(data: data, encoding: .utf8)
            else { return }
            webView.evaluateJavaScript("window.pushZoomPyramidData.apply(null, \(json));")
        }
    }
}

/// Mirrors the renderer's `FocusInfo` (packages/cognitive-map/src/pyramid.ts).
struct FocusInfo: Decodable, Equatable {
    let periodType: String
    let periodIndex: Int
    let childCount: Int
    let narrative: String?
}
