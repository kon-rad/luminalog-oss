# Per-User Data Encryption — Design

**Date:** 2026-06-15
**Status:** Approved for planning
**Scope:** Encrypt all user-generated text content and media at rest, with a per-user key, across Firestore, S3, and Chroma.

---

## 1. Goal

Store every piece of user content — journal entries, transcriptions of image/video/voice entries, AI-generated summaries/insights/prompts, chat messages, and media bytes — in encrypted form. Each user has their own encryption key. Content is decrypted only at three points:

1. When used by the AI in a prompt (proxy, transient RAM).
2. When converted into embeddings (proxy, transient RAM).
3. When displayed in the iOS UI (device).

Content is encrypted before it is stored or updated in Firebase (and before upload to S3).

## 2. Trust Boundary (the defining decision)

**Boundary A — server-accessible per-user keys (envelope encryption).** The trust boundary is LuminaLog's own infrastructure. Data is ciphertext everywhere at rest; the proxy can decrypt just-in-time to perform AI work and never persists plaintext.

- **Protects against:** Firestore/S3 breach, a stolen database dump, Google/AWS sub-processor access, casual insider browsing the database.
- **Does NOT protect against:** a fully compromised proxy or an insider abusing the master key while serving a request. (This is the explicit, accepted limit of boundary A — true zero-knowledge was rejected because AI summaries, RAG embeddings, chat-with-context, and server-side transcription all run server-side and call an external LLM.)

This is encryption-at-rest with per-user keys, **not** zero-knowledge E2E.

## 3. Key Architecture

Three-layer envelope encryption:

```
① Master Key (256-bit)  — lives in the PROXY ENVIRONMENT secret store. Never in Firestore. Never sent to a client.
        │  wraps / unwraps
        ▼
② Per-user Data Key (DEK, 256-bit AES) — one per user, random at signup.
        Stored ONLY wrapped, as users/{uid}.wrappedDEK (ciphertext).
        Unwrapped to plaintext transiently: in proxy RAM, or in the iOS Keychain.
        │  encrypts / decrypts each field
        ▼
③ Field ciphertext (AES-256-GCM) — per field, stored as a small envelope struct.
```

### 3.1 Master key (Option B — env-based, no new service)

- A single application-wide 256-bit master key held in the proxy's environment / host secret store (e.g. Cloud Run / Render / Fly env secrets). **Not** in Firestore, **not** in the app bundle.
- Wraps each user's DEK using AES-256-GCM key-wrap.
- **Cost:** $0, no new vendor.
- **Upgrade path:** the wrap/unwrap operations live behind one small interface (`KeyWrapper` with `wrap(dek)` / `unwrap(blob)`). Swapping the env master key for GCP Cloud KMS later changes only those two functions — the stored `wrappedDEK` and all field ciphertext formats are unchanged, so no data migration is required to upgrade.

### 3.2 Per-user DEK

- Generated once on first sign-in, when the user document is seeded (`ensureUserDocument`).
- Stored wrapped at `users/{uid}.wrappedDEK` alongside a `keyVersion` integer.
- Recoverable: because the master key is server-held, the DEK can always be re-derived/unwrapped server-side. **No user passphrase, no risk of permanent lockout, no data loss on device loss.**

### 3.3 How each side obtains the DEK

**iOS client (once per device):**
1. Sign in (Firebase) → call proxy `POST /v1/keys/bootstrap` with the Firebase ID token.
2. Proxy reads `wrappedDEK`, unwraps via the master key, returns the raw DEK over TLS (the one moment the DEK transits the network).
3. App stores the DEK in the **iOS Keychain** (`kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly`).
4. Thereafter the app encrypts before writing to Firestore and decrypts after reading — locally. **Direct Firestore snapshot listeners and offline support are preserved.**

**Proxy (per request):**
1. Read `wrappedDEK` from Firestore, unwrap via master key (with an optional short in-memory cache to cut overhead).
2. Decrypt only the needed fields in RAM, do the AI/embedding/transcription work.
3. Re-encrypt any output before writing back. Plaintext never persisted.

## 4. Field-Level Encryption Format

In-scope string fields are stored as a versioned envelope map (not a bare string), so format/algorithm/key can evolve:

```
{ "v": 1, "alg": "A256GCM", "iv": <12-byte base64>, "ct": <base64>, "tag": <16-byte base64> }
```

- **Cipher:** AES-256-GCM via CryptoKit (`AES.GCM`) on the client and the equivalent on the proxy.
- **AAD (additional authenticated data):** bind each ciphertext to its context — `userId | collection | fieldName` — so ciphertext cannot be copied between fields/users without failing authentication.
- **Nonce:** fresh random 96-bit IV per encryption.
- Arrays of strings (e.g. `prompts.items`) encrypt each element (or the JSON-encoded array as one blob — chosen per field in the plan).

## 5. Encryption Scope

### 5.1 Encrypt (AES-256-GCM with the user DEK)

| Model | Fields |
|---|---|
| JournalEntry | `content`, `title`, `summary.text`, `insights.text`, `prompts.items` |
| Chat / ChatMessage | `message.text` (user + assistant), `message.sources[].snippet`, `chat.title` |
| UserProfile | `biography`, `dailyPrompt` |
| Media (S3) | file **bytes** (audio / photo / video) |
| Chroma | stored chunk **text** payloads |

### 5.2 Stay plaintext (queries, routing, flags, pointers)

