import { describe, it, expect, beforeEach } from 'vitest'
import { captureAttribution, readAttribution, type Attribution } from './attribution'

/** Minimal in-memory Storage stand-in, so these tests need no DOM. */
function memoryStorage(): Storage {
  const map = new Map<string, string>()
  return {
    get length() {
      return map.size
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage
}

const EMPTY: Attribution = { campaign: null, source: null, medium: null, fbclid: null, gclid: null }

describe('captureAttribution', () => {
  let storage: Storage
  beforeEach(() => {
    storage = memoryStorage()
  })

  it('captures a valid campaign and click ids', () => {
    const got = captureAttribution(
      '?utm_campaign=meta-privacy-founders-v3-202609&utm_source=facebook&utm_medium=paid&fbclid=abc123',
      storage,
    )
    expect(got.campaign).toBe('meta-privacy-founders-v3-202609')
    expect(got.source).toBe('facebook')
    expect(got.medium).toBe('paid')
    expect(got.fbclid).toBe('abc123')
  })

  it('drops a campaign that does not match the convention', () => {
    const got = captureAttribution('?utm_campaign=Some%20Random%20Campaign', storage)
    expect(got.campaign).toBeNull()
  })

  it('persists so a later read on another page still sees it', () => {
    captureAttribution('?utm_campaign=yt-journaling-howto-v1-202609', storage)
    expect(readAttribution(storage).campaign).toBe('yt-journaling-howto-v1-202609')
  })

  it('does not overwrite a stored campaign with a later untagged visit', () => {
    captureAttribution('?utm_campaign=meta-privacy-founders-v3-202609', storage)
    captureAttribution('', storage)
    expect(readAttribution(storage).campaign).toBe('meta-privacy-founders-v3-202609')
  })

  it('lets a genuinely new campaign replace the stored one', () => {
    captureAttribution('?utm_campaign=meta-privacy-founders-v3-202609', storage)
    captureAttribution('?utm_campaign=yt-journaling-howto-v1-202609', storage)
    expect(readAttribution(storage).campaign).toBe('yt-journaling-howto-v1-202609')
  })

  it('returns empty attribution when nothing was ever captured', () => {
    expect(readAttribution(storage)).toEqual(EMPTY)
  })

  it('survives corrupted storage without throwing', () => {
    storage.setItem('argo_attribution', '{not json')
    expect(readAttribution(storage)).toEqual(EMPTY)
  })
})
