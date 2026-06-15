# LuminaLog iOS — Architecture Spec & Implementation Plan

Companion to `ios-swift-app-design.md` (screen designs). This document specifies the full system
architecture for the LuminaLog iOS app and the phased implementation plan.

**Stack summary:**

| Concern | Technology |
|---|---|
| iOS app | SwiftUI (iOS 17+), MVVM |
| Auth | Firebase Auth — Sign in with Apple + Google (Gmail) |
| App database | Cloud Firestore (journals metadata, users, chats, insights) |
| Media storage | AWS S3 (images, videos, audio) via presigned URLs |
| LLM | Together AI (chat, insights, prompts, summaries) |
| Speech-to-text | On-device (Apple `Speech` framework) for live dictation + voice/video transcripts |
| OCR | On-device (Apple `Vision` framework) for handwritten-journal photos |
| Voice calls with AI | Vapi (iOS SDK + server-side custom LLM endpoint) |
| Subscriptions | RevenueCat |
| Vector DB / RAG | ChromaDB via existing `chroma-service` (Express, `:3100`) |
| Proxy API | New Node/Express (TypeScript) service — the only backend the app talks to for AI/S3 |

---

## 1. System Overview

```
┌─────────────────────────────── iOS App (SwiftUI) ───────────────────────────────┐
│  Firebase Auth SDK   Firestore SDK   RevenueCat SDK   Vapi SDK                  │
│  Speech (STT)        Vision (OCR)    AVFoundation (record/play)                 │
└───────┬──────────────────┬───────────────────────────────┬──────────────────────┘
        │ ID token          │ direct reads/writes           │ WebRTC voice
        ▼                   ▼                               ▼
┌─ Proxy API (Express) ─┐  ┌─ Firebase ─────────┐   ┌─ Vapi Cloud ───────────────┐
│ verifies Firebase JWT │  │ Auth                │   │ assistant w/ custom-llm    │
│ /ai/*  /s3/*  /rag/*  │  │ Firestore           │   │ → POST proxy /vapi/llm     │
│ /vapi/* /webhooks/*   │  │ (rules: per-user)   │   └────────────┬───────────────┘
└──┬─────────┬──────────┘  └─────────────────────┘                │
   │         │                                                    │
   ▼         ▼                                                    │
┌─ Together AI ─┐  ┌─ chroma-service :3100 ─┐  ┌─ AWS S3 ─┐       │
│ chat/insights │  │ ChromaDB `journals_ios`│  │ private  │◄──────┘ (RAG context
│ prompts/summ. │  │ collection + embeddings│  │ bucket   │          via proxy)
└───────────────┘  └────────────────────────┘  └──────────┘

RevenueCat Cloud ── webhooks ──► Proxy API ──► Firestore (entitlement mirror)
```

**Key principles:**

1. **No third-party API keys ship in the app.** Together AI, OpenAI (embeddings), AWS, and Vapi
   private keys live only in the proxy API. The app holds Firebase config, the RevenueCat public
   SDK key, and the Vapi public key — all designed to be client-side.
2. **Firestore is the app's source of truth** for structured data; the app reads/writes it
   directly (guarded by security rules). The proxy API is for anything requiring secrets or
   server-side logic (LLM, embeddings, S3 presigning, Vapi session config, webhooks).
3. **Every AI feature flows through one RAG pipeline.** Chat, voice calls, insights, prompts,
   and the daily prompt all retrieve journal context from Chroma the same way.
4. **On-device first for capture:** STT (dictation + transcripts) and OCR run locally — fast,
   private, free. Only the resulting text is sent to the backend for embedding/AI.
5. **Tenant isolation is non-negotiable:** every Chroma read/write filters on `userId`;
   every S3 key is prefixed `users/{uid}/`; every proxy route validates the Firebase ID token
   and only operates on that token's `uid`.

---

## 2. iOS App Architecture

### 2.1 Project structure (SwiftUI, MVVM)

