import { getAddress } from 'viem'
import { db } from '../../middleware/firebaseAuth'
import { firestoreUsernameStore, toDate, normalizeUsername, validateUsername } from '../username'

export const INFO_REQUESTS = 'infoRequests'
export const REQUEST_TTL_MS = 30 * 24 * 60 * 60 * 1000

export interface StoredInfoRequest {
  recipientUid: string
  sender: { address: string; ens: string | null; name: string; description: string }
  reason: string
  questions: string[]
  webhookUrl: string
  webhookHost: string
  status: 'pending'
  createdAt: Date
  expiresAt: Date
  lastDeliveryError: string | null
}

export interface InboxStore {
  create(id: string, doc: StoredInfoRequest): Promise<'created' | 'exists'>
  countPending(uid: string): Promise<number>
  listForRecipient(uid: string): Promise<Array<{ id: string; doc: StoredInfoRequest }>>
  get(id: string): Promise<StoredInfoRequest | null>
  delete(id: string): Promise<void>
  setDeliveryError(id: string, error: string): Promise<void>
}

export interface RecipientDirectory {
  /** `@name`, `name`, or `0x…` → uid, or null. */
  resolve(to: string): Promise<string | null>
  respondent(uid: string): Promise<{ username: string | null; wallet: string | null }>
}

const fromFirestore = (data: FirebaseFirestore.DocumentData): StoredInfoRequest => ({
  ...(data as StoredInfoRequest),
  createdAt: toDate(data.createdAt) ?? new Date(0),
  expiresAt: toDate(data.expiresAt) ?? new Date(0),
})

export const firestoreInboxStore: InboxStore = {
  async create(id, doc) {
    try {
      await db.collection(INFO_REQUESTS).doc(id).create(doc)
      return 'created'
    } catch (err) {
      if ((err as { code?: number }).code === 6) return 'exists' // ALREADY_EXISTS
      throw err
    }
  },
  async countPending(uid) {
    const snap = await db.collection(INFO_REQUESTS).where('recipientUid', '==', uid).count().get()
    return snap.data().count
  },
  async listForRecipient(uid) {
    // Single-field equality: no composite index. ≤ 50 docs per recipient, sorted by the caller.
    const snap = await db.collection(INFO_REQUESTS).where('recipientUid', '==', uid).get()
    return snap.docs.map(d => ({ id: d.id, doc: fromFirestore(d.data()) }))
  },
  async get(id) {
    const snap = await db.collection(INFO_REQUESTS).doc(id).get()
    return snap.exists ? fromFirestore(snap.data()!) : null
  },
  async delete(id) {
    await db.collection(INFO_REQUESTS).doc(id).delete()
  },
  async setDeliveryError(id, error) {
    await db.collection(INFO_REQUESTS).doc(id).set({ lastDeliveryError: error.slice(0, 300) }, { merge: true })
  },
}

export const firestoreDirectory: RecipientDirectory = {
  async resolve(to) {
    const t = to.trim()
    if (/^0x[0-9a-fA-F]{40}$/.test(t)) {
      // Soulbound custodial wallet first (stored as returned by CDP, so match both cases),
      // then the SIWE-linked wallet (stored lowercase by routes/auth.ts).
      const custodial = await db.collection('users')
        .where('wallet.address', 'in', [getAddress(t), t.toLowerCase()]).limit(1).get()
      if (!custodial.empty) return custodial.docs[0].id
      const linked = await db.collection('users').where('walletAddress', '==', t.toLowerCase()).limit(1).get()
      return linked.empty ? null : linked.docs[0].id
    }
    const name = normalizeUsername(t)
    if (validateUsername(name) === 'invalid') return null
    return firestoreUsernameStore.ownerOf(name)
  },
  async respondent(uid) {
    const data = (await db.collection('users').doc(uid).get()).data() ?? {}
    return {
      username: (data.username as string | undefined) ?? null,
      wallet: ((data.wallet as { address?: string } | undefined)?.address) ?? null,
    }
  },
}