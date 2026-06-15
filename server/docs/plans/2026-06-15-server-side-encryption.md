# Server-Side Encryption Implementation Plan

> **For agentic workers:** Implement task-by-task. Each task is TDD where testable. Steps use `- [ ]` checkboxes.

**Goal:** Implement the backend half of LuminaLog's per-user encryption so the proxy can decrypt journal content/chat/biography/audio to run AI, embeddings, and transcription, and re-encrypt anything it writes — fully interoperable with the iOS client already shipped.

**Architecture:** Envelope encryption (design: `ios/docs/superpowers/specs/2026-06-15-per-user-data-encryption-design.md`). A single `MASTER_KEY` in the server env wraps a per-user AES-256-GCM Data Encryption Key (DEK) stored as `users/{uid}.wrappedDEK`. The server is the **sole authority** that generates DEKs (`getOrCreateDEK`, idempotent via a Firestore transaction); the iOS client only ever fetches its DEK via `POST /v1/keys/bootstrap`. Field encryption uses the exact same `{v,alg,iv,ct,tag}` envelope and AAD context strings as the iOS `FieldCipher`; media uses the same chunked `LLM1` format as the iOS `MediaCipher`.

**Tech stack:** Node + TypeScript (CommonJS, strict), Express, firebase-admin, Node `crypto` (AES-256-GCM), Vitest (added by this plan).

**Stack/runner:** Tests run with Vitest via `npm test`. Build with `tsc`. Run with `tsx`/`node`.

---

## CRITICAL: iOS interop contracts (do not deviate)

These three contracts must match the iOS client byte-for-byte. They are the whole point.

### 1. Field envelope (Firestore)
Stored as a Firestore map, read by Node as a plain object:
```json
{ "v": 1, "alg": "A256GCM", "iv": "<base64 12B>", "ct": "<base64>", "tag": "<base64 16B>" }
```
AES-256-GCM. AAD = the UTF-8 bytes of the **context string**. Nonce = random 12 bytes.

### 2. AAD context strings (must equal the iOS `FieldCipher` contexts exactly)
From `ios/.../Core/Persistence/FirestoreMapping.swift`:

| Field (Firestore) | AAD context |
|---|---|
| `journals.content` | `journals.content` |
| `journals.title` | `journals.title` |
| `journals.summary.text` | `journals.summary.text` |
| `journals.insights.text` | `journals.insights.text` |
| `journals.prompts.items[i]` | `journals.prompts.items.<i>` |
| `chats/{id}.title` | `chats.title` |
| `messages.text` | `messages.text` |
| `messages.sources[i].snippet` | `messages.sources.<i>.snippet` |
| `users.biography` | `users.biography` |
| `users.dailyPrompt.text` | `users.dailyPrompt.text` |

### 3. Media binary format (S3) — the iOS `MediaCipher` `LLM1` layout
```
[ "LLM1" (4 bytes) ][ chunkSize uint32 BE (4 bytes) ]
per chunk: [ blobLen uint32 BE (4 bytes) ][ blob ]
  blob = AES.GCM "combined" = nonce(12) || ciphertext || tag(16)
  AAD for chunk i = uint32 BE of i
```
The server only needs **decrypt** (to read audio for Whisper).

### 4. Bootstrap endpoint (iOS `ProxyKeyProvider`)
`POST /v1/keys/bootstrap` (auth required) → `{ "dek": "<base64 32B>" }`.

---

## File Structure

**New**
- `server/src/crypto/fieldCipher.ts` — envelope encrypt/decrypt + Firestore-map helpers.
- `server/src/crypto/mediaCipher.ts` — `LLM1` chunked decrypt (and encrypt for completeness).
- `server/src/crypto/keyService.ts` — `MASTER_KEY` wrap/unwrap, `getOrCreateDEK`, in-memory cache, `cryptoShredUser`.
- `server/src/routes/keys.ts` — `POST /v1/keys/bootstrap`.
- `server/src/crypto/fieldCipher.test.ts`, `mediaCipher.test.ts`, `keyService.test.ts`.
- `server/vitest.config.ts`.

