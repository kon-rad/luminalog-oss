# Editable transcript + voice memos on image journal entries

**Date:** 2026-06-16
**Status:** Design — approved approach, pending spec review
**Scope:** iOS (`LuminaLog`) + server (`server/`)

## Summary

On an image journal entry's detail screen, the transcript section (currently
read-only OCR text shown under the photos) gains an **Edit** button in its
top-right corner. Tapping it opens a sheet with a text editor where the user
can:

- Edit the transcript text freely.
- Clear the editor with an **"x"** button.
- **Record audio**, which is transcribed by a backend Whisper endpoint; the
  returned transcript is **appended to the end of the editor text**.

Each recorded clip is saved to the entry as an encrypted audio attachment in
S3. On the detail view, every audio clip renders as a play/scrub/download card
(the existing `AudioPlayerCard`) above the transcript block.

This feature is **scoped to image entries only.** Voice and video entries
already pair a transcript with their source audio and use the existing
server-side Whisper retry flow.

## Decisions (locked)

| Decision | Choice |
|----------|--------|
| Entry types | Image entries only |
| Audio clips per entry | Multiple — each persists as its own attachment + player card |
| Transcribed-text placement | **Appended to the end** of the editor text (no cursor insertion) |
| Edit reachability | Always available on image entries, even when content is empty |
| Backend transcription | **New stateless `POST /v1/ai/transcribe-clip`** — audio in, `{ text }` out; no S3 read, no Firestore write |

Because the transcript is appended to the end (never inserted at the cursor), no
cursor-position tracking is needed and a plain SwiftUI `TextEditor` (iOS 17
compatible) is sufficient — no `UITextView` wrapper required. Appending means
recording multiple clips accumulates all their transcripts in the editor, each
as a new paragraph, in record order.

## Existing building blocks (reused, not rebuilt)

- `AudioRecorderController` — records mono AAC `.m4a` into a temp file, publishes
  elapsed time, handles mic-permission-denied. Returns `AudioAttachment(url, durationSec)`.
- `AudioPlayerCard` (in `JournalDetailMediaViews.swift`) — play/pause, scrubber,
  elapsed/total labels, and a download/share button. Renders per `MediaItem`.
- `MediaUploader.upload(fileURL:kind:journalId:)` — `ProxyMediaUploader` encrypts
  media bytes with the user's DEK and uploads to S3 via a presigned URL, returning
  a `MediaItem`.
- `aiClient.transcribeAudio(buffer, filename)` (server) — POSTs to Together AI
  Whisper, returns trimmed text. Directly reused by the new endpoint.
- `ai.requestIndex(journalId)` → `POST /v1/rag/index` — re-indexes the entry into
  Chroma for RAG. Fire-and-forget.
- Field encryption: `cipher.sealed(content, "journals.content")` on write,
  `cipher.opened(...)` on read (`FirestoreMapping.swift`).

## Architecture

### Server — new endpoint `POST /v1/ai/transcribe-clip`

- **Auth:** `firebaseAuth` middleware (same as other AI routes).
- **Body:** raw audio bytes via `express.raw({ type: 'audio/*', limit: '25mb' })`,
  so no multipart/multer dependency is added. (Confirm `index.ts` body-parser
  setup allows a per-route raw parser; if a global JSON parser would intercept,
  mount `express.raw` directly on this route.)
- **Behavior:**
  1. Reject empty body → 400.
  2. `const text = await transcribeAudio(req.body, 'clip.m4a')`.
  3. `res.json({ text })`.
- **No S3 read, no Firestore write, no DEK needed** — the clip arrives over TLS,
  is transcribed in memory, and discarded. The clip persists to S3 only when the
  client saves (see below), where it is encrypted by `ProxyMediaUploader`.
- **Errors:** Whisper/network failure → 500 `{ error: 'Transcription failed' }`.

### iOS

#### 1. `TranscriptBlock` — optional Edit affordance

Add `var onEdit: (() -> Void)? = nil`. When non-nil, render an "Edit" button
(SF Symbol `pencil` or text "Edit") in the block header row, trailing the label,
44pt min touch target, `Color.accentWarm`. Existing call sites pass nothing and
are unchanged; only `imageContent` passes a handler.

