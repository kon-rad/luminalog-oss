import SwiftUI
import WebKit
import os.log

private let pyramidLog = Logger(subsystem: "com.konradgnat.luminalog", category: "zoom-pyramid")

/// Hosts the bundled `pyramid.html` (the shared `cognitive-map` package's zoom
/// pyramid) and answers its push/pull bridge: `needTierData` / `needNarrative` /
/// `needEntry` come in as one-way messages, this Coordinator resolves each by
/// calling `AIService` or reading local entries, and pushes the answer back via
/// `window.pushZoomPyramidData`. See `packages/cognitive-map/README.md`'s "push in,
/// pull requests out" section for why the contract is shaped this way.
///
/// Mirrors `CognitiveMapWebView`'s structure exactly; unlike that view, this one's
/// Coordinator also originates outbound calls, since the renderer pulls data it is
/// missing rather than being handed everything upfront.
struct ZoomPyramidWebView: UIViewRepresentable {

    let journals: JournalRepository
    let ai: AIService
    let colorScheme: ColorScheme
    let onFocusChange: (FocusInfo?) -> Void
    let onSelectBeat: (Beat, String) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(journals: journals, ai: ai, onFocusChange: onFocusChange, onSelectBeat: onSelectBeat)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let controller = WKUserContentController()
        for name in ["needTierData", "needNarrative", "needEntry", "focusChange", "selectBeat", "log"] {
            controller.add(context.coordinator, name: name)
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
        controller.addUserScript(WKUserScript(source: bridge,
                                              injectionTime: .atDocumentStart,
                                              forMainFrameOnly: true))
        config.userContentController = controller

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false

        guard let htmlURL = Bundle.main.url(forResource: "pyramid", withExtension: "html") else {
            pyramidLog.error("pyramid.html missing from the bundle. Run npm run sync:ios in packages/cognitive-map.")
            return webView
        }
        webView.loadFileURL(htmlURL, allowingReadAccessTo: htmlURL.deletingLastPathComponent())
        context.coordinator.webView = webView
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.colorScheme = colorScheme
    }

    @MainActor
    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        private let journals: JournalRepository
        private let ai: AIService
        private let onFocusChange: (FocusInfo?) -> Void
        private let onSelectBeat: (Beat, String) -> Void
        weak var webView: WKWebView?
        var colorScheme: ColorScheme = .light
        private var didLoad = false

        /// Session-lifetime cache, keyed "periodType:periodIndex". Not persisted:
        /// see this plan's "Known simplification" section.
        private var narrativeCache: [String: String] = [:]

        /// The map + source content currently shown, so a selectBeat message (just
        /// a beat id) can be resolved to a full Beat + its entry's content for the
        /// inspector sheet.
        private var currentEntryMap: CognitiveMap?
        private var currentEntryContent: String = ""

        init(
            journals: JournalRepository, ai: AIService,
            onFocusChange: @escaping (FocusInfo?) -> Void,
            onSelectBeat: @escaping (Beat, String) -> Void
        ) {
            self.journals = journals
            self.ai = ai
            self.onFocusChange = onFocusChange
            self.onSelectBeat = onSelectBeat
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            didLoad = true
            webView.evaluateJavaScript("window.mountZoomPyramid('week');")
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            pyramidLog.error("Zoom pyramid navigation failed: \(error.localizedDescription, privacy: .public)")
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            pyramidLog.error("Zoom pyramid provisional navigation failed: \(error.localizedDescription, privacy: .public)")
        }

        func userContentController(_ controller: WKUserContentController,
                                   didReceive message: WKScriptMessage) {
            switch message.name {
            case "needTierData":
                guard let periodType = message.body as? String else { return }
                Task { await handleNeedTierData(periodType) }
            case "needNarrative":
                guard let raw = message.body as? String, let payload = decode(raw, as: NeedNarrativePayload.self)
                else { return }
                Task { await handleNeedNarrative(periodType: payload.periodType, periodIndex: payload.periodIndex) }
            case "needEntry":
                guard let dayPeriodIndex = message.body as? Int else { return }
                Task { await handleNeedEntry(dayPeriodIndex: dayPeriodIndex) }
            case "focusChange":
                guard let raw = message.body as? String else { onFocusChange(nil); return }
                onFocusChange(decode(raw, as: FocusInfo.self))
            case "selectBeat":
                guard let beatId = message.body as? String, let map = currentEntryMap,
                      let beat = map.beat(id: beatId)
                else { return }
                onSelectBeat(beat, currentEntryContent)
            case "log":
                pyramidLog.error("Zoom pyramid JS: \(String(describing: message.body), privacy: .public)")
            default:
                break
            }
        }