- Query/sort keys: `userId`, `createdAt`, `updatedAt`, `lastMessageAt`, `contentEditedAt`, `type`, `kind`.
- Flags/derived numbers: `transcriptStatus`, `vector` state, `wordCount`, `stats`, `model`, `generatedAt`.
- Pointers/metadata: `media.s3Key`, media dimensions/duration/kind, `vapiCallId`.
- Keys: `wrappedDEK`, `keyVersion`.
- Profile PII: `email`, `displayName`, `photoURL` (used for display/support — explicitly left plaintext).

**Accepted leak:** keeping `wordCount` plaintext while encrypting `content` leaks the approximate *length* of an entry, not its text. Accepted.

## 6. RAG / Embeddings (the special case)

Vectors cannot be AES-encrypted and remain searchable (encryption destroys the geometry similarity search relies on). Therefore:

- **Chroma is self-hosted inside LuminaLog's infrastructure** (same trust boundary as the proxy).
- **Vectors are stored plaintext** so similarity search works. They are inside the boundary — no worse than the proxy briefly holding plaintext.
- **Chunk text payloads are encrypted** with the user DEK. A Chroma breach yields raw vectors (partially invertible) but **no readable journal text**.
- **Per-user isolation:** each user's vectors live in their own Chroma collection/namespace.

**Indexing flow:** proxy decrypts `content` in RAM → chunk → send chunk text to the embedding model (transient plaintext, = the "converted to embeddings" decrypt point) → store `{ vector: plaintext, chunkText: encrypted }`.

**Chat flow:** embed query → similarity search over plaintext vectors → decrypt top-k chunk texts → feed to LLM → stream reply → re-encrypt before writing the assistant `ChatMessage`.

## 7. Media (S3)

- **Upload:** client encrypts the file with the DEK and streams *ciphertext* to S3 via the existing presigned PUT. S3 stores `application/octet-stream`; the real content type lives in the plaintext `MediaItem` metadata.
- **View:** client downloads ciphertext via presigned GET and decrypts locally with the Keychain DEK.
- **Server transcription:** proxy downloads ciphertext → unwraps DEK → decrypts audio in RAM → Whisper → writes back encrypted `content` + updated `transcriptStatus`.
- **Large files:** video/audio are encrypted in **chunked AES-GCM segments** (each segment its own nonce) so the client keeps streaming from disk without loading the whole file into memory. A small header records segment size and count.
- Images are OCR'd on-device (Vision) *before* upload, so the proxy never needs to read image bytes; audio is the only media the proxy decrypts.

## 8. Key Lifecycle

- **Multi-device / new phone:** sign in → re-fetch DEK via `/v1/keys/bootstrap` → cache in Keychain.
- **Lost device / recovery:** DEK is server-recoverable; no data loss, no passphrase.
- **Master-key rotation:** re-wrap every user's `wrappedDEK` with the new master key (fast; no field re-encryption). `keyVersion` tracks which master generation wrapped each DEK.
- **Per-user DEK rotation:** supported but expensive (re-encrypt that user's data); reserved for suspected key compromise, not routine.
- **Account deletion:** destroy the `wrappedDEK` (crypto-shred) in addition to deleting rows — all of that user's ciphertext across Firestore/S3/Chroma becomes permanently unreadable.

## 9. Existing Data

**Pre-launch.** No production data to preserve. Encryption ships from day one; any test rows are wiped. **No backfill migration, no dual-read transition logic.**

## 10. Components to Build

### 10.1 iOS client

- **`FieldCipher`** — AES-256-GCM encrypt/decrypt of the envelope struct (Section 4) using a DEK, with AAD. Pure, unit-testable.
- **`UserKeyStore`** — fetch DEK from `/v1/keys/bootstrap` on first sign-in; persist/load from Keychain; vend the DEK to repositories; clear on sign-out.
- **`FirestoreMapping` changes** — encrypt in-scope fields on write, decrypt on read, in the existing mapping layer. Reads of malformed/again-plaintext data fail closed (surface an error rather than silently showing ciphertext).
- **`ProxyMediaUploader` changes** — encrypt bytes before presigned PUT (chunked AEAD for large files); decrypt after presigned GET.
- **Networking** — add the `/v1/keys/bootstrap` call to the proxy client.

### 10.2 Proxy (backend — described here, implemented in the backend repo)

- **`KeyWrapper`** — `wrap(dek)` / `unwrap(blob)` against the env master key; the single swappable seam for a future KMS upgrade.
- **`UserKeyService`** — generate DEK at signup, store wrapped; unwrap per request with short in-memory cache.
- **`POST /v1/keys/bootstrap`** — authenticated endpoint returning the raw DEK to the device over TLS.
- **Crypto-aware read/write** — every proxy path that reads or writes in-scope fields decrypts after read / encrypts before write (AI summary/insights/prompts, daily-prompt, chat assistant replies, transcription).
- **RAG** — store encrypted chunk text + plaintext vectors in per-user Chroma collections; decrypt chunk text on retrieval.

## 11. Testing

- **`FieldCipher`** round-trip unit tests; AAD-mismatch and tampered-tag tests must fail closed; cross-user/cross-field ciphertext rejection.
- **`UserKeyStore`** — bootstrap fetch, Keychain persistence, sign-out clears key.
- **Repository round-trips** — write entry/chat/profile → confirm Firestore holds envelope structs (not plaintext) → read back → confirm decrypted equality.
- **Media** — encrypt → upload → download → decrypt byte-equality; chunked path for a large file.
- **Negative** — a raw Firestore document read out-of-band shows no readable content in any in-scope field.

## 12. Out of Scope

- Zero-knowledge / client-only keys.
- Searchable/homomorphic encryption of vectors.
- Encrypting profile PII (`email`/`displayName`/`photoURL`).
- Backfill migration (pre-launch).
- GCP KMS integration (designed for, deferred; swappable via `KeyWrapper`).