**Modified**
- `server/src/config.ts` — add `MASTER_KEY`.
- `server/.env.example` — add `MASTER_KEY`.
- `server/package.json` — add `vitest` + `test` script.
- `server/src/index.ts` — mount `keysRouter`.
- `server/src/routes/ai.ts` — decrypt content/title; transcribe: decrypt audio + encrypt content write-back.
- `server/src/routes/chat.ts` — decrypt bio + history text; encrypt user/assistant messages.
- `server/src/routes/rag.ts` — decrypt content/title before indexing.
- `server/src/services/journalIndexer.ts` — embed plaintext, store **encrypted** chunk text + title.
- `server/src/services/journalRetriever.ts` — decrypt chunk text + title after query.

---

## Task 1: Add Vitest + MASTER_KEY config

**Files:** `server/package.json`, `server/vitest.config.ts`, `server/src/config.ts`, `server/.env.example`

- [ ] **Step 1: Add dev dep + script.** In `package.json` add `"test": "vitest run"` to scripts and `"vitest": "^1.6.0"` to devDependencies, then `npm install`.

- [ ] **Step 2: Vitest config.** Create `server/vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config'
export default defineConfig({ test: { environment: 'node', include: ['src/**/*.test.ts'] } })
```

- [ ] **Step 3: MASTER_KEY in config schema.** In `src/config.ts` add to the zod schema:
```ts
  MASTER_KEY: z.string().refine(
    v => Buffer.from(v, 'base64').length === 32,
    'MASTER_KEY must be base64 of exactly 32 bytes',
  ),
```

- [ ] **Step 4: Document it.** In `.env.example` add:
```
# 32-byte base64 master key that wraps each user's data key.
# Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
MASTER_KEY=
```

- [ ] **Step 5: Commit.** `git add -A && git commit -m "Add Vitest and MASTER_KEY config"`

---

## Task 2: fieldCipher.ts (envelope, iOS-interop)

**Files:** `server/src/crypto/fieldCipher.ts`, `server/src/crypto/fieldCipher.test.ts`

- [ ] **Step 1: Write failing tests.**
```ts
import { describe, it, expect } from 'vitest'
import { randomBytes } from 'crypto'
import { encryptField, decryptField, EncryptedField } from './fieldCipher'

describe('fieldCipher', () => {
  const key = randomBytes(32)

  it('round-trips', () => {
    const env = encryptField(key, 'Secret entry body.', 'journals.content')
    expect(env.v).toBe(1); expect(env.alg).toBe('A256GCM')
    expect(decryptField(key, env, 'journals.content')).toBe('Secret entry body.')
  })

  it('ciphertext is not plaintext', () => {
    const env = encryptField(key, 'secret diary', 'journals.content')
    expect(Buffer.from(env.ct, 'base64').toString('utf8')).not.toBe('secret diary')
  })

  it('wrong AAD context fails closed', () => {
    const env = encryptField(key, 'data', 'journals.content')
    expect(() => decryptField(key, env, 'journals.title')).toThrow()
  })

  it('wrong key fails closed', () => {
    const env = encryptField(key, 'data', 'c')
    expect(() => decryptField(randomBytes(32), env, 'c')).toThrow()
  })

  it('tampered tag fails closed', () => {
    const env = encryptField(key, 'data', 'c')
    const bad: EncryptedField = { ...env, tag: Buffer.alloc(16).toString('base64') }
    expect(() => decryptField(key, bad, 'c')).toThrow()
  })

  it('random nonce per call', () => {
    const a = encryptField(key, 'data', 'c'); const b = encryptField(key, 'data', 'c')
    expect(a.iv).not.toBe(b.iv); expect(a.ct).not.toBe(b.ct)
  })

  it('isEncryptedField rejects plain values', () => {
    const { isEncryptedField } = require('./fieldCipher')
    expect(isEncryptedField('plain string')).toBe(false)
    expect(isEncryptedField({ v: 2 })).toBe(false)
    expect(isEncryptedField(encryptField(key, 'x', 'c'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run — expect FAIL** (`npm test`).

- [ ] **Step 3: Implement.** Create `src/crypto/fieldCipher.ts`:
```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

