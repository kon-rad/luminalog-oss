# Editable Transcript + Voice Memos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On image journal entries, let the user edit the transcript text and record voice memos that are transcribed by a backend Whisper endpoint, appended to the editor, and saved as playable/downloadable audio attachments.

**Architecture:** A new stateless server endpoint `POST /v1/ai/transcribe-clip` transcribes a raw audio clip and returns text only (no S3/Firestore writes). On iOS, an Edit button on the image-entry transcript section opens a `TranscriptEditorView` sheet driven by `TranscriptEditorViewModel`; recorded clips are transcribed (text appended to the editor) and, on Save, uploaded to S3 and persisted via a new `JournalRepository.updateContent` method, then re-indexed for RAG.

**Tech Stack:** Server — Node/Express, vitest, Together AI Whisper (`transcribeAudio`). iOS — SwiftUI (iOS 17), XCTest, existing `AudioRecorderController`, `MediaUploader`, `AIService`/`ProxyAPIClient`, field-encrypted Firestore.

---

## File Structure

**Server**
- Create: `server/src/routes/transcribeClip.ts` — the handler (no firebase/s3 imports, so it's unit-testable).
- Create: `server/src/routes/transcribeClip.test.ts` — handler tests.
- Modify: `server/src/routes/ai.ts` — mount `POST /transcribe-clip` with `firebaseAuth` + `express.raw`.

**iOS — networking & protocols**
- Modify: `ios/LuminaLog/Core/Networking/ProxyAPIClient.swift` — raw-bytes POST helper.
- Modify: `ios/LuminaLog/Core/Networking/AIService.swift` — add `transcribeClip`.
- Modify: `ios/LuminaLog/Core/Networking/ProxyAIService.swift` — implement `transcribeClip`.
- Modify: `ios/LuminaLog/Core/Mocks/MockAIService.swift` — canned `transcribeClip`.

**iOS — persistence**
- Modify: `ios/LuminaLog/Core/Persistence/JournalRepository.swift` — add `updateContent`.
- Modify: `ios/LuminaLog/Core/Persistence/FirestoreJournalRepository.swift` — implement `updateContent`.
- Modify: `ios/LuminaLog/Core/Mocks/MockJournalRepository.swift` — implement `updateContent`.

**iOS — feature**
- Create: `ios/LuminaLog/Features/JournalDetail/TranscriptEditorViewModel.swift`
- Create: `ios/LuminaLog/Features/JournalDetail/TranscriptEditorView.swift`
- Test: `ios/LuminaLogTests/TranscriptEditorViewModelTests.swift`
- Modify: `ios/LuminaLog/Shared/Components/TranscriptBlock.swift` — optional `onEdit`.
- Modify: `ios/LuminaLog/Features/JournalDetail/JournalDetailView.swift` — per-clip audio cards, editable section, sheet.

**iOS — keep-compiling edits to existing test spies** (protocol additions force these):
- `ios/LuminaLogTests/JournalDetailViewModelTests.swift` (SpyAIService)
- `ios/LuminaLogTests/HomeViewModelTests.swift` (SpyAIService)
- `ios/LuminaLogTests/EntryProcessorTests.swift` (SpyAIService, RecordingJournalRepository)
- `ios/LuminaLogTests/ChatViewModelTests.swift` (StubChatAIService)
- `ios/LuminaLogTests/JournalListViewModelTests.swift` (FailingJournalRepository)

**Test commands**
- Server: `cd server && npm test`
- iOS: `xcodebuild test -project ios/LuminaLog.xcodeproj -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16'` (optionally add `-only-testing:LuminaLogTests/TranscriptEditorViewModelTests`)

---

## Task 1: Server `transcribe-clip` handler

**Files:**
- Create: `server/src/routes/transcribeClip.ts`
- Test: `server/src/routes/transcribeClip.test.ts`

- [ ] **Step 1: Write the failing test**

Create `server/src/routes/transcribeClip.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { transcribeAudio } from '../services/aiClient'
import { transcribeClipHandler } from './transcribeClip'

vi.mock('../services/aiClient', () => ({ transcribeAudio: vi.fn() }))

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = vi.fn((c: number) => { res.statusCode = c; return res })
  res.json = vi.fn((b: any) => { res.body = b; return res })
  return res
}

describe('transcribeClipHandler', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns transcript text for a valid audio body', async () => {
    ;(transcribeAudio as any).mockResolvedValue('hello world')
    const req: any = { body: Buffer.from('fake-audio') }
    const res = mockRes()
    await transcribeClipHandler(req, res)
    expect(transcribeAudio).toHaveBeenCalledOnce()
    expect(res.body).toEqual({ text: 'hello world' })
  })

  it('returns 400 on empty body', async () => {
    const req: any = { body: Buffer.alloc(0) }
    const res = mockRes()
    await transcribeClipHandler(req, res)
    expect(res.statusCode).toBe(400)
    expect(transcribeAudio).not.toHaveBeenCalled()
  })

  it('returns 500 when transcription fails', async () => {
    ;(transcribeAudio as any).mockRejectedValue(new Error('whisper down'))
    const req: any = { body: Buffer.from('x') }
    const res = mockRes()
    await transcribeClipHandler(req, res)
    expect(res.statusCode).toBe(500)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd server && npx vitest run src/routes/transcribeClip.test.ts`
Expected: FAIL — cannot resolve `./transcribeClip` (module does not exist).

- [ ] **Step 3: Write the handler**

Create `server/src/routes/transcribeClip.ts`:

```ts
import { Request, Response } from 'express'
import { transcribeAudio } from '../services/aiClient'

// Stateless clip transcription: raw audio in (via express.raw), { text } out.
// No S3 read, no Firestore write — the clip is transcribed in memory and
// discarded. The audio is persisted to S3 only when the client saves the entry.
export async function transcribeClipHandler(req: Request, res: Response): Promise<void> {
  const body = req.body as Buffer | undefined
  if (!body || body.length === 0) {
    res.status(400).json({ error: 'Empty audio body' })
    return
  }
  try {
    const text = await transcribeAudio(body, 'clip.m4a')
    res.json({ text })
  } catch (err) {
    console.error('[ai/transcribe-clip]', err)
    res.status(500).json({ error: 'Transcription failed' })
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd server && npx vitest run src/routes/transcribeClip.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/transcribeClip.ts server/src/routes/transcribeClip.test.ts
git commit -m "feat(server): add stateless transcribe-clip handler"
```

---

## Task 2: Mount the `transcribe-clip` route

**Files:**
- Modify: `server/src/routes/ai.ts`

- [ ] **Step 1: Add the import**

In `server/src/routes/ai.ts`, change the express import on line 1 from:

```ts
import { Router, Request, Response } from 'express'
```

to:

```ts
import express, { Router, Request, Response } from 'express'
import { transcribeClipHandler } from './transcribeClip'
```

- [ ] **Step 2: Mount the route**

In `server/src/routes/ai.ts`, immediately after the `export const aiRouter = Router()` line (around line 13), add:

```ts
// Raw audio body (no multipart): app-level express.json ignores audio/* content
// types, so this per-route parser owns the body.
aiRouter.post(
  '/transcribe-clip',
  firebaseAuth,
  express.raw({ type: 'audio/*', limit: '25mb' }),
  transcribeClipHandler,
)
```

(`firebaseAuth` is already imported in this file.)

- [ ] **Step 3: Verify the server builds**

Run: `cd server && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Run the full server test suite**

Run: `cd server && npm test`
Expected: PASS (existing crypto tests + new transcribeClip tests).

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/ai.ts
git commit -m "feat(server): mount POST /v1/ai/transcribe-clip"
```

---

## Task 3: iOS raw-bytes POST helper on `ProxyAPIClient`

**Files:**
- Modify: `ios/LuminaLog/Core/Networking/ProxyAPIClient.swift`

No new unit test (covered indirectly by `ProxyAIService`; the existing client has no isolated tests). Verify by building.

- [ ] **Step 1: Add a raw POST method**

In `ProxyAPIClient.swift`, after the existing `post(path:body:)` method (the `Void`-returning overload, ~line 67), add:

```swift
/// POST raw bytes with an explicit content type and decode a JSON response.
/// Used for binary uploads (e.g. audio clips) that aren't JSON-encoded.
func postRaw<T: Decodable>(path: String, body: Data, contentType: String) async throws -> T {
    let data = try await postRawData(path: path, body: body, contentType: contentType)
    return try decoder.decode(T.self, from: data)
}

private func postRawData(path: String, body: Data, contentType: String) async throws -> Data {
    let request = try await makeRawRequest(path: path, body: body, contentType: contentType)
    var (data, response) = try await session.data(for: request)

    if (response as? HTTPURLResponse)?.statusCode == 401 {
        let retry = try await makeRawRequest(
            path: path, body: body, contentType: contentType, forceRefresh: true
        )
        (data, response) = try await session.data(for: retry)
    }

    try Self.validate(response: response, data: data)
    return data
}

private func makeRawRequest(
    path: String,
    body: Data,
    contentType: String,
    forceRefresh: Bool = false
) async throws -> URLRequest {
    let component = path.hasPrefix("/") ? String(path.dropFirst()) : path
    let url = baseURL.appendingPathComponent(component)
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue(contentType, forHTTPHeaderField: "Content-Type")
    let token = try await tokenProvider.idToken(forceRefresh: forceRefresh)
    request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
    request.httpBody = body
    return request
}
```

- [ ] **Step 2: Verify it builds**

Run: `xcodebuild build -project ios/LuminaLog.xcodeproj -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' -quiet`
Expected: BUILD SUCCEEDED.

- [ ] **Step 3: Commit**

```bash
git add ios/LuminaLog/Core/Networking/ProxyAPIClient.swift
git commit -m "feat(ios): add raw-bytes POST helper to ProxyAPIClient"
```

---

## Task 4: Add `transcribeClip` to `AIService` + all conformers

**Files:**
- Modify: `ios/LuminaLog/Core/Networking/AIService.swift`
- Modify: `ios/LuminaLog/Core/Networking/ProxyAIService.swift`
- Modify: `ios/LuminaLog/Core/Mocks/MockAIService.swift`
- Modify: `ios/LuminaLogTests/JournalDetailViewModelTests.swift`
- Modify: `ios/LuminaLogTests/HomeViewModelTests.swift`
- Modify: `ios/LuminaLogTests/EntryProcessorTests.swift`
- Modify: `ios/LuminaLogTests/ChatViewModelTests.swift`

- [ ] **Step 1: Add the protocol requirement**

In `AIService.swift`, after the `transcribeJournal(journalId:)` declaration (end of the protocol), add:

```swift
    /// Transcribe a recorded audio clip without persisting anything.
    /// POSTs raw audio bytes to `/v1/ai/transcribe-clip`; returns the transcript
    /// text. Used by the transcript editor to turn a voice memo into text.
    func transcribeClip(audio: Data, contentType: String) async throws -> String
```

- [ ] **Step 2: Implement in `ProxyAIService`**

In `ProxyAIService.swift`, add a DTO near the other private structs:

```swift
    private struct TranscriptResponse: Decodable {
        let text: String
    }
```

and after `transcribeJournal(journalId:)` add:

```swift
    func transcribeClip(audio: Data, contentType: String) async throws -> String {
        let response: TranscriptResponse = try await api.postRaw(
            path: "/v1/ai/transcribe-clip",
            body: audio,
            contentType: contentType
        )
        return response.text
    }
```

- [ ] **Step 3: Implement in `MockAIService`**

In `MockAIService.swift`, after `requestIndex`/`transcribeJournal` (the AIService methods), add:

```swift
    func transcribeClip(audio: Data, contentType: String) async throws -> String {
        try await Task.sleep(nanoseconds: generationDelay)
        return MockData.cannedClipTranscript
    }
```

Then add the canned string to `MockData`. Open `ios/LuminaLog/Core/Mocks/MockData.swift`, and next to the other `canned…` constants add:

```swift
    static let cannedClipTranscript =
        "This is a quick voice memo I recorded to add a little more to this entry."
```

(If `MockData` constants live under a specific `enum`/`extension`, place it alongside `cannedSummary`.)

- [ ] **Step 4: Update test spies so the suite still compiles**

In `JournalDetailViewModelTests.swift` `SpyAIService`, after `transcribeJournal`, add:

```swift
        var transcribeClipCalls = 0
        func transcribeClip(audio: Data, contentType: String) async throws -> String {
            transcribeClipCalls += 1
            return "spy clip transcript"
        }
```

In `HomeViewModelTests.swift` `SpyAIService`, `EntryProcessorTests.swift` `SpyAIService`, and `ChatViewModelTests.swift` `StubChatAIService`, add the minimal conformance to each:

```swift
        func transcribeClip(audio: Data, contentType: String) async throws -> String { "" }
```

- [ ] **Step 5: Build to verify all conformers satisfy the protocol**

Run: `xcodebuild build-for-testing -project ios/LuminaLog.xcodeproj -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' -quiet`
Expected: BUILD SUCCEEDED (no "type does not conform to protocol AIService").

- [ ] **Step 6: Commit**

```bash
git add ios/LuminaLog/Core/Networking/AIService.swift \
        ios/LuminaLog/Core/Networking/ProxyAIService.swift \
        ios/LuminaLog/Core/Mocks/MockAIService.swift \
        ios/LuminaLog/Core/Mocks/MockData.swift \
        ios/LuminaLogTests/JournalDetailViewModelTests.swift \
        ios/LuminaLogTests/HomeViewModelTests.swift \
        ios/LuminaLogTests/EntryProcessorTests.swift \
        ios/LuminaLogTests/ChatViewModelTests.swift
git commit -m "feat(ios): add AIService.transcribeClip across conformers"
```

---

## Task 5: Add `updateContent` to `JournalRepository` + conformers

**Files:**
- Modify: `ios/LuminaLog/Core/Persistence/JournalRepository.swift`
- Modify: `ios/LuminaLog/Core/Persistence/FirestoreJournalRepository.swift`
- Modify: `ios/LuminaLog/Core/Mocks/MockJournalRepository.swift`
- Modify: `ios/LuminaLogTests/EntryProcessorTests.swift` (RecordingJournalRepository)
- Modify: `ios/LuminaLogTests/JournalListViewModelTests.swift` (FailingJournalRepository)
- Test: `ios/LuminaLogTests/MockJournalRepositoryTests.swift`

- [ ] **Step 1: Write the failing test for the mock**

In `ios/LuminaLogTests/MockJournalRepositoryTests.swift`, add this test method to the existing test class:

```swift
    @MainActor
    func testUpdateContentSetsTextAndAppendsMedia() async throws {
        let entry = JournalEntry(userId: "u1", type: .image, title: "Photos", content: "OCR text")
        let repo = MockJournalRepository(entries: [entry])

        let clip = MediaItem(s3Key: "users/u1/journals/\(entry.id)/audio-1.m4a", kind: .audio, durationSec: 12)
        let editedAt = Date()
        try await repo.updateContent(
            id: entry.id,
            content: "OCR text\n\nrecorded memo",
            contentEditedAt: editedAt,
            appendedMedia: [clip]
        )

        var latest: JournalEntry?
        for await e in repo.entry(id: entry.id) { latest = e; break }
        XCTAssertEqual(latest?.content, "OCR text\n\nrecorded memo")
        XCTAssertEqual(latest?.contentEditedAt, editedAt)
        XCTAssertEqual(latest?.media.filter { $0.kind == .audio }.count, 1)
    }

    @MainActor
    func testUpdateContentThrowsWhenEntryMissing() async {
        let repo = MockJournalRepository(entries: [])
        do {
            try await repo.updateContent(id: "missing", content: "x", contentEditedAt: Date(), appendedMedia: [])
            XCTFail("expected entryNotFound")
        } catch JournalRepositoryError.entryNotFound {
            // expected
        } catch {
            XCTFail("unexpected error: \(error)")
        }
    }
```

(If `MockJournalRepository`'s initializer differs, match its existing signature — it currently takes an entries array. Check the top of `MockJournalRepository.swift`.)

- [ ] **Step 2: Run to verify it fails**

Run: `xcodebuild test -project ios/LuminaLog.xcodeproj -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:LuminaLogTests/MockJournalRepositoryTests -quiet`
Expected: FAIL — `updateContent` is not a member (compile error).

- [ ] **Step 3: Add the protocol requirement**

In `JournalRepository.swift`, after `updateAIFields(...)`, add:

```swift
    /// Updates an entry's canonical text and appends audio attachments.
    /// Seals `content`, sets `contentEditedAt`, and array-unions
    /// `appendedMedia`. Throws `JournalRepositoryError.entryNotFound` if the
    /// document does not exist — it must NEVER recreate a deleted entry.
    func updateContent(
        id: String,
        content: String,
        contentEditedAt: Date,
        appendedMedia: [MediaItem]
    ) async throws
```

- [ ] **Step 4: Implement in `FirestoreJournalRepository`**

In `FirestoreJournalRepository.swift`, after `updateAIFields(...)`, add (note: `import FirebaseFirestore` is already present in this file for `FieldValue`/`Timestamp`):

```swift
    func updateContent(
        id: String,
        content: String,
        contentEditedAt: Date,
        appendedMedia: [MediaItem]
    ) async throws {
        guard let cipher = keys.currentCipher else { throw CryptoUnavailableError.keyNotLoaded }
        var payload: [String: Any] = [
            "content": try cipher.sealed(content, "journals.content"),
            "contentEditedAt": Timestamp(date: contentEditedAt),
            "updatedAt": FieldValue.serverTimestamp(),
        ]
        if !appendedMedia.isEmpty {
            // Media metadata (s3Key/kind/duration) is not field-encrypted; only
            // the S3 bytes are. arrayUnion appends without clobbering existing media.
            payload["media"] = FieldValue.arrayUnion(appendedMedia.map(\.firestoreData))
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

In `MockJournalRepository.swift`, after `updateAIFields(...)`, add:

```swift
    func updateContent(
        id: String,
        content: String,
        contentEditedAt: Date,
        appendedMedia: [MediaItem]
    ) async throws {
        guard let index = store.firstIndex(where: { $0.id == id }) else {
            throw JournalRepositoryError.entryNotFound(id: id)
        }
        store[index].content = content
        store[index].contentEditedAt = contentEditedAt
        store[index].media.append(contentsOf: appendedMedia)
        broadcast(changedId: id)
    }
```

- [ ] **Step 6: Add minimal conformance to test repositories**

In `EntryProcessorTests.swift` `RecordingJournalRepository` and `JournalListViewModelTests.swift` `FailingJournalRepository`, add:

```swift
    func updateContent(id: String, content: String, contentEditedAt: Date, appendedMedia: [MediaItem]) async throws {}
```

(For `FailingJournalRepository`, if its other methods throw a canned error to exercise failure paths, mirror that here by throwing the same error instead of an empty body — match the file's existing pattern.)

- [ ] **Step 7: Run to verify the mock tests pass**

Run: `xcodebuild test -project ios/LuminaLog.xcodeproj -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:LuminaLogTests/MockJournalRepositoryTests -quiet`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add ios/LuminaLog/Core/Persistence/JournalRepository.swift \
        ios/LuminaLog/Core/Persistence/FirestoreJournalRepository.swift \
        ios/LuminaLog/Core/Mocks/MockJournalRepository.swift \
        ios/LuminaLogTests/MockJournalRepositoryTests.swift \
        ios/LuminaLogTests/EntryProcessorTests.swift \
        ios/LuminaLogTests/JournalListViewModelTests.swift
git commit -m "feat(ios): add JournalRepository.updateContent"
```

---

## Task 6: `TranscriptEditorViewModel` (TDD)

**Files:**
- Create: `ios/LuminaLog/Features/JournalDetail/TranscriptEditorViewModel.swift`
- Test: `ios/LuminaLogTests/TranscriptEditorViewModelTests.swift`

- [ ] **Step 1: Write the failing tests**

Create `ios/LuminaLogTests/TranscriptEditorViewModelTests.swift`:

```swift
import XCTest
@testable import LuminaLog

final class TranscriptEditorViewModelTests: XCTestCase {

    // MARK: - Spies

    @MainActor
    final class SpyAI: AIService {
        var transcriptToReturn = "transcribed words"
        var shouldFail = false
        var clipCalls = 0
        var indexCalls = 0

        func generateSummary(journalId: String) async throws -> AIGeneration { AIGeneration(text: "", model: "") }
        func generateInsights(journalId: String) async throws -> AIGeneration { AIGeneration(text: "", model: "") }
        func generatePrompts(journalId: String) async throws -> [String] { [] }
        func dailyPrompt() async throws -> String { "" }
        func streamChatReply(chatId: String, message: String) -> AsyncThrowingStream<String, Error> {
            AsyncThrowingStream { $0.finish() }
        }
        func requestIndex(journalId: String) async { indexCalls += 1 }
        func transcribeJournal(journalId: String) async throws {}
        func transcribeClip(audio: Data, contentType: String) async throws -> String {
            clipCalls += 1
            if shouldFail { throw NSError(domain: "spy", code: 1) }
            return transcriptToReturn
        }
    }

    @MainActor
    final class SpyMedia: MediaUploader {
        var uploadCalls = 0
        func upload(fileURL: URL, kind: MediaKind, journalId: String) async throws -> MediaItem {
            uploadCalls += 1
            return MediaItem(s3Key: "key-\(uploadCalls)", kind: kind)
        }
        func viewURL(for s3Key: String) async throws -> URL { URL(fileURLWithPath: "/tmp/\(s3Key)") }
    }

    /// Writes a few bytes to a temp .m4a so the view model can read clip data.
    @MainActor
    private func makeClip(duration: Double = 5) throws -> AudioAttachment {
        let url = FileManager.default.temporaryDirectory
            .appendingPathComponent("\(UUID().uuidString).m4a")
        try Data("audio-bytes".utf8).write(to: url)
        return AudioAttachment(url: url, durationSec: duration)
    }

    // MARK: - Tests

    @MainActor
    func testRecordedClipTranscribesAndAppendsText() async throws {
        let ai = SpyAI()
        let vm = TranscriptEditorViewModel(
            entryId: "e1",
            initialText: "Existing text",
            journals: MockJournalRepository(entries: [.init(userId: "u", type: .image, title: "t")]),
            ai: ai,
            media: SpyMedia()
        )
        let clip = try makeClip()

        await vm.addRecordedClip(clip)

        XCTAssertEqual(ai.clipCalls, 1)
        XCTAssertEqual(vm.text, "Existing text\n\ntranscribed words")
        XCTAssertEqual(vm.pendingClips.count, 1)
        XCTAssertFalse(vm.pendingClips[0].transcribeFailed)
    }

    @MainActor
    func testSecondClipAppendsAfterFirst() async throws {
        let ai = SpyAI()
        let vm = TranscriptEditorViewModel(
            entryId: "e1", initialText: "",
            journals: MockJournalRepository(entries: [.init(userId: "u", type: .image, title: "t")]),
            ai: ai, media: SpyMedia()
        )
        ai.transcriptToReturn = "first"
        await vm.addRecordedClip(try makeClip())
        ai.transcriptToReturn = "second"
        await vm.addRecordedClip(try makeClip())

        XCTAssertEqual(vm.text, "first\n\nsecond")
        XCTAssertEqual(vm.pendingClips.count, 2)
    }

    @MainActor
    func testTranscriptionFailureKeepsClipAndText() async throws {
        let ai = SpyAI()
        ai.shouldFail = true
        let vm = TranscriptEditorViewModel(
            entryId: "e1", initialText: "Original",
            journals: MockJournalRepository(entries: [.init(userId: "u", type: .image, title: "t")]),
            ai: ai, media: SpyMedia()
        )

        await vm.addRecordedClip(try makeClip())

        XCTAssertEqual(vm.text, "Original")
        XCTAssertEqual(vm.pendingClips.count, 1)
        XCTAssertTrue(vm.pendingClips[0].transcribeFailed)
    }

    @MainActor
    func testClearEmptiesText() {
        let vm = TranscriptEditorViewModel(
            entryId: "e1", initialText: "Some text",
            journals: MockJournalRepository(entries: []),
            ai: SpyAI(), media: SpyMedia()
        )
        vm.clear()
        XCTAssertEqual(vm.text, "")
    }

    @MainActor
    func testSaveUploadsAllClipsPersistsAndIndexes() async throws {
        let entry = JournalEntry(userId: "u", type: .image, title: "t", content: "")
        let repo = MockJournalRepository(entries: [entry])
        let ai = SpyAI()
        let media = SpyMedia()
        let vm = TranscriptEditorViewModel(
            entryId: entry.id, initialText: "", journals: repo, ai: ai, media: media
        )
        await vm.addRecordedClip(try makeClip())
        await vm.addRecordedClip(try makeClip())

        await vm.save()

        XCTAssertEqual(media.uploadCalls, 2)
        XCTAssertEqual(ai.indexCalls, 1)
        XCTAssertTrue(vm.didSave)

        var latest: JournalEntry?
        for await e in repo.entry(id: entry.id) { latest = e; break }
        XCTAssertEqual(latest?.media.filter { $0.kind == .audio }.count, 2)
        XCTAssertEqual(latest?.content, vm.text)
        XCTAssertNotNil(latest?.contentEditedAt)
    }

    @MainActor
    func testSaveOnDeletedEntrySetsErrorAndDismisses() async {
        let repo = MockJournalRepository(entries: [])
        let vm = TranscriptEditorViewModel(
            entryId: "gone", initialText: "edited", journals: repo, ai: SpyAI(), media: SpyMedia()
        )
        await vm.save()
        XCTAssertNotNil(vm.errorMessage)
        XCTAssertTrue(vm.didSave)
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `xcodebuild test -project ios/LuminaLog.xcodeproj -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:LuminaLogTests/TranscriptEditorViewModelTests -quiet`
Expected: FAIL — `TranscriptEditorViewModel` is undefined (compile error).

- [ ] **Step 3: Implement the view model**

Create `ios/LuminaLog/Features/JournalDetail/TranscriptEditorViewModel.swift`:

```swift
import Foundation
import OSLog

/// Drives the transcript editor sheet (image entries): edit text, record voice
/// memos that are transcribed by the backend and appended to the text, and save
/// — uploading the recorded clips to S3 and persisting the edited content.
@MainActor
final class TranscriptEditorViewModel: ObservableObject {

    private static let logger = Logger(subsystem: "com.luminalog.app", category: "transcript-editor")

    /// A recorded-but-not-yet-uploaded voice memo.
    struct PendingClip: Identifiable, Equatable {
        let id: UUID
        let url: URL
        let durationSec: Double
        var transcribeFailed: Bool = false
    }

    @Published var text: String
    @Published private(set) var pendingClips: [PendingClip] = []
    @Published private(set) var transcribeState: AIActionState = .idle
    @Published private(set) var saveState: AIActionState = .idle
    /// Set true when the sheet should dismiss (successful save, or the entry was
    /// deleted out from under us).
    @Published private(set) var didSave = false
    @Published var errorMessage: String?

    let entryId: String
    private let journals: JournalRepository
    private let ai: AIService
    private let media: MediaUploader

    init(
        entryId: String,
        initialText: String,
        journals: JournalRepository,
        ai: AIService,
        media: MediaUploader
    ) {
        self.entryId = entryId
        self.text = initialText
        self.journals = journals
        self.ai = ai
        self.media = media
    }

    // MARK: - Recording → transcription

    /// Stage a freshly recorded clip and transcribe it (text appended to the editor).
    func addRecordedClip(_ attachment: AudioAttachment) async {
        pendingClips.append(
            PendingClip(id: attachment.id, url: attachment.url, durationSec: attachment.durationSec)
        )
        await transcribe(clipID: attachment.id)
    }

    /// (Re)transcribe a staged clip and append its text to the editor.
    func transcribe(clipID: UUID) async {
        guard let clip = pendingClips.first(where: { $0.id == clipID }) else { return }
        transcribeState = .loading
        do {
            let data = try Data(contentsOf: clip.url)
            let result = try await ai.transcribeClip(audio: data, contentType: "audio/m4a")
            let trimmed = result.trimmingCharacters(in: .whitespacesAndNewlines)
            if !trimmed.isEmpty {
                text = [text.trimmingCharacters(in: .whitespacesAndNewlines), trimmed]
                    .filter { !$0.isEmpty }
                    .joined(separator: "\n\n")
            }
            setFailed(false, for: clipID)
            transcribeState = .idle
        } catch {
            Self.logger.error("transcribeClip failed: \(error.localizedDescription, privacy: .public)")
            setFailed(true, for: clipID)
            transcribeState = .failed
        }
    }

    private func setFailed(_ failed: Bool, for clipID: UUID) {
        guard let i = pendingClips.firstIndex(where: { $0.id == clipID }) else { return }
        pendingClips[i].transcribeFailed = failed
    }

    // MARK: - Editing

    func clear() { text = "" }

    // MARK: - Save

    func save() async {
        guard saveState != .loading else { return }
        saveState = .loading
        errorMessage = nil
        do {
            var uploaded: [MediaItem] = []
            for clip in pendingClips {
                var item = try await media.upload(fileURL: clip.url, kind: .audio, journalId: entryId)
                item.durationSec = clip.durationSec
                uploaded.append(item)
            }
            try await journals.updateContent(
                id: entryId,
                content: text,
                contentEditedAt: Date(),
                appendedMedia: uploaded
            )
            await ai.requestIndex(journalId: entryId)
            saveState = .idle
            didSave = true
        } catch JournalRepositoryError.entryNotFound {
            errorMessage = "This entry is no longer available."
            saveState = .failed
            didSave = true
        } catch {
            Self.logger.error("save failed: \(error.localizedDescription, privacy: .public)")
            errorMessage = "Couldn't save your changes. Please try again."
            saveState = .failed
        }
    }
}
```

- [ ] **Step 4: Run to verify tests pass**

Run: `xcodebuild test -project ios/LuminaLog.xcodeproj -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' -only-testing:LuminaLogTests/TranscriptEditorViewModelTests -quiet`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add ios/LuminaLog/Features/JournalDetail/TranscriptEditorViewModel.swift \
        ios/LuminaLogTests/TranscriptEditorViewModelTests.swift
git commit -m "feat(ios): TranscriptEditorViewModel with record/transcribe/save"
```

---

## Task 7: `TranscriptEditorView` (UI)

**Files:**
- Create: `ios/LuminaLog/Features/JournalDetail/TranscriptEditorView.swift`

UI view — verified via build + preview, no unit test (consistent with the other detail views).

- [ ] **Step 1: Create the view**

Create `ios/LuminaLog/Features/JournalDetail/TranscriptEditorView.swift`:

```swift
import SwiftUI

/// Editor sheet for an image entry's transcript (design: editable transcript +
/// voice memos). Edit the text, clear it, or record voice memos that are
/// transcribed by the backend and appended to the text. Save uploads the clips
/// and persists the edited content.
struct TranscriptEditorView: View {

    @StateObject private var viewModel: TranscriptEditorViewModel
    @StateObject private var recorder = AudioRecorderController()
    @Environment(\.dismiss) private var dismiss

    init(
        entryId: String,
        initialText: String,
        journals: JournalRepository,
        ai: AIService,
        media: MediaUploader
    ) {
        _viewModel = StateObject(
            wrappedValue: TranscriptEditorViewModel(
                entryId: entryId,
                initialText: initialText,
                journals: journals,
                ai: ai,
                media: media
            )
        )
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: Spacing.l) {
                    editor
                    recordControls
                    if !viewModel.pendingClips.isEmpty {
                        clipList
                    }
                }
                .padding(Spacing.m)
            }
            .background(Color.appBackground.ignoresSafeArea())
            .navigationTitle("Edit transcript")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    if viewModel.saveState == .loading {
                        ProgressView().controlSize(.small).tint(Color.accentWarm)
                    } else {
                        Button("Save") { Task { await viewModel.save() } }
                    }
                }
            }
            .onChange(of: viewModel.didSave) { _, didSave in
                if didSave { dismiss() }
            }
            .alert(
                "Microphone access needed",
                isPresented: $recorder.permissionDenied
            ) {
                Button("OK", role: .cancel) {}
            } message: {
                Text("Enable microphone access in Settings to record a voice memo.")
            }
            .alert(
                "Save failed",
                isPresented: Binding(
                    get: { viewModel.errorMessage != nil && !viewModel.didSave },
                    set: { if !$0 { viewModel.errorMessage = nil } }
                )
            ) {
                Button("OK", role: .cancel) { viewModel.errorMessage = nil }
            } message: {
                Text(viewModel.errorMessage ?? "")
            }
        }
    }

    // MARK: - Editor

    private var editor: some View {
        ZStack(alignment: .topTrailing) {
            TextEditor(text: $viewModel.text)
                .font(.journalBody)
                .foregroundStyle(Color.textPrimary)
                .scrollContentBackground(.hidden)
                .frame(minHeight: 220)
                .padding(Spacing.s)
                .background(
                    RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                        .fill(Color.secondaryBackground)
                )

            if !viewModel.text.isEmpty {
                Button {
                    viewModel.clear()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .font(.system(size: 20))
                        .foregroundStyle(Color.textSecondary)
                        .padding(Spacing.s)
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Clear text")
            }
        }
    }

    // MARK: - Record

    @ViewBuilder
    private var recordControls: some View {
        if recorder.isRecording {
            HStack(spacing: Spacing.m) {
                Circle().fill(Color.danger).frame(width: 10, height: 10)
                Text(recorder.elapsedLabel)
                    .font(.captionText.monospacedDigit())
                    .foregroundStyle(Color.textSecondary)
                Spacer()
                Button {
                    if let clip = recorder.stop() {
                        Task { await viewModel.addRecordedClip(clip) }
                    }
                } label: {
                    Text("Stop").font(.uiBody.weight(.semibold))
                        .foregroundStyle(.white)
                        .padding(.horizontal, Spacing.l)
                        .frame(minHeight: 44)
                        .background(Capsule().fill(Color.danger))
                }
                .buttonStyle(.plain)
            }
        } else if viewModel.transcribeState == .loading {
            HStack(spacing: Spacing.s) {
                ProgressView().controlSize(.small).tint(Color.accentWarm)
                Text("Transcribing…").font(.captionText).foregroundStyle(Color.textSecondary)
                Spacer()
            }
            .frame(minHeight: 44)
        } else {
            Button {
                Task { await recorder.start() }
            } label: {
                HStack(spacing: Spacing.s) {
                    Image(systemName: "mic.fill")
                    Text("Record audio")
                }
                .font(.uiBody.weight(.semibold))
                .foregroundStyle(Color.accentWarm)
                .frame(maxWidth: .infinity, minHeight: 48)
                .background(
                    RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                        .stroke(Color.accentWarm, lineWidth: 1.5)
                )
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Pending clips

    private var clipList: some View {
        VStack(alignment: .leading, spacing: Spacing.s) {
            Text("VOICE MEMOS")
                .font(.captionText.weight(.semibold))
                .foregroundStyle(Color.textSecondary)
                .kerning(0.8)

            ForEach(viewModel.pendingClips) { clip in
                HStack(spacing: Spacing.s) {
                    Image(systemName: "waveform")
                        .foregroundStyle(Color.accentWarm)
                    Text(AudioPlayerCard.timeLabel(clip.durationSec))
                        .font(.captionText.monospacedDigit())
                        .foregroundStyle(Color.textSecondary)
                    Spacer()
                    if clip.transcribeFailed {
                        Button {
                            Task { await viewModel.transcribe(clipID: clip.id) }
                        } label: {
                            HStack(spacing: Spacing.xs) {
                                Image(systemName: "arrow.clockwise")
                                Text("Retry transcript")
                            }
                            .font(.captionText.weight(.semibold))
                            .foregroundStyle(Color.accentWarm)
                            .frame(minHeight: 44)
                        }
                        .buttonStyle(.plain)
                    } else {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(Color.accentWarm)
                    }
                }
                .padding(Spacing.m)
                .background(
                    RoundedRectangle(cornerRadius: CornerRadius.large, style: .continuous)
                        .fill(Color.secondaryBackground)
                )
            }
        }
    }
}

// MARK: - Preview

#Preview("Editor") {
    TranscriptEditorView(
        entryId: "demo-entry-04",
        initialText: "Some OCR text from the photo.",
        journals: MockJournalRepository(),
        ai: MockAIService(),
        media: MockMediaUploader()
    )
}
```

- [ ] **Step 2: Verify it builds**

Run: `xcodebuild build -project ios/LuminaLog.xcodeproj -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' -quiet`
Expected: BUILD SUCCEEDED. (If `MockJournalRepository()` has no no-arg init, use the same seeded init the previews of `JournalDetailView` use.)

- [ ] **Step 3: Commit**

```bash
git add ios/LuminaLog/Features/JournalDetail/TranscriptEditorView.swift
git commit -m "feat(ios): TranscriptEditorView sheet UI"
```

---

## Task 8: Edit affordance on `TranscriptBlock`

**Files:**
- Modify: `ios/LuminaLog/Shared/Components/TranscriptBlock.swift`

- [ ] **Step 1: Add the optional `onEdit` handler and header button**

In `TranscriptBlock.swift`, add a stored property after `let text: String`:

```swift
    /// When set, an "Edit" button is shown in the header's top-right corner.
    var onEdit: (() -> Void)? = nil
```

Then replace the label `Text(...)` at the top of `body`'s `VStack` with a header row:

```swift
            HStack(alignment: .firstTextBaseline) {
                Text(label.uppercased())
                    .font(.captionText.weight(.semibold))
                    .foregroundStyle(Color.textSecondary)
                    .kerning(0.8)
                Spacer()
                if let onEdit {
                    Button(action: onEdit) {
                        HStack(spacing: Spacing.xs) {
                            Image(systemName: "pencil")
                            Text("Edit")
                        }
                        .font(.captionText.weight(.semibold))
                        .foregroundStyle(Color.accentWarm)
                        .frame(minHeight: 44)
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel("Edit transcript")
                }
            }
```

(Existing call sites that don't pass `onEdit` default to `nil` and render unchanged.)

- [ ] **Step 2: Verify it builds**

Run: `xcodebuild build -project ios/LuminaLog.xcodeproj -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' -quiet`
Expected: BUILD SUCCEEDED.

- [ ] **Step 3: Commit**

```bash
git add ios/LuminaLog/Shared/Components/TranscriptBlock.swift
git commit -m "feat(ios): optional Edit button on TranscriptBlock"
```

---

## Task 9: Wire editing + per-clip audio into `JournalDetailView`

**Files:**
- Modify: `ios/LuminaLog/Features/JournalDetail/JournalDetailView.swift`

- [ ] **Step 1: Store `journals` and `ai` for the editor sheet**

In `JournalDetailView`, add stored properties next to `private let media`:

```swift
    private let journals: JournalRepository
    private let ai: AIService
```

In `init`, after `self.media = media`, capture them (the parameters already exist):

```swift
        self.journals = journals
        self.ai = ai
```

Add editor sheet state next to `@State private var selectedTab`:

```swift
    @State private var isEditingTranscript = false
```

- [ ] **Step 2: Replace `imageContent` to show per-clip audio + an editable transcript**

Replace the existing `imageContent(_:)` with:

```swift
    private func imageContent(_ entry: JournalEntry) -> some View {
        VStack(alignment: .leading, spacing: Spacing.m) {
            ForEach(entry.media.filter { $0.kind == .image }, id: \.s3Key) { item in
                EntryImageView(item: item, media: media)
            }

            // One player per recorded voice memo.
            ForEach(entry.media.filter { $0.kind == .audio }, id: \.s3Key) { item in
                AudioPlayerCard(item: item, media: media)
            }

            // Always editable for image entries, even when there's no text yet.
            TranscriptBlock(
                label: "Transcribed text",
                text: entry.content.isEmpty
                    ? "No transcript yet. Tap Edit to add one."
                    : entry.content,
                onEdit: { isEditingTranscript = true }
            )
        }
    }
```

- [ ] **Step 3: Present the editor sheet**

In `loadedBody(_:)`, add a `.sheet` modifier to the outer `VStack` (after the `ScrollView`'s closing brace, before `loadedBody` returns). Attach it to the `VStack(alignment: .leading, spacing: 0)`:

```swift
        .sheet(isPresented: $isEditingTranscript) {
            if let entry = viewModel.entry {
                TranscriptEditorView(
                    entryId: entry.id,
                    initialText: entry.content,
                    journals: journals,
                    ai: ai,
                    media: media
                )
            }
        }
```

- [ ] **Step 4: Verify it builds**

Run: `xcodebuild build -project ios/LuminaLog.xcodeproj -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' -quiet`
Expected: BUILD SUCCEEDED.

- [ ] **Step 5: Run the full iOS test suite**

Run: `xcodebuild test -project ios/LuminaLog.xcodeproj -scheme LuminaLog -destination 'platform=iOS Simulator,name=iPhone 16' -quiet`
Expected: PASS (all suites, including `TranscriptEditorViewModelTests` and `MockJournalRepositoryTests`).

- [ ] **Step 6: Commit**

```bash
git add ios/LuminaLog/Features/JournalDetail/JournalDetailView.swift
git commit -m "feat(ios): editable transcript + per-clip audio on image entries"
```

---

## Final verification

- [ ] **Server:** `cd server && npm test` → all pass; `npx tsc --noEmit` → clean.
- [ ] **iOS:** full `xcodebuild test` → all pass.
- [ ] **Manual smoke (optional, simulator):** open an image entry → tap Edit on the transcript → type text → Record audio → stop → transcript text appended → Save → back on detail view an `AudioPlayerCard` appears with play + download, and the transcript shows the edited text. Recording a second memo adds a second card; its transcript appends after the first.

---

## Notes / decisions carried from the spec

- **Append, not replace/insert:** each transcription appends as a new paragraph (`"\n\n"` joined), in record order.
- **Image entries only.** Voice/video keep the existing server-side Whisper retry flow.
- **Multiple clips** per entry; each is its own attachment + player card.
- **Always editable** on image entries, even with empty content.
- **No orphan S3 objects:** clips upload only on Save; `transcribe-clip` never touches S3.
- **Re-index on save** via `ai.requestIndex`; stale-summary affordance keys off `contentEditedAt` (already implemented).
```
