import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { s3 } from './s3'
import { config } from '../config'

export function recordingKey(uid: string, callId: string): string {
  return `voice/${uid}/${callId}.wav`
}

/** Download Vapi's recording and store it in our bucket. Returns the S3 key. */
export async function storeRecording(uid: string, callId: string, sourceUrl: string): Promise<string> {
  const res = await fetch(sourceUrl)
  if (!res.ok) throw new Error(`recording fetch ${res.status}`)
  const body = Buffer.from(await res.arrayBuffer())
  const Key = recordingKey(uid, callId)
  await s3.send(new PutObjectCommand({
    Bucket: config.AWS_S3_BUCKET,
    Key,
    Body: body,
    ContentType: res.headers.get('content-type') ?? 'audio/wav',
  }))
  return Key
}

/** Short-lived presigned GET for playback (15 min). */
export async function signedPlaybackUrl(key: string): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: config.AWS_S3_BUCKET, Key: key }), { expiresIn: 900 })
}