export interface EncryptedField {
  v: number
  alg: 'A256GCM'
  iv: string   // base64 12B nonce
  ct: string   // base64 ciphertext
  tag: string  // base64 16B tag
}

const VERSION = 1
const ALG = 'A256GCM' as const

export function encryptField(key: Buffer, plaintext: string, context: string): EncryptedField {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  cipher.setAAD(Buffer.from(context, 'utf8'))
  const ct = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return { v: VERSION, alg: ALG, iv: iv.toString('base64'), ct: ct.toString('base64'), tag: tag.toString('base64') }
}

export function decryptField(key: Buffer, field: EncryptedField, context: string): string {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(field.iv, 'base64'))
  decipher.setAAD(Buffer.from(context, 'utf8'))
  decipher.setAuthTag(Buffer.from(field.tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(field.ct, 'base64')), decipher.final()]).toString('utf8')
}

export function isEncryptedField(value: unknown): value is EncryptedField {
  return !!value && typeof value === 'object'
    && (value as any).v === VERSION && (value as any).alg === ALG
    && typeof (value as any).iv === 'string' && typeof (value as any).ct === 'string'
    && typeof (value as any).tag === 'string'
}

/** Decrypt a Firestore value that should be an envelope; '' for missing, throws on garbled. */
export function openField(key: Buffer, value: unknown, context: string): string {
  if (value == null) return ''
  if (!isEncryptedField(value)) throw new Error(`Expected EncryptedField at ${context}`)
  return decryptField(key, value, context)
}
```

- [ ] **Step 4: Run — expect PASS.**

- [ ] **Step 5: Cross-impl interop check (manual, one-time).** From the iOS repo, encrypt a known string/context with a known 32-byte key (e.g. all-zero key) and paste the envelope into a temporary Vitest case asserting `decryptField(zeroKey, env, ctx) === expected`. This proves the two implementations agree. Delete the temp case after it passes. (If the iOS app isn't handy, instead assert Node can decrypt what Node encrypts AND that a Python/openssl AES-256-GCM reference with the same iv/aad/tag matches — but the iOS round-trip is the real contract.)

- [ ] **Step 6: Commit.** `git commit -m "Add fieldCipher (AES-256-GCM envelope, iOS interop)"`

---

## Task 3: mediaCipher.ts (LLM1 chunked decrypt)

**Files:** `server/src/crypto/mediaCipher.ts`, `server/src/crypto/mediaCipher.test.ts`

- [ ] **Step 1: Write failing tests** (round-trip + tamper). Encrypt with the Node `encryptMedia` and decrypt back; also assert a single-chunk and multi-chunk payload round-trip and that flipping a byte throws.
```ts
import { describe, it, expect } from 'vitest'
import { randomBytes } from 'crypto'
import { encryptMedia, decryptMedia } from './mediaCipher'

