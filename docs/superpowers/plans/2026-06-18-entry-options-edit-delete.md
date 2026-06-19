# Entry options menu (metadata · edit · delete) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "…" options menu to the Journal Detail screen that shows entry metadata + edit history, lets the user edit the title/content (text only — no media or type changes), and deletes the entry along with its S3 media, RAG embeddings, summary embedding, and Firestore record.

**Architecture:** iOS SwiftUI presents an options sheet from the detail toolbar; a new text-only edit flow persists title/content + an edit-history record and re-indexes only when content changes; deletion calls an extended server `DELETE /v1/rag/delete` that now also purges S3 media (owner-verified, best-effort), then the client removes the Firestore doc. The server S3 client is extracted into a shared helper.

**Tech Stack:** Swift / SwiftUI (iOS app), Firebase Firestore, Express + TypeScript (RAG server), ChromaDB, AWS S3 (`@aws-sdk/client-s3`), Vitest (server tests), XCTest (iOS tests).

> **Note on commits:** this workspace is **not** a git repository. Where the standard plan format says "Commit", instead run the relevant build/test verification for that layer (server: `npm test`; iOS: build the test target in Xcode). Do not attempt `git` commands.

> **Spec:** `docs/superpowers/specs/2026-06-18-entry-options-edit-delete-design.md`

---

## File structure

**Server (`luminalog-oss/server/`):**
- Create `src/services/s3.ts` — shared `S3Client` + `deleteMediaObjects(keys)`.
- Modify `src/routes/media.ts` — import `s3` from the new helper (no behavior change).
- Modify `src/routes/rag.ts` — extract a named `deleteHandler`; extend it to verify owner + best-effort purge S3 media.
- Modify/Create `src/routes/rag.test.ts` — tests for `deleteHandler`.

**iOS (`luminalog-oss/ios/LuminaLog/`):**
- Modify `Core/Models/JournalEntry.swift` — add `EditRecord` + `editHistory`.
- Modify `Core/Persistence/FirestoreMapping.swift` — encode/decode `editHistory`.
- Modify `Core/Persistence/JournalRepository.swift` — add `applyEntryEdit(...)`.
- Modify `Core/Persistence/FirestoreJournalRepository.swift` — implement it.
- Modify `Core/Mocks/MockJournalRepository.swift` — implement it.
- Modify `Core/Networking/AIService.swift` — add `deleteEntry(journalId:)`.
- Modify `Core/Networking/ProxyAIService.swift` — implement via DELETE route.
- Modify `Core/Networking/ProxyAPIClient.swift` — add `delete(path:)`.
- Modify `Core/Mocks/MockAIService.swift` — no-op `deleteEntry`.
- Create `Features/JournalDetail/EntryOptionsView.swift` — options sheet.
- Create `Features/JournalDetail/EntryEditView.swift` — text-only edit sheet.
- Create `Features/JournalDetail/EntryEditViewModel.swift` — edit logic.
- Modify `Features/JournalDetail/JournalDetailView.swift` — "…" toolbar button + sheets + dismiss-on-delete.
- Modify `Features/JournalDetail/JournalDetailViewModel.swift` — `delete()` + `didDelete`.

**iOS tests (`luminalog-oss/ios/LuminaLogTests/`):**
- Modify `EncryptedMappingTests.swift` — `editHistory` round-trip.
- Create `EntryEditViewModelTests.swift` — edit diff / re-index behavior.
- Modify `JournalDetailViewModelTests.swift` — `delete()` behavior + add `deleteEntry` to the spy.
- Modify the in-test `AIService` mocks in `ChatViewModelTests.swift`, `HomeViewModelTests.swift`, `RelatedViewModelTests.swift`, `TranscriptEditorViewModelTests.swift`, `EntryProcessorTests.swift` — add the `deleteEntry` stub so they still compile.

---

## Task 1: Server — shared S3 helper

**Files:**
- Create: `luminalog-oss/server/src/services/s3.ts`
- Modify: `luminalog-oss/server/src/routes/media.ts:7-13` (S3 client construction)

- [ ] **Step 1: Create the S3 helper**

Create `luminalog-oss/server/src/services/s3.ts`:

```ts
import { S3Client, DeleteObjectsCommand } from '@aws-sdk/client-s3'
import { config } from '../config'

/** Shared S3 client (presigned URLs in media.ts; object deletes in rag.ts). */
export const s3 = new S3Client({
  region: config.AWS_REGION,
  credentials: {
    accessKeyId: config.AWS_ACCESS_KEY_ID,
    secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
  },
})

/** Best-effort batch delete. No-ops on an empty list. Throws on SDK error so
 *  callers can log; callers treat deletion as best-effort. */
export async function deleteMediaObjects(keys: string[]): Promise<void> {
  if (keys.length === 0) return
  await s3.send(
    new DeleteObjectsCommand({
      Bucket: config.AWS_S3_BUCKET,
      Delete: { Objects: keys.map(Key => ({ Key })), Quiet: true },
    }),
  )
}
```

- [ ] **Step 2: Refactor `media.ts` to use the shared client**

In `luminalog-oss/server/src/routes/media.ts`, remove the local `s3` construction (the `new S3Client({...})` block, lines ~7-13) and its now-unused imports `S3Client` (keep `PutObjectCommand`, `GetObjectCommand`). Add:

```ts
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { s3 } from '../services/s3'
```

Leave the rest of `media.ts` unchanged (it already references `s3`).

- [ ] **Step 3: Verify the server still builds**

Run: `cd luminalog-oss/server && npx tsc --noEmit`
Expected: no type errors.

---

## Task 2: Server — extend the delete route to purge S3 media

**Files:**
- Modify: `luminalog-oss/server/src/routes/rag.ts` (the `ragRouter.delete('/delete', …)` block)
- Modify: `luminalog-oss/server/src/routes/rag.test.ts`

