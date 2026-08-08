// Single-flight queue for the ONE shared minter EOA. Both the Soul mint and the
// Course Badge mint submit from the same key, so their writeContract calls must
// be serialized process-wide or they fetch the same pending nonce and collide.
let _mintChain: Promise<unknown> = Promise.resolve()

export function runExclusiveMint<T>(fn: () => Promise<T>): Promise<T> {
  const result = _mintChain.then(fn, fn)
  // Keep the chain alive but never let a rejection poison the next submission.
  _mintChain = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}
