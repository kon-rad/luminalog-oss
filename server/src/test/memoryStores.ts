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

import type { InboxStore, RecipientDirectory, StoredInfoRequest } from '../services/infoRequests/store'
import { normalizeUsername } from '../services/username'

export class MemoryInboxStore implements InboxStore {
  docs = new Map<string, StoredInfoRequest>()
  async create(id: string, doc: StoredInfoRequest) {
    if (this.docs.has(id)) return 'exists' as const
    this.docs.set(id, structuredClone(doc))
    return 'created' as const
  }
  async countPending(uid: string) { return [...this.docs.values()].filter(d => d.recipientUid === uid).length }
  async listForRecipient(uid: string) {
    return [...this.docs.entries()].filter(([, d]) => d.recipientUid === uid).map(([id, doc]) => ({ id, doc }))
  }
  async get(id: string) { return this.docs.get(id) ?? null }
  async delete(id: string) { this.docs.delete(id) }
  async setDeliveryError(id: string, error: string) {
    const d = this.docs.get(id)
    if (d) d.lastDeliveryError = error
  }
}

export class MemoryDirectory implements RecipientDirectory {
  usernames = new Map<string, string>()
  wallets = new Map<string, string>()
  profiles = new Map<string, { username: string | null; wallet: string | null }>()
  async resolve(to: string) {
    const t = to.trim()
    if (/^0x[0-9a-fA-F]{40}$/.test(t)) return this.wallets.get(t.toLowerCase()) ?? null
    return this.usernames.get(normalizeUsername(t)) ?? null
  }
  async respondent(uid: string) { return this.profiles.get(uid) ?? { username: null, wallet: null } }
}