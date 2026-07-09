import Foundation

/// App-wide configuration read from Info.plist keys.
enum AppConfig {

    /// Base URL of the LuminaLog proxy API (spec §4). Read from the
    /// `LUMINALOG_API_URL` Info.plist key; defaults to local development.
    static let proxyBaseURL: URL = {
        if let raw = Bundle.main.object(forInfoDictionaryKey: "LUMINALOG_API_URL") as? String,
           !raw.isEmpty,
           let url = URL(string: raw) {
            return url
        }
        return URL(string: "http://localhost:3200")!
    }()

    /// RevenueCat public SDK key from the `REVENUECAT_API_KEY` Info.plist key.
    /// When absent, the subscription service falls back to the mock.
    static let revenueCatAPIKey: String? = {
        guard let raw = Bundle.main.object(forInfoDictionaryKey: "REVENUECAT_API_KEY") as? String,
              !raw.isEmpty else { return nil }
        return raw
    }()

    // MARK: - On-device embedding model (increment 1c-D)

    /// The downloadable EmbeddingGemma ONNX model asset. The URL + SHA-256 are read
    /// from Info.plist keys (`EMBEDDING_MODEL_URL` / `EMBEDDING_MODEL_SHA256`) so the
    /// self-hosted bucket can change without a code change. Returns `nil` until the
    /// model is hosted and the keys are populated (placeholders are blank), so no live
    /// code path can accidentally try to download a non-existent artifact.
    static let embeddingModelAsset: EmbeddingModelAsset? = {
        makeAsset(urlKey: "EMBEDDING_MODEL_URL",
                  hashKey: "EMBEDDING_MODEL_SHA256",
                  filename: "embeddinggemma-300m.onnx")
    }()

    /// The tokenizer vocabulary/merges file (`tokenizer.json`). Hosted as a plain file
    /// (no zip) so it can be fetched straight into the tokenizer directory that
    /// `AutoTokenizer.from(modelFolder:)` reads. Same `nil`-until-hosted contract as
    /// `embeddingModelAsset`, keyed on `EMBEDDING_TOKENIZER_URL` /
    /// `EMBEDDING_TOKENIZER_SHA256`.
    static let embeddingTokenizerAsset: EmbeddingModelAsset? = {
        makeAsset(urlKey: "EMBEDDING_TOKENIZER_URL",
                  hashKey: "EMBEDDING_TOKENIZER_SHA256",
                  filename: "tokenizer.json")
    }()

    /// The tokenizer configuration file (`tokenizer_config.json`), hosted alongside
    /// `tokenizer.json`. Both land in the same cache directory so swift-transformers
    /// can load the tokenizer from that folder. Keyed on
    /// `EMBEDDING_TOKENIZER_CONFIG_URL` / `EMBEDDING_TOKENIZER_CONFIG_SHA256`.
    static let embeddingTokenizerConfigAsset: EmbeddingModelAsset? = {
        makeAsset(urlKey: "EMBEDDING_TOKENIZER_CONFIG_URL",
                  hashKey: "EMBEDDING_TOKENIZER_CONFIG_SHA256",
                  filename: "tokenizer_config.json")
    }()

    private static func makeAsset(urlKey: String, hashKey: String, filename: String) -> EmbeddingModelAsset? {
        guard let rawURL = Bundle.main.object(forInfoDictionaryKey: urlKey) as? String,
              !rawURL.isEmpty,
              let url = URL(string: rawURL),
              let rawHash = Bundle.main.object(forInfoDictionaryKey: hashKey) as? String,
              !rawHash.isEmpty else {
            return nil
        }
        return EmbeddingModelAsset(url: url, sha256Hex: rawHash, filename: filename)
    }
}
