import { vi, describe, it, expect, beforeEach } from 'vitest'

// Echo presigner: returns a URL embedding the key it was asked to sign, so a
// test can assert which Key reached the PutObjectCommand without any network.
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(async (_client: any, cmd: any) => `https://signed/${cmd.input.Key}`),
}))
vi.mock('../config', () => ({ config: { AWS_S3_BUCKET: 'test-bucket' } }))
vi.mock('../services/s3', () => ({ s3: {} }))
vi.mock('../middleware/firebaseAuth', () => ({
  firebaseAuth: (req: any, _res: any, next: any) => next(),
}))

import { uploadUrlsHandler } from './media'

function mockRes() {
  const res: any = { statusCode: 200 }
  res.status = vi.fn((c: number) => { res.statusCode = c; return res })
  res.json = vi.fn((b: any) => { res.body = b; return res })
  return res
}

const baseFile = { kind: 'video', ext: 'mp4', contentType: 'video/mp4', journalId: 'J1' }

describe('uploadUrlsHandler', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('reuses a valid client-supplied s3Key under the caller prefix', async () => {
    const supplied = 'users/u1/journals/J1/video-stable-123.mp4'
    const req: any = { uid: 'u1', body: { files: [{ ...baseFile, s3Key: supplied }] } }
    const res = mockRes()
    await uploadUrlsHandler(req, res)
    expect(res.statusCode).toBe(200)
    expect(res.body.files).toHaveLength(1)
    expect(res.body.files[0].s3Key).toBe(supplied)
    expect(res.body.files[0].uploadUrl).toBe(`https://signed/${supplied}`)
  })

  it('rejects an s3Key under a foreign prefix with 403', async () => {
    const foreign = 'users/u2/journals/J1/video-evil.mp4'
    const req: any = { uid: 'u1', body: { files: [{ ...baseFile, s3Key: foreign }] } }
    const res = mockRes()
    await uploadUrlsHandler(req, res)
    expect(res.statusCode).toBe(403)
  })

  it('mints a fresh uuid key when s3Key is omitted', async () => {
    const req: any = { uid: 'u1', body: { files: [{ ...baseFile }] } }
    const res = mockRes()
    await uploadUrlsHandler(req, res)
    expect(res.statusCode).toBe(200)
    const key = res.body.files[0].s3Key as string
    expect(key).toMatch(/^users\/u1\/journals\/J1\/video-[0-9a-f-]{36}\.mp4$/)
  })
})
