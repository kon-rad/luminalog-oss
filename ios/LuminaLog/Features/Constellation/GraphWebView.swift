import SwiftUI
import WebKit

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

        func renderIfReady(in webView: WKWebView) {
            guard didLoad, let graph = pendingGraph else { return }
            guard let data = try? JSONEncoder().encode(graph),
                  let json = String(data: data, encoding: .utf8) else { return }
            webView.evaluateJavaScript("window.renderGraph(\(json));", completionHandler: nil)
            lastRenderedNodeCount = graph.nodes.count
        }

        func userContentController(_ controller: WKUserContentController,
                                   didReceive message: WKScriptMessage) {
            guard message.name == "inspect", let id = message.body as? String else { return }
            onSelectNode(id)
        }
    }
}
