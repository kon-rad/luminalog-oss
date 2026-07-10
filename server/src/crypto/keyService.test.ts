// vi.mock calls are hoisted by vitest to BEFORE all imports.
// We mock config and firebaseAuth so their module-level side effects
// (env validation → process.exit, Firebase Admin init) never run.
import { vi } from 'vitest'

// Shared in-memory user store for the getOrCreateDEK transaction (hoisted so the
// firebaseAuth mock below and the tests reference the same Map).
const { store } = vi.hoisted(() => ({ store: new Map<string, Record<string, any>>() }))

vi.mock('../config', () => ({
  config: {
    MASTER_KEY: Buffer.alloc(32).toString('base64'),
    PORT: '3200',
    NODE_ENV: 'test',
    FIREBASE_SERVICE_ACCOUNT_JSON: '{}',
    TOGETHER_AI_API_KEY: 'dummy',
    AWS_ACCESS_KEY_ID: 'dummy',
    AWS_SECRET_ACCESS_KEY: 'dummy',
    AWS_S3_BUCKET: 'dummy',
    AWS_REGION: 'us-east-1',
    VAPI_PUBLIC_KEY: 'dummy',
    VAPI_ASSISTANT_ID: 'dummy',
    VAPI_WEBHOOK_SECRET: 'dummy',
  },
}))

vi.mock('../middleware/firebaseAuth', () => ({
  db: {
    collection: () => ({ doc: (uid: string) => ({ _uid: uid }) }),
    runTransaction: async (fn: (tx: any) => any) =>
      fn({
        get: async (ref: any) => ({ get: (field: string) => store.get(ref._uid)?.[field] }),
        set: (ref: any, data: Record<string, any>) =>
          store.set(ref._uid, { ...(store.get(ref._uid) ?? {}), ...data }),
      }),
  },
}))

import { describe, it, expect, beforeEach } from 'vitest'
import { randomBytes } from 'crypto'
import { wrapDEK, unwrapDEK, getOrCreateDEK, MigratedNoServerDEKError } from './keyService'

describe('keyService wrap', () => {
  const master = randomBytes(32)
  it('wrap/unwrap round-trips a 32B DEK', () => {
    const dek = randomBytes(32)
    const wrapped = wrapDEK(master, dek)
    expect(unwrapDEK(master, wrapped).equals(dek)).toBe(true)
  })
  it('wrong master fails closed', () => {
    const wrapped = wrapDEK(master, randomBytes(32))
    expect(() => unwrapDEK(randomBytes(32), wrapped)).toThrow()
  })
})

describe('getOrCreateDEK — 1d migration guard', () => {
  beforeEach(() => store.clear())

  it('mints a DEK for a brand-new user (no wrappedDEK, no wrappedKeys)', async () => {
    const uid = 'fresh-' + randomBytes(4).toString('hex')
    const dek = await getOrCreateDEK(uid)
    expect(dek.length).toBe(32)
    expect(store.get(uid)?.wrappedDEK).toBeDefined()
  })

  it('REFUSES to regenerate for a migrated user (wrappedKeys present, no wrappedDEK)', async () => {
    const uid = 'migrated-' + randomBytes(4).toString('hex')
    store.set(uid, { wrappedKeys: { icloud: {}, recovery: {} } })
    await expect(getOrCreateDEK(uid)).rejects.toBeInstanceOf(MigratedNoServerDEKError)
    // Critically — it did NOT write a new (wrong) wrappedDEK.
    expect(store.get(uid)?.wrappedDEK).toBeUndefined()
  })
})
