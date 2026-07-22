import Foundation
import OnnxRuntimeBindings
import Tokenizers
import Hub

/// The real on-device embedder: distiluse run through ONNX Runtime, with a
/// WordPiece tokenizer (huggingface/swift-transformers). Pipeline:
///
///   text → tokenize → ORT session run (Core ML EP if available) →
///   `EmbeddingPooling.meanPool(...)` → L2-normalized `EmbeddingVector` (512-dim).
///
/// ## Status (increment 1c-D)
/// Fully wired: `AppServices` builds this (via `LazyONNXTextEmbedder`) once the
/// ~258 MB fp16 distiluse ONNX model + tokenizer are hosted and the Info.plist keys are
/// filled; until then the deterministic `StubTextEmbedder` is used. Usage stays gated
/// by `DevFlags.aiModel1`. It fails **closed** at every step:
///
///   * model file absent on disk → `TextEmbedderError.modelUnavailable`
///   * tokenizer files missing/unloadable → `TextEmbedderError.tokenizationFailed`
///   * ORT session/inference error → `TextEmbedderError.inferenceFailed`
///   * pooling can't produce a valid vector → `TextEmbedderError.poolingFailed`
///
/// It never fabricates a vector. Until the model ships, callers/tests use
/// `StubTextEmbedder` (deterministic) instead.
///
/// - Note: The input/output tensor names default to the distiluse export
///   (`input_ids`, `attention_mask`, `token_type_ids` in; `last_hidden_state` out) and
///   are overridable. `token_type_ids` is fed all-zeros only when the graph declares
///   it (BERT-family). Cross-platform parity (cosine > 0.999 vs the web/Android
///   reference) is validated separately once the model is hosted.
struct ONNXTextEmbedder: TextEmbedder {

    /// Local path to the ONNX model file (populated by `EmbeddingModelProvider`).
    let modelURL: URL
    /// Local directory holding the tokenizer files (`tokenizer.json`,
    /// `tokenizer_config.json`), populated by `EmbeddingModelProvider`.
    let tokenizerDirectory: URL

    /// Graph input tensor name for token ids.
    let inputIdsName: String
    /// Graph input tensor name for the attention mask.
    let attentionMaskName: String
    /// Graph input tensor name for the token-type ids. Some BERT graphs declare this
    /// input; it is fed all-zeros for a single sequence. Only supplied when the loaded
    /// graph actually declares it (DistilBERT/distiluse and RoBERTa/Gemma graphs do
    /// not), so the same code drives both.
    let tokenTypeIdsName: String
    /// Preferred graph output tensor name holding per-token hidden states. If absent
    /// at run time the first output is used.
    let tokenEmbeddingsOutputName: String
    /// Optional value forced into the tokenizer's `tokenizer_class` so swift-transformers
    /// routes to the correct tokenizer model. `nil` (default) uses the value in
    /// `tokenizer_config.json` — correct when it already names a supported class (e.g.
    /// `BertTokenizer` for WordPiece models). Set it only when the hosted file uses a
    /// generic class (`PreTrainedTokenizerFast`) that would misroute.
    let tokenizerClassOverride: String?

    private let fileManager: FileManager

    /// Caches the ORT env + session so the ~258 MB model loads ONCE per embedder, not on
    /// every `embed` call. Reused because `LazyONNXTextEmbedder` memoizes this instance.
    private let sessionBox = ORTSessionBox()

    init(
        modelURL: URL,
        tokenizerDirectory: URL,
        inputIdsName: String = "input_ids",
        attentionMaskName: String = "attention_mask",
        tokenTypeIdsName: String = "token_type_ids",
        tokenEmbeddingsOutputName: String = "last_hidden_state",
        tokenizerClassOverride: String? = nil,
        fileManager: FileManager = .default
    ) {
        self.modelURL = modelURL
        self.tokenizerDirectory = tokenizerDirectory
        self.inputIdsName = inputIdsName
        self.attentionMaskName = attentionMaskName
        self.tokenTypeIdsName = tokenTypeIdsName
        self.tokenEmbeddingsOutputName = tokenEmbeddingsOutputName
        self.tokenizerClassOverride = tokenizerClassOverride
        self.fileManager = fileManager
    }

