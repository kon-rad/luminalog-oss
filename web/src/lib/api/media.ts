import { apiPost } from '@/lib/api/client'
import { encryptBlob, decryptToBlob } from '@/lib/crypto/mediaCipher'

// Typed browser client for the M4 media same-origin proxy routes (M4-T2).
// Media is ALWAYS encrypted client-side before it ever leaves the browser —
// S3 only ever holds `application/octet-stream` ciphertext. The logical media
// type is conveyed by `kind`/`ext`, never by the S3 object's content-type, so
// every presigned PUT is requested (and signed) with `application/octet-stream`.
//
// Upload/view URLs are obtained from our server via the same-origin proxy
// (auth + no CORS), but the actual PUT/GET against those presigned URLs goes
// DIRECTLY to S3, cross-origin, bypassing this app's proxy entirely. That
// requires S3 CORS to be configured to allow this origin — infra, not code.

// Keep in sync with `ALLOWED_KINDS` in server/src/routes/media.ts.
export type MediaKind = 'audio' | 'image' | 'video'

export interface UploadFileRequest {
  kind: MediaKind
  ext: string
  contentType: string
  journalId: string
  /** Optional client-supplied stable key (upload-retry reuse). Must live under
   *  the caller's own `users/<uid>/` prefix or the server rejects it (403). */
  s3Key?: string
}

export interface PresignedUpload {
  s3Key: string
  uploadUrl: string
}

export interface PresignedView {
  s3Key: string
  viewUrl: string
}

/** Requests presigned S3 PUT URLs (1h expiry) for one or more files. */
export function fetchUploadUrls(files: UploadFileRequest[]): Promise<{ files: PresignedUpload[] }> {
  return apiPost('/api/media/upload-urls', { files })
}

/** Requests presigned S3 GET URLs (1h expiry) for one or more existing keys. */
export function fetchViewUrls(s3Keys: string[]): Promise<{ urls: PresignedView[] }> {
  return apiPost('/api/media/view-urls', { s3Keys })
}

/**
 * Convenience wrapper for the (later) capture flow: request a single presigned
 * upload URL for one file. Always signs for `application/octet-stream` since
 * only ciphertext is ever uploaded.
 */
export async function requestUploadUrl(
  kind: MediaKind,
  ext: string,
  journalId: string,
  s3Key?: string,
): Promise<PresignedUpload> {
  const { files } = await fetchUploadUrls([
    { kind, ext, contentType: 'application/octet-stream', journalId, s3Key },
  ])
  return files[0]
}

/**
 * Encrypts `blob` under `key` and PUTs the ciphertext directly to the
 * presigned `uploadUrl` (a direct cross-origin request to S3 — NOT routed
 * through our same-origin proxy). Throws if the PUT does not succeed.
 */
export async function uploadEncryptedMedia(key: CryptoKey, blob: Blob, uploadUrl: string): Promise<void> {
  const cipher = await encryptBlob(key, blob)
  const res = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'content-type': 'application/octet-stream' },
    body: cipher,
  })
  if (!res.ok) {
    throw new Error(`uploadEncryptedMedia: PUT failed: ${res.status}`)
  }
}

/**
 * GETs the ciphertext directly from the presigned `viewUrl` (a direct
 * cross-origin request to S3 — NOT routed through our same-origin proxy),
 * decrypts it under `key`, and returns an object URL for the plaintext
 * `mimeType` Blob. Throws if the GET does not succeed.
 *
 * The CALLER owns the returned object URL's lifetime and MUST call
 * `URL.revokeObjectURL(url)` when it is no longer needed (e.g. on unmount).
 */
export async function fetchDecryptedObjectUrl(key: CryptoKey, viewUrl: string, mimeType: string): Promise<string> {
  const res = await fetch(viewUrl)
  if (!res.ok) {
    throw new Error(`fetchDecryptedObjectUrl: GET failed: ${res.status}`)
  }
  const bytes = new Uint8Array(await res.arrayBuffer())
  const blob = await decryptToBlob(key, bytes, mimeType)
  return URL.createObjectURL(blob)
}
