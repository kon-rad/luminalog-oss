import Foundation

/// Proactively downloads the on-device embedding assets (the ~258 MB distiluse ONNX
/// model + both tokenizer files) into the **same cache directory** the lazy embedder
/// reads, so the first real `embed()` becomes a cache hit instead of blocking the
/// user's first AI request on a large download.
///
/// It reuses `EmbeddingModelProvider` (streaming download + SHA-256 verify + atomic
/// install), so it inherits the memory-safe path. The politeness (Wi-Fi-only, wait for
/// connectivity) lives entirely in the injected provider's `URLSession` — see
/// `URLSession.embeddingPrefetch`. The lazy on-demand path stays any-network, so a user
/// who actively invokes AI on cellular is never blocked by this gate.
///
/// **Best-effort:** each asset is fetched independently and any failure is swallowed —
/// the lazy path is the ultimate fallback, and the next launch retries. Nothing here is
/// on the critical path.
struct EmbeddingModelPrefetcher {

    let assets: [EmbeddingModelAsset]
    let provider: EmbeddingModelProvider

    init(assets: [EmbeddingModelAsset], provider: EmbeddingModelProvider) {
        self.assets = assets
        self.provider = provider
    }

    /// Fetch every asset into the cache. Returns `true` iff **all** assets are now
    /// present + verified locally (so the model can be used without any further
    /// download) — the caller uses this to decide whether it's safe to run background
    /// backfill without triggering a metered download. Per-asset failures are otherwise
    /// swallowed (they retry on the next launch / lazily on first use).
    @discardableResult
    func prefetch() async -> Bool {
        var allReady = true
        for asset in assets {
            if (try? await provider.fetch(asset)) == nil { allReady = false }
        }
        return allReady
    }
}

extension URLSession {
    /// A network-polite session used only for speculative model prefetch: it skips
    /// Low Data Mode and cellular/hotspot (so it never spends metered data on a 258 MB
    /// download the user hasn't asked for) and waits for an inexpensive path (Wi-Fi)
    /// instead of failing. Bounded by a resource timeout so a waiting task can't linger
    /// indefinitely; if it never completes, the lazy on-demand path still covers use.
    static let embeddingPrefetch: URLSession = {
        let config = URLSessionConfiguration.default
        config.allowsConstrainedNetworkAccess = false   // skip Low Data Mode
        config.allowsExpensiveNetworkAccess = false      // skip cellular / personal hotspot
        config.waitsForConnectivity = true               // wait for Wi-Fi instead of failing
        config.timeoutIntervalForResource = 3600         // don't linger forever (1 h)
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        return URLSession(configuration: config)
    }()
}