```
LuminaLog/
├── App/                      # LuminaLogApp.swift, AppDelegate (Firebase config), DI container
├── Core/
│   ├── Auth/                 # AuthService (Firebase Auth, Apple/Google), session state
│   ├── Networking/           # APIClient (proxy API), endpoints, ID-token injection, retry
│   ├── Persistence/          # FirestoreService, typed collection refs, Codable models
│   ├── Media/                # S3Uploader (presigned PUT, multipart), AudioRecorder,
│   │                         #   VideoRecorder, PhotoPicker, AVPlayer wrappers
│   ├── Speech/               # SpeechTranscriber (SFSpeechRecognizer, on-device), live + file modes
│   ├── OCR/                  # VisionOCRService (VNRecognizeTextRequest, handwriting)
│   ├── Subscriptions/        # RevenueCatService (Purchases SDK), entitlement publisher
│   └── Voice/                # VapiCallService (Vapi iOS SDK), call state machine
├── Features/
│   ├── Home/                 # HomeView, HomeViewModel (daily prompt, streak, word count, recents)
│   ├── JournalList/          # ListView + paginated query
│   ├── JournalDetail/        # DetailView, tabs: Main / Insights / Prompts
│   ├── CreateEntry/          # CreateEntryView, capture flows, save pipeline
│   ├── Chats/                # ChatListView, ChatView (streaming), VoiceCallView
│   └── Profile/              # ProfileView, bio editor, settings, paywall
├── Shared/                   # Components from the design system: EntryRow, TypePill,
│                             #   StatCard, PromptCard, AIActionButton, TranscriptBlock, TabBar
└── Resources/                # Assets, Localizable
```

- **State:** `@Observable` view models per feature; a shared `SessionStore`
  (auth user, entitlement, profile) injected via `@Environment`.
- **Concurrency:** async/await throughout; Firestore snapshot listeners bridged to
  `AsyncStream` for live lists.
- **Offline:** Firestore's built-in offline cache covers reads; entry creation queues media
  uploads (see §5.3) so a journal can be saved offline and synced later.

### 2.2 Authentication

- **Providers:** Sign in with Apple (required by App Store when offering social login) and
  Google Sign-In, both via Firebase Auth.
- On first sign-in, create `users/{uid}` in Firestore (displayName, email, photoURL, createdAt).
- `APIClient` attaches `Authorization: Bearer <Firebase ID token>` to every proxy call;
  refreshes via `getIDToken(forcingRefresh:)` on 401.
- Account deletion (Settings): proxy route `/account/delete` performs full cleanup
  (Firestore docs, Chroma vectors, S3 prefix, RevenueCat alias, Firebase Auth user) — never
  client-side piecemeal.

### 2.3 Speech-to-text (local)

Apple `Speech` framework with `requiresOnDeviceRecognition = true`:

- **Live dictation** (Create Entry view): streaming `SFSpeechAudioBufferRecognitionRequest`
  feeding partial results into the text editor.
- **File transcription** (voice + video entries): after recording, run
  `SFSpeechURLRecognitionRequest` against the audio track (extract audio from video via
  `AVAssetExportSession`). The resulting transcript is stored on the journal doc and is what
  gets embedded for RAG.
- Fallback: if on-device recognition is unavailable for the locale, allow network-based
  recognition with user consent; if both fail, save the entry with `transcriptStatus: "failed"`
  and a retry affordance in the detail view.

### 2.4 OCR (image entries)

Apple `Vision` — `VNRecognizeTextRequest` with `recognitionLevel = .accurate` and language
correction, which handles handwriting reasonably well. Multi-photo entries OCR each image and
concatenate with page markers. Result stored as `ocrText` on the journal doc; user can edit it
in the detail view (re-triggers re-embedding + summary regeneration eligibility).

### 2.5 Subscriptions (RevenueCat)

- One entitlement: `pro`. Products: monthly + annual auto-renewing subscriptions.
- `Purchases.shared` configured at launch with `appUserID = firebaseUid` (keeps RevenueCat,
  Firebase, and proxy identities aligned).