    func embed(_ text: String) async throws -> EmbeddingVector {
        // Fail closed on the concrete precondition first: no model on disk.
        guard fileManager.fileExists(atPath: modelURL.path) else {
            throw TextEmbedderError.modelUnavailable
        }
        let tokenizer = try makeTokenizer()
        let ids = try tokenIds(for: text, tokenizer: tokenizer)
        do {
            guard let vector = try runBatched([ids]).first else {
                throw TextEmbedderError.inferenceFailed("empty batch result")
            }
            return vector
        } catch let error as TextEmbedderError {
            throw error
        } catch {
            throw TextEmbedderError.inferenceFailed(error.localizedDescription)
        }
    }

    /// Batched embed: tokenize every text, pad to the batch's longest sequence, and run
    /// ONE ORT session over a `[N, maxLen]` input — far fewer session invocations than N
    /// single-item runs, which is what backfill leans on. Falls back to the per-item
    /// path if the batched run throws or the model ignores the batch axis (e.g. a graph
    /// exported with a fixed `batch=1`), so batching is a throughput bonus and never a
    /// correctness regression.
    func embed(batch texts: [String]) async throws -> [EmbeddingVector] {
        guard !texts.isEmpty else { return [] }
        guard fileManager.fileExists(atPath: modelURL.path) else {
            throw TextEmbedderError.modelUnavailable
        }
        let tokenizer = try makeTokenizer()
        let rows = try texts.map { try tokenIds(for: $0, tokenizer: tokenizer) }
        do {
            return try runBatched(rows)
        } catch {
            // Batched run failed or produced an unexpected batch axis — degrade to safe
            // per-item runs (each a batch of one, which every graph supports).
            var out = [EmbeddingVector]()
            out.reserveCapacity(rows.count)
            for row in rows {
                guard let vector = try runBatched([row]).first else {
                    throw TextEmbedderError.inferenceFailed("empty result")
                }
                out.append(vector)
            }
            return out
        }
    }

    // MARK: - Tokenization

    /// Build the swift-transformers tokenizer from the two hosted JSON files.
    ///
    /// We build it from the two JSON files directly instead of
    /// `AutoTokenizer.from(modelFolder:)`, because that API *requires* a `config.json`
    /// (the model config) in the folder and we host only tokenizer.json +
    /// tokenizer_config.json. distiluse's `DistilBertTokenizerFast` routes correctly to
    /// swift-transformers' (WordPiece) `BertTokenizer` on its own, so
    /// `tokenizerClassOverride` is nil.
    ///
    /// NOTE: swift-transformers' `PrecompiledNormalizer` is a stub, so SentencePiece
    /// tokenizers (XLM-RoBERTa / Unigram) tokenize INCORRECTLY on-device — hence a
    /// WordPiece model (distiluse), whose `BertNormalizer` is fully implemented. For a
    /// model whose `tokenizer_class` is a generic `PreTrainedTokenizerFast`, set
    /// `tokenizerClassOverride` to the right class (e.g. "BertTokenizer").
    private func makeTokenizer() throws -> Tokenizer {
        do {
            let dataURL = tokenizerDirectory.appendingPathComponent("tokenizer.json")
            let configURL = tokenizerDirectory.appendingPathComponent("tokenizer_config.json")
            guard let tokenizerData = try JSONSerialization.jsonObject(
                with: Data(contentsOf: dataURL)) as? [NSString: Any] else {
                throw TextEmbedderError.tokenizationFailed
            }
            var configDict = ((try? JSONSerialization.jsonObject(
                with: Data(contentsOf: configURL))) as? [NSString: Any]) ?? [:]
            if let tokenizerClassOverride {
                configDict["tokenizer_class"] = tokenizerClassOverride
            }
            return try AutoTokenizer.from(
                tokenizerConfig: Config(configDict),
                tokenizerData: Config(tokenizerData)
            )
        } catch let error as TextEmbedderError {
            throw error
        } catch {
            throw TextEmbedderError.tokenizationFailed
        }
    }

    /// Tokenize + truncate to the model's max sequence length (distiluse: 128). Long
    /// entries otherwise overflow the position embeddings and the ONNX run FAILS. Keep
    /// the final special token ([SEP]) so the wrapped sequence stays well-formed,
    /// matching the reference tokenizer's max_length=128 truncation.
    private func tokenIds(for text: String, tokenizer: Tokenizer) throws -> [Int] {
        let rawIds = tokenizer.encode(text: text)
        guard !rawIds.isEmpty else { throw TextEmbedderError.tokenizationFailed }
        let maxLen = 128
        let ids: [Int] = rawIds.count > maxLen
            ? Array(rawIds.prefix(maxLen - 1)) + [rawIds[rawIds.count - 1]]
            : rawIds
        guard !ids.isEmpty else { throw TextEmbedderError.tokenizationFailed }
        return ids
    }

