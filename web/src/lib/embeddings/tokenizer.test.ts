import { describe, it, expect } from 'vitest'
import { tokenize } from '@/lib/embeddings/tokenizer'

// distiluse-base-multilingual-cased-v2 uses the mBERT WordPiece vocab: [CLS]=101,
// [SEP]=102. We assert the structural invariants (CLS…SEP framing + an all-ones
// attention mask the same length as the ids) rather than a brittle full ID list;
// the ONNX parity gate (Task 3) is what proves the tokenization is byte-correct.
describe('tokenize', () => {
  it('produces WordPiece input_ids framed by [CLS]…[SEP] with a matching all-ones mask', async () => {
    const { inputIds, attentionMask } = await tokenize('hello world')
    const ids = Array.from(inputIds, Number)
    expect(ids[0]).toBe(101) // [CLS]
    expect(ids[ids.length - 1]).toBe(102) // [SEP]
    expect(ids.length).toBeGreaterThanOrEqual(4)
    expect(inputIds).toBeInstanceOf(BigInt64Array)
    expect(attentionMask).toBeInstanceOf(BigInt64Array)
    expect(Array.from(attentionMask, Number)).toEqual(ids.map(() => 1))
  }, 30_000)
})
