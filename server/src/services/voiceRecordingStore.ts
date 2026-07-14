import { PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'
import { s3 } from './s3'
import { config } from '../config'

// Plaintext staging (transient) lives under the user's own prefix so the existing
// media presign authorization (users/<uid>/) covers the client's GET/PUT. The client
// derives finalRecordingKey from stagingKey by swapping the path segment.
export function stagingKey(uid: string, callId: string): string {
  return `users/${uid}/voice-staging/${callId}.wav`
}

export function finalRecordingKey(uid: string, callId: string): string {
  return `users/${uid}/voice/${callId}.wav`
}

/**
 * Download Vapi's recording from its (public) URL and stage it PLAINTEXT in our
 * bucket, promptly — Vapi retains call recordings only ~14 days. Returns the
 * staging S3 key, or null on a non-OK fetch (e.g. expired/gated URL — logged so
 * we can detect Vapi gating). Never encrypts: the server holds no DEK.
 */
export async function stageRecording(uid: string, callId: string, sourceUrl: string): Promise<string | null> {
  const res = await fetch(sourceUrl)
  if (!res.ok) {
    console.error('[voiceRecordingStore] recording fetch failed', { callId, status: res.status })
    return null
  }
  const body = Buffer.from(await res.arrayBuffer())
  const Key = stagingKey(uid, callId)
  await s3.send(new PutObjectCommand({
    Bucket: config.AWS_S3_BUCKET,
    Key,
    Body: body,
    ContentType: res.headers.get('content-type') ?? 'audio/wav',
  }))
  return Key
}

/** Delete a staged plaintext recording once the client has re-uploaded the ciphertext. */
export async function deleteStaging(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: config.AWS_S3_BUCKET, Key: key }))
}
