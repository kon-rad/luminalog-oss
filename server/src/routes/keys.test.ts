import { vi, describe, it, expect, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// In-memory Firestore stand-in for the `users` collection, supporting the
// merge + FieldValue.delete + serverTimestamp semantics keys.ts relies on.
// ---------------------------------------------------------------------------
const { store, db } = vi.hoisted(() => {
  const store = new Map<string, Record<string, any>>()

  const DELETE = '__delete__'
  function isPlainObject(x: any): x is Record<string, any> {
    return x !== null && typeof x === 'object' && !Array.isArray(x) && !x.__serverTimestamp
  }
  function deepMerge(target: Record<string, any>, patch: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = { ...target }
    for (const [k, v] of Object.entries(patch)) {
      if (v && (v as any).__delete) {
        delete out[k]
      } else if (isPlainObject(v) && isPlainObject(out[k])) {
        out[k] = deepMerge(out[k], v)
      } else {
        out[k] = v
      }
    }
    return out
  }
  function resolveTimestamps(data: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = Array.isArray(data) ? [...data] : { ...data }
    for (const [k, v] of Object.entries(out)) {
      if (v && (v as any).__serverTimestamp) {
        out[k] = { toDate: () => new Date('2026-07-09T00:00:00.000Z') }
      } else if (isPlainObject(v)) {
        out[k] = resolveTimestamps(v)
      }
    }
    return out
  }

  function makeDocRef(id: string) {
    return {
      id,
      async set(data: Record<string, any>, opts?: { merge?: boolean }) {
        const existing = opts?.merge ? store.get(id) ?? {} : {}
        store.set(id, resolveTimestamps(deepMerge(existing, data)))
      },
      async get() {
        const d = store.get(id)
        return { exists: !!d, id, data: () => d, get: (field: string) => d?.[field] }
      },
    }
  }

  const db = {
    collection: (_name: string) => ({ doc: (id: string) => makeDocRef(id) }),
  }
  return { store, db, DELETE }
})

vi.mock('../middleware/firebaseAuth', () => ({
  firebaseAuth: (req: any, _res: any, next: any) => { req.uid = 'u'; next() },
  db,
}))
vi.mock('../crypto/keyService', () => ({
  getOrCreateDEK: vi.fn(async () => Buffer.alloc(32, 7)),
  cryptoShredUser: vi.fn(async (uid: string) => {
    const d = store.get(uid)
    if (d) delete d.wrappedDEK
  }),
}))
vi.mock('firebase-admin', () => ({
  default: {
    firestore: {
      FieldValue: {
        serverTimestamp: () => ({ __serverTimestamp: true }),
        delete: () => ({ __delete: true }),
      },
    },
  },
}))

import {
  keysRouter,
  putWrappedKeysHandler,
  getWrappedKeysHandler,
  deleteWrappedKeyHandler,
  finalizeMigrationHandler,
} from './keys'
import { cryptoShredUser } from '../crypto/keyService'

const shredSpy = vi.mocked(cryptoShredUser)

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = (c: number) => { res.statusCode = c; return res }
  res.json = (b: any) => { res.body = b; return res }
  return res
}

const env = () => ({ v: 1, iv: 'aXY=', ct: 'Y3Q=', tag: 'dGFn' })

beforeEach(() => { store.clear() })

describe('wrapped-key storage: PUT then GET round-trips (userId-scoped)', () => {
  it('stores both slots and returns them verbatim to the same uid', async () => {
    const putReq: any = { uid: 'u', body: { wraps: { icloud: env(), recovery: env() }, keyVersion: 2 } }
    const putRes = mockRes()
    await putWrappedKeysHandler(putReq, putRes)
    expect(putRes.statusCode).toBe(200)
    expect(putRes.body.methods.sort()).toEqual(['icloud', 'recovery'])
    expect(putRes.body.zkKeyVersion).toBe(2)

    const getRes = mockRes()
    await getWrappedKeysHandler({ uid: 'u' } as any, getRes)
    expect(getRes.body.wrappedKeys.icloud).toEqual(env())
    expect(getRes.body.wrappedKeys.recovery).toEqual(env())
    expect(getRes.body.zkKeyVersion).toBe(2)
  })

  it('merges a second PUT slot without clobbering the first', async () => {
    await putWrappedKeysHandler({ uid: 'u', body: { wraps: { icloud: env() } } } as any, mockRes())
    await putWrappedKeysHandler({ uid: 'u', body: { wraps: { recovery: env() } } } as any, mockRes())
    const getRes = mockRes()
    await getWrappedKeysHandler({ uid: 'u' } as any, getRes)
    expect(Object.keys(getRes.body.wrappedKeys).sort()).toEqual(['icloud', 'recovery'])
  })

  it('GET with none stored → {}', async () => {
    const getRes = mockRes()
    await getWrappedKeysHandler({ uid: 'nobody' } as any, getRes)
    expect(getRes.body.wrappedKeys).toEqual({})
    expect(getRes.body.zkKeyVersion).toBeNull()
  })
})

