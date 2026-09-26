import { db } from '../middleware/firebaseAuth'

/**
 * Public Argo handles (spec section 3). `usernames/{name}` is the uniqueness lock;
 * `users/{uid}.username` + `.usernameChangedAt` mirror it. All three are
 * server-owned (Firestore rules deny client writes). The claim rules live in the
 * pure `decideClaim` so they're tested without Firestore.
 */

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/
export const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'argo', 'argoquest', 'luminalog', 'support', 'help', 'api', 'root',
  'system', 'official', 'staff', 'team', 'security', 'mod', 'moderator', 'null', 'undefined',
  'me', 'you', 'inbox', 'settings',
])
export const USERNAME_CHANGE_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000

export const normalizeUsername = (input: string) => input.trim().replace(/^@/, '').toLowerCase()

export function validateUsername(name: string): 'invalid' | 'reserved' | null {
  if (!USERNAME_RE.test(name)) return 'invalid'
  if (RESERVED_USERNAMES.has(name)) return 'reserved'
  return null
}

export type ClaimDecision =
  | { kind: 'noop' }
  | { kind: 'claim'; releasing: string | null }
  | { kind: 'error'; status: 400 | 409 | 429; error: 'invalid' | 'reserved' | 'taken' | 'too_soon'; nextChangeAt?: Date }

export function decideClaim(args: {
  uid: string
  name: string
  current: { username: string | null; changedAt: Date | null }
  claimOwner: string | null
  now: Date
}): ClaimDecision {
  const invalid = validateUsername(args.name)
  if (invalid) return { kind: 'error', status: 400, error: invalid }
  if (args.current.username === args.name) return { kind: 'noop' }
  if (args.claimOwner && args.claimOwner !== args.uid) return { kind: 'error', status: 409, error: 'taken' }
  if (args.current.changedAt) {
    const nextChangeAt = new Date(args.current.changedAt.getTime() + USERNAME_CHANGE_INTERVAL_MS)
    if (args.now < nextChangeAt) return { kind: 'error', status: 429, error: 'too_soon', nextChangeAt }
  }
  return { kind: 'claim', releasing: args.current.username }
}

export type ClaimResult =
  | { ok: true; username: string; usernameChangedAt: Date; nextChangeAt: Date }
  | { ok: false; status: 400 | 409 | 429; error: string; nextChangeAt?: Date }

export interface UsernameStore {
  /** uid holding `name`, or null. A claim whose users/{uid} doc is gone counts as unclaimed. */
  ownerOf(name: string): Promise<string | null>
  claim(uid: string, name: string, now: Date): Promise<ClaimResult>
}

export function toDate(v: unknown): Date | null {
  if (v instanceof Date) return v
  if (v && typeof (v as { toDate?: unknown }).toDate === 'function') return (v as { toDate(): Date }).toDate()
  return null
}

const next = (d: Date) => new Date(d.getTime() + USERNAME_CHANGE_INTERVAL_MS)

export const firestoreUsernameStore: UsernameStore = {
  async ownerOf(name) {
    const claim = await db.collection('usernames').doc(name).get()
    const uid = claim.exists ? (claim.data()?.uid as string | undefined) : undefined
    if (!uid) return null
    const user = await db.collection('users').doc(uid).get()
    return user.exists ? uid : null
  },

  async claim(uid, name, now) {
    return db.runTransaction(async tx => {
      const userRef = db.collection('users').doc(uid)
      const claimRef = db.collection('usernames').doc(name)
      const [userSnap, claimSnap] = await Promise.all([tx.get(userRef), tx.get(claimRef)])
      const data = userSnap.data() ?? {}
      const current = {
        username: (data.username as string | undefined) ?? null,
        changedAt: toDate(data.usernameChangedAt),
      }
      let claimOwner = claimSnap.exists ? ((claimSnap.data()?.uid as string | undefined) ?? null) : null
      if (claimOwner && claimOwner !== uid) {
        const ownerSnap = await tx.get(db.collection('users').doc(claimOwner))
        if (!ownerSnap.exists) claimOwner = null // orphaned claim from a deleted account
      }
      const decision = decideClaim({ uid, name, current, claimOwner, now })
      if (decision.kind === 'error') {
        return { ok: false, status: decision.status, error: decision.error, nextChangeAt: decision.nextChangeAt }
      }
      if (decision.kind === 'noop') {
        const changedAt = current.changedAt ?? now
        return { ok: true, username: name, usernameChangedAt: changedAt, nextChangeAt: next(changedAt) }
      }
      if (decision.releasing) tx.delete(db.collection('usernames').doc(decision.releasing))
      tx.set(claimRef, { uid, claimedAt: now })
      tx.set(userRef, { username: name, usernameChangedAt: now }, { merge: true })
      return { ok: true, username: name, usernameChangedAt: now, nextChangeAt: next(now) }
    })
  },
}