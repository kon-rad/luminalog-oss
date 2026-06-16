# Background Media Processing + Audio Download — Design

**Date:** 2026-06-16
**Status:** Approved (brainstorming) — ready for implementation plan

## Overview

Two related changes to the journal flows:

1. **Audio download button reposition** — move the existing download button on the
   voice-recording card to the bottom-right of the card, under the duration label.
2. **Background upload + transcribe** — after tapping Save on an audio, image, or
   video entry, dismiss the create screen immediately and run OCR / upload /
   transcription in the background, surfacing progress through a new
   `processingStatus` field on the journal entry.

---

## Part 1 — Audio download button

### Current state

`AudioPlayerCard` (`Features/JournalDetail/JournalDetailMediaViews.swift`) already
has a working download button (uncommitted). It currently sits as the trailing
element of the play/slider `HStack`, vertically centered. Its logic — resolve the
media URL, download to a temp file if remote, present a share sheet — is correct
and stays unchanged.

### Change

Restructure the card from a single `HStack` into a `VStack`:

```
VStack:
  HStack(play button, VStack(slider, HStack(elapsed, "unavailable"?, duration)))
  HStack(Spacer, downloadButton)   // download icon, bottom-right
```

- Download icon appears on its own row **below** the duration label, trailing-aligned.
- Disabled/loading/unavailable states for the button are unchanged.

### Format

Downloaded file stays in the **native `.m4a`** (mono AAC) format — no transcoding.
iOS has no built-in MP3 encoder; native `.m4a` is lossless and a no-op to share.
The only tweak: name the shared temp file `voice_journal.m4a` explicitly.

---

## Part 2 — Background upload + transcribe

### Goal

Tapping Save returns the user to the list immediately. Upload, OCR, the Firestore
write, and server transcription happen in the background, with live status visible
on the entry. Applies to `voice`, `video`, and `image` entries. `text` entries are
already instant and keep their current synchronous save.

### Model change

Add to `JournalEntry` (and `FirestoreMapping`):

```swift
enum ProcessingStatus: String, Codable, Sendable {
    case processing     // initial write / deriving content (OCR)
    case uploading      // media upload in flight
    case saving         // writing final content + media to Firestore
    case transcribing   // server-side Whisper running (voice/video)
    case ready          // pipeline complete
    case failed         // a step failed; retry available in-session
}

var processingStatus: ProcessingStatus?   // nil == legacy/complete entry
```

`transcriptStatus` is unchanged (server-owned: `ready` / `processing` / `failed`).
The UI badge is derived from both: a voice/video entry left at
`processingStatus == .transcribing` is shown as **Transcribing…** until the streamed
`transcriptStatus` flips to `.ready`/`.failed`.

### New service: `EntryProcessor`

A long-lived service (protocol + live impl + mock), held in `AppServices` and
injected into `CreateEntryDependencies`. It owns in-flight jobs so work survives the
dismissal of `CreateEntryViewModel`.

Responsibilities:

- Hold a `ProcessingJob` per `draftId`: typed text, attachment set, staged temp-file
  URLs, entry type, userId, prompt.
- Own temp-file lifecycle (currently in `CreateEntryViewModel.cleanupTempFiles`) —
  delete only on success or explicit discard, so failed jobs remain retryable.
- Drive the pipeline and write status transitions to Firestore.
- Support `retry(draftId:)` for failed jobs (in-session only).
- Run multiple jobs concurrently (keyed by `draftId`).

Interface sketch:

```swift
@MainActor
protocol EntryProcessor: AnyObject {
    func enqueue(_ job: ProcessingJob)
    func retry(draftId: String)
}
```

### New save flow

`CreateEntryViewModel.save()`:

1. Validate (`canSave`, signed in), stop dictation.
2. Build a `ProcessingJob` from current text + attachments + draftId + userId + prompt.
3. Hand it to `EntryProcessor.enqueue(_:)`.
4. Set `didSave = true` → create screen dismisses immediately.

The view-model no longer owns the saving overlay phases or temp-file cleanup for the
committed draft; that moves to `EntryProcessor`. (The transient "preparing" feedback
between tap and dismiss is effectively instantaneous and can be dropped.)

`EntryProcessor` per job:

1. Write entry to Firestore immediately with `processingStatus = .processing`,
   typed text as content, computed title, empty media → **entry appears in list now**.
2. **image:** run OCR (`.processing`) → set `.uploading`, upload photos (+ thumbnails)
   → set `.saving`, write entry with final content + media → `.ready`.
3. **voice/video:** set `.uploading`, upload media → set `.saving`, write entry with
   media → set `.transcribing`, call `ai.transcribeJournal(journalId:)`. Server reads
   media from the saved doc, transcribes, and updates `transcriptStatus`
   (`ready`/`failed`) — streamed back to the client live. Client leaves
   `processingStatus == .transcribing`; the derived badge resolves to done when
   `transcriptStatus` becomes `ready`.
4. On non-voice/video success: `recordEntrySaved` + `ai.requestIndex(journalId:)`
   (both fire-and-forget, as today).
5. On any thrown error: write `processingStatus = .failed`, keep the job in memory.
6. On success: delete the job's temp files and drop the job.

Pipeline ordering is fixed by the server contract: `/transcribe` requires media to
already exist on the saved entry, so upload + save must precede the transcribe call.

Firestore writes use the existing `repository.save(entry)` full-document overwrite.
The client stops overwriting once it hands off to the server (after the
`.transcribing` write), so it never clobbers the server's `transcriptStatus` update.

### Status display

A derived helper on `JournalEntry` produces a display state:

- `processingStatus == .processing` → "Processing…"
- `.uploading` → "Uploading…"
- `.saving` → "Saving…"
- `.transcribing` (or `transcriptStatus == .processing`) → "Transcribing…"
- `.failed` (or `transcriptStatus == .failed`) → "Failed"
- otherwise → no badge (ready)

Shown as a small badge in:
- `EntryRow` (list) — near the type pill.
- `JournalDetailView` — header/status area.

A `.failed` badge is tappable and calls `EntryProcessor.retry(draftId:)`.

### Concurrency & lifecycle

- Multiple entries can process at once; jobs are independent.
- `EntryProcessor` is `@MainActor`; uploads/OCR/transcribe run via `await` on their
  existing async services off the main actor as they already do.

---

## Accepted v1 limitations

1. **In-session retry only.** If the app is killed mid-upload, the in-memory job and
   temp files are gone; a stuck/`failed` entry can then only be deleted, not retried.
   Durable retry (persisting attachments to disk + relaunch scan) is out of scope.
2. **No pre-upload image preview.** Image entries show the status badge (not the
   photo) until upload completes; the photo appears once `media` is written.

---

## Out of scope

- MP3 transcoding.
- Server changes (the existing `/transcribe` route already does what we need).
- Durable/background-task (BGTaskScheduler) processing across app launches.
- Changes to `text` entry save (stays synchronous/instant).

---

## Testing

- `EntryProcessor` live impl: unit tests with mock repository / media / ai / ocr
  covering each type's transition sequence, failure → `.failed`, and `retry`.
- `CreateEntryViewModel.save()`: hands job to a mock `EntryProcessor` and dismisses
  immediately (no longer drives upload/save itself).
- `JournalEntry` derived display-status helper: table of (`processingStatus`,
  `transcriptStatus`) → expected badge.
- `AudioPlayerCard`: layout/preview check that the download button renders in the
  bottom-right position; existing download/share behavior unchanged.
