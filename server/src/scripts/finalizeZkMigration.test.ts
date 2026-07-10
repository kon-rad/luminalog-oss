import { describe, it, expect, vi } from 'vitest'

// Mock firebase-admin's FieldValue sentinels (same shape as keys.test.ts) so the
// fake Firestore below can recognize delete/serverTimestamp in an `update` patch.
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

import { finalizeUsers } from './finalizeZkMigration'

/** Minimal in-memory Firestore supporting `.doc(uid).get()/.update()` with the
 *  FieldValue.delete sentinel. */
function makeFakeDb(initial: Record<string, Record<string, any>>) {
  const store = new Map<string, Record<string, any>>(Object.entries(initial))
  const db: any = {
    collection: () => ({
      doc: (uid: string) => ({
        get: async () => ({
          exists: store.has(uid),
          get: (field: string) => store.get(uid)?.[field],
        }),
        update: async (patch: Record<string, any>) => {
          const cur = { ...(store.get(uid) ?? {}) }
          for (const [k, v] of Object.entries(patch)) {
            if (v && (v as any).__delete) delete cur[k]
            else cur[k] = v
          }
          store.set(uid, cur)
        },
      }),
    }),
  }
  return { db, store }
}

const env = { v: 1, iv: 'aXY=', ct: 'aXY=', tag: 'aXY=' }

function seed() {
  return makeFakeDb({
    migrated: { wrappedDEK: { v: 1 }, wrappedKeys: { icloud: env, recovery: env } },
    notmigrated: { wrappedDEK: { v: 1 } },
    onlyicloud: { wrappedDEK: { v: 1 }, wrappedKeys: { icloud: env } }, // half-migrated → ineligible
  })
}

describe('finalizeZkMigration.finalizeUsers', () => {
  it('check mode mutates nothing and reports exactly the eligible users', async () => {
    const { db, store } = seed()
    const res = await finalizeUsers(db, ['migrated', 'notmigrated', 'onlyicloud'], { check: true })

    expect(res.filter((r) => r.eligible).length).toBe(1)
    expect(res.find((r) => r.uid === 'migrated')).toMatchObject({ eligible: true, finalized: false })
    expect(res.find((r) => r.uid === 'onlyicloud')?.eligible).toBe(false)
    // Nothing changed.
    expect(store.get('migrated')!.wrappedDEK).toBeDefined()
    expect(store.get('migrated')!.zkMigratedAt).toBeUndefined()
  })

  it('real run finalizes ONLY the fully-migrated user; others untouched', async () => {
    const { db, store } = seed()
    const res = await finalizeUsers(db, ['migrated', 'notmigrated', 'onlyicloud'], { check: false })

    expect(res.find((r) => r.uid === 'migrated')?.finalized).toBe(true)
    expect(store.get('migrated')!.wrappedDEK).toBeUndefined() // deleted
    expect(store.get('migrated')!.zkMigratedAt).toEqual({ __serverTimestamp: true })

    // Ineligible users keep their wrappedDEK (never locked out).
    expect(res.find((r) => r.uid === 'notmigrated')?.finalized).toBe(false)
    expect(store.get('notmigrated')!.wrappedDEK).toBeDefined()
    expect(store.get('onlyicloud')!.wrappedDEK).toBeDefined()
  })

  it('is idempotent — re-running an already-finalized user does not throw and stays finalized', async () => {
    const { db, store } = seed()
    await finalizeUsers(db, ['migrated'], { check: false })
    const again = await finalizeUsers(db, ['migrated'], { check: false })
    expect(again[0].finalized).toBe(true)
    expect(store.get('migrated')!.wrappedDEK).toBeUndefined()
  })
})
