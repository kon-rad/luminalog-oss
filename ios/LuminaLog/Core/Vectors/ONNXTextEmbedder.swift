import Foundation
import OnnxRuntimeBindings
import Tokenizers

/// The real on-device embedder: EmbeddingGemma run through ONNX Runtime, with a
/// SentencePiece tokenizer (huggingface/swift-transformers). Pipeline:
///
///   text → tokenize → ORT session run (Core ML EP if available) →
///   `EmbeddingPooling.meanPool(...)` → L2-normalized `EmbeddingVector` (768-dim).
///
/// ## Status (increment 1c-D, Phase 1)
/// The ONNX Runtime + swift-transformers dependencies ARE wired into the build, so
/// this compiles and links. It cannot actually run until the ~100–200 MB
/// EmbeddingGemma ONNX model + tokenizer are hosted and fetched by
/// `EmbeddingModelProvider` — so this type is **not** wired into any live path yet
/// (that is a later increment). It fails **closed** at every step:
///
///   * model file absent on disk → `TextEmbedderError.modelUnavailable`
///   * tokenizer files missing/unloadable → `TextEmbedderError.tokenizationFailed`
///   * ORT session/inference error → `TextEmbedderError.inferenceFailed`
///   * pooling can't produce a valid vector → `TextEmbedderError.poolingFailed`
///
/// It never fabricates a vector. Until the model ships, callers/tests use
/// `StubTextEmbedder` (deterministic) instead.
///
/// - Note: The input/output tensor names default to EmbeddingGemma's exported graph
///   (`input_ids`, `attention_mask`, `token_embeddings`) and are overridable, since
///   the exact names depend on how the ONNX artifact is converted. Cross-platform
///   parity (cosine > 0.999 vs the web/Android reference) is validated separately
///   (plan Phase 0) once the model is hosted.
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
    /// Preferred graph output tensor name holding per-token hidden states. If absent
    /// at run time the first output is used.
    let tokenEmbeddingsOutputName: String

    private let fileManager: FileManager

    init(
        modelURL: URL,
        tokenizerDirectory: URL,
        inputIdsName: String = "input_ids",
        attentionMaskName: String = "attention_mask",
        tokenEmbeddingsOutputName: String = "token_embeddings",
        fileManager: FileManager = .default
    ) {
        self.modelURL = modelURL
        self.tokenizerDirectory = tokenizerDirectory
        self.inputIdsName = inputIdsName
        self.attentionMaskName = attentionMaskName
        self.tokenEmbeddingsOutputName = tokenEmbeddingsOutputName
        self.fileManager = fileManager
    }

    func embed(_ text: String) async throws -> EmbeddingVector {
        // Fail closed on the concrete precondition first: no model on disk.
        guard fileManager.fileExists(atPath: modelURL.path) else {
            throw TextEmbedderError.modelUnavailable
        }

        // 1. Tokenize (SentencePiece via swift-transformers). Single sequence, so
        //    every produced token is attended (mask all-ones).
        let tokenizer: Tokenizer
        do {
            tokenizer = try await AutoTokenizer.from(modelFolder: tokenizerDirectory)
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

            let outputNames = try session.outputNames()
            let wanted = outputNames.contains(tokenEmbeddingsOutputName)
                ? tokenEmbeddingsOutputName
                : (outputNames.first ?? tokenEmbeddingsOutputName)

            let outputs = try session.run(
                withInputs: [inputIdsName: idsTensor, attentionMaskName: maskTensor],
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
    /// EmbeddingGemma exports can produce:
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
