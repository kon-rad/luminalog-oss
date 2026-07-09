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

        // 1. Tokenize via swift-transformers. We build the tokenizer from the two JSON
        //    files directly instead of `AutoTokenizer.from(modelFolder:)`, because that
        //    API *requires* a `config.json` (the model config) in the folder and we host
        //    only tokenizer.json + tokenizer_config.json. distiluse's
        //    `DistilBertTokenizerFast` routes correctly to swift-transformers'
        //    (WordPiece) `BertTokenizer` on its own, so `tokenizerClassOverride` is nil.
        //    NOTE: swift-transformers' `PrecompiledNormalizer` is a stub, so SentencePiece
        //    tokenizers (XLM-RoBERTa / Unigram) tokenize INCORRECTLY on-device — hence a
        //    WordPiece model (distiluse), whose `BertNormalizer` is fully implemented.
        //    For a model whose `tokenizer_class` is a generic `PreTrainedTokenizerFast`,
        //    set `tokenizerClassOverride` to the right class (e.g. "BertTokenizer").
        let tokenizer: Tokenizer
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
            tokenizer = try AutoTokenizer.from(
                tokenizerConfig: Config(configDict),
                tokenizerData: Config(tokenizerData)
            )
        } catch let error as TextEmbedderError {
            throw error
        } catch {
            throw TextEmbedderError.tokenizationFailed
        }
        let inputIds = tokenizer.encode(text: text)
        guard !inputIds.isEmpty else { throw TextEmbedderError.tokenizationFailed }
        let attentionMask = [Int](repeating: 1, count: inputIds.count)
        let seqLen = inputIds.count

        // 2. Run ORT.
        do {
            let env = try ORTEnv(loggingLevel: .warning)
            let options = try ORTSessionOptions()
            // Prefer the Core ML execution provider when the device supports it.
            if ORTIsCoreMLExecutionProviderAvailable() {
                let coreML = ORTCoreMLExecutionProviderOptions()
                try? options.appendCoreMLExecutionProvider(with: coreML)
            }
            let session = try ORTSession(env: env, modelPath: modelURL.path, sessionOptions: options)

            let shape: [NSNumber] = [1, NSNumber(value: seqLen)]
            let idsTensor = try ORTValue(
                tensorData: NSMutableData(data: Self.int64Data(inputIds)),
                elementType: .int64,
                shape: shape
            )
            let maskTensor = try ORTValue(
                tensorData: NSMutableData(data: Self.int64Data(attentionMask)),
                elementType: .int64,
                shape: shape
            )

            var inputs = [inputIdsName: idsTensor, attentionMaskName: maskTensor]
            // Some BERT graphs require token_type_ids; feed all-zeros for a
            // single sequence. Only added when the graph declares it, so DistilBERT/RoBERTa/Gemma
            // graphs (which don't) are unaffected.
            if (try? session.inputNames())?.contains(tokenTypeIdsName) == true {
                inputs[tokenTypeIdsName] = try ORTValue(
                    tensorData: NSMutableData(data: Self.int64Data([Int](repeating: 0, count: seqLen))),
                    elementType: .int64,
                    shape: shape
                )
            }

            let outputNames = try session.outputNames()
            let wanted = outputNames.contains(tokenEmbeddingsOutputName)
                ? tokenEmbeddingsOutputName
                : (outputNames.first ?? tokenEmbeddingsOutputName)

            let outputs = try session.run(
                withInputs: inputs,
                outputNames: Set([wanted]),
                runOptions: nil
            )
            guard let output = outputs[wanted] else {
                throw TextEmbedderError.inferenceFailed("missing output \(wanted)")
            }

            let info = try output.tensorTypeAndShapeInfo()
            let outShape = info.shape.map { $0.intValue }
            let raw = Data(referencing: try output.tensorData())
            let floats = Self.floats(from: raw)

            return try Self.pool(floats: floats, shape: outShape, attentionMask: attentionMask)
        } catch let error as TextEmbedderError {
            throw error
        } catch {
            throw TextEmbedderError.inferenceFailed(error.localizedDescription)
        }
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
