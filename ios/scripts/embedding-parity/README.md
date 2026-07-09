# Embedding cross-platform parity gate

Proves the on-device distiluse pipeline (`ONNXTextEmbedder`: tokenizer → ONNX →
mean-pool → L2-normalize) produces the **same** vectors as the web reference
(Transformers.js), so vectors are comparable across iOS / web / Android.

**Run this — and pass — BEFORE flipping `DevFlags.aiModel1` on or writing any real
vector.** The 512-dim and the embedding semantics lock the moment production vectors
exist; a divergent pipeline would silently poison search and break Step-2
comparability.

## Parity contract (both sides MUST match)

- Same model weights: `distiluse-base-multilingual-cased-v2` (the ONNX export you host).
- **Raw** text in — no task/query prompt prefix on either side.
- Mean-pool over the attention mask, then L2-normalize.
- 512 dimensions.

`reference.mjs` uses `pooling: 'mean', normalize: true`, which reproduces
`EmbeddingPooling.meanPool(...).l2normalized` on the iOS side.

## Steps

1. **Host the model** first (see the hosting guide in the workspace `docs/`), fill the
   six `EMBEDDING_*` keys, and `xcodegen generate`.

2. **Generate web reference vectors:**
   ```bash
   cd ios/scripts/embedding-parity
   npm install @huggingface/transformers
   # Point at the SAME artifact you host (env optional; defaults to the community export):
   # EMBEDDING_MODEL_ID=Xenova/distiluse-base-multilingual-cased-v2
   node reference.mjs        # → reference_vectors.json
   ```

3. **Run the iOS gate** against that file:
   ```bash
   cd ios
   EMBEDDING_PARITY_REFERENCE="$PWD/scripts/embedding-parity/reference_vectors.json" \
   xcodebuild test \
     -project LuminaLog.xcodeproj -scheme LuminaLog \
     -destination 'platform=iOS Simulator,name=iPhone 16 Pro' \
     -only-testing:LuminaLogTests/EmbeddingParityTests
   ```
   `EmbeddingParityTests` embeds `texts.json` on device via the real
   `LazyONNXTextEmbedder` path (downloads + verifies the model) and asserts cosine
   > 0.999 vs the reference for every text. It **skips** (green) until the model is
   hosted and `EMBEDDING_PARITY_REFERENCE` is set — so it never blocks the normal
   unit suite.

## If parity fails

- **cosine well below 0.999 across the board** → likely double-pooling: you exported a
  sentence-transformers pipeline that already pools. Re-export the *base* transformer
  (token-level `last_hidden_state`, rank-3 `[batch, seq, 512]`).
- **a few texts diverge** → tokenizer mismatch. Confirm the hosted `tokenizer.json` +
  `tokenizer_config.json` are the exact pair from the same model revision.
- **dimension assert fails** → the export isn't producing 512-dim token embeddings.

## Files

- `texts.json` — shared corpus embedded identically on both sides (extend freely; the
  plan suggests ~100 for a thorough gate).
- `reference.mjs` — web reference generator → `reference_vectors.json`.
- `../../LuminaLogTests/EmbeddingParityTests.swift` — the iOS gate.