#### 2. `CursorTextEditor` — NOT needed

Dropped. Plain `TextEditor` suffices (transcript is appended to the end, never
inserted mid-text).

#### 3. `TranscriptEditorView` (new) — presented as `.sheet`

Layout (top → bottom), following existing theme tokens (`Spacing`, `CornerRadius`,
`Color.*`, fonts):

- Navigation bar: **Cancel** (leading), **Save** (trailing, disabled while saving).
- A `TextEditor` bound to `viewModel.text`, with a clear **"x"** button
  (overlay, top-trailing of the editor) that sets text to `""`.
- A **Record** control:
  - Idle: "Record audio" button (mic icon).
  - Recording: shows `controller.elapsedLabel` + a Stop button.
  - Transcribing: inline `ProgressView` + "Transcribing…".
- A list of **pending clips** recorded this session (count + a small row each),
  so the user sees what will be attached on Save.
- Mic-permission-denied → existing Settings-alert pattern (mirrors
  `CreateEntryMediaViews`).

#### 4. `TranscriptEditorViewModel` (new, `@MainActor`)

State:
- `text: String` — working transcript (seeded from `entry.content`).
- `pendingClips: [AudioAttachment]` — recorded-but-not-yet-uploaded clips.
- `recordState`, `transcribeState`, `saveState` — `AIActionState`-style enums.

Dependencies (injected for testability): `AudioRecorderController`, an audio
transcribe function (proxy call to `/v1/ai/transcribe-clip`), `MediaUploader`,
`JournalRepository`, `AIService` (for `requestIndex`), `entryId`, `journalId`.

Behavior:
- **Record stop:** receive `AudioAttachment` → set `transcribeState = .loading`
  → POST clip bytes to `/v1/ai/transcribe-clip` → on success **append** the
  returned text to `text` as a new paragraph (`text = [text, returnedText]`
  joined with `"\n\n"`, trimming so an empty editor yields just the transcript)
  and append the clip to `pendingClips`; on failure keep the clip in
  `pendingClips` (audio still saved) and surface a per-clip retry.
- **Clear ("x"):** `text = ""`.
- **Save:**
  1. `saveState = .loading`.
  2. For each `pendingClips`: `media.upload(fileURL: clip.url, kind: .audio, journalId:)`
     → collect `[MediaItem]` (carry `durationSec`).
  3. `repository.updateContent(id:, content: text, contentEditedAt: Date(), appendedMedia:)`.
  4. `await ai.requestIndex(journalId)` (fire-and-forget; failures swallowed).
  5. Dismiss sheet. Firestore listener refreshes the detail view.
  - On upload/persist failure: keep sheet open, `saveState = .failed`, allow retry
    (typed edits preserved).
  - On `JournalRepositoryError.entryNotFound`: show "entry no longer available",
    dismiss.

#### 5. Detail view — `imageContent`

```
private func imageContent(_ entry: JournalEntry) -> some View {
    VStack(alignment: .leading, spacing: Spacing.m) {
        ForEach(entry.media.filter { $0.kind == .image }, id: \.s3Key) { item in
            EntryImageView(item: item, media: media)
        }

        // NEW: one player per recorded voice memo
        ForEach(entry.media.filter { $0.kind == .audio }, id: \.s3Key) { item in
            AudioPlayerCard(item: item, media: media)
        }

        transcriptSection(entry, label: "Transcribed text", onEdit: { presentEditor = true })
    }
}
```

`transcriptSection` passes `onEdit` to `TranscriptBlock`. The sheet binds to a
`@State presentEditor` flag and constructs `TranscriptEditorView` with the
entry's current content + the injected services already available to
`JournalDetailView` (`journals`, `ai`, `media`).

Edge case: if an image entry has empty `content`, still show an Edit entry point
(a minimal "Add a transcript" affordance) so the editor is reachable — otherwise
`transcriptSection` returns `EmptyView` for empty content and the button never
appears. Implement by rendering the Edit affordance even when content is empty
for image entries.

### Persistence — new repository method

Add to `JournalRepository`:

