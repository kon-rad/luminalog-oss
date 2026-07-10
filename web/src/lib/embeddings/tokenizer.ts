// WordPiece tokenizer for distiluse-base-multilingual-cased-v2, built in-browser
// from the hosted `tokenizer.json` + `tokenizer_config.json` (no HF network
// repo). Transformers.js drives tokenization entirely from the fast-tokenizer
// spec in tokenizer.json, so the base `PreTrainedTokenizer` reproduces the same
// WordPiece IDs the iOS swift-transformers `BertTokenizer` produces. We emit
// int64 `input_ids` + an all-ones `attention_mask` (matching iOS, which builds
// the mask as [1]*len for a single unpadded sequence).

import { PreTrainedTokenizer } from '@huggingface/transformers'
import { fetchAsset } from '@/lib/embeddings/modelProvider'

export interface TokenizeResult {
  inputIds: BigInt64Array
  attentionMask: BigInt64Array
}

let tokenizerPromise: Promise<PreTrainedTokenizer> | null = null

export async function loadTokenizer(): Promise<PreTrainedTokenizer> {
  if (!tokenizerPromise) {
    tokenizerPromise = (async () => {
      const [tokBytes, cfgBytes] = await Promise.all([
        fetchAsset('tokenizer'),
        fetchAsset('tokenizerConfig'),
      ])
      const tokenizerJSON = JSON.parse(new TextDecoder().decode(new Uint8Array(tokBytes)))
      const tokenizerConfig = JSON.parse(new TextDecoder().decode(new Uint8Array(cfgBytes)))
      return new PreTrainedTokenizer(tokenizerJSON, tokenizerConfig)
    })()
  }
  return tokenizerPromise
}

export async function tokenize(text: string): Promise<TokenizeResult> {
  const tokenizer = await loadTokenizer()
  const encoded = await tokenizer(text, { add_special_tokens: true })
  // Transformers.js returns int64 tensors whose `.data` is a BigInt64Array.
  const idsData = encoded.input_ids.data as ArrayLike<bigint>
  const inputIds = BigInt64Array.from({ length: idsData.length }, (_, i) => BigInt(idsData[i]))
  const attentionMask = BigInt64Array.from({ length: inputIds.length }, () => BigInt(1))
  return { inputIds, attentionMask }
}
