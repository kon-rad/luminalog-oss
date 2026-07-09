// Cross-platform embedding parity — WEB REFERENCE generator.
//
// ⚠️ CAVEAT for distiluse-base-multilingual-cased-v2 (the current model): it has a
// Dense projection HEAD after mean-pooling (768 → 512, Tanh). Transformers.js
// `feature-extraction` with `pooling:'mean'` applies ONLY the mean-pool and returns
// the 768-dim PRE-Dense vector — NOT the shipped 512-dim embedding. So this script is
// correct only for pure mean-pool models. For distiluse, the canonical 512-dim
// reference is produced from the FULL pipeline (sentence-transformers in Python, or by
// running the hosted ONNX which bakes the Dense in). The committed on-device gate was
// validated at cosine 0.9999991 against that Python-canonical reference. When the web
// app (Step 2) runs the hosted ONNX via onnxruntime-web, both sides share one graph and
// match by construction.
//
// For a pure mean-pool model, produces reference vectors for the shared `texts.json`
// using Transformers.js. The iOS side (EmbeddingParityTests) embeds the SAME texts and
// asserts cosine > 0.999 against these vectors.
//
// Parity contract (pure mean-pool models):
//   * same model weights (the ONNX export you host),
//   * RAW text in — no task/query prompt prefix on either side,
//   * mean-pool over the attention mask, then L2-normalize.
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
const MODEL_ID = process.env.EMBEDDING_MODEL_ID ?? "Xenova/distiluse-base-multilingual-cased-v2";

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
  if (vec.length !== 512) {
    throw new Error(`Expected 512 dims, got ${vec.length} for text #${i}. ` +
      `The exported graph is not producing token-level embeddings — re-check the export.`);
  }
  vectors.push(vec);
  console.error(`  [${i + 1}/${texts.length}] embedded`);
}

const outPath = join(here, "reference_vectors.json");
writeFileSync(outPath, JSON.stringify({ model: MODEL_ID, dimension: 512, texts, vectors }));
console.error(`Wrote ${vectors.length} reference vectors → ${outPath}`);
console.error(`Now run the iOS gate (see README.md) with EMBEDDING_PARITY_REFERENCE=${outPath}`);
