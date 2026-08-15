import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { openDB } from 'idb'
import { clearSlot, loadSlot, saveSlot } from './browserSlot'

const DEK = new Uint8Array(32).map((_, i) => i)
const OTHER = new Uint8Array(32).fill(9)

async function wipe() {
  const db = await openDB('argo-keys', 1, {
    upgrade(d) {
      if (!d.objectStoreNames.contains('slots')) d.createObjectStore('slots')
    },
  })
  await db.clear('slots')
  db.close()
}

beforeEach(async () => {
  await wipe()
})

describe('browserSlot', () => {
  it('returns null when no slot exists', async () => {
    expect(await loadSlot('uid-1')).toBeNull()
  })

  it('round-trips the DEK bytes', async () => {
    await saveSlot('uid-1', DEK)
    const got = await loadSlot('uid-1')
    expect(got).not.toBeNull()
    expect(Array.from(got as Uint8Array)).toEqual(Array.from(DEK))
  })

  it('keys slots by uid and never leaks across users', async () => {
    await saveSlot('uid-1', DEK)
    await saveSlot('uid-2', OTHER)
    expect(Array.from((await loadSlot('uid-1')) as Uint8Array)).toEqual(Array.from(DEK))
    expect(Array.from((await loadSlot('uid-2')) as Uint8Array)).toEqual(Array.from(OTHER))
  })

  it('stores a non-extractable KEK that cannot be exported', async () => {
    await saveSlot('uid-1', DEK)
    const db = await openDB('argo-keys', 1)
    const rec = await db.get('slots', 'uid-1')
    db.close()
    expect(rec.kek.extractable).toBe(false)
    await expect(crypto.subtle.exportKey('raw', rec.kek)).rejects.toThrow()
  })

  it('never stores the DEK in the clear', async () => {
    await saveSlot('uid-1', DEK)
    const db = await openDB('argo-keys', 1)
    const rec = await db.get('slots', 'uid-1')
    db.close()
    const serialized = JSON.stringify({ env: rec.env, uid: rec.uid, createdAt: rec.createdAt })
    expect(serialized).not.toContain(Buffer.from(DEK).toString('base64'))
  })

  it('self-heals a corrupt record and returns null', async () => {
    await saveSlot('uid-1', DEK)
    const db = await openDB('argo-keys', 1)
    const rec = await db.get('slots', 'uid-1')
    // Tamper with the ciphertext so the GCM tag check fails.
    await db.put('slots', { ...rec, env: { ...rec.env, ct: Buffer.alloc(32).toString('base64') } }, 'uid-1')
    db.close()

    expect(await loadSlot('uid-1')).toBeNull()

    // The bad record is gone, not left to fail again on the next visit.
    const db2 = await openDB('argo-keys', 1)
    expect(await db2.get('slots', 'uid-1')).toBeUndefined()
    db2.close()
  })

  it('overwrites an existing slot rather than accumulating', async () => {
    await saveSlot('uid-1', DEK)
    await saveSlot('uid-1', OTHER)
    expect(Array.from((await loadSlot('uid-1')) as Uint8Array)).toEqual(Array.from(OTHER))
    const db = await openDB('argo-keys', 1)
    expect(await db.count('slots')).toBe(1)
    db.close()
  })

  it('clears a slot', async () => {
    await saveSlot('uid-1', DEK)
    await clearSlot('uid-1')
    expect(await loadSlot('uid-1')).toBeNull()
  })

  it('clearing a slot that does not exist is a no-op', async () => {
    await expect(clearSlot('nobody')).resolves.toBeUndefined()
  })
})
