import { describe, expect, it } from 'vitest'
import { clearSlot, loadSlot, saveSlot } from './browserSlot'

// Deliberately does NOT import 'fake-indexeddb/auto', so `indexedDB` is
// undefined here exactly as it is in private browsing or with storage disabled.
// Lives in its own file because `getDB` memoizes its database handle, so a
// sibling test that already opened one would mask this path.
//
// The contract: a slot is a convenience cache, so a browser that refuses to
// store it must still end up with a working unlocked session. Throwing here
// would turn a SUCCESSFUL unlock into a "failed" state, which is both wrong and
// alarming.
describe('browserSlot with storage unavailable', () => {
  it('has no global indexedDB, which is the point of this file', () => {
    expect(typeof indexedDB).toBe('undefined')
  })

  it('saveSlot resolves instead of throwing', async () => {
    await expect(saveSlot('uid-1', new Uint8Array(32))).resolves.toBeUndefined()
  })

  it('loadSlot returns null instead of throwing', async () => {
    await expect(loadSlot('uid-1')).resolves.toBeNull()
  })

  it('clearSlot resolves instead of throwing', async () => {
    await expect(clearSlot('uid-1')).resolves.toBeUndefined()
  })
})
