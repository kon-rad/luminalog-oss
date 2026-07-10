import { describe, it, expect } from 'vitest'
import { sha256Hex, MODEL_ASSETS } from '@/lib/embeddings/modelProvider'

describe('sha256Hex', () => {
  it('returns the known lowercase hex digest of empty input', async () => {
    const hex = await sha256Hex(new ArrayBuffer(0))
    expect(hex).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
  })
})

describe('MODEL_ASSETS', () => {
  it('pins the three distiluse files with their SHA-256 hashes', () => {
    const byKey = Object.fromEntries(MODEL_ASSETS.map((a) => [a.key, a]))
    expect(byKey.onnx.sha256).toBe('ef4f58f1eb478e3097c3b4f197c97390ae4decaedc363defbb937a4c8eb41e6f')
    expect(byKey.onnx.url).toContain('/distiluse-multilingual/v1/distiluse-multilingual.onnx')
    expect(byKey.tokenizer.sha256).toBe('3564bb27a5b787b8ce0e415d4961a19c682d6fc70c3dc92341d9c699e11d37f6')
    expect(byKey.tokenizerConfig.sha256).toBe('84e36de990575ab69acf45c7537a1bb7f1bd6ecba95ab4d5ba8bf64ccc24b2c8')
  })
})