    // MARK: - ORT session run

    /// The cached ORT session (loads the ~258 MB model once), built on first use with
    /// the Core ML execution provider when the device supports it.
    private func resolveSession() throws -> ORTSession {
        try sessionBox.resolve {
            let env = try ORTEnv(loggingLevel: .warning)
            let options = try ORTSessionOptions()
            if ORTIsCoreMLExecutionProviderAvailable() {
                let coreML = ORTCoreMLExecutionProviderOptions()
                try? options.appendCoreMLExecutionProvider(with: coreML)
            }
            let s = try ORTSession(env: env, modelPath: modelURL.path, sessionOptions: options)
            return (env, s)
        }
    }

    /// Run one ORT session over a batch of token-id rows, mean-pooling each row's output
    /// with its own attention mask. `rows` must be non-empty. A batch of one is the
    /// single-item path.
    private func runBatched(_ rows: [[Int]]) throws -> [EmbeddingVector] {
        let n = rows.count
        let maxLen = rows.map(\.count).max() ?? 0
        guard n > 0, maxLen > 0 else { throw TextEmbedderError.tokenizationFailed }

        let (flatIds, flatMask) = Self.padded(rows, maxLen: maxLen)
        let session = try resolveSession()
        let shape: [NSNumber] = [NSNumber(value: n), NSNumber(value: maxLen)]
        let idsTensor = try ORTValue(
            tensorData: NSMutableData(data: Self.int64Data(flatIds)),
            elementType: .int64, shape: shape)
        let maskTensor = try ORTValue(
            tensorData: NSMutableData(data: Self.int64Data(flatMask)),
            elementType: .int64, shape: shape)

        var inputs = [inputIdsName: idsTensor, attentionMaskName: maskTensor]
        // Some BERT graphs require token_type_ids; feed all-zeros. Only added when the
        // graph declares it (DistilBERT/RoBERTa/Gemma graphs don't).
        if (try? session.inputNames())?.contains(tokenTypeIdsName) == true {
            inputs[tokenTypeIdsName] = try ORTValue(
                tensorData: NSMutableData(data: Self.int64Data([Int](repeating: 0, count: n * maxLen))),
                elementType: .int64, shape: shape)
        }

        let outputNames = try session.outputNames()
        let wanted = outputNames.contains(tokenEmbeddingsOutputName)
            ? tokenEmbeddingsOutputName
            : (outputNames.first ?? tokenEmbeddingsOutputName)

        let outputs = try session.run(withInputs: inputs, outputNames: Set([wanted]), runOptions: nil)
        guard let output = outputs[wanted] else {
            throw TextEmbedderError.inferenceFailed("missing output \(wanted)")
        }
        let info = try output.tensorTypeAndShapeInfo()
        let outShape = info.shape.map { $0.intValue }
        let raw = Data(referencing: try output.tensorData())
        let floats = Self.floats(from: raw)

        let masks = rows.map { row in (0..<maxLen).map { $0 < row.count ? 1 : 0 } }
        return try Self.poolBatch(floats: floats, shape: outShape, batch: n, masks: masks)
    }

    // MARK: - Output pooling

    /// Turn a raw ORT output tensor into a normalized vector. Handles the two shapes
    /// distiluse exports can produce:
    ///   * rank-3 `[1, seq, hidden]` → mean-pool over the sequence with the mask.
    ///   * rank-2 `[1, hidden]`      → already a sentence embedding → just normalize.
    static func pool(floats: [Float], shape: [Int], attentionMask: [Int]) throws -> EmbeddingVector {
        if shape.count == 3 {
            let seq = shape[1]
            let hidden = shape[2]
            guard let pooled = EmbeddingPooling.meanPool(
                flat: floats, tokenCount: seq, hiddenDim: hidden, attentionMask: attentionMask
            ) else { throw TextEmbedderError.poolingFailed }
            return pooled
        } else if shape.count == 2 {
            let vector = EmbeddingVector(floats).l2normalized
            guard vector.magnitude > 0 else { throw TextEmbedderError.poolingFailed }
            return vector
        } else {
            throw TextEmbedderError.inferenceFailed("unexpected output rank \(shape.count)")
        }
    }

