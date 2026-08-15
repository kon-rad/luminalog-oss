import { openDB, type DBSchema, type IDBPDatabase } from 'idb'
import { unwrap, wrap, type WrappedKeyEnvelope } from '@/lib/crypto/wrappedKey'

// The browser-local KEK slot: this device's stand-in for the iCloud Keychain
// wrap that iOS holds and a browser cannot reach.
//
// A freshly generated, NON-EXTRACTABLE AES-GCM key is stored as a CryptoKey
// object (structured clone keeps its raw bytes inside the browser's key store,
// where page script can use it but not export it), and the DEK is stored beside
// it as an ordinary `{v,iv,ct,tag}` envelope sealed under that key. Neither
// half is useful without the other, and the raw DEK is never written to disk.
//
// THREAT MODEL, stated plainly: this defends against a stolen server database
// and casual access to the device. It does NOT defend against XSS on the
// origin, because any script running here can USE the key without exporting it.
// That is the ceiling for browser-based end-to-end encryption, and the privacy
// copy must not claim more.
//
// Every path degrades rather than throwing. A slot is a cache, and a cache miss
// must always fall through to the recovery-code prompt, never to an error
// screen.

interface SlotRecord {
  uid: string
  kek: CryptoKey
  env: WrappedKeyEnvelope
  createdAt: number
}

interface KeysDB extends DBSchema {
  slots: {
    key: string
    value: SlotRecord
  }
}

const DB_NAME = 'argo-keys'
const STORE = 'slots'

let dbPromise: Promise<IDBPDatabase<KeysDB>> | undefined

// Lazy singleton. Never touches `indexedDB` at module load time (SSR-safe).
function getDB(): Promise<IDBPDatabase<KeysDB>> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('browserSlot: indexedDB is unavailable'))
  }
  if (!dbPromise) {
    dbPromise = openDB<KeysDB>(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE)
      },
    })
  }
  return dbPromise
}

/**
 * Seal `dekBytes` under a fresh non-extractable browser key and persist both.
 *
 * NEVER throws. A browser that refuses to store the slot (private browsing,
 * storage disabled, quota exceeded) must still end up with a working unlocked
 * session, just one that does not persist.
 */
export async function saveSlot(uid: string, dekBytes: Uint8Array): Promise<void> {
  try {
    const db = await getDB()
    const kek = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ])
    const env = await wrap(kek, dekBytes)
    await db.put(STORE, { uid, kek, env, createdAt: Date.now() }, uid)
  } catch (err) {
    console.warn('[keys] could not persist the browser slot; this session only:', err)
  }
}

/**
 * Recover the DEK bytes for `uid`, or null if this browser holds no usable
 * slot. A corrupt or tampered record clears itself so the next visit starts
 * clean instead of failing identically forever.
 */
export async function loadSlot(uid: string): Promise<Uint8Array | null> {
  let db: IDBPDatabase<KeysDB>
  try {
    db = await getDB()
  } catch {
    // Private browsing, storage disabled, or SSR. Unlock still works for the
    // session; it just will not persist.
    return null
  }

  const rec = await db.get(STORE, uid)
  if (!rec) return null

  try {
    return await unwrap(rec.kek, rec.env)
  } catch {
    await clearSlot(uid)
    return null
  }
}

/** Forget this browser's slot for `uid`. Safe to call when none exists. */
export async function clearSlot(uid: string): Promise<void> {
  try {
    const db = await getDB()
    await db.delete(STORE, uid)
  } catch {
    // Nothing to clear if storage is unavailable.
  }
}

/**
 * Ask the browser to exempt this origin from routine storage eviction. Reduces,
 * but cannot eliminate, Safari's ITP purge of script-writable storage after
 * seven days without user interaction. Best effort, never fatal.
 */
export async function requestPersistence(): Promise<void> {
  try {
    await navigator.storage?.persist?.()
  } catch {
    // Not supported, or the user declined. Neither is an error.
  }
}
