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
 * Vapi's recording storage is private: the end-of-call `recordingUrl` returns 400
 * when fetched directly (every staging attempt in production failed this way).
 * The authenticated endpoint 302-redirects to a short-lived signed URL; `fetch`
 * follows it and drops the Authorization header on the cross-origin hop.
 * https://docs.vapi.ai/assistants/retrieve-call-artifacts
 */
export function vapiRecordingEndpoint(callId: string): string {
  return `https://api.vapi.ai/call/${encodeURIComponent(callId)}/mono-recording`
}

/**
 * Download the call's recording from Vapi and stage it PLAINTEXT in our bucket,
 * promptly: Vapi retains call recordings only ~14 days. Returns the staging S3
 * key, or null when there is no private key or the download fails (logged with
 * the start of the body so Vapi-side causes are diagnosable). Never encrypts:
 * the server holds no DEK.
 */
export async function stageRecording(uid: string, callId: string): Promise<string | null> {
  if (!config.VAPI_PRIVATE_KEY) {
    console.error('[voiceRecordingStore] VAPI_PRIVATE_KEY unset; recording not staged', { callId })
    return null
  }
  const res = await fetch(vapiRecordingEndpoint(callId), {
    headers: { Authorization: `Bearer ${config.VAPI_PRIVATE_KEY}` },
  })
  if (!res.ok) {
    const body = (await res.text().catch(() => '')).slice(0, 200)
    console.error('[voiceRecordingStore] recording fetch failed', { callId, status: res.status, body })
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
