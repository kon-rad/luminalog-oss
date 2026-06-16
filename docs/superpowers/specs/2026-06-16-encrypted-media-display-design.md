# Encrypted Media Display & Thumbnails — Design

Date: 2026-06-16
Status: Approved

## Problem

Opening a journal entry with a photo shows "Photo unavailable" and videos do not
play. Root cause: the app is end-to-end encrypted. Every media file is encrypted
client-side with `MediaCipher` (AES-GCM, `"LLM1"` chunk format) **before** upload,
so S3 stores ciphertext. But `MediaUploader.viewURL(for:)` returns the presigned
S3 GET — pointing at the ciphertext — which the views hand **directly** to
`AsyncImage` (photos), `AVPlayer` (video), and the audio controller. None of them
can decrypt, so decoding fails. `MediaCipher.decryptFile` is never called anywhere
in the app.

`MediaItem.thumbnailS3Key` exists in the model but is never populated — thumbnail
generation was scaffolded and never built.

## Goals

1. Generate thumbnails for images (on-device, before encryption).
2. Load the thumbnail first in the entry detail view, then the full image.
3. Tap a photo to view it full-screen (existing `ImageZoomViewer`).
4. Photo and video have a download button (audio already has one).
5. Fix media playback/display for **all** kinds (audio is broken the same way).

## Non-goals

- No server changes. `upload-urls` / `view-urls` are generic; `thumbnailS3Key`
  already exists in the model. No Firestore schema migration.
- No backfill of thumbnails onto legacy entries.

## Approach

One new decrypting media layer, not decrypt-inline-per-view.

### `MediaContentStore` (new — `ios/LuminaLog/Core/Media/`)

Wraps the existing `MediaUploader` + `MediaCipher` + `UserKeyStore`.

`func fileURL(for s3Key: String) async throws -> URL` returns a **decrypted local
file URL**:

1. Return cached file if present (`Caches/media/<hash(s3Key)>.<ext>`).
2. Resolve presigned URL via `uploader.viewURL(for:)`.
3. Download ciphertext to a temp file.
4. **Magic-byte detection:** if the file begins with `MediaCipher.magic` (`"LLM1"`),
   decrypt with `MediaCipher(key: dek).decryptFile` into the cache path. Otherwise
   treat the bytes as plaintext and move them into the cache as-is. This pass-through
   keeps demo-mode seeds (plaintext local copies) and any pre-encryption legacy
   uploads working.
5. Return the cache file URL.

- Extension on the cache filename is derived from `s3Key` so the share sheet,
  Files app, and `AVPlayer` infer the right type.
- An in-flight task map dedups concurrent requests for the same key (two views →
  one download).
- `purge()` clears the cache directory; wired into sign-out / key-store clear so
  decrypted plaintext never outlives the session.

### Thumbnail generation on upload (`ProxyMediaUploader.upload`, images only)

After probing dimensions, render a downscaled JPEG (~400 px max edge — retina-
friendly for the ~200 pt inline frame), encrypt it with the same DEK, and request
its upload URL **in the same `/v1/media/upload-urls` call** (the endpoint takes a
`files` array). Set `thumbnailS3Key` on the returned `MediaItem`.

### View changes (`JournalDetailMediaViews.swift`, `ImageZoomViewer.swift`)

- `EntryImageView`: resolve via `MediaContentStore`. If `thumbnailS3Key != nil`,
  show the decrypted thumbnail first, then swap in the full image. Legacy images
  (no thumb key) decrypt + display the full image directly (downscaled by
  `scaledToFit`). Add a download button. Tap → full-screen.
- `ImageZoomViewer`: unchanged signature; receives the decrypted full-image file
  URL (`AsyncImage` works on `file://`).
- `VideoPlayerCard`: resolve decrypted local file → `AVPlayer(url:)`. Add a
  download button. Chunked GCM cannot seek-stream, so video decrypts fully to file
  before play — acceptable.
- `AudioPlayerCard`: load the decrypted file; fix its existing download button to
  share the decrypted file (today it downloads/shares ciphertext).
- Download buttons reuse the audio card's share-sheet pattern; now correct because
  cache files are real plaintext with proper extensions.

### Error handling

Keep existing "Photo/Video unavailable" placeholders for genuine failures (missing
key, network, decrypt failure).

## Testing

- `MediaContentStore`: decrypt-and-cache; plaintext pass-through via magic-byte
  detection; in-flight dedup; `purge()`. Uses a mock uploader serving a known
  ciphertext file + DEK.
- Thumbnail generation: image upload requests two keys, sets `thumbnailS3Key`,
  thumbnail respects max edge.
- `MediaCipher` round-trip is already covered by existing tests.

## Wiring

`MediaContentStore` is constructed in `AppServices` from the existing
`MediaUploader` + `UserKeyStore` and injected into `JournalDetailView` / its media
subviews (same path the `MediaUploader` is injected today). `purge()` is called
wherever the key store is cleared on sign-out.
