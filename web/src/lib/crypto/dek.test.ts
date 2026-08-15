import { describe, it, expect, beforeEach, vi } from 'vitest'

// A valid base64-encoded 32-byte AES-256 key (raw bytes don't matter for this
// test — we only need `crypto.subtle.importKey` to succeed on the real
// node 22 WebCrypto implementation).
const FAKE_DEK_B64 = Buffer.alloc(32, 7).toString('base64')

const mocks = vi.hoisted(() => ({
  apiPost: vi.fn(),
}))

vi.mock('@/lib/api/client', () => ({
  apiPost: (...args: unknown[]) => mocks.apiPost(...args),
}))

// The module under test holds module-level singleton state (`cachedDEK`,
// `generation`), so each test re-imports a fresh instance via
// `vi.resetModules()` to avoid cross-test bleed.
beforeEach(() => {
  vi.resetModules()
  mocks.apiPost.mockReset()
})

describe('bootstrapDEK / getCachedDEK / clearDEK', () => {
  it('bootstraps, caches, and getCachedDEK returns the cached key', async () => {
    mocks.apiPost.mockResolvedValue({ dek: FAKE_DEK_B64 })
    const { bootstrapDEK, getCachedDEK } = await import('@/lib/crypto/dek')

    expect(getCachedDEK()).toBeNull()

    const key = await bootstrapDEK()

    expect(key).toBeInstanceOf(CryptoKey)
    expect(getCachedDEK()).toBe(key)
  })

  it('does not let an in-flight bootstrap repopulate the cache after clearDEK() (sign-out) runs first', async () => {
    // A deferred promise lets us control exactly when the (mocked) network
    // fetch resolves, so we can interleave `clearDEK()` in between the
    // bootstrap starting and its fetch resolving.
    let resolveFetch!: (value: { dek: string }) => void
    const deferred = new Promise<{ dek: string }>((resolve) => {
      resolveFetch = resolve
    })
    mocks.apiPost.mockReturnValue(deferred)

    const { bootstrapDEK, getCachedDEK, clearDEK } = await import('@/lib/crypto/dek')

    const bootstrapPromise = bootstrapDEK()

    // Sign-out happens while the fetch is still in flight.
    clearDEK()

    // Now the stale fetch resolves.
    resolveFetch({ dek: FAKE_DEK_B64 })
    const key = await bootstrapPromise

    // The caller of the in-flight bootstrap still gets a usable key back...
    expect(key).toBeInstanceOf(CryptoKey)
    // ...but the shared cache must NOT have been re-poisoned by the stale
    // bootstrap — a later, different user must not inherit this key.
    expect(getCachedDEK()).toBeNull()
  })
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
