import SwiftUI
import WebKit
import os.log

private let mapLog = Logger(subsystem: "com.konradgnat.luminalog", category: "cognitive-map")

/// Hosts the bundled `map.html` (the shared `cognitive-map` renderer) and injects the
/// decrypted map plus the resolved theme tokens. Reports beat taps back via
/// `onSelectBeat`.
///
/// The renderer is shared with the web app on purpose: the map is one implementation
/// drawn twice, not two implementations that look similar. See packages/cognitive-map.
/// Re-run `npm run sync:ios` in that package after changing it, or this view keeps
/// loading the previously committed bundle.
///
/// Mirrors the shipped `GraphWebView` / `SoulGalaxyWebView` pattern.
struct CognitiveMapWebView: UIViewRepresentable {

    let map: CognitiveMap
    let colorScheme: ColorScheme
    let onSelectBeat: (String) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onSelectBeat: onSelectBeat)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "selectBeat")
        controller.add(context.coordinator, name: "log")

        // Forward JS console errors to the native log. Without this a failed script
        // load is silent and the tab just renders empty with no explanation.
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
        // The renderer owns pan and zoom, so the scroll view must not compete.
        webView.scrollView.isScrollEnabled = false

        guard let htmlURL = Bundle.main.url(forResource: "map", withExtension: "html") else {
            mapLog.error("map.html missing from the bundle. Run npm run sync:ios in packages/cognitive-map.")
            return webView
        }
        // Read access to Resources so map.html can load ./vendor/cognitive-map.iife.js.
        webView.loadFileURL(htmlURL, allowingReadAccessTo: htmlURL.deletingLastPathComponent())
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        context.coordinator.pending = (map, colorScheme)
        context.coordinator.renderIfReady(in: webView)
    }

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        private let onSelectBeat: (String) -> Void
        var didLoad = false
        var pending: (map: CognitiveMap, colorScheme: ColorScheme)?
        private var lastRendered: String?

        init(onSelectBeat: @escaping (String) -> Void) {
            self.onSelectBeat = onSelectBeat
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            didLoad = true
            renderIfReady(in: webView)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            mapLog.error("Cognitive map navigation failed: \(error.localizedDescription, privacy: .public)")
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            mapLog.error("Cognitive map provisional navigation failed: \(error.localizedDescription, privacy: .public)")
        }

        func renderIfReady(in webView: WKWebView) {
            guard didLoad, let pending else { return }
            guard
                let mapData = try? JSONEncoder().encode(pending.map),
                let mapJSON = String(data: mapData, encoding: .utf8),
                let themeData = try? JSONSerialization.data(
                    withJSONObject: CognitiveMapTheme.tokens(for: pending.colorScheme)
                ),
                let themeJSON = String(data: themeData, encoding: .utf8)
            else { return }

            // Skip a redundant re-render: SwiftUI calls updateUIView freely, and
            // redrawing resets the reader's pan position mid-gesture.
            let signature = "\(mapJSON.hashValue)|\(themeJSON.hashValue)"
            guard signature != lastRendered else { return }
            lastRendered = signature

            webView.evaluateJavaScript("window.renderCognitiveMap(\(mapJSON), \(themeJSON));")
        }

        func userContentController(_ controller: WKUserContentController,
                                   didReceive message: WKScriptMessage) {
            switch message.name {
            case "selectBeat":
                guard let id = message.body as? String else { return }
                onSelectBeat(id)
            case "log":
                mapLog.error("Cognitive map JS: \(String(describing: message.body), privacy: .public)")
            default:
                break
            }
        }
    }
}