```swift
/// Updates an entry's canonical text and appends audio attachments.
/// Seals `content`, sets `contentEditedAt`, and arrayUnions `appendedMedia`.
/// Throws `JournalRepositoryError.entryNotFound` if the document is gone
/// (never resurrects a deleted entry).
func updateContent(
    id: String,
    content: String,
    contentEditedAt: Date,
    appendedMedia: [MediaItem]
) async throws
```

`FirestoreJournalRepository` implementation:
- `payload["content"] = try cipher.sealed(content, "journals.content")`
- `payload["contentEditedAt"] = Timestamp(date: contentEditedAt)`
- `payload["updatedAt"] = FieldValue.serverTimestamp()`
- if `appendedMedia` non-empty: `payload["media"] = FieldValue.arrayUnion(mediaDicts)`
  (encode each `MediaItem` to its Firestore dict; media metadata is **not**
  field-encrypted — only the S3 bytes are).
- `updateData(payload)`, mapping Firestore `notFound` → `entryNotFound`.

`MockJournalRepository` gets a matching implementation (mutates the in-memory
entry) for previews and tests.

### iOS networking — transcribe-clip call

Add to `AIService` (or a focused transcribe call on the proxy):

```swift
/// Transcribe a recorded audio clip without persisting anything.
/// POSTs raw audio bytes to /v1/ai/transcribe-clip; returns the transcript.
func transcribeClip(audio: Data, contentType: String) async throws -> String
```

`ProxyAIService` posts the raw bytes with `Content-Type: audio/m4a`. The mock
returns a canned string for demo mode and tests.

## Data flow

```
Edit button → sheet(TranscriptEditorView, seeded with entry.content)

Record → stop → AudioAttachment(url, durationSec)
       → POST /v1/ai/transcribe-clip (raw m4a)  →  { text }
       → text = [text, returnedText] joined "\n\n"   (append to end)
       → pendingClips.append(clip)

Save → for each pendingClip: MediaUploader.upload(.audio) → MediaItem
     → repository.updateContent(content, contentEditedAt, appendedMedia)
     → ai.requestIndex(journalId)        (fire-and-forget)
     → dismiss → Firestore listener refreshes detail view
                 (new AudioPlayerCard per clip + updated transcript text;
                  summary "Regenerate" appears via contentEditedAt > summary.generatedAt)
```

## Error handling

| Failure | Behavior |
|---------|----------|
| Transcription (`transcribe-clip`) fails | Keep clip in `pendingClips`; per-clip retry; user can still Save (audio persists without transcript text) |
| Mic permission denied | Existing Settings-alert pattern |
| Clip upload fails on Save | Sheet stays open; `saveState = .failed`; retry; typed edits preserved |
| `updateContent` → entryNotFound | "Entry no longer available"; dismiss |
| `requestIndex` fails | Swallowed; server-side reconcile retries |

## Testing

**iOS unit tests** (`LuminaLogTests`), `TranscriptEditorViewModel` with
`MockMediaUploader`, mock transcribe-clip, `MockJournalRepository`, `MockAIService`:
- Recording stop → transcribe success appends returned text to `text` (as a new
  paragraph) and appends a pending clip; a second clip appends after the first.
- Transcribe failure keeps the clip and leaves prior `text` intact.
- Clear sets `text = ""`.
- Multiple clips accumulate; Save uploads all of them.
- Save calls `updateContent` with sealed content + `contentEditedAt` + all media,
  then `requestIndex`.
- Deleted-entry (`entryNotFound`) path surfaces the error and dismisses.
- `MockJournalRepository.updateContent` mutates the in-memory entry.

**Server test** (`vitest`), `transcribe-clip` route:
- Valid audio body → `{ text }` (Whisper mocked).
- Missing auth → 401.
- Empty body → 400.
- Whisper error → 500.

## Out of scope (YAGNI)

- Editing transcripts on text/voice/video entries.
- Re-ordering or deleting individual audio clips from an entry.
- Live (streaming) dictation in the editor — recording is clip-based.
- On-device (Apple Speech) transcription for these clips — backend Whisper only,
  per the requested flow.
```
