import { vi, describe, it, expect, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// In-memory Firestore stand-in for the `vectors` collection.
//
// Docs are keyed by their id (the handler uses `${uid}__${entryId}`). It
// supports the exact surface vectors.ts touches: collection().doc().set/delete,
// collection().where('userId','==',uid).get(), and db.batch(). `set` simulates
// Firestore resolving a serverTimestamp sentinel into a readable Timestamp.
// ---------------------------------------------------------------------------
const { store, db } = vi.hoisted(() => {
  const store = new Map<string, Record<string, any>>()

  function resolveTimestamps(data: Record<string, any>): Record<string, any> {
    const out = { ...data }
    // The FieldValue.serverTimestamp() sentinel is a non-string object; Firestore
    // resolves it to a Timestamp on read. Simulate that so isoUpdatedAt() works.
    if (out.updatedAt && typeof out.updatedAt !== 'string') {
      out.updatedAt = { toDate: () => new Date('2026-07-09T00:00:00.000Z') }
    }
    return out
  }

  function makeDocRef(id: string) {
    return {
      id,
      async set(data: Record<string, any>) {
        store.set(id, resolveTimestamps(data))
      },
      async delete() {
        store.delete(id)
      },
      async get() {
        const d = store.get(id)
        return { exists: !!d, id, data: () => d }
      },
    }
  }

  const collectionRef = {
    doc: (id: string) => makeDocRef(id),
    where: (_field: string, _op: string, value: any) => ({
      async get() {
        const docs = [...store.entries()]
          .filter(([, d]) => d.userId === value)
          .map(([id, d]) => ({ id, data: () => d }))
        return { docs }
      },
    }),
  }

  const db = {
    collection: (_name: string) => collectionRef,
    batch: () => {
      const ops: Array<() => void> = []
      return {
        set(ref: any, data: Record<string, any>) {
          ops.push(() => store.set(ref.id, resolveTimestamps(data)))
        },
        async commit() {
          ops.forEach(op => op())
        },
      }
    },
  }

  return { store, db }
})

vi.mock('../middleware/firebaseAuth', () => ({
  firebaseAuth: (req: any, _res: any, next: any) => { req.uid = 'u'; next() },
  db,
}))

// firebase-admin is imported by vectors.ts only for the serverTimestamp sentinel.
vi.mock('firebase-admin', () => ({
  default: {
    firestore: {
      FieldValue: { serverTimestamp: () => ({ __serverTimestamp: true }) },
    },
  },
}))

import {
  putVectorHandler,
  listVectorsHandler,
  deleteVectorHandler,
  batchVectorsHandler,
} from './vectors'

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = (c: number) => { res.statusCode = c; return res }
  res.json = (b: any) => { res.body = b; return res }
  return res
}

beforeEach(() => {
  store.clear()
})

describe('putVectorHandler + listVectorsHandler', () => {
  it('round-trips the blob VERBATIM for the same uid', async () => {
    const blob = 'BASE64_OPAQUE_CIPHERTEXT_==' // stand-in for {v,iv,ct,tag}
    const putReq: any = { uid: 'u', params: { entryId: 'e1' }, body: { blob, dim: 768, model: 'embeddinggemma-300m' } }
    const putRes = mockRes()
    await putVectorHandler(putReq, putRes)
    expect(putRes.statusCode).toBe(200)
    expect(putRes.body).toEqual({ ok: true, entryId: 'e1' })

    const listReq: any = { uid: 'u' }
    const listRes = mockRes()
    await listVectorsHandler(listReq, listRes)
    expect(listRes.body.vectors).toHaveLength(1)
    expect(listRes.body.vectors[0]).toMatchObject({
      entryId: 'e1',
      blob, // byte-for-byte identical — server never mutated it
      dim: 768,
      model: 'embeddinggemma-300m',
    })
    expect(listRes.body.vectors[0].updatedAt).toBe('2026-07-09T00:00:00.000Z')
  })

  it('upserts (a second PUT overwrites the same entry, not append)', async () => {
    const base: any = { uid: 'u', params: { entryId: 'e1' } }
    await putVectorHandler({ ...base, body: { blob: 'v1', dim: 768, model: 'm' } }, mockRes())
    await putVectorHandler({ ...base, body: { blob: 'v2', dim: 768, model: 'm' } }, mockRes())
    const listRes = mockRes()
    await listVectorsHandler({ uid: 'u' } as any, listRes)
    expect(listRes.body.vectors).toHaveLength(1)
    expect(listRes.body.vectors[0].blob).toBe('v2')
  })
})