describe('mediaCipher', () => {
  const key = randomBytes(32)
  it('round-trips multi-chunk', () => {
    const payload = randomBytes(10_000)
    const enc = encryptMedia(key, payload, 1024)
    expect(enc.subarray(0, 4).toString()).toBe('LLM1')
    expect(decryptMedia(key, enc).equals(payload)).toBe(true)
  })
  it('tamper fails closed', () => {
    const enc = encryptMedia(key, randomBytes(5000), 1024)
    enc[enc.length - 1] ^= 0xff
    expect(() => decryptMedia(key, enc)).toThrow()
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** `src/crypto/mediaCipher.ts` (must match the iOS layout in the Interop section):
```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const MAGIC = Buffer.from('LLM1')

function be32(n: number): Buffer { const b = Buffer.alloc(4); b.writeUInt32BE(n >>> 0, 0); return b }

export function encryptMedia(key: Buffer, data: Buffer, chunkSize = 1 << 20): Buffer {
  const out: Buffer[] = [MAGIC, be32(chunkSize)]
  let index = 0
  for (let off = 0; off < data.length; off += chunkSize) {
    const chunk = data.subarray(off, Math.min(off + chunkSize, data.length))
    const iv = randomBytes(12)
    const cipher = createCipheriv('aes-256-gcm', key, iv)
    cipher.setAAD(be32(index))
    const ct = Buffer.concat([cipher.update(chunk), cipher.final()])
    const blob = Buffer.concat([iv, ct, cipher.getAuthTag()]) // nonce||ct||tag = AES.GCM "combined"
    out.push(be32(blob.length), blob)
    index++
  }
  return Buffer.concat(out)
}

export function decryptMedia(key: Buffer, data: Buffer): Buffer {
  if (!data.subarray(0, 4).equals(MAGIC)) throw new Error('Malformed media file')
  let pos = 8 // skip magic(4) + chunkSize(4)
  const out: Buffer[] = []
  let index = 0
  while (pos < data.length) {
    const len = data.readUInt32BE(pos); pos += 4
    const blob = data.subarray(pos, pos + len); pos += len
    if (blob.length !== len) throw new Error('Truncated media chunk')
    const iv = blob.subarray(0, 12)
    const tag = blob.subarray(blob.length - 16)
    const ct = blob.subarray(12, blob.length - 16)
    const decipher = createDecipheriv('aes-256-gcm', key, iv)
    decipher.setAAD(be32(index))
    decipher.setAuthTag(tag)
    out.push(Buffer.concat([decipher.update(ct), decipher.final()]))
    index++
  }
  return Buffer.concat(out)
}
```

- [ ] **Step 4: Run — expect PASS.** **Step 5:** one-time interop check vs an iOS-encrypted file if available. **Step 6:** commit `Add mediaCipher (LLM1 chunked, iOS interop)`.

---

## Task 4: keyService.ts (wrap/unwrap, getOrCreateDEK, shred)

**Files:** `server/src/crypto/keyService.ts`, `server/src/crypto/keyService.test.ts`

The DEK is wrapped with `MASTER_KEY` using AES-256-GCM and stored at `users/{uid}.wrappedDEK` as `{ v, iv, ct, tag }` (base64). `keyVersion` records the master generation. Generation is idempotent under a Firestore transaction so concurrent first-use (client bootstrap racing a server op) can't mint two DEKs.

- [ ] **Step 1: Unit-test the pure wrap/unwrap** (the Firestore parts are integration-tested manually). `keyService.test.ts`:
```ts
import { describe, it, expect } from 'vitest'
import { randomBytes } from 'crypto'
import { wrapDEK, unwrapDEK } from './keyService'

describe('keyService wrap', () => {
  const master = randomBytes(32)
  it('wrap/unwrap round-trips a 32B DEK', () => {
    const dek = randomBytes(32)
    const wrapped = wrapDEK(master, dek)
    expect(unwrapDEK(master, wrapped).equals(dek)).toBe(true)
  })
  it('wrong master fails closed', () => {
    const wrapped = wrapDEK(master, randomBytes(32))
    expect(() => unwrapDEK(randomBytes(32), wrapped)).toThrow()
  })
})
```

- [ ] **Step 2: Run — expect FAIL.**

- [ ] **Step 3: Implement** `src/crypto/keyService.ts`:
```ts
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'
import admin from 'firebase-admin'
import { db } from '../middleware/firebaseAuth'
import { config } from '../config'

export interface WrappedDEK { v: number; iv: string; ct: string; tag: string }

const master = Buffer.from(config.MASTER_KEY, 'base64')
const cache = new Map<string, { dek: Buffer; expires: number }>()
const CACHE_MS = 5 * 60 * 1000

export function wrapDEK(masterKey: Buffer, dek: Buffer): WrappedDEK {
  const iv = randomBytes(12)
  const c = createCipheriv('aes-256-gcm', masterKey, iv)
  const ct = Buffer.concat([c.update(dek), c.final()])
  return { v: 1, iv: iv.toString('base64'), ct: ct.toString('base64'), tag: c.getAuthTag().toString('base64') }
}

export function unwrapDEK(masterKey: Buffer, w: WrappedDEK): Buffer {
  const d = createDecipheriv('aes-256-gcm', masterKey, Buffer.from(w.iv, 'base64'))
  d.setAuthTag(Buffer.from(w.tag, 'base64'))
  return Buffer.concat([d.update(Buffer.from(w.ct, 'base64')), d.final()])
}

/** Idempotently fetch-or-mint the user's DEK. Server is the sole generator. */
export async function getOrCreateDEK(uid: string): Promise<Buffer> {
  const hit = cache.get(uid)
  if (hit && hit.expires > Date.now()) return hit.dek

  const ref = db.collection('users').doc(uid)
  const dek = await db.runTransaction(async tx => {
    const snap = await tx.get(ref)
    const existing = snap.get('wrappedDEK') as WrappedDEK | undefined
    if (existing) return unwrapDEK(master, existing)
    const fresh = randomBytes(32)
    tx.set(ref, { wrappedDEK: wrapDEK(master, fresh), keyVersion: 1 }, { merge: true })
    return fresh
  })
  cache.set(uid, { dek, expires: Date.now() + CACHE_MS })
  return dek
}

/** Crypto-shred: destroy the wrapped DEK so all ciphertext becomes unreadable. */
export async function cryptoShredUser(uid: string): Promise<void> {
  cache.delete(uid)
  await db.collection('users').doc(uid).update({
    wrappedDEK: admin.firestore.FieldValue.delete(),
  })
}
```

- [ ] **Step 4: Run — expect PASS.** **Step 5:** commit `Add keyService (env-master wrap/unwrap, getOrCreateDEK, shred)`.

---

## Task 5: /v1/keys/bootstrap route

**Files:** `server/src/routes/keys.ts`, `server/src/index.ts`

- [ ] **Step 1: Implement** `src/routes/keys.ts`:
```ts
import { Router, Request, Response } from 'express'
import { firebaseAuth } from '../middleware/firebaseAuth'
import { getOrCreateDEK } from '../crypto/keyService'

export const keysRouter = Router()

keysRouter.post('/bootstrap', firebaseAuth, async (req: Request, res: Response) => {
  const uid = (req as any).uid as string
  try {
    const dek = await getOrCreateDEK(uid)
    res.json({ dek: dek.toString('base64') })
  } catch (err) {
    console.error('[keys/bootstrap]', err)
    res.status(500).json({ error: 'Key bootstrap failed' })
  }
})
```

- [ ] **Step 2: Mount it.** In `src/index.ts` add `import { keysRouter } from './routes/keys'` and `app.use('/v1/keys', keysRouter)`.

- [ ] **Step 3: Verify** `npm run build` succeeds. Manual smoke test in Task 9.

- [ ] **Step 4: Commit** `Add POST /v1/keys/bootstrap`.

---

## Task 6: Decrypt journal reads (ai.ts, rag.ts) + encrypt content write-back

**Files:** `server/src/routes/ai.ts`, `server/src/routes/rag.ts`

These routes read `data.content` / `data.title` as plaintext today; those are now envelopes. Decrypt them with the user's DEK after reading; encrypt anything written back.

- [ ] **Step 1: ai.ts — decrypt in `fetchJournal`.** Import `getOrCreateDEK` and `openField`. Change `fetchJournal` to also return the DEK, and have callers decrypt:
```ts
import { getOrCreateDEK } from '../crypto/keyService'
import { openField, encryptField } from '../crypto/fieldCipher'

async function fetchJournal(journalId: string, uid: string) {
  const snap = await db.collection('journals').doc(journalId).get()
  if (!snap.exists) throw Object.assign(new Error('Not found'), { status: 404 })
  const data = snap.data()!
  if (data.userId !== uid) throw Object.assign(new Error('Forbidden'), { status: 403 })
  const dek = await getOrCreateDEK(uid)
  return {
    ...data,
    content: openField(dek, data.content, 'journals.content'),
    title: openField(dek, data.title, 'journals.title'),
  }
}
```
The `/summary`, `/insights`, `/prompts` handlers already use `data.content` — now plaintext again. They return text to the client (which persists encrypted on iOS); **no server write needed** there.

- [ ] **Step 2: ai.ts — `/daily-prompt` decrypt each entry.** That handler reads `data.content`/`data.title` from multiple docs. After fetching `snap`, get `const dek = await getOrCreateDEK(uid)` and inside the `.map`, replace `data.content`/`data.title` with `openField(dek, data.content, 'journals.content')` and `openField(dek, data.title, 'journals.title')`.

- [ ] **Step 3: ai.ts — `/transcribe`.** This is the big one. The audio in S3 is **encrypted** (iOS `MediaCipher`). After `streamToBuffer`, decrypt before Whisper; encrypt `content` before write-back; pass plaintext to the indexer (Task 8 encrypts inside Chroma):
```ts
import { decryptMedia } from '../crypto/mediaCipher'
// ...
const dek = await getOrCreateDEK(uid)
const audioCiphertext = await streamToBuffer(s3Res.Body as any)
const audioBuffer = decryptMedia(dek, audioCiphertext)       // ← decrypt S3 media
const transcript = await transcribeAudio(audioBuffer, filename)

const existingContent = openField(dek, data.content, 'journals.content').trim()  // ← decrypt prior content
const newContent = [existingContent, transcript].filter(Boolean).join('\n\n')

await db.collection('journals').doc(journalId).update({
  content: encryptField(dek, newContent, 'journals.content'),  // ← re-encrypt
  transcriptStatus: 'ready',
  updatedAt: admin.firestore.FieldValue.serverTimestamp(),
})
// indexJournalEntry receives PLAINTEXT content/title + dek (see Task 8)
const indexResult = await indexJournalEntry({
  userId: uid, entryId: journalId, content: newContent,
  title: openField(dek, data.title, 'journals.title'),
  type: data.type ?? 'voice', updatedAt: new Date().toISOString(), dek,
})
```

- [ ] **Step 4: rag.ts — decrypt before indexing.** In `/index`, after the `data.userId` check:
```ts
import { getOrCreateDEK } from '../crypto/keyService'
import { openField } from '../crypto/fieldCipher'
// ...
const dek = await getOrCreateDEK(uid)
const content = openField(dek, data.content, 'journals.content')
if (!content.trim()) { res.json({ indexed: false, chunks: 0, reason: 'empty_content' }); return }
const result = await indexJournalEntry({
  userId: uid, entryId: journalId, content,
  title: openField(dek, data.title, 'journals.title'),
  type: data.type ?? 'text',
  updatedAt: (data.updatedAt as admin.firestore.Timestamp)?.toDate().toISOString() ?? new Date().toISOString(),
  dek,
})
```

- [ ] **Step 5: Build** (`npm run build`) — expect type error at `indexJournalEntry` until Task 8 adds `dek`. Do Tasks 7–8 then build together. **Step 6:** commit after Task 8.

---

## Task 7: Decrypt chat reads + encrypt message writes (chat.ts)

**Files:** `server/src/routes/chat.ts`

- [ ] **Step 1: Decrypt bio + history; encrypt both message writes.**
```ts
import { getOrCreateDEK } from '../crypto/keyService'
import { openField, encryptField } from '../crypto/fieldCipher'
// after uid + validation:
const dek = await getOrCreateDEK(uid)

const userSnap = await db.collection('users').doc(uid).get()
const bio = openField(dek, userSnap.data()?.biography, 'users.biography')

const msgsSnap = await db.collection('chats').doc(chatId).collection('messages')
  .orderBy('createdAt', 'desc').limit(10).get()
const history = msgsSnap.docs.reverse().map(d => ({
  role: d.data().role as string,
  content: openField(dek, d.data().text, 'messages.text'),   // ← decrypt
}))
```
Encrypt the user message write:
```ts
await userMsgRef.set({
  role: 'user',
  text: encryptField(dek, message, 'messages.text'),         // ← encrypt
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
})
```
Encrypt the assistant message write:
```ts
await assistantMsgRef.set({
  role: 'assistant',
  text: encryptField(dek, fullReply, 'messages.text'),       // ← encrypt
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
})
```
The SSE `delta` stream to the client stays plaintext (TLS) — unchanged. `retrieveContext` now returns decrypted text (Task 8).

- [ ] **Step 2:** build with Task 8. **Step 3:** commit after Task 8.

---

## Task 8: Encrypt Chroma chunk text (indexer + retriever)

**Files:** `server/src/services/journalIndexer.ts`, `server/src/services/journalRetriever.ts`

Per design §6: **embeddings are computed from plaintext** (so similarity search works) but the **stored chunk text and title are encrypted**. Vectors stay plaintext. The retriever decrypts what it reads back.

- [ ] **Step 1: indexer — accept `dek`, encrypt stored documents + title.**
```ts
import { encryptField } from '../crypto/fieldCipher'
// signature gains `dek: Buffer`
export async function indexJournalEntry(params: {
  userId: string; entryId: string; content: string; title: string
  type: string; updatedAt: string; dek: Buffer
}): Promise<{ chunks: number }> {
  const { userId, entryId, content, title, type, updatedAt, dek } = params
  // ...
  const chunks = chunk(content)
  if (chunks.length === 0) return { chunks: 0 }
  const embeddings = await embed(chunks)                       // ← PLAINTEXT chunks → vectors
  const encTitle = JSON.stringify(encryptField(dek, title, 'journals.title'))
  await col.add({
    ids: chunks.map((_, i) => `${userId}_${entryId}_chunk_${i}`),
    embeddings,                                                 // ← vectors stay plaintext
    documents: chunks.map((c, i) =>
      JSON.stringify(encryptField(dek, c, `rag.chunk.${i}`))),  // ← encrypted text payloads
    metadatas: chunks.map((_, i) => ({
      userId, entryId, title: encTitle, type, chunkIndex: i,
      totalChunks: chunks.length, indexedAt: updatedAt,
    })),
  })
  return { chunks: chunks.length }
}
```
> Note: Chroma `documents` must be strings, so the envelope is JSON-stringified. `rag.chunk.<i>` is a server-internal AAD (Chroma is server-only; no iOS interop needed for chunk text).

- [ ] **Step 2: retriever — accept `dek`, decrypt documents + title.**
```ts
import { decryptField } from '../crypto/fieldCipher'
export async function retrieveContext(uid: string, query: string, dek: Buffer): Promise<string> {
  // ... unchanged query ...
  return docs.map((doc, i) => {
    const m = metas[i] as Record<string, unknown>
    const text = decryptField(dek, JSON.parse(doc as string), `rag.chunk.${m.chunkIndex}`)
    const title = m.title ? decryptField(dek, JSON.parse(m.title as string), 'journals.title') : ''
    const date = (m.indexedAt as string | undefined)?.slice(0, 10) ?? ''
    return `[#${i + 1} — ${m.type} · ${title} · ${date}]\n${text}`
  }).join('\n\n')
}
```

- [ ] **Step 3: Update caller.** In `chat.ts`, change `retrieveContext(uid, ragQuery)` → `retrieveContext(uid, ragQuery, dek)`.

- [ ] **Step 4: Build** `npm run build` — now Tasks 6–8 compile together. Fix any residual type errors. **Step 5:** commit `Encrypt journal/chat/RAG content server-side end to end`.

> **Migration note:** existing plaintext Chroma chunks (if any) won't `JSON.parse` as envelopes. Since the project is pre-launch (design §9), wipe the `journals` Chroma collection once before first encrypted index, or add a try/catch in the retriever that skips non-envelope docs during a transition.

---

## Task 9: Verification

- [ ] **Step 1:** `npm test` — all crypto unit tests pass.
- [ ] **Step 2:** `npm run build` — clean compile.
- [ ] **Step 3: End-to-end smoke (against a dev Firestore + Chroma):**
  - `POST /v1/keys/bootstrap` with a valid Firebase token → returns a 44-char base64 `dek`; `users/{uid}.wrappedDEK` now exists.
  - Create an entry from the iOS app (writes encrypted `content`). Call `POST /v1/ai/summary` → returns a coherent summary (proves the server decrypted the iOS-written ciphertext = **interop confirmed**).
  - Send a chat message → assistant reply streams; inspect `chats/{id}/messages` in Firestore and confirm `text` fields are `{v,alg,iv,ct,tag}` envelopes, not plaintext.
  - Record a voice entry whose on-device transcription fails → `POST /v1/ai/transcribe` → entry `content` becomes a re-encrypted envelope and `transcriptStatus: ready` (proves S3 media decrypt + re-encrypt).
- [ ] **Step 4: Negative check:** read any `journals`/`messages`/`users` doc directly in the Firestore console — no readable content in any in-scope field.

---

## Task 10 (optional hardening, per design §6 & §8)

- [ ] **Per-user Chroma collections.** Replace the single `journals` collection + `userId` metadata filter with one collection per user (e.g. `journals_<uid>`), so a Chroma breach can't even correlate across users. Update `db/chroma.ts` to `getOrCreateCollection({ name: 'journals_' + uid })`, thread `uid` through indexer/retriever/purge, and drop the `where userId` filters.
- [ ] **Account-deletion endpoint.** `DELETE /v1/account` → delete the user's journals/chats/Chroma/S3, then `cryptoShredUser(uid)` so any residue is permanently unreadable.

---

## Self-Review

**Spec coverage:** §2 boundary A (server holds master key, mints/unwraps DEK) → Tasks 1,4,5. §3 envelope/wrap → Tasks 2,4. §4 AES-256-GCM + AAD → Task 2 (+ interop table). §5.1 encrypt scope → Tasks 6,7,8 (content/title/summary-insights-prompts inputs, chat text, biography, dailyPrompt input, media, chunk text). §5.2 plaintext → untouched (userId/timestamps/type/flags/s3Key). §6 RAG (plaintext vectors, encrypted chunk text, per-user) → Task 8 (+ Task 10 collections). §7 media chunked → Tasks 3,6. §8 lifecycle/shred → Task 4 (`cryptoShredUser`), Task 10 endpoint. §9 pre-launch → migration note in Task 8.

**Interop:** envelope shape, AAD contexts, `LLM1` media format, and `/v1/keys/bootstrap` response all pinned to the iOS client in the Interop section and exercised by the Task 9 smoke test (server decrypts iOS-written ciphertext).

**Placeholder scan:** none — every step shows concrete code or an exact edit.

**Type consistency:** `encryptField`/`decryptField`/`openField`/`isEncryptedField`, `EncryptedField {v,alg,iv,ct,tag}`, `encryptMedia`/`decryptMedia`, `wrapDEK`/`unwrapDEK`/`getOrCreateDEK`/`cryptoShredUser`, and `indexJournalEntry(... dek)` / `retrieveContext(uid, query, dek)` are consistent across tasks.
