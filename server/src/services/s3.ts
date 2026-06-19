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