        // MARK: - Bridge request handlers

        private func handleNeedTierData(_ periodType: String) async {
            guard let points = try? await ai.periodPositions(periodType: periodType) else { return }
            push(kind: "tier", periodType, encodableToObject(points) ?? [])
        }

        private func handleNeedNarrative(periodType: String, periodIndex: Int) async {
            let cacheKey = "\(periodType):\(periodIndex)"
            if let cached = narrativeCache[cacheKey] {
                push(kind: "narrative", periodType, periodIndex, cached)
                return
            }
            guard let days = await daysInPeriod(periodType: periodType, periodIndex: periodIndex),
                  !days.isEmpty,
                  let narrative = try? await ai.generatePeriodNarrative(
                    periodType: periodType, periodIndex: periodIndex, days: days
                  )
            else { return }
            narrativeCache[cacheKey] = narrative
            push(kind: "narrative", periodType, periodIndex, narrative)
        }

        private func handleNeedEntry(dayPeriodIndex: Int) async {
            guard let all = try? await journals.fetchAllEntries() else {
                push(kind: "entry", dayPeriodIndex, ["v": 1, "beats": [], "edges": []]); return
            }
            let sameDay = all
                .filter { ServerSemanticIndex.dayIndex(for: $0.createdAt) == dayPeriodIndex }
                .sorted { $0.createdAt > $1.createdAt }
            guard var entry = sameDay.first else {
                push(kind: "entry", dayPeriodIndex, ["v": 1, "beats": [], "edges": []]); return
            }
            if entry.cognitiveMap == nil, let generated = try? await ai.generateEntryMap(journalId: entry.id) {
                entry.cognitiveMap = generated
                try? await journals.updateCognitiveMap(id: entry.id, map: generated)
            }
            let map = entry.cognitiveMap?.map ?? CognitiveMap(v: 1, beats: [], edges: [])
            currentEntryMap = map
            currentEntryContent = entry.content
            push(kind: "entry", dayPeriodIndex, encodableToObject(map) ?? [:])
        }

        /// Every local entry whose day falls in `periodType`/`periodIndex`, as
        /// `PeriodNarrativeDayInput`s built from whatever beats each entry already
        /// has extracted (`entry.cognitiveMap?.map.beats`). An entry with no map yet
        /// contributes nothing rather than blocking the whole period: "arrives when
        /// it arrives" (see the design spec's Error handling section), not
        /// "generate everything on demand here," which would make opening a coarse
        /// tier trigger dozens of entry-map generations at once.
        private func daysInPeriod(periodType: String, periodIndex: Int) async -> [PeriodNarrativeDayInput]? {
            guard let all = try? await journals.fetchAllEntries() else { return nil }
            var byDay: [Int: [PeriodNarrativeBeatInput]] = [:]
            for entry in all {
                guard let beats = entry.cognitiveMap?.map.beats, !beats.isEmpty else { continue }
                let day = ServerSemanticIndex.dayIndex(for: entry.createdAt)
                guard periodIndexMatches(day: day, periodType: periodType, target: periodIndex) else { continue }
                let inputs = beats.map {
                    PeriodNarrativeBeatInput(text: $0.text, kind: $0.kind.rawValue, domain: $0.domain.rawValue, isSpine: $0.isSpine)
                }
                byDay[day, default: []].append(contentsOf: inputs)
            }
            return byDay.map { PeriodNarrativeDayInput(dayIndex: $0.key, beats: $0.value) }
        }

        private func periodIndexMatches(day: Int, periodType: String, target: Int) -> Bool {
            switch periodType {
            case "day": return day == target
            case "week": return PeriodIndex.weekIndex(forDayIndex: day) == target
            case "month":
                let anchor = PeriodIndex.thursdayDayIndex(forDayIndex: day)
                return PeriodIndex.monthIndex(forDayIndex: anchor) == target
            case "quarter":
                let anchor = PeriodIndex.thursdayDayIndex(forDayIndex: day)
                return PeriodIndex.quarterIndex(forDayIndex: anchor) == target
            case "year":
                let anchor = PeriodIndex.thursdayDayIndex(forDayIndex: day)
                return PeriodIndex.yearIndex(forDayIndex: anchor) == target
            case "lifetime": return true
            default: return false
            }
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

        /// Every push into the renderer goes through this one call: the whole
        /// argument list is JSON-serialized together and applied as JS varargs, so
        /// arbitrary text (an LLM-generated narrative paragraph, never trusted to be
        /// quote-safe) is never hand-interpolated into a JS string literal.
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