    /// Batched counterpart of `pool`: split a `[batch, seq, hidden]` (or `[batch,
    /// hidden]`) ORT output into one normalized vector per row, mean-pooling each row
    /// with its own mask. **Throws** (so the caller can fall back to per-item) if the
    /// batch axis is missing/mismatched or the float count doesn't match the shape —
    /// i.e. a model that ignored the batch dimension.
    static func poolBatch(floats: [Float], shape: [Int], batch: Int, masks: [[Int]]) throws -> [EmbeddingVector] {
        guard batch > 0, masks.count == batch else {
            throw TextEmbedderError.inferenceFailed("batch \(batch) vs masks \(masks.count)")
        }
        if shape.count == 3 {
            guard shape[0] == batch else {
                throw TextEmbedderError.inferenceFailed("batch axis \(shape[0]) != \(batch)")
            }
            let seq = shape[1], hidden = shape[2]
            let per = seq * hidden
            guard per > 0, floats.count == batch * per else {
                throw TextEmbedderError.inferenceFailed("float count \(floats.count) != \(batch * per)")
            }
            var out = [EmbeddingVector]()
            out.reserveCapacity(batch)
            for i in 0..<batch {
                let slice = Array(floats[(i * per)..<((i + 1) * per)])
                guard let pooled = EmbeddingPooling.meanPool(
                    flat: slice, tokenCount: seq, hiddenDim: hidden, attentionMask: masks[i]
                ) else { throw TextEmbedderError.poolingFailed }
                out.append(pooled)
            }
            return out
        } else if shape.count == 2 {
            guard shape[0] == batch else {
                throw TextEmbedderError.inferenceFailed("batch axis \(shape[0]) != \(batch)")
            }
            let hidden = shape[1]
            guard hidden > 0, floats.count == batch * hidden else {
                throw TextEmbedderError.inferenceFailed("float count \(floats.count) != \(batch * hidden)")
            }
            var out = [EmbeddingVector]()
            out.reserveCapacity(batch)
            for i in 0..<batch {
                let slice = Array(floats[(i * hidden)..<((i + 1) * hidden)])
                let vector = EmbeddingVector(slice).l2normalized
                guard vector.magnitude > 0 else { throw TextEmbedderError.poolingFailed }
                out.append(vector)
            }
            return out
        } else {
            throw TextEmbedderError.inferenceFailed("unexpected output rank \(shape.count)")
        }
    }

    /// Pad token-id `rows` to `maxLen` (pad id 0) and produce the flat row-major
    /// `[N*maxLen]` id + attention-mask buffers ORT wants (mask 1 = real, 0 = pad).
    static func padded(_ rows: [[Int]], maxLen: Int) -> (ids: [Int], mask: [Int]) {
        var ids = [Int](); ids.reserveCapacity(rows.count * maxLen)
        var mask = [Int](); mask.reserveCapacity(rows.count * maxLen)
        for row in rows {
            for j in 0..<maxLen {
                if j < row.count { ids.append(row[j]); mask.append(1) }
                else { ids.append(0); mask.append(0) }
            }
        }
        return (ids, mask)
    }

    // MARK: - Tensor byte helpers

    /// Little-endian `Int64` bytes for an integer array (ORT tensor payload).
    static func int64Data(_ values: [Int]) -> Data {
        var data = Data(capacity: values.count * 8)
        for v in values {
            var le = Int64(v).littleEndian
            withUnsafeBytes(of: &le) { data.append(contentsOf: $0) }
        }
        return data
    }

    /// Decode a little-endian `Float32` payload into `[Float]`.
    static func floats(from data: Data) -> [Float] {
        let count = data.count / 4
        var out = [Float]()
        out.reserveCapacity(count)
        var i = data.startIndex
        for _ in 0..<count {
            let u = UInt32(data[i]) | (UInt32(data[i + 1]) << 8)
                | (UInt32(data[i + 2]) << 16) | (UInt32(data[i + 3]) << 24)
            out.append(Float(bitPattern: u))
            i += 4
        }
        return out
    }
}

/// Lazily builds and caches the ORT env + session (retaining the env so the session
/// stays valid). `embed` calls are serialized by the owning `LazyONNXTextEmbedder`
/// actor; the lock only guards the rare concurrent first-call race.
final class ORTSessionBox: @unchecked Sendable {
    private let lock = NSLock()
    private var env: ORTEnv?
    private var session: ORTSession?

    /// Returns the cached session, creating (and retaining env + session) once.
    func resolve(_ create: () throws -> (ORTEnv, ORTSession)) throws -> ORTSession {
        lock.lock(); defer { lock.unlock() }
        if let session { return session }
        let (e, s) = try create()
        env = e
        session = s
        return s
    }
}