- [ ] **Step 1: Write the failing tests**

Append to `luminalog-oss/server/src/routes/rag.test.ts`. First extend the existing top-of-file mocks so `deleteHandler`'s dependencies are controllable — update the `journalIndexer`, `summaryIndexer` mocks and add an `s3` service mock:

```ts
// (existing journalIndexer mock already has deleteJournalEntry: vi.fn())
vi.mock('../services/s3', () => ({ deleteMediaObjects: vi.fn(async () => {}) }))
```

Then add a describe block (uses a per-test `db` doc via overriding the firebaseAuth mock's `db` is awkward, so `deleteHandler` reads the doc through the same mocked `db`; the default mock returns `{ userId: 'u' }` with no media). Add:

```ts
import { deleteHandler } from './rag'
import { deleteJournalEntry } from '../services/journalIndexer'
import { deleteSummary } from '../services/summaryIndexer'
import { deleteMediaObjects } from '../services/s3'

describe('deleteHandler', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('400 without journalId', async () => {
    const req: any = { uid: 'u', query: {} }
    const res = mockRes()
    await deleteHandler(req, res)
    expect(res.statusCode).toBe(400)
  })

  it('purges embeddings + summary and returns deleted:true', async () => {
    const req: any = { uid: 'u', query: { journalId: 'e1' } }
    const res = mockRes()
    await deleteHandler(req, res)
    expect(deleteJournalEntry).toHaveBeenCalledWith('u', 'e1')
    expect(deleteSummary).toHaveBeenCalledWith('u', 'e1')
    expect(res.body).toEqual({ deleted: true })
  })

  it('still purges embeddings when S3 delete throws (best-effort)', async () => {
    ;(deleteMediaObjects as any).mockRejectedValueOnce(new Error('s3 down'))
    const req: any = { uid: 'u', query: { journalId: 'e1' } }
    const res = mockRes()
    await deleteHandler(req, res)
    expect(deleteJournalEntry).toHaveBeenCalledWith('u', 'e1')
    expect(res.body).toEqual({ deleted: true })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd luminalog-oss/server && npx vitest run src/routes/rag.test.ts`
Expected: FAIL — `deleteHandler` is not exported.

- [ ] **Step 3: Implement `deleteHandler` and wire the route**

In `luminalog-oss/server/src/routes/rag.ts`, add the import near the top:

```ts
import { deleteMediaObjects } from '../services/s3'
```

Replace the existing `ragRouter.delete('/delete', firebaseAuth, async (req, res) => { … })` block with an extracted, exported handler and a thin route binding:

```ts
export async function deleteHandler(req: Request, res: Response): Promise<void> {
  const uid = (req as any).uid as string
  const journalId = req.query['journalId'] as string | undefined

  if (!journalId) {
    res.status(400).json({ error: 'Missing journalId query param' })
    return
  }

  // Best-effort S3 media purge. Read the doc for the media keys and verify
  // ownership; a missing doc just means there are no keys to collect.
  try {
    const snap = await db.collection('journals').doc(journalId).get()
    if (snap.exists) {
      const data = snap.data()!
      if (data.userId !== uid) {
        res.status(403).json({ error: 'Forbidden' })
        return
      }
      const prefix = `users/${uid}/`
      const keys: string[] = []
      for (const m of (data.media ?? []) as Array<Record<string, unknown>>) {
        const k = m['s3Key']
        const t = m['thumbnailS3Key']
        if (typeof k === 'string' && k.startsWith(prefix)) keys.push(k)
        if (typeof t === 'string' && t.startsWith(prefix)) keys.push(t)
      }
      await deleteMediaObjects(keys)
    }
  } catch (err) {
    // Best-effort: log and continue to embedding purge (spec delete policy).
    console.error('[rag/delete] media purge failed (continuing)', err)
  }

  try {
    await deleteJournalEntry(uid, journalId)
    await deleteSummary(uid, journalId)
    res.json({ deleted: true })
  } catch (err) {
    console.error('[rag/delete]', err)
    res.status(500).json({ error: 'Delete failed' })
  }
}

ragRouter.delete('/delete', firebaseAuth, deleteHandler)
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd luminalog-oss/server && npx vitest run src/routes/rag.test.ts`
Expected: PASS (all `deleteHandler` + existing `relatedHandler` tests).

- [ ] **Step 5: Verify the whole server suite + types**

Run: `cd luminalog-oss/server && npm test && npx tsc --noEmit`
Expected: all tests pass, no type errors.

---

## Task 3: iOS model — `EditRecord` + `editHistory`

**Files:**
- Modify: `luminalog-oss/ios/LuminaLog/Core/Models/JournalEntry.swift`
- Modify: `luminalog-oss/ios/LuminaLog/Core/Persistence/FirestoreMapping.swift`
- Modify: `luminalog-oss/ios/LuminaLogTests/EncryptedMappingTests.swift`

- [ ] **Step 1: Write the failing round-trip test**

Add to `luminalog-oss/ios/LuminaLogTests/EncryptedMappingTests.swift`:

```swift
func testJournalEntryRoundTripsEditHistory() throws {
    let edited = Date(timeIntervalSince1970: 1_760_500_000)
    let entry = JournalEntry(
        id: "e1", userId: "u1", type: .text, title: "t",
        createdAt: created, updatedAt: created, content: "c",
        editHistory: [EditRecord(editedAt: edited, fields: ["title", "content"])],
        wordCount: 1
    )
    let data = try entry.firestoreData(cipher: cipher)

    // Edit history is metadata — stored plaintext (not an encrypted envelope).
    let raw = try XCTUnwrap(data["editHistory"] as? [[String: Any]])
    XCTAssertEqual(raw.first?["fields"] as? [String], ["title", "content"])

    let decoded = try XCTUnwrap(JournalEntry(documentId: "e1", data: data, cipher: cipher))
    XCTAssertEqual(decoded.editHistory.count, 1)
    XCTAssertEqual(decoded.editHistory.first?.fields, ["title", "content"])
    XCTAssertEqual(decoded.editHistory.first?.editedAt, edited)
}

func testJournalEntryOmitsEmptyEditHistory() throws {
    let entry = JournalEntry(
        id: "e1", userId: "u1", type: .text, title: "t",
        createdAt: created, updatedAt: created, content: "c", wordCount: 1
    )
    let data = try entry.firestoreData(cipher: cipher)
    XCTAssertNil(data["editHistory"], "Entries with no edits write no editHistory field")
    let decoded = try XCTUnwrap(JournalEntry(documentId: "e1", data: data, cipher: cipher))
    XCTAssertEqual(decoded.editHistory, [])
}
```

- [ ] **Step 2: Add `EditRecord` and the `editHistory` field to the model**

In `luminalog-oss/ios/LuminaLog/Core/Models/JournalEntry.swift`, add the struct (place it above `JournalEntry`, near `AIPrompts`):

```swift
/// A timestamped record of a user edit to an entry's title/content.
/// `fields` is a subset of ["title", "content"] — what changed in that edit.
struct EditRecord: Codable, Equatable, Sendable {
    var editedAt: Date
    var fields: [String]

    init(editedAt: Date = Date(), fields: [String]) {
        self.editedAt = editedAt
        self.fields = fields
    }
}
```

In `struct JournalEntry`, add the stored property after `contentEditedAt`:

```swift
    /// Dated history of user edits to title/content (newest entries appended).
    var editHistory: [EditRecord]
```

Add the parameter to `init(...)` (after `contentEditedAt: Date? = nil,`):

```swift
        editHistory: [EditRecord] = [],
```

and assign it in the body (after `self.contentEditedAt = contentEditedAt`):

```swift
        self.editHistory = editHistory
```

- [ ] **Step 3: Map `editHistory` in FirestoreMapping**

In `luminalog-oss/ios/LuminaLog/Core/Persistence/FirestoreMapping.swift`, inside `JournalEntry.init?(documentId:data:cipher:)`, add a decode line before the `self.init(` call:

```swift
        let editHistory = (data["editHistory"] as? [[String: Any]] ?? []).compactMap(EditRecord.init(data:))
```

and pass it into `self.init(...)` (after `contentEditedAt: timestamp(data["contentEditedAt"]),`):

```swift
                editHistory: editHistory,
```

In `func firestoreData(cipher:)`, after the `if let contentEditedAt { … }` line add:

```swift
        if !editHistory.isEmpty {
            // Metadata only (timestamps + field names) — not field-encrypted.
            data["editHistory"] = editHistory.map(\.firestoreData)
        }
```

Add an `EditRecord` mapping extension (next to the `MediaItem` extension):

```swift
extension EditRecord {

    init?(data: [String: Any]) {
        guard let editedAt = timestamp(data["editedAt"]) else { return nil }
        self.init(
            editedAt: editedAt,
            fields: data["fields"] as? [String] ?? []
        )
    }

    var firestoreData: [String: Any] {
        ["editedAt": Timestamp(date: editedAt), "fields": fields]
    }
}
```

- [ ] **Step 4: Run the mapping tests**

Run the `EncryptedMappingTests` in Xcode (scheme `LuminaLog`, test target `LuminaLogTests`), or:
`cd luminalog-oss/ios && xcodebuild test -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:LuminaLogTests/EncryptedMappingTests`
Expected: PASS, including the two new tests.

---

## Task 4: iOS repository — `applyEntryEdit`

**Files:**
- Modify: `luminalog-oss/ios/LuminaLog/Core/Persistence/JournalRepository.swift`
- Modify: `luminalog-oss/ios/LuminaLog/Core/Persistence/FirestoreJournalRepository.swift`
- Modify: `luminalog-oss/ios/LuminaLog/Core/Mocks/MockJournalRepository.swift`
- Modify: `luminalog-oss/ios/LuminaLogTests/MockJournalRepositoryTests.swift`

- [ ] **Step 1: Write the failing test**

Add to `luminalog-oss/ios/LuminaLogTests/MockJournalRepositoryTests.swift`:

```swift
@MainActor
func testApplyEntryEditUpdatesFieldsAndAppendsHistory() async throws {
    let entry = JournalEntry(id: "e1", userId: "u1", type: .text, title: "Old", content: "Old body")
    let repo = MockJournalRepository(entries: [entry])

    let when = Date(timeIntervalSince1970: 1_760_600_000)
    try await repo.applyEntryEdit(
        id: "e1", title: "New", content: "New body",
        contentEditedAt: when,
        edit: EditRecord(editedAt: when, fields: ["title", "content"])
    )

    let updated = try await repo.entries(after: nil, limit: 10).first { $0.id == "e1" }
    XCTAssertEqual(updated?.title, "New")
    XCTAssertEqual(updated?.content, "New body")
    XCTAssertEqual(updated?.contentEditedAt, when)
    XCTAssertEqual(updated?.editHistory.count, 1)
    XCTAssertEqual(updated?.editHistory.first?.fields, ["title", "content"])
}

@MainActor
func testApplyEntryEditThrowsWhenMissing() async {
    let repo = MockJournalRepository(entries: [])
    do {
        try await repo.applyEntryEdit(
            id: "nope", title: "t", content: "c", contentEditedAt: nil,
            edit: EditRecord(fields: ["title"])
        )
        XCTFail("expected entryNotFound")
    } catch JournalRepositoryError.entryNotFound {
        // expected
    } catch {
        XCTFail("unexpected error: \(error)")
    }
}
```

- [ ] **Step 2: Run to verify failure**

Expected: FAIL — `applyEntryEdit` is not a member of `JournalRepository`.

- [ ] **Step 3: Add the protocol method**

In `luminalog-oss/ios/LuminaLog/Core/Persistence/JournalRepository.swift`, add before `func delete(id:)`:

```swift
    /// Applies a user edit to an entry's title and content, appending an
    /// `EditRecord` to the edit history. `contentEditedAt` is set ONLY when the
    /// content changed (pass nil for a title-only edit, so the summary is not
    /// flagged stale). Throws `JournalRepositoryError.entryNotFound` if the
    /// document does not exist — it must NEVER recreate a deleted entry.
    func applyEntryEdit(
        id: String,
        title: String,
        content: String,
        contentEditedAt: Date?,
        edit: EditRecord
    ) async throws
```

- [ ] **Step 4: Implement in `FirestoreJournalRepository`**

In `luminalog-oss/ios/LuminaLog/Core/Persistence/FirestoreJournalRepository.swift`, add before `func delete(id:)`:

```swift
    func applyEntryEdit(
        id: String,
        title: String,
        content: String,
        contentEditedAt: Date?,
        edit: EditRecord
    ) async throws {
        guard let cipher = keys.currentCipher else { throw CryptoUnavailableError.keyNotLoaded }
        var payload: [String: Any] = [
            "title": try cipher.sealed(title, "journals.title"),
            "content": try cipher.sealed(content, "journals.content"),
            "updatedAt": FieldValue.serverTimestamp(),
            "editHistory": FieldValue.arrayUnion([edit.firestoreData]),
        ]
        if let contentEditedAt {
            payload["contentEditedAt"] = Timestamp(date: contentEditedAt)
        }
        do {
            try await journals.document(id).updateData(payload)
        } catch let error as NSError
            where error.domain == FirestoreErrorDomain
                && error.code == FirestoreErrorCode.notFound.rawValue {
            throw JournalRepositoryError.entryNotFound(id: id)
        }
    }
```

- [ ] **Step 5: Implement in `MockJournalRepository`**

In `luminalog-oss/ios/LuminaLog/Core/Mocks/MockJournalRepository.swift`, add before `func delete(id:)`:

```swift
    func applyEntryEdit(
        id: String,
        title: String,
        content: String,
        contentEditedAt: Date?,
        edit: EditRecord
    ) async throws {
        guard let index = store.firstIndex(where: { $0.id == id }) else {
            throw JournalRepositoryError.entryNotFound(id: id)
        }
        store[index].title = title
        store[index].content = content
        if let contentEditedAt { store[index].contentEditedAt = contentEditedAt }
        store[index].editHistory.append(edit)
        broadcast(changedId: id)
    }
```

- [ ] **Step 6: Run the repository tests**

Run the `MockJournalRepositoryTests` (Xcode or `xcodebuild test … -only-testing:LuminaLogTests/MockJournalRepositoryTests`).
Expected: PASS.

---

## Task 5: iOS networking — `deleteEntry` + `ProxyAPIClient.delete`

**Files:**
- Modify: `luminalog-oss/ios/LuminaLog/Core/Networking/ProxyAPIClient.swift`
- Modify: `luminalog-oss/ios/LuminaLog/Core/Networking/AIService.swift`
- Modify: `luminalog-oss/ios/LuminaLog/Core/Networking/ProxyAIService.swift`
- Modify: `luminalog-oss/ios/LuminaLog/Core/Mocks/MockAIService.swift`

- [ ] **Step 1: Add a `DELETE` helper to `ProxyAPIClient`**

In `luminalog-oss/ios/LuminaLog/Core/Networking/ProxyAPIClient.swift`, add a public method after `post(path:body:)` (the no-return overload):

```swift
    /// DELETE a path (query string allowed), ignoring the response payload.
    /// Retries exactly once with a force-refreshed token on HTTP 401.
    func delete(path: String) async throws {
        let request = try await makeBodylessRequest(path: path, method: "DELETE")
        var (data, response) = try await session.data(for: request)
        if (response as? HTTPURLResponse)?.statusCode == 401 {
            let retry = try await makeBodylessRequest(path: path, method: "DELETE", forceRefresh: true)
            (data, response) = try await session.data(for: retry)
        }
        try Self.validate(response: response, data: data)
    }
```

Add the request builder after `makeRequest(path:body:forceRefresh:)`:

```swift
    private func makeBodylessRequest(
        path: String,
        method: String,
        forceRefresh: Bool = false
    ) async throws -> URLRequest {
        let component = path.hasPrefix("/") ? String(path.dropFirst()) : path
        let url = baseURL.appendingPathComponent(component)
        var request = URLRequest(url: url)
        request.httpMethod = method
        let token = try await tokenProvider.idToken(forceRefresh: forceRefresh)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        return request
    }
```

> Note: `appendingPathComponent` percent-encodes the path, which would corrupt a `?query=`. To keep the query intact, build the URL from the base + path string. Replace the first two lines of `makeBodylessRequest` with:
>
> ```swift
>         let component = path.hasPrefix("/") ? String(path.dropFirst()) : path
>         guard let url = URL(string: component, relativeTo: baseURL) else {
>             throw ProxyAPIError.invalidURL(path)
>         }
> ```

- [ ] **Step 2: Add `deleteEntry` to the `AIService` protocol**

In `luminalog-oss/ios/LuminaLog/Core/Networking/AIService.swift`, add after `transcribeJournal`:

```swift
    /// Best-effort server-side purge of an entry's remote artifacts: S3 media
    /// objects, RAG chunk embeddings, and the summary embedding. Does NOT delete
    /// the Firestore record — the client owns that.
    func deleteEntry(journalId: String) async throws
```

- [ ] **Step 3: Implement in `ProxyAIService`**

In `luminalog-oss/ios/LuminaLog/Core/Networking/ProxyAIService.swift`, add after `transcribeJournal`:

```swift
    func deleteEntry(journalId: String) async throws {
        let encoded = journalId.addingPercentEncoding(withAllowedCharacters: .urlQueryAllowed) ?? journalId
        try await api.delete(path: "/v1/rag/delete?journalId=\(encoded)")
    }
```

- [ ] **Step 4: Implement no-op in `MockAIService`**

In `luminalog-oss/ios/LuminaLog/Core/Mocks/MockAIService.swift`, add after `transcribeJournal`:

```swift
    func deleteEntry(journalId: String) async throws {
        // No-op in demo mode.
    }
```

- [ ] **Step 5: Add `deleteEntry` stubs to in-test AIService mocks**

So the test target compiles, add `func deleteEntry(journalId: String) async throws {}` to each in-test mock:
- `luminalog-oss/ios/LuminaLogTests/ChatViewModelTests.swift` (near its `requestIndex` stub, ~line 122)
- `luminalog-oss/ios/LuminaLogTests/HomeViewModelTests.swift` (~line 30)
- `luminalog-oss/ios/LuminaLogTests/RelatedViewModelTests.swift` (~line 58)
- `luminalog-oss/ios/LuminaLogTests/TranscriptEditorViewModelTests.swift` (~line 22)
- `luminalog-oss/ios/LuminaLogTests/EntryProcessorTests.swift` (~line 24)

(The `SpyAIService` in `JournalDetailViewModelTests.swift` gets a richer version in Task 7.)

- [ ] **Step 6: Build the app target**

Build the `LuminaLog` scheme in Xcode (or `xcodebuild build -scheme LuminaLog -destination '…'`).
Expected: compiles (test target compiled in later tasks).

---

## Task 6: iOS — `EntryEditViewModel` (edit logic)

**Files:**
- Create: `luminalog-oss/ios/LuminaLog/Features/JournalDetail/EntryEditViewModel.swift`
- Create: `luminalog-oss/ios/LuminaLogTests/EntryEditViewModelTests.swift`

- [ ] **Step 1: Write the failing tests**

Create `luminalog-oss/ios/LuminaLogTests/EntryEditViewModelTests.swift`:

```swift
import XCTest
@testable import LuminaLog

@MainActor
final class EntryEditViewModelTests: XCTestCase {

    private final class SpyAI: AIService {
        var indexCalls = 0
        func generateSummary(journalId: String) async throws -> AIGeneration { .init(text: "", model: "") }
        func generateInsights(journalId: String) async throws -> AIGeneration { .init(text: "", model: "") }
        func generatePrompts(journalId: String) async throws -> [String] { [] }
        func dailyPrompt() async throws -> String { "" }
        func streamChatReply(chatId: String, message: String) -> AsyncThrowingStream<String, Error> {
            AsyncThrowingStream { $0.finish() }
        }
        func requestIndex(journalId: String) async { indexCalls += 1 }
        func transcribeJournal(journalId: String) async throws {}
        func transcribeClip(audio: Data, contentType: String) async throws -> String { "" }
        func relatedEntries(journalId: String, limit: Int) async throws -> [RelatedEntry] { [] }
        func deleteEntry(journalId: String) async throws {}
    }

    private func makeVM(_ entry: JournalEntry, repo: MockJournalRepository, ai: SpyAI) -> EntryEditViewModel {
        EntryEditViewModel(entry: entry, journals: repo, ai: ai)
    }

    func testContentEditReindexesAndSetsContentEditedAt() async throws {
        let entry = JournalEntry(id: "e1", userId: "u", type: .text, title: "T", content: "Body")
        let repo = MockJournalRepository(entries: [entry])
        let ai = SpyAI()
        let vm = makeVM(entry, repo: repo, ai: ai)
        vm.content = "New body"
        await vm.save()

        XCTAssertTrue(vm.didSave)
        XCTAssertEqual(ai.indexCalls, 1)
        let saved = try await repo.entries(after: nil, limit: 10).first { $0.id == "e1" }
        XCTAssertEqual(saved?.content, "New body")
        XCTAssertNotNil(saved?.contentEditedAt)
        XCTAssertEqual(saved?.editHistory.first?.fields, ["content"])
    }

    func testTitleOnlyEditDoesNotReindex() async throws {
        let entry = JournalEntry(id: "e1", userId: "u", type: .text, title: "T", content: "Body")
        let repo = MockJournalRepository(entries: [entry])
        let ai = SpyAI()
        let vm = makeVM(entry, repo: repo, ai: ai)
        vm.title = "New title"
        await vm.save()

        XCTAssertTrue(vm.didSave)
        XCTAssertEqual(ai.indexCalls, 0)
        let saved = try await repo.entries(after: nil, limit: 10).first { $0.id == "e1" }
        XCTAssertEqual(saved?.title, "New title")
        XCTAssertNil(saved?.contentEditedAt)
        XCTAssertEqual(saved?.editHistory.first?.fields, ["title"])
    }

    func testNoChangeWritesNothing() async throws {
        let entry = JournalEntry(id: "e1", userId: "u", type: .text, title: "T", content: "Body")
        let repo = MockJournalRepository(entries: [entry])
        let ai = SpyAI()
        let vm = makeVM(entry, repo: repo, ai: ai)
        await vm.save()

        XCTAssertTrue(vm.didSave)
        XCTAssertEqual(ai.indexCalls, 0)
        let saved = try await repo.entries(after: nil, limit: 10).first { $0.id == "e1" }
        XCTAssertEqual(saved?.editHistory.count, 0)
    }

    func testDeletedMidEditSurfacesMessage() async throws {
        let entry = JournalEntry(id: "e1", userId: "u", type: .text, title: "T", content: "Body")
        let repo = MockJournalRepository(entries: [])   // entry already gone
        let ai = SpyAI()
        let vm = makeVM(entry, repo: repo, ai: ai)
        vm.content = "changed"
        await vm.save()

        XCTAssertNotNil(vm.errorMessage)
        XCTAssertTrue(vm.didSave)   // dismiss
    }
}
```

- [ ] **Step 2: Run to verify failure**

Expected: FAIL — `EntryEditViewModel` does not exist.

- [ ] **Step 3: Implement `EntryEditViewModel`**

Create `luminalog-oss/ios/LuminaLog/Features/JournalDetail/EntryEditViewModel.swift`:

```swift
import Foundation
import OSLog

/// Drives the text-only entry edit sheet: edits title + canonical content and
/// persists them with an edit-history record. Media, assets, and entry type are
/// immutable here (see spec). Re-indexes (re-embeds + re-summarizes) only when
/// the content changed; a title-only edit writes Firestore without re-indexing.
@MainActor
final class EntryEditViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.konradgnat.luminalog", category: "entry-edit")

    @Published var title: String
    @Published var content: String
    @Published private(set) var saveState: AIActionState = .idle
    /// Set true when the sheet should dismiss (successful save, no-op, or the
    /// entry was deleted out from under us).
    @Published private(set) var didSave = false
    @Published var errorMessage: String?

    let entry: JournalEntry
    private let journals: JournalRepository
    private let ai: AIService

    init(entry: JournalEntry, journals: JournalRepository, ai: AIService) {
        self.entry = entry
        self.title = entry.title
        self.content = entry.content
        self.journals = journals
        self.ai = ai
    }

    /// The content label varies by entry type (spec §iOS components 3).
    var contentLabel: String {
        switch entry.type {
        case .text: return "Body"
        case .image: return "Transcribed text"
        case .voice, .video: return "Transcript"
        }
    }

    var hasMedia: Bool { !entry.media.isEmpty }

    func save() async {
        guard saveState != .loading else { return }

        let newTitle = title.trimmingCharacters(in: .whitespacesAndNewlines)
        let newContent = content   // preserve intentional internal whitespace
        var changed: [String] = []
        if newTitle != entry.title { changed.append("title") }
        if newContent != entry.content { changed.append("content") }

        // Nothing changed — just dismiss.
        guard !changed.isEmpty else { didSave = true; return }

        saveState = .loading
        errorMessage = nil
        let now = Date()
        let contentChanged = changed.contains("content")
        do {
            try await journals.applyEntryEdit(
                id: entry.id,
                title: newTitle,
                content: newContent,
                contentEditedAt: contentChanged ? now : nil,
                edit: EditRecord(editedAt: now, fields: changed)
            )
            // Re-embed + re-summarize only when content changed. The server
            // /v1/rag/index re-purges chunks and, because contentEditedAt now
            // post-dates the summary, regenerates the summary + its embedding.
            if contentChanged {
                await ai.requestIndex(journalId: entry.id)
            }
            saveState = .idle
            didSave = true
        } catch JournalRepositoryError.entryNotFound {
            errorMessage = "This entry is no longer available."
            saveState = .failed
            didSave = true
        } catch {
            Self.logger.error("entry edit save failed: \(error.localizedDescription, privacy: .public)")
            errorMessage = "Couldn't save your changes. Please try again."
            saveState = .failed
        }
    }
}
```

- [ ] **Step 4: Run the edit tests**

Run `EntryEditViewModelTests` (Xcode or `xcodebuild test … -only-testing:LuminaLogTests/EntryEditViewModelTests`).
Expected: PASS (all four).

---

## Task 7: iOS — `JournalDetailViewModel.delete()`

**Files:**
- Modify: `luminalog-oss/ios/LuminaLog/Features/JournalDetail/JournalDetailViewModel.swift`
- Modify: `luminalog-oss/ios/LuminaLogTests/JournalDetailViewModelTests.swift`

- [ ] **Step 1: Extend the spy + write failing tests**

In `luminalog-oss/ios/LuminaLogTests/JournalDetailViewModelTests.swift`, add to `SpyAIService` (near `requestIndex`):

```swift
        var deleteCalls = 0
        var shouldFailDelete = false
        func deleteEntry(journalId: String) async throws {
            deleteCalls += 1
            if shouldFailDelete { throw SpyError() }
        }
```

Add tests (use the existing helper that builds a VM with a `MockJournalRepository`; mirror the file's existing setup — it already constructs `JournalDetailViewModel` with a repo + spy). Add:

```swift
    @MainActor
    func testDeleteCallsRemoteThenRemovesRecord() async throws {
        let entry = JournalEntry(id: "entry-1", userId: "u", type: .text, title: "T", content: "B")
        let repo = MockJournalRepository(entries: [entry])
        let ai = SpyAIService()
        let vm = JournalDetailViewModel(entryId: "entry-1", journals: repo, ai: ai)
        await vm.start()

        await vm.delete()

        XCTAssertEqual(ai.deleteCalls, 1)
        XCTAssertTrue(vm.didDelete)
        let remaining = try await repo.entries(after: nil, limit: 10)
        XCTAssertFalse(remaining.contains { $0.id == "entry-1" })
    }

    @MainActor
    func testDeleteRemovesRecordEvenWhenRemoteFails() async throws {
        let entry = JournalEntry(id: "entry-1", userId: "u", type: .text, title: "T", content: "B")
        let repo = MockJournalRepository(entries: [entry])
        let ai = SpyAIService()
        ai.shouldFailDelete = true
        let vm = JournalDetailViewModel(entryId: "entry-1", journals: repo, ai: ai)
        await vm.start()

        await vm.delete()

        XCTAssertTrue(vm.didDelete)
        let remaining = try await repo.entries(after: nil, limit: 10)
        XCTAssertFalse(remaining.contains { $0.id == "entry-1" })
    }
```

- [ ] **Step 2: Run to verify failure**

Expected: FAIL — `delete()` / `didDelete` do not exist.

- [ ] **Step 3: Implement `delete()` + `didDelete`**

In `luminalog-oss/ios/LuminaLog/Features/JournalDetail/JournalDetailViewModel.swift`, add a published property near the others:

```swift
    /// Set true once the entry has been deleted so the view can pop.
    @Published private(set) var didDelete = false
```

Add the method (e.g. after `retryTranscription()`):

```swift
    // MARK: - Delete

    /// Best-effort delete: purge remote artifacts (S3 media + embeddings +
    /// summary) server-side, then always remove the Firestore record so the
    /// entry disappears from the user's list (spec delete policy).
    func delete() async {
        guard entry != nil else { return }
        do {
            try await ai.deleteEntry(journalId: entryId)
        } catch {
            Self.logger.error("""
            remote delete cleanup failed for \(self.entryId, privacy: .private); \
            removing record anyway: \(error.localizedDescription, privacy: .public)
            """)
        }
        do {
            try await journals.delete(id: entryId)
        } catch {
            Self.logger.error("firestore delete failed for \(self.entryId, privacy: .private): \(error.localizedDescription, privacy: .public)")
        }
        didDelete = true
    }
```

- [ ] **Step 4: Run the detail view model tests**

Run `JournalDetailViewModelTests` (Xcode or `xcodebuild test … -only-testing:LuminaLogTests/JournalDetailViewModelTests`).
Expected: PASS, including the two new tests.

---

## Task 8: iOS — `EntryOptionsView` (the "…" sheet)

**Files:**
- Create: `luminalog-oss/ios/LuminaLog/Features/JournalDetail/EntryOptionsView.swift`

- [ ] **Step 1: Implement the options sheet**

Create `luminalog-oss/ios/LuminaLog/Features/JournalDetail/EntryOptionsView.swift`:

```swift
import SwiftUI

/// The entry "…" options sheet (spec §iOS components 2): read-only metadata
/// (created date + edit history) and the Edit / Delete actions.
struct EntryOptionsView: View {

    let entry: JournalEntry
    /// Called when the user chooses Edit (the parent presents the edit sheet).
    let onEdit: () -> Void
    /// Called when the user confirms deletion.
    let onDelete: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var isConfirmingDelete = false

    var body: some View {
        NavigationStack {
            List {
                Section("Details") {
                    LabeledContent("Created", value: Self.format(entry.createdAt))
                }

                Section("Edits") {
                    if entry.editHistory.isEmpty {
                        Text("No edits yet.")
                            .foregroundStyle(Color.textSecondary)
                    } else {
                        ForEach(Array(entry.editHistory.reversed().enumerated()), id: \.offset) { _, record in
                            VStack(alignment: .leading, spacing: Spacing.xxs) {
                                Text(Self.format(record.editedAt))
                                    .font(.bodyText)
                                Text(Self.fieldsLabel(record.fields))
                                    .font(.captionText)
                                    .foregroundStyle(Color.textSecondary)
                            }
                        }
                    }
                }

                Section {
                    Button {
                        dismiss()
                        onEdit()
                    } label: {
                        Label("Edit", systemImage: "pencil")
                    }

                    Button(role: .destructive) {
                        isConfirmingDelete = true
                    } label: {
                        Label("Delete", systemImage: "trash")
                    }
                }
            }
            .navigationTitle("Options")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") { dismiss() }
                }
            }
            .confirmationDialog(
                "Delete this entry?",
                isPresented: $isConfirmingDelete,
                titleVisibility: .visible
            ) {
                Button("Delete", role: .destructive) {
                    dismiss()
                    onDelete()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This can't be undone. The entry, its media, and all related data will be permanently removed.")
            }
        }
    }

    private static func format(_ date: Date) -> String {
        date.formatted(date: .abbreviated, time: .shortened)
    }

    private static func fieldsLabel(_ fields: [String]) -> String {
        let set = Set(fields)
        if set.contains("title") && set.contains("content") { return "Title & content" }
        if set.contains("title") { return "Title" }
        if set.contains("content") { return "Content" }
        return "Edited"
    }
}

#Preview("With history") {
    EntryOptionsView(
        entry: JournalEntry(
            id: "e1", userId: "u", type: .text, title: "A day",
            content: "Body",
            editHistory: [
                EditRecord(editedAt: Date().addingTimeInterval(-3600), fields: ["title"]),
                EditRecord(editedAt: Date(), fields: ["title", "content"]),
            ]
        ),
        onEdit: {}, onDelete: {}
    )
}

#Preview("No history") {
    EntryOptionsView(
        entry: JournalEntry(id: "e1", userId: "u", type: .text, title: "A day", content: "Body"),
        onEdit: {}, onDelete: {}
    )
}
```

> If `Spacing.xxs` or `.bodyText`/`.captionText` font tokens don't exist, substitute the nearest existing tokens used elsewhere in `Features/JournalDetail` (e.g. `Spacing.xs`, `.captionText`). Verify against `JournalDetailView.swift` usages.

- [ ] **Step 2: Build to verify it compiles**

Build the `LuminaLog` scheme. Expected: compiles; both previews render.

---

## Task 9: iOS — `EntryEditView` (the edit sheet)

**Files:**
- Create: `luminalog-oss/ios/LuminaLog/Features/JournalDetail/EntryEditView.swift`

- [ ] **Step 1: Implement the edit sheet**

Create `luminalog-oss/ios/LuminaLog/Features/JournalDetail/EntryEditView.swift`:

```swift
import SwiftUI

/// Text-only entry edit sheet (spec §iOS components 3). Edits title + canonical
/// content. Media, assets, and entry type are immutable here.
struct EntryEditView: View {

    @StateObject private var viewModel: EntryEditViewModel
    @Environment(\.dismiss) private var dismiss

    init(entry: JournalEntry, journals: JournalRepository, ai: AIService) {
        _viewModel = StateObject(
            wrappedValue: EntryEditViewModel(entry: entry, journals: journals, ai: ai)
        )
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Title") {
                    TextField("Title", text: $viewModel.title, axis: .vertical)
                }

                Section(viewModel.contentLabel) {
                    TextEditor(text: $viewModel.content)
                        .frame(minHeight: 200)
                }

                if viewModel.hasMedia {
                    Section {
                        Label(
                            "Photos, audio, and video can't be changed after creation.",
                            systemImage: "lock"
                        )
                        .font(.captionText)
                        .foregroundStyle(Color.textSecondary)
                    }
                }

                if let errorMessage = viewModel.errorMessage {
                    Section {
                        Text(errorMessage).foregroundStyle(Color.danger)
                    }
                }
            }
            .navigationTitle("Edit Entry")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarLeading) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Save") {
                        Task { await viewModel.save() }
                    }
                    .disabled(viewModel.saveState == .loading)
                }
            }
            .onChange(of: viewModel.didSave) { _, didSave in
                if didSave { dismiss() }
            }
        }
    }
}

#Preview {
    EntryEditView(
        entry: JournalEntry(id: "e1", userId: "u", type: .text, title: "A day", content: "Body text here."),
        journals: MockJournalRepository(),
        ai: MockAIService()
    )
}
```

> Verify the `onChange(of:)` two-parameter closure signature matches the project's iOS deployment target (iOS 17+ uses `{ _, newValue in }`). If older, use the single-parameter form already used elsewhere in the codebase.

- [ ] **Step 2: Build to verify it compiles**

Build the `LuminaLog` scheme. Expected: compiles; preview renders.

---

## Task 10: iOS — wire the "…" button and sheets into `JournalDetailView`

**Files:**
- Modify: `luminalog-oss/ios/LuminaLog/Features/JournalDetail/JournalDetailView.swift`

- [ ] **Step 1: Add state for the new sheets**

In `JournalDetailView`, add next to the existing `@State` declarations:

```swift
    @State private var isShowingOptions = false
    @State private var isEditingEntry = false
```

- [ ] **Step 2: Add the "…" toolbar button**

In the `.toolbar { … }` block, add a second `ToolbarItem` (keep the existing `TypePill` one):

```swift
            ToolbarItem(placement: .topBarTrailing) {
                if viewModel.entry != nil {
                    Button {
                        isShowingOptions = true
                    } label: {
                        Image(systemName: "ellipsis.circle")
                    }
                    .accessibilityLabel("Entry options")
                }
            }
```

- [ ] **Step 3: Present the options + edit sheets and handle delete dismissal**

On the `loadedBody(_:)` view (which already has the `.sheet(isPresented: $isEditingTranscript)` modifier), add after that sheet:

```swift
        .sheet(isPresented: $isShowingOptions) {
            if let entry = viewModel.entry {
                EntryOptionsView(
                    entry: entry,
                    onEdit: { isEditingEntry = true },
                    onDelete: { Task { await viewModel.delete() } }
                )
            }
        }
        .sheet(isPresented: $isEditingEntry) {
            if let entry = viewModel.entry {
                EntryEditView(entry: entry, journals: journals, ai: ai)
            }
        }
        .onChange(of: viewModel.didDelete) { _, didDelete in
            if didDelete { dismiss() }
        }
```

Add the dismiss environment value to `JournalDetailView` (near the top of the struct):

```swift
    @Environment(\.dismiss) private var dismiss
```

> Match the `onChange` signature to the codebase convention (see Task 9 note).

- [ ] **Step 4: Build + run the app**

Build and run the `LuminaLog` scheme on a simulator. Manually verify: opening an entry shows the "…" button; it opens the options sheet with Created date and "No edits yet."; Edit opens the edit sheet; saving a content change updates the entry and (after re-index) the summary; Delete shows the confirmation and, on confirm, returns to the list with the entry gone.

---

## Task 11: Full test pass + docs

**Files:**
- Modify: `luminalog-oss/docs/ADR.md`
- Modify: `luminalog-oss/docs/DEV-LOG.md`

- [ ] **Step 1: Run the full server suite**

Run: `cd luminalog-oss/server && npm test && npx tsc --noEmit`
Expected: all pass, no type errors.

- [ ] **Step 2: Run the full iOS test target**

Run the `LuminaLogTests` target in Xcode (or `xcodebuild test -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16'`).
Expected: all tests pass.

- [ ] **Step 3: Append ADR-0012**

Add to the top of the entries in `luminalog-oss/docs/ADR.md` (newest first), an `ADR-0012` capturing: the extended `DELETE /v1/rag/delete` now owner-verifies and best-effort purges S3 media (shared `services/s3.ts`); edit is text-only with content-change-gated re-index/re-summary; `editHistory` stored as plaintext metadata; best-effort delete policy; and the image transcript-editor exception. Use **Date**, **Status**, **Context**, **Decision**, **Consequences**.

- [ ] **Step 4: Append a DEV-LOG entry**

Add a dated entry (newest first) to `luminalog-oss/docs/DEV-LOG.md` summarizing the entry options menu (metadata + edit history, text-only edit with auto re-embed/re-summary on content change, full delete of media + embeddings + record) and linking the spec, this plan, and ADR-0012.

---

## Self-review notes

- **Spec coverage:** "…" button + options sheet (Tasks 8, 10); metadata + edit history display (Tasks 3, 8); text-only edit of title/content with locked media/type (Tasks 6, 9); re-index + re-summary on content change only (Task 6); edit-history model + scope (Task 3); delete of S3 media + embeddings + summary + record, best-effort (Tasks 1, 2, 5, 7); docs (Task 11). All covered.
- **Type consistency:** `applyEntryEdit(id:title:content:contentEditedAt:edit:)`, `EditRecord(editedAt:fields:)`, `deleteEntry(journalId:)`, `ProxyAPIClient.delete(path:)`, `didDelete`, `didSave` are used identically across tasks.
- **Best-effort delete:** server returns 200 even when S3 delete throws (Task 2); client removes the record even when `deleteEntry` throws (Task 7).
```
