import SwiftUI
import WebKit
import os.log

private let graphLog = Logger(subsystem: "com.konradgnat.luminalog", category: "constellation")

/// Hosts the bundled `graph.html` (3d-force-graph) and injects the fetched
/// graph as JSON. Reports node taps back via `onSelectNode`.
struct GraphWebView: UIViewRepresentable {

    let graph: JournalGraph
    let onSelectNode: (String) -> Void

    func makeCoordinator() -> Coordinator {
        Coordinator(onSelectNode: onSelectNode)
    }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "inspect")
        controller.add(context.coordinator, name: "log")

        // Forward JS errors and console output to the native log. Without this,
        // a failed script load or runtime throw inside the WebView is silent and
        // the map just renders as a black screen with no explanation.
        let bridge = """
        window.onerror = function (msg, src, line, col) {
          window.webkit.messageHandlers.log.postMessage('JS error: ' + msg + ' @' + (src||'') + ':' + line + ':' + col);
        };
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
        webView.scrollView.isScrollEnabled = false   // let 3d-force-graph own gestures

        guard let htmlURL = Bundle.main.url(forResource: "graph", withExtension: "html") else {
            return webView
        }
        // Grant read access to the Resources dir so graph.html can load ./vendor/*.js
        webView.loadFileURL(htmlURL, allowingReadAccessTo: htmlURL.deletingLastPathComponent())
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        // Re-inject if the graph identity changed (e.g. after a retry).
        guard context.coordinator.lastRenderedNodeCount != graph.nodes.count else { return }
        context.coordinator.pendingGraph = graph
        context.coordinator.renderIfReady(in: webView)
    }

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        private let onSelectNode: (String) -> Void
        var didLoad = false
        var pendingGraph: JournalGraph?
        var lastRenderedNodeCount = -1

        init(onSelectNode: @escaping (String) -> Void) {
            self.onSelectNode = onSelectNode
        }

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            didLoad = true
            renderIfReady(in: webView)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            graphLog.error("Constellation WebView navigation failed: \(error.localizedDescription, privacy: .public)")
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            graphLog.error("Constellation WebView provisional navigation failed: \(error.localizedDescription, privacy: .public)")
        }

        func renderIfReady(in webView: WKWebView) {
            guard didLoad, let graph = pendingGraph else { return }
            guard let data = try? JSONEncoder().encode(graph),
                  let json = String(data: data, encoding: .utf8) else { return }
            webView.evaluateJavaScript("window.renderGraph(\(json));", completionHandler: nil)
            lastRenderedNodeCount = graph.nodes.count
        }

        func userContentController(_ controller: WKUserContentController,
                                   didReceive message: WKScriptMessage) {
            switch message.name {
            case "inspect":
                guard let id = message.body as? String else { return }
                onSelectNode(id)
            case "log":
                graphLog.error("Constellation JS: \(String(describing: message.body), privacy: .public)")
            default:
                break
            }
        }
    }
}
