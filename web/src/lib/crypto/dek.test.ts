import { describe, it, expect, beforeEach, vi } from 'vitest'

// The module under test holds module-level singleton state (`cachedDEK`,
// `generation`), so each test re-imports a fresh instance via
// `vi.resetModules()` to avoid cross-test bleed.
//
// There is no network mock here any more: the server-held `/bootstrap` path was
// deleted at the zero-knowledge cutover, so `installDEK` (fed by a client-held
// wrap) is the only way a key reaches this cache.
beforeEach(() => {
  vi.resetModules()
})

describe('installDEK', () => {
  it('caches an imported 32-byte key', async () => {
    const { installDEK, getCachedDEK } = await import('@/lib/crypto/dek')

    expect(getCachedDEK()).toBeNull()
    const key = await installDEK(new Uint8Array(32).fill(1))
    expect(key).toBeInstanceOf(CryptoKey)
    expect(key.extractable).toBe(false)
    expect(getCachedDEK()).toBe(key)
  })

  it('rejects a key of the wrong length and caches nothing', async () => {
    const { installDEK, getCachedDEK } = await import('@/lib/crypto/dek')

    await expect(installDEK(new Uint8Array(16))).rejects.toThrow(/32-byte/)
    expect(getCachedDEK()).toBeNull()
  })

  it('clearDEK drops the cached key', async () => {
    const { installDEK, getCachedDEK, clearDEK } = await import('@/lib/crypto/dek')

    await installDEK(new Uint8Array(32).fill(2))
    expect(getCachedDEK()).not.toBeNull()
    clearDEK()
    expect(getCachedDEK()).toBeNull()
  })

  it('does not poison the cache when a sign-out races the import', async () => {
    const { installDEK, getCachedDEK, clearDEK } = await import('@/lib/crypto/dek')

    // Start the import, then sign out before it settles. The caller still gets
    // a usable key, but a later different user must not inherit it.
    const pending = installDEK(new Uint8Array(32).fill(3))
    clearDEK()
    const key = await pending

    expect(key).toBeInstanceOf(CryptoKey)
    expect(getCachedDEK()).toBeNull()
  })
})
