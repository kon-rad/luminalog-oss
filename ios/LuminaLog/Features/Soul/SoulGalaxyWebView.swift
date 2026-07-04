import SwiftUI
import WebKit
import os.log

private let soulLog = Logger(subsystem: "com.konradgnat.luminalog", category: "soul")

/// Hosts the bundled `soul.html` (ForceGraph3D) and injects the point-set as
/// `window.renderSoul({points})`. Re-injects when the points change.
struct SoulGalaxyWebView: UIViewRepresentable {

    let points: [ConstellationPoint]

    func makeCoordinator() -> Coordinator { Coordinator() }

    func makeUIView(context: Context) -> WKWebView {
        let config = WKWebViewConfiguration()
        let controller = WKUserContentController()
        controller.add(context.coordinator, name: "log")
        let bridge = """
        window.onerror = function (m, s, l, c) {
          window.webkit.messageHandlers.log.postMessage('JS error: ' + m + ' @' + (s||'') + ':' + l + ':' + c);
        };
        ['error','warn'].forEach(function (lvl) {
          var o = console[lvl];
          console[lvl] = function () {
            try { window.webkit.messageHandlers.log.postMessage(lvl + ': ' + Array.prototype.join.call(arguments, ' ')); } catch (e) {}
            o.apply(console, arguments);
          };
        });
        """
        controller.addUserScript(WKUserScript(source: bridge, injectionTime: .atDocumentStart, forMainFrameOnly: true))
        config.userContentController = controller

        let webView = WKWebView(frame: .zero, configuration: config)
        webView.navigationDelegate = context.coordinator
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false

        guard let htmlURL = Bundle.main.url(forResource: "soul", withExtension: "html") else { return webView }
        webView.loadFileURL(htmlURL, allowingReadAccessTo: htmlURL.deletingLastPathComponent())
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        let signature = "\(points.count):\(points.first?.dayIndex ?? -1):\(points.last?.dayIndex ?? -1)"
        guard context.coordinator.lastSignature != signature else { return }
        context.coordinator.pendingPoints = points
        context.coordinator.pendingSignature = signature
        context.coordinator.renderIfReady(in: webView)
    }

    final class Coordinator: NSObject, WKScriptMessageHandler, WKNavigationDelegate {
        var didLoad = false
        var pendingPoints: [ConstellationPoint] = []
        var pendingSignature = ""
        var lastSignature: String?

        func webView(_ webView: WKWebView, didFinish navigation: WKNavigation!) {
            didLoad = true
            renderIfReady(in: webView)
        }

        func webView(_ webView: WKWebView, didFail navigation: WKNavigation!, withError error: Error) {
            soulLog.error("Soul WebView nav failed: \(error.localizedDescription, privacy: .public)")
        }

        func webView(_ webView: WKWebView, didFailProvisionalNavigation navigation: WKNavigation!, withError error: Error) {
            soulLog.error("Soul WebView provisional nav failed: \(error.localizedDescription, privacy: .public)")
        }

        func renderIfReady(in webView: WKWebView) {
            guard didLoad else { return }
            let payload: [String: Any] = [
                "points": pendingPoints.map { ["x": $0.x, "y": $0.y, "z": $0.z, "wordCount": Double($0.wordCount)] }
            ]
            guard let data = try? JSONSerialization.data(withJSONObject: payload),
                  let json = String(data: data, encoding: .utf8) else { return }
            webView.evaluateJavaScript("window.renderSoul(\(json));", completionHandler: nil)
            lastSignature = pendingSignature
        }

        func userContentController(_ controller: WKUserContentController, didReceive message: WKScriptMessage) {
            if message.name == "log" {
                soulLog.error("Soul JS: \(String(describing: message.body), privacy: .public)")
            }
        }
    }
}