describe('cross-tenant isolation (MOST IMPORTANT)', () => {
  it('GET returns ONLY the caller\'s blobs — no cross-tenant leakage', async () => {
    // Seed two users' blobs.
    await putVectorHandler({ uid: 'u', params: { entryId: 'e1' }, body: { blob: 'u-blob-1', dim: 768, model: 'm' } } as any, mockRes())
    await putVectorHandler({ uid: 'u', params: { entryId: 'e2' }, body: { blob: 'u-blob-2', dim: 768, model: 'm' } } as any, mockRes())
    await putVectorHandler({ uid: 'other', params: { entryId: 'e1' }, body: { blob: 'other-secret', dim: 768, model: 'm' } } as any, mockRes())

    const listRes = mockRes()
    await listVectorsHandler({ uid: 'u' } as any, listRes)
    const blobs = listRes.body.vectors.map((v: any) => v.blob).sort()
    expect(blobs).toEqual(['u-blob-1', 'u-blob-2'])
    // The other tenant's ciphertext must never appear in u's listing.
    expect(JSON.stringify(listRes.body)).not.toContain('other-secret')

    // And the other user only sees their own.
    const otherRes = mockRes()
    await listVectorsHandler({ uid: 'other' } as any, otherRes)
    expect(otherRes.body.vectors).toHaveLength(1)
    expect(otherRes.body.vectors[0].blob).toBe('other-secret')
  })
})

describe('putVectorHandler ownership + validation', () => {
  it('ignores/overrides any userId in the body (ownership from the token only)', async () => {
    const req: any = { uid: 'u', params: { entryId: 'e1' }, body: { blob: 'b', dim: 768, model: 'm', userId: 'attacker', entryId: 'spoofed' } }
    await putVectorHandler(req, mockRes())

    // Stored under the token uid; visible to 'u', not to 'attacker'.
    const uRes = mockRes()
    await listVectorsHandler({ uid: 'u' } as any, uRes)
    expect(uRes.body.vectors).toHaveLength(1)
    expect(uRes.body.vectors[0].entryId).toBe('e1') // from the URL, not the body

    const attackerRes = mockRes()
    await listVectorsHandler({ uid: 'attacker' } as any, attackerRes)
    expect(attackerRes.body.vectors).toHaveLength(0)
  })

  it('400 on missing blob', async () => {
    const res = mockRes()
    await putVectorHandler({ uid: 'u', params: { entryId: 'e1' }, body: { dim: 768, model: 'm' } } as any, res)
    expect(res.statusCode).toBe(400)
  })

  it('400 on missing/invalid dim', async () => {
    const res = mockRes()
    await putVectorHandler({ uid: 'u', params: { entryId: 'e1' }, body: { blob: 'b', model: 'm' } } as any, res)
    expect(res.statusCode).toBe(400)
  })

  it('400 on missing entryId', async () => {
    const res = mockRes()
    await putVectorHandler({ uid: 'u', params: {}, body: { blob: 'b', dim: 768, model: 'm' } } as any, res)
    expect(res.statusCode).toBe(400)
  })
})

describe('deleteVectorHandler', () => {
  it('removes only the caller\'s entry', async () => {
    await putVectorHandler({ uid: 'u', params: { entryId: 'e1' }, body: { blob: 'u1', dim: 768, model: 'm' } } as any, mockRes())
    await putVectorHandler({ uid: 'other', params: { entryId: 'e1' }, body: { blob: 'o1', dim: 768, model: 'm' } } as any, mockRes())

    const delRes = mockRes()
    await deleteVectorHandler({ uid: 'u', params: { entryId: 'e1' } } as any, delRes)
    expect(delRes.body).toEqual({ deleted: true, entryId: 'e1' })

    // u's blob is gone...
    const uRes = mockRes()
    await listVectorsHandler({ uid: 'u' } as any, uRes)
    expect(uRes.body.vectors).toHaveLength(0)
    // ...but the other tenant's identically-named entry is untouched.
    const otherRes = mockRes()
    await listVectorsHandler({ uid: 'other' } as any, otherRes)
    expect(otherRes.body.vectors).toHaveLength(1)
  })

  it('400 on missing entryId', async () => {
    const res = mockRes()
    await deleteVectorHandler({ uid: 'u', params: {} } as any, res)
    expect(res.statusCode).toBe(400)
  })
})

describe('batchVectorsHandler', () => {
  it('upserts many blobs under the caller (backfill)', async () => {
    const req: any = {
      uid: 'u',
      body: { vectors: [
        { entryId: 'e1', blob: 'b1', dim: 768, model: 'm' },
        { entryId: 'e2', blob: 'b2', dim: 768, model: 'm' },
      ] },
    }
    const res = mockRes()
    await batchVectorsHandler(req, res)
    expect(res.body).toEqual({ ok: true, count: 2 })

    const listRes = mockRes()
    await listVectorsHandler({ uid: 'u' } as any, listRes)
    expect(listRes.body.vectors.map((v: any) => v.blob).sort()).toEqual(['b1', 'b2'])
  })

  it('400 when an item is malformed (nothing written)', async () => {
    const req: any = { uid: 'u', body: { vectors: [{ entryId: 'e1', blob: 'ok', dim: 768 }, { entryId: 'e2', dim: 768 }] } }
    const res = mockRes()
    await batchVectorsHandler(req, res)
    expect(res.statusCode).toBe(400)
    // Reject-all: no partial write.
    const listRes = mockRes()
    await listVectorsHandler({ uid: 'u' } as any, listRes)
    expect(listRes.body.vectors).toHaveLength(0)
  })

  it('400 on empty/missing array', async () => {
    const res = mockRes()
    await batchVectorsHandler({ uid: 'u', body: {} } as any, res)
    expect(res.statusCode).toBe(400)
  })
})