describe('cross-tenant isolation', () => {
  it('user A never sees user B wraps', async () => {
    await putWrappedKeysHandler({ uid: 'a', body: { wraps: { icloud: { v: 1, iv: 'A', ct: 'Asecret', tag: 'A' } } } } as any, mockRes())
    await putWrappedKeysHandler({ uid: 'b', body: { wraps: { icloud: { v: 1, iv: 'B', ct: 'Bsecret', tag: 'B' } } } } as any, mockRes())
    const aRes = mockRes()
    await getWrappedKeysHandler({ uid: 'a' } as any, aRes)
    expect(JSON.stringify(aRes.body)).toContain('Asecret')
    expect(JSON.stringify(aRes.body)).not.toContain('Bsecret')
  })
})

describe('never accept/store a raw key (fail-closed envelope validation)', () => {
  it('400 on a bare base64 string in a slot (looks like a raw key)', async () => {
    const res = mockRes()
    await putWrappedKeysHandler({ uid: 'u', body: { wraps: { icloud: 'RAW_BASE64_DEK==' } } } as any, res)
    expect(res.statusCode).toBe(400)
    expect(store.size).toBe(0)
  })

  it('400 on {key:...} shape (raw key field, not an envelope)', async () => {
    const res = mockRes()
    await putWrappedKeysHandler({ uid: 'u', body: { wraps: { icloud: { key: 'RAW' } } } } as any, res)
    expect(res.statusCode).toBe(400)
  })

  it('400 on a malformed envelope (missing tag)', async () => {
    const res = mockRes()
    await putWrappedKeysHandler({ uid: 'u', body: { wraps: { icloud: { v: 1, iv: 'x', ct: 'y' } } } } as any, res)
    expect(res.statusCode).toBe(400)
  })

  it('400 on an unknown wrap method', async () => {
    const res = mockRes()
    await putWrappedKeysHandler({ uid: 'u', body: { wraps: { evil: env() } } } as any, res)
    expect(res.statusCode).toBe(400)
  })

  it('400 on missing/empty wraps map', async () => {
    const r1 = mockRes()
    await putWrappedKeysHandler({ uid: 'u', body: {} } as any, r1)
    expect(r1.statusCode).toBe(400)
    const r2 = mockRes()
    await putWrappedKeysHandler({ uid: 'u', body: { wraps: {} } } as any, r2)
    expect(r2.statusCode).toBe(400)
  })

  it('persists ONLY envelope fields, dropping any extra keys smuggled in', async () => {
    await putWrappedKeysHandler({ uid: 'u', body: { wraps: { icloud: { ...env(), rawDek: 'SNEAKY' } } } } as any, mockRes())
    const getRes = mockRes()
    await getWrappedKeysHandler({ uid: 'u' } as any, getRes)
    expect(getRes.body.wrappedKeys.icloud).toEqual(env())
    expect(JSON.stringify(getRes.body)).not.toContain('SNEAKY')
  })
})

