# Argo for Android: Feature Inventory and Architecture Plan

**Status:** Planning. No Android code exists yet. This document is the design
input for it.
**Written:** 2026-08-27.
**Audience:** whoever builds the Android client.

Argo already has **two** shipping clients against one backend: the SwiftUI iOS
app (`ios/`) and the Next.js web app (`web/`). Both speak the same Firestore
schema, the same zero-knowledge encryption envelope, and the same Express API
(`server/`). Android is the **third client of an existing contract**, not a new
product. That framing decides most of the hard questions in this document: where
there is a choice between "what feels natural on Android" and "what the other two
clients already do", the existing contract wins, because a mismatch does not
degrade gracefully. It fails as an undecryptable entry.

The single most useful reference while building this is **not** the iOS app. It is
`web/src/lib/crypto/`. The web client is the existing proof that a non-Apple
platform can join this system, and it already solved the problem Android has:
there is no iCloud Keychain, so the recovery code carries the account.

---

## How to read this document

| Part | What it answers |
|---|---|
| [Part 1](#part-1-what-the-ios-app-actually-does) | What features exist on iOS today, with source references |
| [Part 2](#part-2-the-contracts-android-must-honour-exactly) | What Android must match byte for byte |
| [Part 3](#part-3-recommended-android-stack) | Language, UI, DI, storage, crypto, media libraries |
| [Part 4](#part-4-module-layout-and-ios-to-android-mapping) | Gradle modules, and the API-to-API translation table |
| [Part 5](#part-5-feature-by-feature-implementation-plan) | How each iOS feature is built on Android |
| [Part 6](#part-6-blocking-prerequisites) | Server and shared work that must land **before** Android ships |
| [Part 7](#part-7-delivery-phases) | Milestones, in dependency order |
| [Part 8](#part-8-testing-strategy) | Especially cross-client golden vectors |
| [Part 9](#part-9-risks-and-open-questions) | What could go wrong, and what still needs a decision |

---

# Part 1: What the iOS app actually does

259 Swift files across `ios/LuminaLog/`. Grouped by capability, with the source
of truth for each so an Android implementer can read the original.

## 1.1 Identity, session, and gates

The app boots through a chain of gates. Each one blocks the UI until it resolves,
and the ordering is load bearing.

| Gate | Source | Purpose |
|---|---|---|
| Onboarding | `Features/Onboarding/` | Pre-auth. Walks 18 profile fields (name, biography, and the 16 `profileDetails`), buffers answers to disk so a kill mid-flow loses nothing, captures Soul NFT consent |
| Sign-in | `Features/Auth/SignInView.swift`, `Core/Auth/FirebaseAuthService.swift` | Sign in with Apple (`ASAuthorizationController` + nonce) and Google Sign-In, both exchanged for a Firebase credential |
| `KeyGate` | `App/KeyGate.swift`, `Core/Crypto/KeyEnrollmentService.swift` | Resolves the per-user DEK. Enrolls a brand-new account, or asks for the recovery code when this device cannot unlock |
| `ConsentGate` | `App/ConsentGate.swift`, `Core/Consent/` | AI-data-sharing consent (App Store 5.1.1/5.1.2), recorded locally and mirrored to `PUT /v1/consent` |
| `PaywallGate` | `App/PaywallGate.swift` | Entitlement check against RevenueCat |

Also here: first-sign-in `users/{uid}` document seeding
(`ProfileRepository.ensureUserDocument`), merging the buffered onboarding draft
into the profile, sign out, and a two-step account deletion that purges
Firestore, S3 media, and vector state.

`KeyEnrollmentService.resolve()` is the single most important control flow in the
app and is described in full in [Part 2.3](#23-the-key-hierarchy).

## 1.2 Zero-knowledge encryption

The server holds no key and can decrypt nothing. Everything below runs on device.

| Piece | Source | What it is |
|---|---|---|
| Field envelope | `Core/Crypto/EncryptedField.swift` | `{v:1, alg:"A256GCM", iv, ct, tag}`, base64 blobs, stored in Firestore in place of the plaintext string |
| Field cipher | `Core/Crypto/FieldCipher.swift` | AES-256-GCM, 12-byte nonce, 16-byte tag, **AAD = a context string** such as `journals.title` |
| Wrapped key | `Core/Crypto/WrappedKey.swift` | `{v:1, iv, ct, tag}`, the DEK sealed under a KEK, AES-256-GCM with **no** AAD |
| Recovery code | `Core/Crypto/RecoveryCode.swift` | 256 bits, Crockford base32, grouped in fours, KEK derived via HKDF-SHA256 with a fixed salt and info |
| Media cipher | `Core/Crypto/MediaCipher.swift` | Chunked file format, `LLM1` magic, 1 MiB chunks, AAD = big-endian chunk index |
| Key store | `Core/Crypto/UserKeyStore.swift` | In-memory DEK cache, device Keychain persistence, vends the `FieldCipher` |
| iCloud KEK | `Core/Crypto/ICloudKeyProvider.swift`, `SyncedKeychainStore.swift` | Reads a random 32-byte KEK from the iCloud Keychain, fetches the wraps, unwraps the DEK |
| Enroller | `Core/Crypto/ClientKeyEnroller.swift` | Mints a DEK, uploads both wraps, **verifies the round trip**, and only then installs |
| Transport | `Core/Crypto/KeyMigrationTransport.swift` | `PUT`/`GET /v1/keys/wrapped`, `POST /v1/keys/finalize-migration` |

## 1.3 Journaling core

**Create entry** (`Features/CreateEntry/`, `Core/Media/`) is by far the largest
subsystem. It covers four entry types (text, voice, video, image) through one
composer:

- Rich text editor with an attachment tray (`CreateEntryView`, `AttachmentSet`).
- Live dictation into the editor via Apple Speech (`Core/Speech/`).
- Camera photo and video capture, plus a multi-photo burst mode
  (`CameraPicker`, `MultiPhotoCameraView`, `PhotoCaptureBuffer`).
- Photo library import.
- Segmented audio recording that survives interruptions and crashes:
  each segment is written to disk as it records, a manifest lives on the draft,
  and segments are merged into one `.m4a` on stop
  (`SegmentRecorder`, `RecordingSession`, `RecordingMerger`, `RecordingInventory`).
- On-device OCR over images (`Core/OCR/VisionOCRService.swift`), whose text
  becomes the entry's canonical `content`.
- Durable drafts (`Core/Persistence/DraftStore.swift`): one JSON file plus a media
  folder per draft, resumable from Home, swept on launch.

**Background processing** (`Core/Media/EntryProcessor.swift` and friends) is what
lets the composer dismiss instantly. The entry is written to Firestore straight
away and then walks a `processingStatus` state machine
(`processing → uploading → saving → transcribing → ready | failed`) while:

- media is encrypted to a temp ciphertext file and PUT to a presigned S3 URL over
  a background `URLSession` (`MediaUploader`, `ProxyMediaUploader`, `UploadManager`,
  `BackgroundUploadTransport`);
- a durable `UploadJournal` records every in-flight upload so a relaunch can
  finalize or retry;
- video is transcoded (`VideoTranscoder`);
- audio is prepared, chunked, and sent for server transcription
  (`AudioChunkPlanner`, `AudioTranscriptionPreparer`);
- summary, insights, and prompts are generated and persisted client-encrypted
  (`EntryAIGenerator`, `EntryFinalizer`);
- a launch sweep marks stranded entries failed (`sweepStuckEntries`) and
  re-transcribes degenerate transcripts (`TranscriptBackfiller`,
  `TranscriptRecoverer`, `TranscriptPlausibility`).

**Reading and editing**:

- Journal list (`Features/JournalList/`): search, type filter chips, date-grouped
  sections, filter-aware infinite scroll, load-failure retry.
- Journal detail (`Features/JournalDetail/`): five tabs, `Main`, `Map`, `Insights`,
  `Prompts`, `Related`; media viewers; audio playback with scrubbing; image zoom;
  entry edit with an edit-history trail; a transcript editor that can re-record;
  per-entry options including "exclude from share" and delete.
- Deletion purges Firestore locally plus S3 objects, RAG chunks, and the summary
  embedding server-side (`AIService.deleteEntry`).

## 1.4 AI features

Every one of these runs on the **Model 1** path: the client decrypts its own
context on device and posts **plaintext** to the server, which calls the model and
persists nothing. Request shapes are pinned in `Core/Networking/Model1Requests.swift`.

| Feature | Endpoint | Client source |
|---|---|---|
| Entry summary, insights, prompts | `POST /v1/ai/entry-ai` | `ProxyAIService.generateEntryAI` |
| Per-entry cognitive map | `POST /v1/ai/entry-map`, poll `GET /v1/ai/entry-map/:jobId` | `Features/CognitiveMap/` |
| Daily prompts, five per day | `POST /v1/ai/daily-prompt` | `Features/Home/DailyPromptCarousel.swift` |
| Daily insights report | `POST /v1/ai/daily-report` | `Features/Home/DailyInsightsReportView.swift` |
| Daily encouragements | `POST /v1/ai/daily-encouragements` | `Core/Notifications/EncouragementCoordinator.swift` |
| Streaming text chat | `POST /v1/ai/chat` (SSE) | `Features/Chats/ChatViewModel.swift` |
| Voice call | `POST /v1/vapi/call-config`, Vapi SDK | `Core/Voice/VapiVoiceCallService.swift` |
| Keyword search | `POST /v1/rag/search/keyword` | `Features/Search/` |
| Semantic search | `POST /v1/rag/search/semantic` | `Features/Search/` |
| Related entries | `POST /v1/rag/related` | `Features/JournalDetail/RelatedViewModel.swift` |
| Whole-corpus graph | `POST /v1/rag/graph` | `Features/Constellation/` |
| Chunk indexing | `PUT /v1/rag/index`, `DELETE /v1/rag/:entryId` | `Core/Vectors/ServerSemanticIndex.swift` |
| Clip transcription | `POST /v1/ai/transcribe-clip` (raw bytes) | `ProxyAIService.transcribeClip` |
| Entry transcription | `POST /v1/ai/transcribe` | `ProxyAIService.transcribeJournal` |

Chunking happens **on the client** (`Core/Vectors/JournalChunker.swift`) and is
deterministic, because the same function must reproduce `chunk[chunkIndex]` at
retrieval time. There is no on-device embedding model. There are no vectors on
the client.

## 1.5 Growth, gamification, and identity surfaces

- **Daily goal and streak**: a word target per day, a goal-gated streak, a
  lifetime word odometer, and a self-healing reconciler that recomputes today's
  total from today's entries rather than trusting an increment
  (`Core/Persistence/DailyGoalReconciler.swift`, `DailyGoalStreak.swift`,
  `StreakCalculator.swift`).
- **Milestones**: interruption-aware celebration popups
  (`Features/Home/MilestoneCoordinator.swift`, `App/AppActivityMonitor.swift`).
- **Insights dashboard** (`Features/Insights/`): word cloud with a custom layout
  engine, emotion trend chart, activity heatmap, entry-type donut, all computed
  locally from decrypted entries.
- **Leaderboard** (`Features/Leaderboard/`): `GET /v1/leaderboards`, streak and
  word boards.
- **Soul** (`Features/Soul/`): a 3D constellation of qualifying journaling days, a
  Base-chain wallet, and a soulbound NFT. `GET /v1/soul`,
  `PUT /v1/soul/constellation`.
- **Constellation** (`Features/Constellation/`): the whole-corpus similarity graph,
  rendered in 3D.
- **Credits** (`Features/Credits/`, `Core/Credits/`): voice-call minutes as
  consumable IAP, metered per minute during a call.
- **Subscription** (`Features/Profile/PaywallView.swift`, `Core/Subscriptions/`):
  RevenueCat offerings, purchase, restore, offer-code redemption, manage-subscription.

## 1.6 Platform and system integration

- **Local notifications**: smart daily reminders across multiple configurable
  slots (`Core/Notifications/Reminder*`), plus three AI encouragement notifications
  a day drawn from the week's entries (`Encouragement*`).
- **Background refresh**: a `BGAppRefreshTask` at 5 AM local generates the day's
  encouragements, with a scene-active catch-up because iOS may never run the task
  (see ADR-0135).
- **Theme**: warm paper and ink palettes, light, dark, and system
  (`Shared/Theme.swift`, `Shared/ThemeMode.swift`). Tokens mirror the web app's
  `core.jsx`.
- **Analytics**: PostHog, routed through the server's `/v1/ph` reverse proxy, with
  autocapture, screen views, element interactions, and session replay all forced
  **off**. A test fails the build if a second file imports PostHog
  (`Core/Analytics/Analytics.swift`).
- **Sharing**: report-card share to Instagram Stories, X, LinkedIn, Facebook, plus
  save-to-photos (`Shared/Services/`).
- **Three WebView-hosted visualizations**: cognitive map, journal constellation,
  Soul galaxy. All three load bundled JS from the app bundle and are injected with
  JSON (`Features/CognitiveMap/CognitiveMapWebView.swift`,
  `Features/Constellation/GraphWebView.swift`,
  `Features/Soul/SoulGalaxyWebView.swift`). The cognitive-map renderer is the
  shared `packages/cognitive-map` bundle, synced into iOS and web from one source.

---

# Part 2: The contracts Android must honour exactly

This part is the reason the Android app cannot be designed from the UI down. Get
any of it wrong and the symptom is silent: an entry that will not open.

## 2.1 The field-encryption envelope

Firestore stores, in place of every sensitive string, a map:

```json
{ "v": 1, "alg": "A256GCM", "iv": "<base64, 12 bytes>", "ct": "<base64>", "tag": "<base64, 16 bytes>" }
```

- Algorithm: AES-256-GCM.
- Nonce: 12 random bytes per encryption. Never reused.
- Tag: 16 bytes, stored **separately** from the ciphertext. Note that the JCA
  `Cipher` in GCM mode returns tag-appended output, so Android must split it.
- AAD: the UTF-8 bytes of a **context string** (see next section).
- Parsing is fail-closed: anything that is not a well-formed v1 envelope, a bare
  plaintext string included, must be rejected rather than displayed.

Reference implementations: `ios/LuminaLog/Core/Crypto/EncryptedField.swift` and
`web/src/lib/crypto/envelope.ts`.

## 2.2 AAD context strings

The context string is bound as additional authenticated data so a ciphertext
cannot be moved between fields under the same key. **These are byte-exact.** The
authoritative list already exists as a single file on web:
`web/src/lib/crypto/aad.ts`. Android should port that file verbatim.

| Document | Field | AAD context |
|---|---|---|
| `journals/{id}` | `title` | `journals.title` |
| `journals/{id}` | `content` | `journals.content` |
| `journals/{id}` | `summary.text` | `journals.summary.text` |
| `journals/{id}` | `insights.text` | `journals.insights.text` |
| `journals/{id}` | `prompts.items[i]` | `journals.prompts.items.{i}` |
| `journals/{id}` | `cognitiveMap.data` | `journals.cognitiveMap.data` |
| `users/{uid}` | `biography` | `users.biography` |
| `users/{uid}` | `profileDetails.{key}` | `users.profileDetails.{key}` |
| `users/{uid}` | `dailyPrompt.text` | `users.dailyPrompt.text` |
| `users/{uid}` | `dailyPrompt.prompts[].text` | `users.dailyPrompt.prompts.text` |
| `chats/{id}` | `title` | `chats.title` |
| `chats/{id}` | `rawTranscript` | `chats.rawTranscript` |
| `chats/{id}/messages/{id}` | `text` | `messages.text` |
| `chats/{id}/messages/{id}` | `sources[i].snippet` | `messages.sources.{i}.snippet` |
| `chats/{id}/messages/{id}` | `sources[i].title` | `messages.sources.{i}.title` |
| `dailyReports/{uid}/days/{id}` | `findings` | `dailyReports.findings` |
| `dailyReports/{uid}/days/{id}` | `question` (the model's `gem`) | `dailyReports.question` |
| `dailyReports/{uid}/days/{id}` | `emotionSummary` | `dailyReports.emotionSummary` |
| `dailyEncouragements/{uid}/messages/{id}` | `title` | `dailyEncouragements.title` |
| `dailyEncouragements/{uid}/messages/{id}` | `body` | `dailyEncouragements.body` |

`web/src/lib/crypto/aad.ts` additionally declares `dailyReports.insights`, which
the iOS client neither writes nor reads today. Port the constant for parity, but
do not invent a field for it.

Three traps worth naming:

1. `prompts.items.{i}` and `messages.sources.{i}.*` embed the **array index**.
   Reordering an array without re-encrypting breaks it.
2. The daily report's `gem` is persisted under the legacy key `question`, and its
   AAD is `dailyReports.question`. Do not "fix" the name.
3. `journals.summary` and `journals.insights` are **not** AAD strings themselves.
   The `AIGeneration` mapper appends `.text`, so the wire value is
   `journals.summary.text`. Passing the bare prefix fails authentication.

The 16 `profileDetails` keys are: `goals`, `hobbies`, `age`, `gender`,
`challenges`, `dailyHabits`, `starSign`, `maritalStatus`, `location`, `education`,
`work`, `favoriteMovies`, `favoriteArtists`, `favoriteBooks`, `languages`,
`friendsDescribe`.

## 2.3 The key hierarchy

```
              recovery code (256-bit, shown once, stored nowhere)
                        |  HKDF-SHA256(salt, info)
                        v
   KEK_icloud   KEK_recovery   KEK_android (new, see Part 6.1)
        \             |              /
         \            |             /       AES-256-GCM wrap, NO AAD
          v           v            v
              wrappedKeys.{slot} in users/{uid}     <- the server sees only these
                        |
                        v
                    DEK (32 bytes)
                    /          \
        FieldCipher (AAD)     MediaCipher (chunked)
```

Recovery-code parameters, all fixed:

| Parameter | Value |
|---|---|
| Entropy | 32 bytes (256 bits) |
| Alphabet | Crockford base32, `0123456789ABCDEFGHJKMNPQRSTVWXYZ` |
| Display | 52 characters, grouped in fours with `-` |
| Normalization | strip `-` and whitespace, uppercase, then `O`→`0`, `I`→`1`, `L`→`1`, `U`→`V` |
| KDF | HKDF-SHA256 |
| Salt | `luminalog-recovery-kek-salt-v1` (UTF-8) |
| Info | `luminalog-recovery-kek-v1` (UTF-8) |
| Output | 32 bytes |
| IKM | the UTF-8 bytes of the **normalized** code |

The DEK wrap is AES-256-GCM under the KEK with **no AAD**, envelope
`{v:1, iv, ct, tag}`. Note this differs from the field envelope: no `alg` key, and
no AAD.

**The enrollment ordering rule.** A DEK is installed on a device only after its
wraps have been uploaded **and re-fetched and proven to unwrap back to the same
DEK**. Never install first. Installing first lets a user encrypt data under a key
that has no durable backup, which is unrecoverable data loss. See
`ClientKeyEnroller.enroll` and `web/src/lib/crypto/keys/keyEnrollment.ts`.

**The resolve flow**, which Android must reproduce:

1. Try the local slot. Cached DEK, then the device-local Keystore slot. On success,
   unlocked.
2. Otherwise `GET /v1/keys/wrapped`. A **transport error is not an answer**. Treat
   it as a retryable failure, never as "this account has no key". Getting this
   wrong mints a second DEK and orphans the user's entire journal.
3. If the account has **no** wraps at all, enroll a new account: mint a DEK, derive
   a recovery KEK, upload, verify, install, show the code exactly once.
4. If the account **has** wraps that this device cannot open, prompt for the
   recovery code. On success, re-bind to a fresh device slot so later launches are
   silent.

## 2.4 Media file format (`LLM1`)

Media is encrypted on device and the **ciphertext** is what goes to S3. The server
never sees plaintext bytes and never holds a key.

```
[ "LLM1" magic, 4 bytes ][ chunkSize, uint32 big-endian, 4 bytes ]
repeat per chunk:
  [ blobLength, uint32 big-endian, 4 bytes ][ AES-GCM combined blob ]
```

- Default `chunkSize` is 1 MiB (`1 << 20`). The header value is informational on
  read; the reader uses the per-chunk length prefix.
- "Combined" means `nonce || ciphertext || tag`, which is what Apple's
  `AES.GCM.SealedBox.combined` produces. Android must construct and parse that
  layout by hand.
- AAD per chunk is the **zero-based chunk index as a 4-byte big-endian integer**,
  which is what prevents chunks being reordered, dropped, or duplicated.
- Streaming is mandatory, not an optimization. A long video must never be fully
  resident in memory.

Reference: `Core/Crypto/MediaCipher.swift`, `web/src/lib/crypto/mediaCipher.ts`,
`server/src/crypto/mediaCipher.ts`.

## 2.5 The chunker

`Core/Vectors/JournalChunker.swift`, mirrored by the server's `CHUNKER_VERSION`:

| Parameter | Value |
|---|---|
| Version | 1 |
| Short threshold | 500 characters, emitted as a single chunk |
| Chunk size | 600 characters |
| Overlap | 100 characters, so the window steps by 500 |
| Empty or whitespace-only input | zero chunks |

The iOS implementation slices `Array(content)`, that is, **Swift grapheme
clusters**, while the web and server implementations slice JS/TS strings, which are
UTF-16 code units. For BMP text these agree. For emoji and other astral-plane
characters they do not. Android's `String` is also UTF-16, so **match the
JavaScript behaviour** (iterate UTF-16 code units), and add a cross-client test
that pins the disagreement rather than pretending it does not exist. Chunking only
has to be self-consistent between index time and retrieval time on the same
client, but a shared corpus makes the disagreement visible.

## 2.6 The API surface

Base URL `https://api.luminalog.com`. Every authenticated call carries
`Authorization: Bearer <Firebase ID token>`, and a 401 is retried exactly once with
a force-refreshed token (`Core/Networking/ProxyAPIClient.swift`).

| Group | Routes |
|---|---|
| Keys | `PUT /v1/keys/wrapped`, `GET /v1/keys/wrapped`, `DELETE /v1/keys/wrapped/:method`, `POST /v1/keys/finalize-migration` |
| Consent | `PUT /v1/consent`, `GET /v1/consent` |
| AI | `POST /v1/ai/summary`, `/entry-ai`, `/entry-map`, `GET /v1/ai/entry-map/:jobId`, `/daily-prompt`, `/daily-report`, `/daily-encouragements`, `/transcribe`, `/transcribe-clip` |
| Chat | `POST /v1/ai/chat` (SSE stream) |
| RAG | `PUT /v1/rag/index`, `POST /v1/rag/search`, `/search/keyword`, `/search/semantic`, `/related`, `/graph`, `DELETE /v1/rag/:entryId` |
| Media | `POST /v1/media/upload-urls`, `POST /v1/media/view-urls` |
| Voice | `POST /v1/vapi/call-config`, `POST /v1/vapi/recording-finalize` |
| Commerce | `GET /v1/entitlement` |
| Social | `GET /v1/leaderboards`, `GET /v1/soul`, `PUT /v1/soul/constellation` |
| Analytics | `POST /v1/ph/*` (PostHog reverse proxy, unauthenticated) |
| Health | `GET /health` |

Server-side guards worth knowing about:

- `requireAiConsent` returns 403 when the server has no consent record. The iOS
  client installs a one-shot recovery hook that re-syncs consent and retries the
  request once (`ProxyAPIClient.consentRecovery`). Android needs the same hook, or
  it will show spurious AI failures on a fresh install.
- `requirePro` returns 402 without an active `pro` entitlement. It is currently
  **off** behind the `ENFORCE_PRO` flag, but Android must handle 402 from day one.
- `POST /v1/media/upload-urls` will only presign keys under `users/<uid>/`. A
  client-supplied stable `s3Key` outside that prefix is a 403.

## 2.7 Firestore schema and rules

Collections, per `firestore.rules`:

| Path | Ownership |
|---|---|
| `users/{uid}` | owner read/write, except `entitlement`, which is server-owned |
| `users/{uid}/constellationCentroids/{dayIndex}` | server only, denied to clients |
| `journals/{journalId}` | owner, keyed by a `userId` **field** |
| `chats/{chatId}` and `chats/{chatId}/messages/{id}` | owner, keyed by a `userId` field on the parent |
| `dailyReports/{uid}/days/{date}` | owner, keyed by the **path** segment |
| `dailyEncouragements/{uid}/messages/{id}` | owner, keyed by the path segment |

Every read and write must filter on the caller's uid. Query keys, status flags,
timestamps, word counts, and media metadata stay plaintext. Only text is
encrypted. That asymmetry is what allows `orderBy(createdAt)` and pagination to
work at all.

---

# Part 3: Recommended Android stack

Decisions, with the reasoning stated once so they do not get relitigated per PR.

| Concern | Choice | Why |
|---|---|---|
| Language | Kotlin, latest stable | Non-negotiable for a new Android app |
| UI | Jetpack Compose + Material 3 | Closest structural analogue to SwiftUI, so the iOS view models port nearly one to one |
| minSdk | **26** (Android 8.0) | AES-GCM in Android Keystore landed in API 23, but 26 gets adaptive icons, reliable `java.time` behaviour with desugaring, and drops the long tail of Keystore bugs. Coverage cost is negligible |
| targetSdk | Current stable at build time | Play requirement |
| Async | Coroutines + `Flow` | `AsyncStream` maps to `Flow`, `@MainActor` maps to `Dispatchers.Main.immediate` |
| State | `ViewModel` + `StateFlow`, unidirectional | Matches the iOS `ObservableObject` + `@Published` pattern |
| Navigation | Navigation Compose, type-safe routes | Replaces `NavigationStack` |
| DI | Hilt | `AppServices` becomes a Hilt module graph. Keep the protocol-and-mock split from iOS: every service is an interface with a fake, which is how the iOS test suite works |
| Symmetric crypto | `javax.crypto` (`AES/GCM/NoPadding`), Conscrypt-backed | The envelope format is already fixed. Tink would add its own framing that then has to be stripped |
| HKDF | Tink's `com.google.crypto.tink.subtle.Hkdf`, or ~30 lines of RFC 5869 | Either is fine. Pin it with the shared test vectors |
| Local key slot | Android Keystore AES key (non-exportable) + the wrap envelope in DataStore | See 3.1 |
| Cloud key slot | Google Block Store | See 3.1 |
| Local DB | Room | Drafts, upload journal, recording manifests, media cache index |
| Preferences | DataStore (Proto or Preferences) | Replaces `UserDefaults` |
| Firebase | `firebase-auth-ktx`, `firebase-firestore-ktx` via BoM | Same backend, same rules, same offline persistence |
| HTTP | OkHttp + Retrofit + kotlinx-serialization | SSE via a raw OkHttp call reading the response body line by line |
| Image loading | Coil | Compose-native |
| Camera | CameraX | Photo, video, and the multi-photo burst |
| Audio capture | `AudioRecord` writing raw PCM per segment, muxed to AAC | Mirrors the iOS "write every buffer to disk" crash-safety property. `MediaRecorder` does not give that guarantee |
| Media playback | Media3 / ExoPlayer | Audio scrubbing and video |
| Video transcode | Media3 Transformer | Replaces `AVAssetExportSession` |
| Speech to text | `SpeechRecognizer`, on-device where available (`createOnDeviceSpeechRecognizer`, API 33+), server Whisper as the fallback | Replaces `SFSpeechRecognizer` |
| OCR | ML Kit Text Recognition v2, bundled model | Replaces Vision |
| Background work | WorkManager, with a foreground service for long uploads | Replaces background `URLSession` and `BGTaskScheduler`. Strictly more reliable than the iOS equivalents |
| Notifications | `NotificationManager` + `AlarmManager.setExactAndAllowWhileIdle` for reminder slots | Replaces `UNUserNotificationCenter` |
| Purchases | RevenueCat `purchases-android` | Same entitlement `pro`, same `app_user_id` (the Firebase uid), same webhook |
| Voice | Vapi `client-sdk-android` | Official Kotlin SDK, so the `VoiceCallService` protocol ports directly |
| Analytics | PostHog Android SDK pointed at `/v1/ph` | Same proxy, same forced-off capture flags, same one-file import guard |
| Charts | Compose Canvas for the heatmap and word cloud, Vico for the line and donut charts | The word-cloud layout engine is custom on iOS too and should be ported, not replaced |
| WebViews | `WebView` + `WebViewAssetLoader`, JS bundles in `assets/` | Same three visualizations, same bundles |
| Build | Gradle Kotlin DSL + version catalog + convention plugins | |

## 3.1 The Android key anchor, which is the one genuinely new design

iOS anchors the DEK in the iCloud Keychain, which survives reinstall and reaches a
new device automatically. Android has no single equivalent. The recommendation is
a **two-tier** anchor, plus the recovery code as the cross-ecosystem backstop.

**Tier 1, device slot (`android` wrap):** generate a non-exportable AES-256 key in
the Android Keystore (`AndroidKeyStore` provider, `setUserAuthenticationRequired(false)`
by default, StrongBox where available). Wrap the DEK under it and store the
`{v,iv,ct,tag}` envelope in DataStore. Upload the same envelope to
`wrappedKeys.android`. This is exactly the web `browserSlot` pattern
(`web/src/lib/crypto/keys/browserSlot.ts`), and its threat model is the same one
already written down there: it defends against a stolen server database and casual
device access; it does not defend against a compromised app process. Do not let the
privacy copy claim more.

The Keystore key does not survive uninstall or a device change, so this tier alone
is not enough.

**Tier 2, cloud slot (Google Block Store):** store the raw 32-byte KEK from tier 1
in Block Store (`play-services-auth-blockstore`) with cloud backup enabled and
`setRequireUserAuthentication(true)`. Block Store allows up to 4 KB per entry and
16 entries, so a 32-byte key fits comfortably. Block Store restores across
reinstall and, with cloud backup on, across a device transfer, which makes it the
nearest thing Android has to the iCloud Keychain. It requires Google Play services,
so it must degrade to tier 3 rather than fail.

**Tier 3, recovery code:** the universal path, identical to iOS and web. For a user
whose account was created on iOS, this is the **only** way in on their first Android
launch, because the `icloud` wrap is unreadable off Apple platforms. Design the
recovery-code entry screen as a first-class flow, not an error state. This is the
lesson the web client already learned.

**Future consolidation:** `docs/superpowers/specs/2026-07-09-encryption-step2-crossplatform-passkey-prf-design.md`
proposes a passkey with the WebAuthn PRF extension as one universal anchor across
all three platforms. It was designed and never built; the only trace in the code is
a comment. Android's Credential Manager plus Google Password Manager does support
PRF, so this remains the right long-term answer. It is explicitly **out of scope**
for the first Android release: it would be a change to iOS and web as well, and
Android should not be blocked on it.

---

# Part 4: Module layout and iOS to Android mapping

## 4.1 Gradle modules

Mirror the iOS folder structure, because it is already a clean layering and it
makes cross-referencing trivial during the port.

```
android/
  build-logic/                  convention plugins
  gradle/libs.versions.toml     version catalog
  app/                          Application, Hilt graph, navigation host, gates
  core/
    model/                      pure Kotlin data classes, zero Android deps
    crypto/                     envelope, fieldCipher, wrappedKey, recoveryCode,
                                mediaCipher, keyStoreSlot, blockStoreSlot,
                                keyEnrollment
    network/                    ProxyApiClient, SSE, DTOs, token provider
    data/                       Firestore repositories + mapping, Room, DataStore
    media/                      uploader, upload journal, recorder, transcoder, OCR
    ai/                         AiService, Model1 request builders, RAG, chunker
    ui/                         theme, design tokens, shared composables
    testing/                    fakes + shared golden vectors
  feature/
    onboarding/  auth/  home/  journal-list/  journal-detail/  create-entry/
    chats/  voice/  search/  insights/  soul/  constellation/  cognitive-map/
    leaderboard/  profile/  paywall/  credits/
```

`core:model` and `core:crypto` must have **no Android dependencies** beyond
`javax.crypto`, so they are testable on the JVM without an emulator. That is what
makes the golden-vector suite in [Part 8](#part-8-testing-strategy) cheap to run.

## 4.2 Translation table

| iOS | Android |
|---|---|
| `AppServices` | Hilt `@Module` graph, one `@Binds` per service interface |
| `protocol X` + `MockX` | `interface X` + `FakeX` in `core:testing` |
| `@MainActor final class ...ViewModel: ObservableObject` | `@HiltViewModel class ...ViewModel : ViewModel()` |
| `@Published var` | `MutableStateFlow` exposed as `StateFlow` |
| `AsyncStream<T>` | `Flow<T>` (`callbackFlow` around a Firestore listener) |
| `AsyncThrowingStream<String, Error>` for SSE | `Flow<String>` from an OkHttp streaming call |
| `Task { }` | `viewModelScope.launch { }` |
| `CryptoKit.AES.GCM` | `Cipher.getInstance("AES/GCM/NoPadding")` + `GCMParameterSpec(128, iv)` |
| `HKDF<SHA256>.deriveKey` | Tink `Hkdf.computeHkdf("HMACSHA256", ikm, salt, info, 32)` |
| `SecRandomCopyBytes` | `SecureRandom` |
| Keychain (`KeychainStore`) | Android Keystore wrap + DataStore envelope |
| iCloud Keychain (`SyncedKeychainStore`) | Google Block Store |
| `UserDefaults` | DataStore Preferences |
| `FileManager` app-support JSON drafts | Room + `context.filesDir` |
| Background `URLSession` | WorkManager `CoroutineWorker` + foreground service |
| `BGAppRefreshTask` | WorkManager `PeriodicWorkRequest` |
| `UNUserNotificationCenter` | `NotificationManagerCompat` + `AlarmManager` |
| `AVAudioEngine` + `AVAudioFile` | `AudioRecord` + `MediaMuxer` |
| `AVAssetExportSession` | Media3 `Transformer` |
| `SFSpeechRecognizer` | `SpeechRecognizer` (on-device where available) |
| Vision `VNRecognizeTextRequest` | ML Kit `TextRecognition` |
| `WKWebView` + `WKScriptMessageHandler` | `WebView` + `@JavascriptInterface` (or `WebMessagePort`) |
| Swift Charts | Vico, or Compose `Canvas` |
| `ShareLink` / `UIActivityViewController` | `Intent.ACTION_SEND` + `FileProvider` |
| Sign in with Apple (`ASAuthorizationController`) | Firebase `OAuthProvider("apple.com")` + `startActivityForSignInWithProvider`, which opens a Custom Tab |
| Google Sign-In SDK | Credential Manager with Google ID, then a Firebase credential |

Note on Apple sign-in: it resolves to the **same Firebase uid** as on iOS, because
the provider identity is the same Apple ID. This matters, because that uid is the
key to `users/{uid}`, to every `userId` field, to the S3 prefix, and to the
RevenueCat `app_user_id`.

---

# Part 5: Feature-by-feature implementation plan

## 5.1 Encryption (`core:crypto`): build this first, alone, against test vectors

Port, in this order, each with tests before anything else exists:

1. `Envelope` (parse and serialize `{v,alg,iv,ct,tag}`), fail-closed.
2. `FieldCipher.encrypt/decrypt(plaintext, aad)`.
3. `Aad` object, a verbatim port of `web/src/lib/crypto/aad.ts`.
4. `WrappedKey.wrap/unwrap` (no AAD).
5. `RecoveryCode`: generate, normalize, Crockford base32 encode, `deriveKek`.
6. `MediaCipher.encryptFile/decryptFile`, streaming, with the `LLM1` layout.
7. `KeystoreSlot` and `BlockStoreSlot`.
8. `KeyEnrollmentService`, a direct port of the iOS state machine, with the
   **verify-then-install** ordering preserved.

Do not start on UI until a JVM test decrypts a fixture produced by the iOS app.

## 5.2 Networking (`core:network`)

`ProxyApiClient` on OkHttp:

- A `TokenProvider` interface over `FirebaseUser.getIdToken(forceRefresh)`.
- An `Authenticator` or interceptor that retries a 401 exactly once with a forced
  refresh.
- A `consentRecovery` hook: on a 403 whose body indicates missing consent, call
  `PUT /v1/consent` once and replay the request. Wire it after construction, as
  iOS does, to break the dependency cycle.
- Bounded exponential backoff on the raw-bytes transcription path
  (3 attempts, 250 ms then 500 ms), matching `TransientRetryPolicy`.
- Treat **413 as terminal**, never retried. The same bytes always fail, and iOS
  maps it to `transcriptStatus = unsupported`.
- SSE: a streaming `ResponseBody`, read line by line, emitted as a `Flow<String>`.
  The chat endpoint persists both sides server-side, so the client must **not**
  write the user message or the reply itself.

## 5.3 Data layer (`core:data`)

Repositories as interfaces, mirroring `Core/Persistence/`:
`JournalRepository`, `ProfileRepository`, `ChatRepository`, `DailyReportRepository`,
`EncouragementRepository`.

- Every live query becomes a `callbackFlow` over `addSnapshotListener`, and
  **never throws**: log the error and stay silent until the next good snapshot,
  exactly as iOS documents. A stream captures the user at creation and must be
  recreated on auth change.
- Decryption happens in the mapping layer, not the ViewModel. A document that
  fails to decrypt is **dropped**, never surfaced as garbage.
- Port `FirestoreMapping.swift` field by field. It is the schema.
- Room holds: drafts, the upload journal, recording segment manifests, the failed
  report store, and the decrypted-media cache index.

## 5.4 Create entry and the processing pipeline

The largest feature, and the one where Android is genuinely **better** positioned
than iOS.

- Compose composer with an attachment tray, seeded optionally from a prompt.
- CameraX for capture; a burst buffer for multi-photo.
- Recording: `AudioRecord` writing PCM chunks to a segment file as they arrive, one
  file per segment, a manifest row per segment in Room, merged and encoded to AAC
  on stop. Audio focus loss maps to the iOS "forced interruption" pause. A
  foreground service with `microphone` type keeps a long recording alive.
- OCR through ML Kit, feeding `content`.
- The `processingStatus` state machine is written to Firestore exactly as on iOS,
  because the same document is read by the iOS and web clients.
- Uploads: a `CoroutineWorker` per file, with the upload journal as the durable
  record. WorkManager's constraint and retry engine replaces the hand-rolled
  `UploadManager` backoff, but **keep the journal**, because it is what lets a
  cold start finalize an entry whose uploads completed while the app was dead.
- A launch sweep marks stranded entries failed and re-arms pending uploads.

## 5.5 AI features

All of these are thin once `core:crypto` and `core:network` exist, because the
client's job is: decrypt locally, POST plaintext, encrypt the result, write it back.

- Entry AI, cognitive map (with `jobId` polling), daily prompt, daily report,
  encouragements: direct ports of `ProxyAIService`.
- Chat: SSE, with the "server persists both sides" rule respected.
- Voice: the Vapi Android SDK behind a `VoiceCallService` interface. Build the
  plaintext call context on device (`name`, `bio`, `profile`, `todayContext`,
  `ragContext`, `focalEntry`, `now`) and POST it to `/v1/vapi/call-config`. Request
  `RECORD_AUDIO` **before** starting the call and fail loudly if denied: iOS learned
  (ADR-0110) that a call without mic input looks like a companion that simply never
  answers. Meter credits per minute during the call. After the call, import the
  webhook-staged recording, re-encrypt it under the DEK, and finalize.
- Search, related, graph: direct ports.
- Indexing: the chunker port from [Part 2.5](#25-the-chunker), plus
  index-on-save and delete-on-delete.

## 5.6 Visualizations

The cognitive map, constellation, and Soul galaxy are already JS bundles rendered
in a WebView. Reuse them:

- Add a `sync-android.sh` to `packages/cognitive-map/`, alongside the existing
  `sync-ios.sh` and `sync-web.sh`, copying the IIFE bundle into
  `android/feature/cognitive-map/src/main/assets/`.
- Serve `assets/` through `WebViewAssetLoader` under an `https://appassets.androidplatform.net/`
  origin, so the page has a real origin and CSP behaves.
- Bridge JS to Kotlin with `@JavascriptInterface` for the tap callbacks
  (`selectBeat`, `inspect`) and the console/error forwarder that iOS installs. That
  forwarder is not optional: without it a failed script load renders a blank view
  with no explanation.
- Inject theme tokens the same way iOS does, so the map matches the app theme.

## 5.7 Commerce

- RevenueCat Android SDK, `app_user_id` set to the Firebase uid on sign-in and
  cleared on sign-out.
- Google Play products must be created and mapped to the **same** RevenueCat
  entitlement `pro`, so a user who subscribes on iOS is Pro on Android. The
  webhook and `GET /v1/entitlement` need no change: they key on the uid.
- Consumable credit packs mirror `com.luminalog.credits.*`.
- Play's manage-subscription deep link replaces StoreKit's sheet. Offer codes
  become Play promo codes.

## 5.8 Notifications and background work

Android is more capable here, and the plan should take advantage of it rather than
faithfully reproducing iOS's workarounds:

- Daily reminder slots: `AlarmManager.setExactAndAllowWhileIdle` per slot, re-armed
  on boot (`BOOT_COMPLETED`), on goal progress, and on settings change. Port
  `ReminderPlanner` unchanged; it is pure logic.
- Encouragements: a WorkManager `PeriodicWorkRequest` targeting the pre-dawn
  window. Keep the idempotent cycle and the on-resume catch-up from iOS anyway,
  because Doze can still delay it, and idempotence costs nothing.
- Request `POST_NOTIFICATIONS` at the right moment (after the user has seen why),
  not at first launch.

---

# Part 6: Blocking prerequisites

These are shared or server-side changes. Android cannot ship correctly without
them, and two of them are arguably live bugs today.

## 6.1 Add an `android` wrap slot (server)

`server/src/routes/keys.ts` hardcodes:

```ts
const WRAP_METHODS = ['icloud', 'recovery'] as const
```

An unknown method is a **400**. Android's device slot therefore cannot be stored
until this list grows. The `PUT` handler already merges, so adding a slot never
clobbers an existing one, but that property deserves an explicit test once there
are three slots. `web/src/lib/crypto/keys/wrapTransport.ts` keeps a mirror of this
list and silently drops unknown methods, so it should be updated in the same
change.

## 6.2 Fix the "both wraps or nothing" rule on iOS (P0, likely a live bug)

`ios/LuminaLog/Core/Crypto/KeyMigrationTransport.swift:60-71` returns `nil` from
`fetchWraps()` unless **both** `icloud` and `recovery` are present:

```swift
guard let wraps = response.wrappedKeys,
      let icloudDTO = wraps.icloud,
      let recoveryDTO = wraps.recovery, ...
else { return nil }
```

`KeyEnrollmentService.resolve()` reads `nil` as "this account has no key material"
and calls `enrollNewAccount`, which **mints a fresh DEK**. Every entry written
under the old DEK is then permanently unreadable.

An account created on the web has only a `recovery` wrap. An account created on
Android would have `recovery` and `android`. In both cases iOS would orphan the
user's journal on first launch. This must become "any valid wrap present means the
account has key material; only a completely empty map may enroll", and the
recovery-code prompt must be shown whenever the device cannot open what is there.

An iOS fix ships on Apple's review clock, so this needs to land **well before** the
Android beta reaches anyone with an existing account.

## 6.3 Cross-client golden vectors (shared)

Create a fixture set, checked into the repo, that all three clients test against:
field envelopes for every AAD context, DEK wraps, recovery-code KEK derivations,
`LLM1` media files, and chunker outputs including at least one emoji case. Web
already has fixtures under `web/src/lib/crypto/keys/__fixtures__/`. Promote them to
a shared location and have iOS and Android read the same files. Without this, the
first cross-platform decryption bug is found by a user.

## 6.4 Google Play and RevenueCat setup

A Play Console app, subscription and consumable products, RevenueCat Play
integration mapped onto the existing `pro` entitlement, and the RevenueCat webhook
verified for Play events. Note that the webhook authenticates via a `?secret=`
query parameter, which is unchanged.

## 6.5 Firebase Android app registration

Add an Android app to the `luminalog-5822e` Firebase project, with the release and
debug SHA-1 and SHA-256 certificate fingerprints (Google Sign-In will not work
without them). `google-services.json` is per-developer configuration and must be
gitignored, exactly as `GoogleService-Info.plist` is on iOS.

## 6.6 Decide the Android package name

Suggested: `com.konradgnat.argo`. It does not have to match the iOS bundle id
`com.konradgnat.luminalog`, and there is no reason to inherit the pre-rebrand name
on a new store listing. This is a one-way door: it cannot be changed after the
first Play release.

---

# Part 7: Delivery phases

Each phase ends with something demonstrable. Nothing after phase 1 can be trusted
until phase 1's tests pass against real iOS-produced data.

| Phase | Scope | Done when |
|---|---|---|
| **0. Prerequisites** | Part 6.1, 6.2, 6.3, 6.4, 6.5, 6.6 | The server accepts an `android` wrap and iOS no longer re-enrolls on a partial wrap map |
| **1. Crypto core** | `core:model`, `core:crypto`, all of 5.1 | JVM tests decrypt iOS-produced fixtures for every AAD context, and an `LLM1` file round-trips against the iOS and server implementations |
| **2. Identity** | Firebase Auth (Apple + Google), `ProxyApiClient`, key gate, recovery-code entry, consent gate | An existing iOS user signs in on Android, enters their recovery code, and the app reports unlocked |
| **3. Read-only journal** | Repositories, mapping, journal list, journal detail (Main tab), media view and decrypt, theme | An existing user browses, opens, and plays back their real entries. **This is the milestone that proves the whole thesis** |
| **4. Write path** | Create entry (text first), draft store, word count, daily goal and streak reconcile, RAG indexing | An entry written on Android opens correctly on iOS and web |
| **5. Media capture** | Audio segments, camera, library import, OCR, upload workers, transcode, the processing state machine, transcript backfill, recordings recovery | A voice entry recorded on Android transcribes and appears on iOS |
| **6. AI** | Entry AI, cognitive map, daily prompt, daily report, search, related, chat streaming | Feature parity on the text-AI surfaces |
| **7. Voice** | Vapi SDK, call screen, credits metering, call detail, recording finalize | A voice call completes and its transcript is readable on iOS |
| **8. Growth surfaces** | Insights dashboard, constellation, Soul, leaderboard, milestones, notifications, encouragements | |
| **9. Commerce and launch** | Paywall, purchases, restore, credits, analytics, Play listing, closed testing | |

Phases 3 and 4 are the risk concentration. Budget for them accordingly. Phases 6
onward are mostly mechanical once the plumbing works.

---

# Part 8: Testing strategy

The iOS app has a large unit-test suite (`ios/LuminaLogTests/`, 120+ files) built
on the protocol-plus-mock pattern. Reproduce that shape, and add one thing iOS does
not have.

1. **Cross-client golden vectors (the new thing, and the most valuable).** A shared
   fixture directory that iOS, web, and Android all test against. Any drift in an
   AAD string, the HKDF parameters, the base32 alphabet, the `LLM1` layout, or the
   chunker fails a test in three repos instead of corrupting a user's journal.
2. **Pure-logic JVM tests**, no emulator: chunker, retriever ranking, streak math,
   daily-goal reconcile, reminder planner, encouragement planner, word count,
   Model 1 request builders, Firestore mapping round-trips.
3. **Fake-backed ViewModel tests**, one fake per service interface, ported from the
   iOS mocks in `Core/Mocks/`.
4. **Instrumented tests** for the parts that only exist on a device: Keystore slot,
   Block Store slot, WorkManager upload chains, `AudioRecord` segment recovery after
   a process kill.
5. **A manual cross-client matrix** run before each release: create on each of the
   three clients, read on the other two; recovery-code unlock on each; a subscription
   purchased on one platform recognized on the others.
6. **The import guard**, ported from iOS: exactly one file may import the PostHog
   SDK. In a journaling app, autocapture is content exfiltration, and a test is the
   only thing that keeps it off permanently.

---

# Part 9: Risks and open questions

| Risk | Impact | Mitigation |
|---|---|---|
| Wrap-map bug (6.2) reaches a real user | Permanent loss of a journal | Fix and ship on iOS **before** any Android build touches a real account. Add a test that a partial wrap map never enrolls |
| AAD or envelope drift between clients | Undecryptable entries, discovered late | Shared golden vectors, phase 1 gate |
| Chunker grapheme vs UTF-16 disagreement | Wrong chunk returned as a RAG citation for emoji-heavy entries | Match the JS behaviour, pin it with a test, accept the known iOS difference |
| No iCloud Keychain equivalent | Every cross-ecosystem user hits the recovery code | Two-tier Keystore + Block Store anchor; treat recovery-code entry as a first-class flow, not an error |
| Recovery code lost | Unrecoverable, by design | Enrollment UX must make this consequence unmistakable. Consider a "save to password manager" affordance on Android |
| Play billing and App Store entitlements diverge | A paying user is paywalled on their second device | One RevenueCat entitlement keyed on the Firebase uid; test the cross-store case explicitly |
| Android fragmentation in audio capture | Lost recordings on specific OEM devices | Segment-to-disk architecture already limits the blast radius; test on Samsung, Pixel, and one budget MediaTek device |
| Old-client compatibility | An Android write breaks the shipped iOS 1.0 client | Never add a **required** field to an existing document. New fields must be optional and default sensibly on read |
| Server deploy blast radius | Downtime for live users | The `android` wrap-slot change is additive and low risk, but it still follows the deploy checklist, including the `/proc/<pid>/environ` env verification |

## Open questions needing a decision

1. **Package name.** `com.konradgnat.argo` is the recommendation. One-way door.
2. **minSdk 26 or 24?** 26 is recommended. 24 adds roughly a percent of devices and
   a meaningful amount of Keystore and `java.time` special-casing.
3. **Does the Android release wait for the passkey-PRF universal anchor?**
   Recommendation: no. Ship with Keystore plus Block Store plus recovery code, and
   treat passkey-PRF as a later cross-platform project touching all three clients.
4. **Tablet and foldable support.** iOS is `TARGETED_DEVICE_FAMILY = 1`, phone only.
   Play surfaces large-screen quality in its listing, so at minimum the layouts
   should not break. Full tablet-optimized layouts are out of scope for v1.
5. **Does Android need the `finalize-migration` endpoint at all?** It exists for the
   iOS zero-knowledge cutover. A new Android client has nothing to migrate, so it
   should probably never call it. Confirm before wiring it.
6. **Compose Multiplatform for `core:crypto`?** Tempting, because it would let iOS
   and Android share one crypto implementation. Rejected for v1: it would mean
   rewriting shipped, audited iOS crypto, which is a far larger risk than
   maintaining two implementations pinned by shared test vectors.

---

## Appendix: files worth reading before writing any Android code

| Purpose | File |
|---|---|
| The key state machine | `ios/LuminaLog/Core/Crypto/KeyEnrollmentService.swift` |
| The same machine, on a non-Apple platform | `web/src/lib/crypto/keys/keyEnrollment.ts` |
| The device slot pattern to copy | `web/src/lib/crypto/keys/browserSlot.ts` |
| The AAD list, authoritative | `web/src/lib/crypto/aad.ts` |
| The schema | `ios/LuminaLog/Core/Persistence/FirestoreMapping.swift` |
| Ownership rules | `firestore.rules` |
| The API contract, client side | `ios/LuminaLog/Core/Networking/Model1Requests.swift` |
| The API contract, server side | `server/src/index.ts` and `server/src/routes/` |
| The media format | `ios/LuminaLog/Core/Crypto/MediaCipher.swift` |
| The processing state machine | `ios/LuminaLog/Core/Media/EntryProcessor.swift` |
| Why things are the way they are | `docs/ADR.md` (135 entries, newest first) |
