import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WrappedKeyEnvelope } from '@/lib/crypto/wrappedKey'

// Shared mutable state the mocks read, so each test can shape the world.
const world = {
  slot: null as Uint8Array | null,
  wraps: {} as Record<string, WrappedKeyEnvelope>,
  legacy: false,
  uploaded: [] as Record<string, WrappedKeyEnvelope>[],
  saved: [] as { uid: string; bytes: Uint8Array }[],
  cleared: [] as string[],
  installed: [] as Uint8Array[],
  // Drop uploads on the floor, simulating a server that accepts a PUT whose
  // result does not read back. Exercises the verify gate.
  swallowUploads: false,
  // Make fetchWraps reject, simulating being offline.
  failFetch: false,
}

vi.mock('./browserSlot', () => ({
  loadSlot: async () => world.slot,
  saveSlot: async (uid: string, bytes: Uint8Array) => {
    world.saved.push({ uid, bytes })
    world.slot = bytes
  },
  clearSlot: async (uid: string) => {
    world.cleared.push(uid)
    world.slot = null
  },
  requestPersistence: async () => {},
}))

vi.mock('./wrapTransport', () => ({
  fetchWraps: async () => {
    if (world.failFetch) throw new Error('offline')
    return { wrappedKeys: world.wraps, zkKeyVersion: 1 }
  },
  uploadWraps: async (wraps: Record<string, WrappedKeyEnvelope>) => {
    world.uploaded.push(wraps)
    if (!world.swallowUploads) world.wraps = { ...world.wraps, ...wraps }
  },
}))

vi.mock('@/lib/crypto/dek', () => ({
  installDEK: async (bytes: Uint8Array) => {
    world.installed.push(bytes)
    return {} as CryptoKey
  },
}))

const { resolveKey, unlockWithRecoveryCode } = await import('./keyEnrollment')
const { deriveKEK } = await import('./recoveryCode')
const { wrap } = await import('@/lib/crypto/wrappedKey')

const DEK = new Uint8Array(32).map((_, i) => i)
const CODE = 'ABCD-2345-WXYZ-0000'
const hasLegacy = async () => world.legacy

beforeEach(() => {
  world.slot = null
  world.wraps = {}
  world.legacy = false
  world.uploaded = []
  world.saved = []
  world.cleared = []
  world.installed = []
  world.swallowUploads = false
  world.failFetch = false
})

describe('resolveKey', () => {
  it('unlocks from the browser slot without touching the network', async () => {
    world.slot = DEK
    const state = await resolveKey('uid-1', hasLegacy)
    expect(state.kind).toBe('unlocked')
    expect(world.installed).toHaveLength(1)
    expect(Array.from(world.installed[0])).toEqual(Array.from(DEK))
    expect(world.uploaded).toHaveLength(0)
  })

  it('asks for the recovery code when a recovery wrap exists but no slot does', async () => {
    world.wraps = { recovery: await wrap(await deriveKEK(CODE), DEK) }
    const state = await resolveKey('uid-1', hasLegacy)
    expect(state).toEqual({ kind: 'needsRecoveryCode', failedAttempt: false })
  })

  it('routes a legacy pre-migration user to iOS', async () => {
    world.legacy = true
    const state = await resolveKey('uid-1', hasLegacy)
    expect(state.kind).toBe('needsIOSSetup')
    expect(world.uploaded).toHaveLength(0)
    expect(world.installed).toHaveLength(0)
  })

  it('enrolls a brand-new account and shows the code once', async () => {
    const state = await resolveKey('uid-1', hasLegacy)
    expect(state.kind).toBe('showingRecoveryCode')
    if (state.kind !== 'showingRecoveryCode') throw new Error('unreachable')

    // 13 groups of 4, Crockford only.
    expect(state.code.split('-')).toHaveLength(13)

    // Exactly one recovery wrap uploaded.
    expect(world.uploaded).toHaveLength(1)
    expect(Object.keys(world.uploaded[0])).toEqual(['recovery'])

    // The DEK was installed and the slot written.
    expect(world.installed).toHaveLength(1)
    expect(world.saved).toHaveLength(1)
  })

  it('uploads a wrap that the shown code actually opens', async () => {
    const state = await resolveKey('uid-1', hasLegacy)
    if (state.kind !== 'showingRecoveryCode') throw new Error('expected enrollment')

    // The whole point of the acknowledgement screen: the code on it must be
    // able to recover the key on another device.
    const { unwrap } = await import('@/lib/crypto/wrappedKey')
    const recovered = await unwrap(await deriveKEK(state.code), world.wraps.recovery)
    expect(Array.from(recovered)).toEqual(Array.from(world.installed[0]))
  })

  it('installs nothing when the enrollment verify gate fails', async () => {
    world.swallowUploads = true
    const state = await resolveKey('uid-1', hasLegacy)
    expect(state.kind).toBe('failed')
    expect(world.installed).toHaveLength(0)
    expect(world.saved).toHaveLength(0)
  })

  it('reports a transient failure without destroying anything', async () => {
    world.failFetch = true
    const state = await resolveKey('uid-1', hasLegacy)
    expect(state.kind).toBe('failed')
    expect(world.cleared).toHaveLength(0)
    expect(world.installed).toHaveLength(0)
  })
})

describe('unlockWithRecoveryCode', () => {
  beforeEach(async () => {
    world.wraps = { recovery: await wrap(await deriveKEK(CODE), DEK) }
  })

  it('unwraps with the right code and installs the DEK', async () => {
    const state = await unlockWithRecoveryCode('uid-1', CODE, true)
    expect(state.kind).toBe('unlocked')
    expect(Array.from(world.installed[0])).toEqual(Array.from(DEK))
  })

  it('accepts a sloppily typed code', async () => {
    const state = await unlockWithRecoveryCode('uid-1', 'abcd 2345 wxyz 0000', true)
    expect(state.kind).toBe('unlocked')
  })

  it('fails closed on a wrong code and installs nothing', async () => {
    const state = await unlockWithRecoveryCode('uid-1', 'ABCD-2345-WXYZ-0001', true)
    expect(state).toEqual({ kind: 'needsRecoveryCode', failedAttempt: true })
    expect(world.installed).toHaveLength(0)
  })

  it('writes the browser slot when remember is true', async () => {
    await unlockWithRecoveryCode('uid-1', CODE, true)
    expect(world.saved).toHaveLength(1)
  })

  it('skips the browser slot when remember is false', async () => {
    await unlockWithRecoveryCode('uid-1', CODE, false)
    expect(world.saved).toHaveLength(0)
    expect(world.installed).toHaveLength(1)
  })

  it('leaves the server wraps completely untouched', async () => {
    await unlockWithRecoveryCode('uid-1', CODE, true)
    expect(world.uploaded).toHaveLength(0)
  })

  it('reports needsRecoveryCode when the account has no recovery wrap', async () => {
    world.wraps = {}
    const state = await unlockWithRecoveryCode('uid-1', CODE, true)
    expect(state).toEqual({ kind: 'needsRecoveryCode', failedAttempt: true })
  })

  it('reports a transient failure rather than a wrong code when offline', async () => {
    // A network failure must NOT be reported as a bad code: telling a user
    // their correct code is wrong is the worst possible message here.
    world.failFetch = true
    const state = await unlockWithRecoveryCode('uid-1', CODE, true)
    expect(state.kind).toBe('failed')
  })
})
