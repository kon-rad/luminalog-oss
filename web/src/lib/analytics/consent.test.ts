import { describe, it, expect, beforeEach } from 'vitest'
import { readConsent, writeConsent } from './consent'

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

describe('consent', () => {
  let storage: Storage
  beforeEach(() => {
    storage = memoryStorage()
  })

  it('defaults to unknown so nothing loads before a choice is made', () => {
    expect(readConsent(storage)).toBe('unknown')
  })

  it('round-trips a granted choice', () => {
    writeConsent(storage, 'granted')
    expect(readConsent(storage)).toBe('granted')
  })

  it('round-trips a denied choice', () => {
    writeConsent(storage, 'denied')
    expect(readConsent(storage)).toBe('denied')
  })

  it('treats an unrecognised stored value as unknown', () => {
    storage.setItem('argo_ad_consent', 'maybe')
    expect(readConsent(storage)).toBe('unknown')
  })
})
