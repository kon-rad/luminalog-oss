// Cross-platform embedding parity — WEB REFERENCE generator.
//
// Produces reference MiniLM (paraphrase-multilingual-MiniLM-L12-v2) vectors for the shared `texts.json` using
// Transformers.js (the same runtime the web app uses in Step 2). The iOS side
// (EmbeddingParityTests) embeds the SAME texts with ONNXTextEmbedder and asserts
// cosine similarity > 0.999 against these vectors — that is the gate that proves the
// on-device pipeline (tokenizer + ONNX graph + mean-pool + L2-normalize) matches the
// reference BEFORE any real vector is written to the encrypted store (the 384-dim and
// the semantics lock once production vectors exist).
//
// Parity contract (MUST match ONNXTextEmbedder / EmbeddingPooling exactly):
//   * same model weights (paraphrase-multilingual-MiniLM-L12-v2, the ONNX export you host),
//   * RAW text in — no task/query prompt prefix on either side,
//   * mean-pool over the attention mask, then L2-normalize,
//   * 384 dimensions.
//
// Usage:
//   cd ios/scripts/embedding-parity
//   npm install @huggingface/transformers
//   node reference.mjs            # writes reference_vectors.json
//
// Then run the iOS gate against the output (see README.md).

import { pipeline } from "@huggingface/transformers";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// The model repo. Point this at the SAME artifact you host for the app. The
// community ONNX export is a convenient reference; if you host your own export,
// use that repo/path so the graphs are byte-identical.
const MODEL_ID = process.env.EMBEDDING_MODEL_ID ?? "Xenova/paraphrase-multilingual-MiniLM-L12-v2";

const texts = JSON.parse(readFileSync(join(here, "texts.json"), "utf8"));

console.error(`Loading ${MODEL_ID} …`);
// pooling: 'mean' + normalize: true reproduces EmbeddingPooling.meanPool(...).l2normalized.
const extractor = await pipeline("feature-extraction", MODEL_ID, {
  dtype: "fp32",
});

const vectors = [];
for (let i = 0; i < texts.length; i++) {
  const out = await extractor(texts[i], { pooling: "mean", normalize: true });
  const vec = Array.from(out.data);
  if (vec.length !== 384) {
    throw new Error(`Expected 384 dims, got ${vec.length} for text #${i}. ` +
      `The exported graph is not producing token-level embeddings — re-check the export.`);
  }
  vectors.push(vec);
  console.error(`  [${i + 1}/${texts.length}] embedded`);
}

const outPath = join(here, "reference_vectors.json");
writeFileSync(outPath, JSON.stringify({ model: MODEL_ID, dimension: 384, texts, vectors }));
console.error(`Wrote ${vectors.length} reference vectors → ${outPath}`);
console.error(`Now run the iOS gate (see README.md) with EMBEDDING_PARITY_REFERENCE=${outPath}`);
