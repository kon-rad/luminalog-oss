/** In-memory sliding window, per key. Single PM2 process, same trade as the SIWE nonce store:
 *  a restart resets the counters, which only ever errs toward allowing requests. */
export class SlidingWindowLimiter {
  private hits = new Map<string, number[]>()
  constructor(private limit: number, private windowMs: number, private now: () => number = Date.now) {}

  take(key: string): boolean {
    const t = this.now()
    const recent = (this.hits.get(key) ?? []).filter(h => t - h < this.windowMs)
    if (recent.length >= this.limit) { this.hits.set(key, recent); return false }
    recent.push(t)
    this.hits.set(key, recent)
    if (this.hits.size > 10_000) this.sweep(t)
    return true
  }

  private sweep(t: number) {
    for (const [k, v] of this.hits) if (v.every(h => t - h >= this.windowMs)) this.hits.delete(k)
  }
}