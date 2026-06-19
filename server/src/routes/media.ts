import { Router, Request, Response } from 'express'
import { randomUUID } from 'crypto'
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { firebaseAuth } from '../middleware/firebaseAuth'
import { config } from '../config'
import { s3 } from '../services/s3'

const ALLOWED_KINDS = new Set(['image', 'video', 'audio'])

/** Canonical media contract — see docs/transcription-pipeline.md. */
interface UploadFileRequest {
  kind: string
  ext: string
  contentType: string
  bytes?: number
  journalId: string
}

/** Sanitize a path component so a client can never escape its own prefix. */
const sanitize = (value: string) => value.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 128)

export const mediaRouter = Router()

mediaRouter.post('/upload-urls', firebaseAuth, async (req: Request, res: Response) => {
  const uid = (req as any).uid as string
  const { files } = req.body as { files?: UploadFileRequest[] }
  if (!Array.isArray(files) || files.length === 0) {
    res.status(400).json({ error: 'Missing files array' }); return
  }
  for (const file of files) {
    if (!ALLOWED_KINDS.has(file.kind)) { res.status(400).json({ error: `Invalid kind: ${file.kind}` }); return }
    if (!file.journalId || !file.ext || !file.contentType) {
      res.status(400).json({ error: 'Each file requires kind, ext, contentType, journalId' }); return
    }
  }

  try {
    // The server owns key generation so a client can only ever write under its
    // own `users/<uid>/…` prefix. Shape: users/<uid>/journals/<journalId>/<kind>-<uuid>.<ext>
    const result = await Promise.all(
      files.map(async ({ kind, ext, contentType, journalId }) => {
        const cleanExt = sanitize(ext).toLowerCase() || 'bin'
        const s3Key = `users/${uid}/journals/${sanitize(journalId)}/${kind}-${randomUUID()}.${cleanExt}`
        const uploadUrl = await getSignedUrl(
          s3,
          new PutObjectCommand({ Bucket: config.AWS_S3_BUCKET, Key: s3Key, ContentType: contentType }),
          { expiresIn: 3600 },
        )
        return { s3Key, uploadUrl }
      }),
    )
    res.json({ files: result })
  } catch (err) {
    console.error('[media/upload-urls]', err)
    res.status(500).json({ error: 'Failed to generate upload URLs' })
  }
})

mediaRouter.post('/view-urls', firebaseAuth, async (req: Request, res: Response) => {
  const uid = (req as any).uid as string
  const { s3Keys } = req.body as { s3Keys?: string[] }
  if (!Array.isArray(s3Keys) || s3Keys.length === 0) {
    res.status(400).json({ error: 'Missing s3Keys array' }); return
  }
  // Authorization: a caller may only resolve keys under its own prefix.
  const prefix = `users/${uid}/`
  if (!s3Keys.every(key => typeof key === 'string' && key.startsWith(prefix))) {
    res.status(403).json({ error: 'Cannot access keys outside your own namespace' }); return
  }

  try {
    const urls = await Promise.all(
      s3Keys.map(async s3Key => {
        const viewUrl = await getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: config.AWS_S3_BUCKET, Key: s3Key }),
          { expiresIn: 3600 },
        )
        return { s3Key, viewUrl }
      }),
    )
    res.json({ urls })
  } catch (err) {
    console.error('[media/view-urls]', err)
    res.status(500).json({ error: 'Failed to generate view URLs' })
  }
})
