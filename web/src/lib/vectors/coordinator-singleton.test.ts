import { describe, it, expect, vi } from 'vitest'

// The singleton transitively imports the proxy client → firebase; stub it so the
// import doesn't try to initialize a real Firebase app in the test env.
vi.mock('@/lib/firebase', () => ({
  auth: {
    get currentUser() {
      return null
    },
  },
  db: { __db: true },
}))

import { indexEntrySafe, removeEntrySafe } from '@/lib/vectors/coordinator-singleton'

// With no DEK cached (the default in a test env), the coordinator throws
// KeyUnavailableError before ever touching the embedder/model. The *Safe
// wrappers must swallow that so indexing can never block or crash a save.
describe('indexEntrySafe / removeEntrySafe', () => {
  it('never throws when the coordinator rejects (fire-and-forget)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await expect(indexEntrySafe('e1', 'some text')).resolves.toBeUndefined()
    await expect(removeEntrySafe('e1')).resolves.toBeUndefined()
  })
})