describe('DELETE one wrap slot', () => {
  it('removes only the named slot, keeps the other', async () => {
    await putWrappedKeysHandler({ uid: 'u', body: { wraps: { icloud: env(), recovery: env() } } } as any, mockRes())
    const delRes = mockRes()
    await deleteWrappedKeyHandler({ uid: 'u', params: { method: 'recovery' } } as any, delRes)
    expect(delRes.body).toEqual({ deleted: true, method: 'recovery' })
    const getRes = mockRes()
    await getWrappedKeysHandler({ uid: 'u' } as any, getRes)
    expect(Object.keys(getRes.body.wrappedKeys)).toEqual(['icloud'])
  })

  it('400 on unknown method', async () => {
    const res = mockRes()
    await deleteWrappedKeyHandler({ uid: 'u', params: { method: 'evil' } } as any, res)
    expect(res.statusCode).toBe(400)
  })
})

describe('POST /finalize-migration (guarded, irreversible crypto-shred)', () => {
  beforeEach(() => { shredSpy.mockClear() })

  it('409 + does NOT shred when wrappedKeys is absent', async () => {
    store.set('u', { wrappedDEK: { v: 1, iv: 'x', ct: 'y', tag: 'z' } })
    const res = mockRes()
    await finalizeMigrationHandler({ uid: 'u' } as any, res)
    expect(res.statusCode).toBe(409)
    expect(res.body).toEqual({ error: 'Not migrated: client wraps not present' })
    expect(shredSpy).not.toHaveBeenCalled()
    expect(store.get('u')?.wrappedDEK).toBeDefined()
  })

  it('409 when wrappedKeys is present but missing one of the two envelopes', async () => {
    store.set('u', { wrappedDEK: { v: 1, iv: 'x', ct: 'y', tag: 'z' }, wrappedKeys: { icloud: env() } })
    const res = mockRes()
    await finalizeMigrationHandler({ uid: 'u' } as any, res)
    expect(res.statusCode).toBe(409)
    expect(shredSpy).not.toHaveBeenCalled()
  })

  it('200 + deletes wrappedDEK + sets zkMigratedAt when both envelopes present', async () => {
    store.set('u', {
      wrappedDEK: { v: 1, iv: 'x', ct: 'y', tag: 'z' },
      wrappedKeys: { icloud: env(), recovery: env() },
    })
    const res = mockRes()
    await finalizeMigrationHandler({ uid: 'u' } as any, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ finalized: true })
    expect(shredSpy).toHaveBeenCalledWith('u')
    expect(store.get('u')?.wrappedDEK).toBeUndefined()
    expect(store.get('u')?.zkMigratedAt).toEqual({ toDate: expect.any(Function) })
  })

  it('is idempotent: still 200 when wrappedDEK is already gone but wrappedKeys present', async () => {
    store.set('u', { wrappedKeys: { icloud: env(), recovery: env() } })
    const res = mockRes()
    await finalizeMigrationHandler({ uid: 'u' } as any, res)
    expect(res.statusCode).toBe(200)
    expect(res.body).toEqual({ finalized: true })
    expect(shredSpy).toHaveBeenCalledWith('u')
  })

  it('ownership comes from req.uid, never the request body', async () => {
    store.set('u', { wrappedKeys: { icloud: env(), recovery: env() } })
    store.set('other', {}) // no wraps — must not be affected
    const res = mockRes()
    await finalizeMigrationHandler({ uid: 'u', body: { uid: 'other' } } as any, res)
    expect(res.statusCode).toBe(200)
    expect(shredSpy).toHaveBeenCalledWith('u')
    expect(shredSpy).not.toHaveBeenCalledWith('other')
  })

  it('route is registered on keysRouter', () => {
    const paths = keysRouter.stack
      .filter((l: any) => l.route)
      .map((l: any) => `${Object.keys(l.route.methods)[0].toUpperCase()} ${l.route.path}`)
    expect(paths).toContain('POST /finalize-migration')
  })
})

describe('legacy bootstrap path is untouched (still present)', () => {
  it('POST /bootstrap route is still registered on keysRouter', () => {
    const paths = keysRouter.stack
      .filter((l: any) => l.route)
      .map((l: any) => `${Object.keys(l.route.methods)[0].toUpperCase()} ${l.route.path}`)
    expect(paths).toContain('POST /bootstrap')
    // The new wrapped endpoints coexist alongside it.
    expect(paths).toContain('PUT /wrapped')
    expect(paths).toContain('GET /wrapped')
  })
})