- Gating (v1 proposal): free tier = unlimited text journaling + N AI actions/month;
  `pro` = unlimited insights/prompts/chat/voice + media entries. Enforced in two places:
  UI (paywall) and proxy API (checks the entitlement mirror — see §4.5 — so a patched client
  can't bypass limits).
- RevenueCat webhook → proxy `/webhooks/revenuecat` → writes
  `users/{uid}/entitlements` mirror doc in Firestore.

---

## 3. Data Model (Firestore)

```
users/{uid}
  displayName, email, photoURL
  biography: string              # user-written bio; injected into all AI system prompts
  createdAt, timezone
  stats: { streakCount, lastEntryDate, totalWords }     # maintained transactionally on save
  dailyPrompt: { text, date, sourceEntryIds[] }          # today's personalized prompt (cached)

users/{uid}/entitlements/current
  isPro, productId, expiresAt, updatedAt                 # mirror of RevenueCat (proxy-written)

journals/{journalId}
  userId                          # owner; rules enforce userId == request.auth.uid
  type: "text" | "voice" | "video" | "image"
  title, createdAt, updatedAt
  content: string                 # text body / transcript / ocrText — the canonical text
  contentEditedAt                 # to flag stale summaries ("Regenerate")
  media: [ { s3Key, kind: "image"|"video"|"audio", durationSec?, width?, height? } ]
  transcriptStatus: "ready" | "processing" | "failed" | null
  summary: { text, generatedAt, model } | null
  insights: { text, generatedAt, model } | null
  prompts: { items: [string] (5), generatedAt, model } | null
  vector: { status: "indexed"|"pending"|"failed", chunkCount, indexedAt }
  wordCount: number

chats/{chatId}
  userId, kind: "text" | "voice", title, createdAt, lastMessageAt, vapiCallId?

chats/{chatId}/messages/{messageId}
  role: "user" | "assistant", text, createdAt
  sources: [ { journalId, snippet } ]?    # RAG citations (v2 UI)
```

**Firestore security rules (essence):** all `users/{uid}/**` readable/writable only by that
`uid`; `journals` and `chats` require `resource.data.userId == request.auth.uid` (and same on
create). `entitlements` and AI-result fields are written by the proxy via Admin SDK (bypasses
rules); clients get read-only access to them — enforce by validating client writes don't touch
`summary/insights/prompts/vector/entitlements` fields in rules.

**Streak & word count:** computed client-side at save time inside a Firestore transaction on
`users/{uid}.stats` (increment streak if `lastEntryDate` was yesterday in the user's timezone,
reset if older; add `wordCount` delta). Keeps Home instant with zero backend reads.

---

## 4. Proxy API (new service: `luminalog-api/`)

Express + TypeScript, deployed under PM2 on the existing production server (shared box,
68.183.142.183 — pick a free port, e.g. `:3200`; note essaymaker already uses 3050 and
chroma-service 3100). Verifies Firebase ID tokens with `firebase-admin` on every route;
all secrets in `.env`.

### 4.1 Route map

```
POST /v1/ai/summary          { journalId }                → generates + saves summary
POST /v1/ai/insights         { journalId }                → generates + saves insights
POST /v1/ai/prompts          { journalId }                → generates + saves 5 prompts
POST /v1/ai/daily-prompt     {}                           → personalized prompt of the day
POST /v1/ai/chat             { chatId, message }          → SSE stream of assistant reply
POST /v1/rag/index           { journalId }                → chunk + embed + upsert to Chroma
POST /v1/rag/delete          { journalId }                → remove vectors
POST /v1/s3/upload-urls      { files: [{kind, ext, bytes}] } → presigned PUT URLs + s3Keys
POST /v1/s3/view-urls        { s3Keys: [] }               → presigned GET URLs (short TTL)
POST /v1/vapi/call-config    { chatId }                   → per-call Vapi assistant overrides
POST /v1/vapi/llm            (Vapi custom-llm endpoint — OpenAI-compatible chat completions)
POST /v1/webhooks/revenuecat (signed)                     → entitlement mirror
POST /v1/webhooks/vapi       (signed)                     → call ended → persist transcript
POST /v1/account/delete      {}                           → full account cleanup
```

### 4.2 Centralized system prompts

`luminalog-api/src/prompts/index.ts` — **the single file holding every system prompt**, as
required by the design spec:

```ts
export const PROMPTS = {
  summary:      (vars) => `...`,   // summarize one journal entry
  insights:     (vars) => `...`,   // analyze entry → themes, emotions, observations
  journalPrompts:(vars) => `...`,  // 5 follow-up journaling prompts on the entry's theme
  dailyPrompt:  (vars) => `...`,   // one personalized question from recent themes
  chat:         (vars) => `...`,   // companion persona; receives {biography, ragContext}
  voiceChat:    (vars) => `...`,   // chat persona tuned for spoken brevity (Vapi)
}
```

Every prompt that takes journal context receives it pre-formatted by the retriever
(§5.2) — prompts never query Chroma themselves.

### 4.3 Together AI client

- Single `togetherClient.ts` wrapper (Together's API is OpenAI-compatible).
- Models (constants, tunable): `CHAT_MODEL` for chat/voice (a fast instruct model),
  `ANALYSIS_MODEL` for insights/summaries/prompts (can be the same model to start).
- Chat route streams via SSE to the app; non-chat routes are request/response and persist
  results to Firestore server-side before returning (so a killed app never loses a paid
  generation).

### 4.4 ChromaDB & embeddings

- Reuse the existing `chroma-service` (`:3100`), extended per `JOURNAL_RAG_PLAN.md` Phase 1
  with multi-collection support. New collection: **`journals_ios`** with metadata
  `{ userId, journalId, type, title, chunkIndex, totalChunks, createdAt }`.
- Embeddings: OpenAI `text-embedding-3-small` (already what chroma-service uses — keep one
  embedding model across the system).
- Chunking: 1000 chars / 200 overlap over `Title + Type + Content` (mirrors the proven
  essaymaker pattern). Deterministic IDs `${userId}_${journalId}_chunk_${i}`; pre-delete by
  `{userId, journalId}` before upsert so edits never duplicate.

### 4.5 Entitlement enforcement

AI routes check `users/{uid}/entitlements/current` (cached 60s in-process) and the free-tier
usage counter (`users/{uid}/usage/{yyyymm}`) before calling Together. Return `402` with a
typed error the app maps to the paywall.

---

## 5. Core Pipelines

### 5.1 Journal save pipeline (all four types)

```
1. User saves entry in Create view
2. App: derive canonical text
     text  → content = typed text
     image → Vision OCR → content = ocrText (user-reviewable)
     voice → on-device STT on file → content = transcript
     video → extract audio → on-device STT → content = transcript
3. App: if media → POST /v1/s3/upload-urls → presigned PUT upload(s) to S3
        (background URLSession; entry doc saved immediately with transcriptStatus/upload state)
4. App: write journals/{id} to Firestore + transaction on users/{uid}.stats (streak, words)
5. App: fire-and-forget POST /v1/rag/index { journalId }
6. Proxy: read doc → chunk → embed → upsert to Chroma → set vector.status = "indexed"
7. (Lazy) Summary generated on first open of detail view if summary == null
```

Failure handling: steps 5–6 are retryable and idempotent; a Firestore-triggered nightly
reconcile (simple cron on the proxy) re-indexes any doc with `vector.status != "indexed"`.

### 5.2 RAG retrieval (shared by chat, voice, insights, prompts, daily prompt)

`luminalog-api/src/services/journalRetriever.ts` — direct port of the pattern in
`JOURNAL_RAG_PLAN.md` Phase 4:

- `retrieveContext(userId, query, { topK = 12 })` → embed query → Chroma search with
  **mandatory `{ userId }` filter** (asserted in the service, not callers) → format excerpts
  as `[#i — {type} · {title} · {date}]\n{text}` blocks.
- Fail-soft with a 10s timeout: empty context on error; the AI features still work, just
  without memory.
- Per-feature queries: chat/voice use the user's message; insights/summary/prompts use the
  entry's own content (to pull *related past entries* into the analysis); daily prompt uses
  the last ~5 entry titles+summaries as the query.

### 5.3 Media pipeline (S3)

- Private bucket `luminalog-media`, SSE-S3 encryption, no public access; keys
  `users/{uid}/{journalId}/{uuid}.{ext}`.
- Upload: presigned PUT (15 min TTL), `Content-Length` bound to the requested size; videos
  use S3 multipart via presigned part URLs when > 50 MB.
- Playback/display: app calls `/v1/s3/view-urls` for short-TTL (1 h) presigned GETs; cache
  URLs in-memory keyed by s3Key with expiry.
- Lifecycle rule: abort incomplete multipart uploads after 7 days.

### 5.4 Chat pipeline (text)

```
App sends message → POST /v1/ai/chat (SSE)
Proxy: load biography (users/{uid})            ─┐
       retrieveContext(userId, message)         ├→ PROMPTS.chat({biography, ragContext})
       last 20 messages from chats/{id}/messages┘
       → Together AI (stream) → SSE to app
       → persist user msg + assistant msg to Firestore on completion
```

### 5.5 Voice call pipeline (Vapi)

- App taps "Start Voice Chat" → `POST /v1/vapi/call-config` → proxy returns assistant
  overrides (no secrets): `model = custom-llm` pointing at `POST /v1/vapi/llm` with a signed,
  short-lived per-call token embedded in the URL/headers, plus voice/transcriber settings.
- App starts the call with the Vapi iOS SDK (public key + overrides). Vapi handles
  telephony/WebRTC, its own STT/TTS, and calls **our** `/v1/vapi/llm` for every turn — which
  runs the *same* biography + RAG + `PROMPTS.voiceChat` pipeline as text chat, returned in
  OpenAI-compatible streaming format.
- This keeps one brain for text and voice: Vapi is transport, our proxy is intelligence.
- Call ends → Vapi webhook `/v1/webhooks/vapi` → persist full transcript as messages under the
  `chats/{chatId}` doc (kind: "voice") so calls appear in chat history per the design.
- In-call UI states (listening/thinking/speaking) come from Vapi SDK events.

### 5.6 Daily personalized prompt

- On Home load, app checks `users/{uid}.dailyPrompt.date == today` → if stale, calls
  `POST /v1/ai/daily-prompt`; proxy RAG-retrieves recent themes, generates one question,
  saves it to the user doc. Cached for the day; deterministic cost (≤1 LLM call/user/day).

---

## 6. Security & Privacy

- **Secrets:** only on the proxy (.env): Together, OpenAI (embeddings), AWS IAM (scoped to
  the one bucket), Vapi private key, RevenueCat webhook secret, Firebase service account.
- **Tenant isolation:** Firebase rules (Firestore), `userId` filter assertion (Chroma),
  per-uid key prefix + presigning (S3), uid-from-token only (proxy — never trust a uid in
  the request body).
- **Webhooks:** verify RevenueCat authorization header and Vapi signature; reject otherwise.
- **Privacy posture (feeds marketing too):** journals are private by design — on-device
  transcription/OCR, encrypted storage (Firestore + S3 SSE), no training on user data,
  full account deletion. State this in the privacy policy and App Store privacy labels
  (data linked to user: identifiers, user content; none used for tracking).
- **Rate limiting:** per-uid token bucket on all `/v1/ai/*` routes (protects Together spend).

---

## 7. Implementation Plan

### Phase 0 — Foundations (week 1)
- [ ] Create Xcode project, SwiftUI app shell, design-system components from `ios-swift-app-design.md` (tab bar with raised "+", EntryRow, TypePill, StatCard).
- [ ] Firebase project: Auth (Apple + Google), Firestore, security rules v1.
- [ ] Scaffold `luminalog-api` (Express TS, firebase-admin token middleware, health route); PM2 deploy alongside existing services.
- [ ] AWS: bucket, IAM user, lifecycle rules.

### Phase 1 — Auth + text journaling end-to-end (weeks 1–2)
- [ ] Sign in with Apple/Google → user doc creation → session store.
- [ ] Create Entry (text only) → Firestore save → stats transaction (streak, words).
- [ ] Home (daily prompt placeholder, stats, recent 10 lazy list) + List view + Detail (Main tab, text).
- **Milestone: usable text journal app.**

### Phase 2 — RAG + AI features (weeks 2–4)
- [ ] chroma-service: multi-collection support + `journals_ios` collection (JOURNAL_RAG_PLAN Phase 1 work).
- [ ] Proxy: prompts file, Together client, `/rag/index`, `journalRetriever`, `/ai/summary`, `/ai/insights`, `/ai/prompts`, `/ai/daily-prompt`.
- [ ] iOS: Detail tabs (Insights, Prompts) with generate/regenerate states; prompt "→" → Create with prefilled question; live daily prompt on Home.
- **Milestone: AI journal with memory.**

### Phase 3 — Media entries (weeks 4–6)
- [ ] S3 presign routes + background uploader.
- [ ] Live dictation (Speech) in Create view.
- [ ] Voice entries (record → STT file transcript), video entries (record/upload → audio extract → STT), image entries (camera/library multi-photo → Vision OCR).
- [ ] Detail Main tab variants: audio player + transcript, video player + transcript, zoomable images + OCR text.
- **Milestone: all four entry types, all indexed into RAG.**

### Phase 4 — Chat (weeks 6–7)
- [ ] Proxy `/ai/chat` SSE with biography + RAG + history.
- [ ] iOS: Chats list, text chat view with streaming, chat persistence.

### Phase 5 — Voice calls (weeks 7–8)
- [ ] Vapi assistant + `/vapi/call-config`, `/vapi/llm` (custom-llm), `/webhooks/vapi`.
- [ ] iOS: VapiCallService, voice call screen (animation + transcript modes), calls saved into chat history.

### Phase 6 — Subscriptions + profile (weeks 8–9)
- [ ] RevenueCat products, paywall, entitlement mirror webhook, proxy-side gating + usage counters.
- [ ] Profile: photo upload (S3), name, biography editor; settings: sign out, delete account (full cleanup route), subscription management.

### Phase 7 — Hardening + launch (weeks 9–10)
- [ ] Rate limiting, retry/reconcile cron for failed indexing, observability (timing logs on RAG + LLM calls).
- [ ] Empty/loading/error states per design spec; offline save path; accessibility pass (Dynamic Type, VoiceOver).
- [ ] TestFlight beta → App Store review prep (privacy labels, sign-in-with-Apple compliance, account deletion in-app).

### Explicit non-goals for v1
Widgets, push-notification reminders, journal export, web app parity, multi-language STT,
shared journals. The `sources` citations UI in chat is v2.

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Cross-tenant leakage in Chroma | `userId` filter asserted inside retriever/indexer; never expose raw Chroma client to routes |
| On-device STT quality varies | Transcript is editable in detail view; edits re-index + flag summary regeneration |
| Handwriting OCR misses | OCR text shown + editable next to the image; user fix re-indexes |
| Together/Chroma outage breaks app | Fail-soft retrieval (empty context); AI buttons show retry; journaling itself never depends on AI |
| LLM/embedding cost runaway | Daily prompt cached 1/day; rate limits; usage counters; topK constant |
| Shared prod box (PM2, many apps) | New API on its own port (3200); memory caps in PM2 config; do not assume a fresh box |
| Vapi latency on RAG turn | Retriever timeout 3s on the voice path (lower than chat's 10s); skip context rather than stall speech |
| App Store rejection | Sign in with Apple included; in-app account deletion; subscription terms on paywall |
