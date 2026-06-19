# Entry options menu: metadata, edit, delete — Design

**Date:** 2026-06-18
**Status:** Approved (brainstorm complete)
**Spec:** this file · **Plan:** `docs/superpowers/plans/2026-06-18-entry-options-edit-delete.md` · **ADR:** ADR-0012

## Summary

Add an entry-management surface to the Journal Detail screen. A new "…" button in
the top-right toolbar opens an **options sheet** ("settings menu") that:

1. **Shows metadata** — when the entry was created, and a dated history of every
   user edit (date/time + which fields changed).
2. **Edits the entry** — a text-only edit flow for the **title** and **canonical
   content** (typed body / transcript / image OCR text). Media, assets, and entry
   type are immutable: editing can never add or remove a photo, audio, or video,
   and the type never changes.
3. **Deletes the entry** — behind an irreversible-action confirmation. Deletion
   removes the S3 media (video/audio/images), the RAG embeddings, the summary
   embedding, and the Firestore journal record.

When an edit changes the **content**, the entry is re-embedded and its summary
regenerated. When an edit changes **only the title**, no re-indexing occurs.

## Decisions (from brainstorm)

- **Editable fields:** `title` + canonical `content`. AI summary/insights/prompts
  stay read-only and regenerate automatically. Media and `type` are locked.
- **Re-index trigger:** content change only. A title-only edit writes Firestore
  but does **not** re-embed or re-summarize.
- **Edit history granularity:** each edit records `editedAt` + the list of fields
  changed (e.g. `["title"]`, `["content"]`, `["title","content"]`).
- **Delete failure policy:** best-effort. The Firestore record is always removed
  so the entry disappears from the user's list; remote-cleanup failures (S3 /
  embeddings) are logged, accepting possible orphaned remote artifacts.
- **Image voice-memo editor exception:** the existing image `TranscriptEditorView`
  (records and appends voice memos — ADR around 2026-06-16) is kept as-is. The
  no-new-media rule applies to the **new general edit flow**; the image transcript
  editor remains the one intentional exception, reachable from the Main tab.

## Scope of an "edit"

Only **user-initiated** changes to `title`/`content` via the new edit flow append
an `EditRecord`. Background processing (upload/transcribe pipeline) and AI
generation (summary/insights/prompts) are **not** edits and do not append records.
The existing image transcript editor continues to set `contentEditedAt` (driving
stale-summary detection) but is out of scope for the edit-history list in v1.

---

## Data model changes

### `EditRecord` (new, `Core/Models/JournalEntry.swift`)

```swift
struct EditRecord: Codable, Equatable, Sendable {
    var editedAt: Date
    var fields: [String]   // subset of ["title", "content"]
}
```

### `JournalEntry` (new field)

```swift
var editHistory: [EditRecord]   // appended on each user edit; default []
```

- `createdAt` (existing) → the "Created" row.
- `contentEditedAt` (existing) → unchanged; still flags stale summaries server-side
  and gates the summary "Regenerate" affordance.
- `updatedAt` (existing) → unchanged; server write timestamp.

### Firestore mapping (`Core/Persistence/FirestoreMapping.swift`)

`editHistory` is stored as an array of plaintext maps `{ editedAt: Timestamp,
fields: [String] }`. It contains **no journal content** (only timestamps and field
names), so per the metadata convention (ADR-0002) it is **not** field-encrypted —
consistent with `media` metadata and `vector` state.

- Encode in `firestoreData(cipher:)`: `editHistory.map { ["editedAt": Timestamp, "fields": $0.fields] }`
  (omit the key when empty).
- Decode in `init?(documentId:data:cipher:)`: map `data["editHistory"]` (default `[]`).
- Add `EditRecord(data:)` / `EditRecord.firestoreData` helpers mirroring `MediaItem`.

---

## iOS components

### 1. Toolbar "…" button (`JournalDetailView.swift`)

Add a second `ToolbarItem(placement: .topBarTrailing)` with an
`ellipsis.circle` button (shown only once `viewModel.entry` is loaded). Tapping it
sets `@State private var isShowingOptions = true`, presenting `EntryOptionsView` as
a sheet. The existing `TypePill` toolbar item stays.

### 2. `EntryOptionsView` (new, `Features/JournalDetail/EntryOptionsView.swift`)

A sheet ("settings menu"). Presented with the loaded `entry`. Sections:

- **Details** — read-only metadata:
  - "Created" → `entry.createdAt` (`.abbreviated` date + `.shortened` time).
  - "Edits" → list of `entry.editHistory` rows, newest first, each showing the
    formatted `editedAt` and a humanized field list ("Title", "Content", or
    "Title & content"). Empty state: "No edits yet."
