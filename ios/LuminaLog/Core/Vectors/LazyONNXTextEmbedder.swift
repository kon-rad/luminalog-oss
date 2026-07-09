import Foundation

/// The runtime bridge that makes on-device semantic search **self-activate** once the
/// MiniLM artifact is hosted. It is a `TextEmbedder` that, on its first
/// `embed(_:)`, resolves the model + tokenizer:
///
///   1. downloads & SHA-256-verifies the ONNX model (via `EmbeddingModelProvider`),
///   2. downloads & verifies BOTH tokenizer files (`tokenizer.json` +
///      `tokenizer_config.json`) into the same cache directory,
///   3. builds a concrete `ONNXTextEmbedder` pointed at the model file and that
///      tokenizer directory,
///
/// then delegates every embed to it. `AppServices` constructs this (instead of
/// `StubTextEmbedder`) whenever `AppConfig.embeddingModelAsset` and both tokenizer
/// assets are non-nil — i.e. the moment the four/six Info.plist keys are filled with a
/// hosted artifact. No zip: the two tokenizer JSON files are hosted separately and
/// land side-by-side, which is exactly what `AutoTokenizer.from(modelFolder:)` wants.
///
/// Resolution is **single-flight and memoized**: concurrent first calls trigger one
/// download pass, not N. A resolution *failure* is deliberately not cached, so a later
/// call can retry (e.g. once the network is back). It **fails closed** end to end —
/// any download/verify/tokenize/inference error propagates; it never fabricates a
/// vector. Because it is only *constructed* when the assets exist and only *used* when
/// `DevFlags.aiModel1` is ON, hosting the model does not by itself change any behavior.
actor LazyONNXTextEmbedder: TextEmbedder {

    private let modelAsset: EmbeddingModelAsset
    private let tokenizerAsset: EmbeddingModelAsset
    private let tokenizerConfigAsset: EmbeddingModelAsset
    private let provider: EmbeddingModelProvider
    private let makeEmbedder: (URL, URL) -> TextEmbedder

    /// Memoized single-flight resolution. Present ⇒ resolution in progress or done;
    /// cleared on failure so the next call retries.
    private var resolveTask: Task<TextEmbedder, Error>?

    /// - Parameters:
    ///   - modelAsset: the ONNX model (`minilm-multilingual-l12-v2.onnx`).
    ///   - tokenizerAsset: `tokenizer.json`.
    ///   - tokenizerConfigAsset: `tokenizer_config.json`.
    ///   - provider: downloads + verifies + caches assets (inject a fake in tests).
    ///   - makeEmbedder: builds the concrete embedder from the resolved model URL and
    ///     tokenizer directory. Defaults to the real `ONNXTextEmbedder`; injectable so
    ///     the resolution plumbing is testable without the real model.
    init(
        modelAsset: EmbeddingModelAsset,
        tokenizerAsset: EmbeddingModelAsset,
        tokenizerConfigAsset: EmbeddingModelAsset,
        provider: EmbeddingModelProvider = EmbeddingModelProvider(),
        makeEmbedder: @escaping (URL, URL) -> TextEmbedder = { modelURL, tokenizerDir in
            ONNXTextEmbedder(modelURL: modelURL, tokenizerDirectory: tokenizerDir)
        }
    ) {
        self.modelAsset = modelAsset
        self.tokenizerAsset = tokenizerAsset
        self.tokenizerConfigAsset = tokenizerConfigAsset
        self.provider = provider
        self.makeEmbedder = makeEmbedder
    }

    func embed(_ text: String) async throws -> EmbeddingVector {
        try await resolvedEmbedder().embed(text)
    }

    func embed(batch texts: [String]) async throws -> [EmbeddingVector] {
        try await resolvedEmbedder().embed(batch: texts)
    }

    /// Resolve (once) and return the concrete embedder. Concurrent callers share the
    /// in-flight `Task`; a failure is not memoized so a later call retries.
    private func resolvedEmbedder() async throws -> TextEmbedder {
        if let resolveTask { return try await resolveTask.value }

        let task = Task { [modelAsset, tokenizerAsset, tokenizerConfigAsset, provider, makeEmbedder] () async throws -> TextEmbedder in
            let modelURL = try await provider.fetch(modelAsset)
            // Both tokenizer files cache side-by-side under the provider's directory;
            // AutoTokenizer.from(modelFolder:) reads that directory.
            _ = try await provider.fetch(tokenizerAsset)
            _ = try await provider.fetch(tokenizerConfigAsset)
            let tokenizerDir = provider.localURL(for: tokenizerAsset).deletingLastPathComponent()
            return makeEmbedder(modelURL, tokenizerDir)
        }
        resolveTask = task

        do {
            return try await task.value
        } catch {
            resolveTask = nil   // don't cache a failed resolution — allow retry
            throw error
        }
    }
}
