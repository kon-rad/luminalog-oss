import { decideClaim, USERNAME_CHANGE_INTERVAL_MS, type ClaimResult, type UsernameStore } from '../services/username'

export class MemoryUsernameStore implements UsernameStore {
  claims = new Map<string, string>()
  users = new Map<string, { username: string | null; changedAt: Date | null }>()

  async ownerOf(name: string) {
    const uid = this.claims.get(name)
    return uid && this.users.has(uid) ? uid : null
  }

  async claim(uid: string, name: string, now: Date): Promise<ClaimResult> {
    const current = this.users.get(uid) ?? { username: null, changedAt: null }
    const decision = decideClaim({ uid, name, current, claimOwner: await this.ownerOf(name), now })
    if (decision.kind === 'error') return { ok: false, status: decision.status, error: decision.error, nextChangeAt: decision.nextChangeAt }
    const changedAt = decision.kind === 'noop' ? (current.changedAt ?? now) : now
    if (decision.kind === 'claim') {
      if (decision.releasing) this.claims.delete(decision.releasing)
      this.claims.set(name, uid)
      this.users.set(uid, { username: name, changedAt: now })
    }
    return { ok: true, username: name, usernameChangedAt: changedAt, nextChangeAt: new Date(changedAt.getTime() + USERNAME_CHANGE_INTERVAL_MS) }
  }
}