- **Actions:**
  - **Edit** — dismisses the sheet and signals the detail view to present the edit
    flow (via a callback or shared `@State` binding).
  - **Delete** (destructive / red, `trash` icon) — presents a
    `confirmationDialog`: title "Delete this entry?", message "This can't be
    undone. The entry, its media, and all related data will be permanently
    removed.", destructive button "Delete", plus "Cancel". Confirming calls the
    view model's delete path.

The view is preview-friendly (takes the `entry` value and closures), no direct
Firebase access.

### 3. Edit flow — `EntryEditView` + `EntryEditViewModel` (new, `Features/JournalDetail/`)

Presented as a sheet from the detail view after "Edit" is chosen. Uniform across
all four types:

- **Fields:** a title `TextField` and a content `TextEditor` (multiline). Labeled
  per type for content ("Body" for text, "Transcript" for voice/video,
  "Transcribed text" for image).
- **Locked media:** a read-only footer noting media is part of the entry and can't
  be changed here (e.g. "Photos, audio, and video can't be changed after
  creation."), shown when `entry.media` is non-empty. No add/remove controls.
- **Save (`EntryEditViewModel.save()`):**
  1. Trim inputs. Compute `changed = []`; add `"title"` if title differs, `"content"`
     if content differs. If `changed` is empty → dismiss without writing.
  2. Build `EditRecord(editedAt: Date(), fields: changed)`.
  3. Persist via the new repository method `applyEntryEdit(...)` (below):
     - always sets `title`, `content`, array-unions the `EditRecord`, and sets
       `updatedAt` to server time;
     - sets `contentEditedAt = editedAt` **only when `content` changed**.
  4. If `content` changed → `await ai.requestIndex(journalId:)` (fire-and-forget).
     The server `/v1/rag/index` re-purges + re-embeds the chunks and, because
     `contentEditedAt > summary.generatedAt`, regenerates the summary and its
     embedding. No `force` flag is needed. Title-only edits skip this entirely.
  5. On `JournalRepositoryError.entryNotFound` (entry deleted mid-edit): surface a
     message and dismiss.
- The live Firestore listener in `JournalDetailViewModel` refreshes the detail UI
  after the write; the regenerated summary arrives via the same listener.

### 4. Repository method (`JournalRepository` + `FirestoreJournalRepository`)

```swift
func applyEntryEdit(
    id: String,
    title: String,
    content: String,
    contentEditedAt: Date?,   // non-nil only when content changed
    edit: EditRecord
) async throws
```

Implementation (mirrors `updateContent` error handling — `updateData` never
recreates a deleted doc, maps `notFound` → `JournalRepositoryError.entryNotFound`):

```swift
var payload: [String: Any] = [
    "title": try cipher.sealed(title, "journals.title"),
    "content": try cipher.sealed(content, "journals.content"),
    "updatedAt": FieldValue.serverTimestamp(),
    "editHistory": FieldValue.arrayUnion([edit.firestoreData]),
]
if let contentEditedAt { payload["contentEditedAt"] = Timestamp(date: contentEditedAt) }
```

`updateContent` (image transcript editor) is left untouched.

### 5. Delete path (`JournalDetailViewModel`)

Add `@Published private(set) var didDelete = false` and:

```swift
func delete() async {
    guard let entry else { return }
    // Best-effort remote cleanup (S3 media + embeddings + summary).
    do { try await ai.deleteEntry(journalId: entryId) }
    catch { logger.error("remote delete cleanup failed; removing record anyway") }
    // Always remove the Firestore record so the entry disappears.
    do { try await journals.delete(id: entryId) }
    catch { logger.error("firestore delete failed") }
    didDelete = true
}
```

`JournalDetailView` observes `didDelete` and calls `@Environment(\.dismiss)` to pop
back to the list (the list's live stream drops the row).

### 6. AI service (`AIService` + `ProxyAIService` + mocks)

Add to the protocol:

```swift
/// Best-effort server-side purge of an entry's remote artifacts:
/// S3 media objects, RAG chunk embeddings, and the summary embedding.
/// Does NOT delete the Firestore record (the client owns that).
func deleteEntry(journalId: String) async throws
```

`ProxyAIService` implements it via the extended delete route:

```swift
func deleteEntry(journalId: String) async throws {
    try await api.delete(path: "/v1/rag/delete?journalId=\(journalId)")
}
```

`MockAIService` and every in-test `AIService` mock get a no-op/recording impl.

### 7. API client (`ProxyAPIClient`)

Add a `DELETE` helper mirroring `post(path:)` (401-once retry, status validation,
empty-body ignore):

```swift
func delete(path: String) async throws
```

---

## Server changes

### Extend `DELETE /v1/rag/delete` (`server/src/routes/rag.ts`)

Today it deletes chunk embeddings + summary embedding. Extend it to also purge S3
media, keeping it the single "purge an entry's RAG/media artifacts" endpoint:

1. Read `journals/{journalId}` from Firestore.
   - **Exists:** verify `data.userId === uid` → `403` otherwise. Collect media keys
     from `data.media[]` (each `s3Key`, plus `thumbnailS3Key` when present).
     Best-effort delete those S3 objects (see S3 helper). Ownership double-check:
     only delete keys that start with `users/<uid>/` (matches the upload key
     scheme `users/<uid>/journals/<journalId>/<kind>-<uuid>.<ext>`).
   - **Missing** (already deleted, or media keys unavailable): skip S3, continue.
2. `await deleteJournalEntry(uid, journalId)` (chunks) and
   `await deleteSummary(uid, journalId)` (summary) — as today.
3. Respond `{ deleted: true }`.

S3 failures are caught and logged (best-effort), not surfaced as 500, so the client
always proceeds to remove the Firestore record. A hard failure of the embedding
purge still returns 500 (the client logs and deletes the record anyway, per policy).

### S3 delete helper (`server/src/services/s3.ts`, new)

Extract the `S3Client` construction (currently inline in `routes/media.ts`) into a
shared module and add a batch delete:

```ts
export const s3 = new S3Client({ region, credentials })
export async function deleteMediaObjects(keys: string[]): Promise<void>  // DeleteObjectsCommand
```

`routes/media.ts` is refactored to import `s3` from this module (no behavior
change). `routes/rag.ts` imports `deleteMediaObjects`.

### userId scoping

All operations stay `userId`-scoped (CLAUDE.md invariant): the route verifies doc
ownership before touching S3, `deleteJournalEntry`/`deleteSummary` already filter on
`userId`/`entryId`, and only `users/<uid>/`-prefixed keys are deleted.

---

## Data flow

**Edit (content changed):**
```
EntryEditView.save → EntryEditViewModel
  → repo.applyEntryEdit(title, content, contentEditedAt=now, edit)   [Firestore]
  → ai.requestIndex(journalId)                                       [POST /v1/rag/index]
       server: purge+re-embed chunks; summary stale → regenerate + re-embed summary
  → live listener refreshes detail (new content + new summary)
```

**Edit (title only):** `repo.applyEntryEdit(..., contentEditedAt=nil, edit)` — no
index call.

**Delete:**
```
EntryOptionsView → confirm → JournalDetailViewModel.delete()
  → ai.deleteEntry(journalId)        [DELETE /v1/rag/delete?journalId=]
       server: verify owner → best-effort S3 delete → purge chunks + summary
  → repo.delete(id)                  [Firestore]   (always, best-effort)
  → didDelete=true → view dismisses
```

## Error handling

- **Edit, entry deleted mid-edit:** `entryNotFound` → message + dismiss; never
  recreates the doc (`updateData` semantics).
- **Edit, index failure:** swallowed (fire-and-forget); server reconcile retries.
  Stale summary remains flagged until re-index succeeds.
- **Delete, remote cleanup failure:** logged; Firestore record still removed
  (best-effort policy). Possible orphaned S3/embeddings, logged server-side.
- **Delete, Firestore failure:** logged; the entry stays until the next attempt.

## Testing

- **Model/mapping:** `editHistory` round-trips through `firestoreData` ↔
  `init?(documentId:data:cipher:)`; empty history omitted/defaults to `[]`.
- **`EntryEditViewModel`:** title-only edit does not call `requestIndex` and passes
  `contentEditedAt=nil`; content edit calls `requestIndex` and sets
  `contentEditedAt`; no-op edit (nothing changed) writes nothing; `entryNotFound`
  path surfaces a message.
- **`JournalDetailViewModel.delete`:** calls `ai.deleteEntry` then `repo.delete`;
  sets `didDelete`; still deletes the record when `ai.deleteEntry` throws.
- **Repository:** `applyEntryEdit` array-unions the record, sets fields, and throws
  `entryNotFound` on a missing doc.
- **Server:** unit/integration around the extended delete (owner check → 403;
  missing doc → still purges embeddings; S3 failure → still 200 + embeddings purged).

## Out of scope

- Editing media, adding/removing assets, or changing entry type.
- Editing AI summary/insights/prompts text directly.
- Recording edit history for the image transcript editor's voice-memo flow.
- Undo / soft-delete / trash.
