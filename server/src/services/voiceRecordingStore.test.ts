import { vi, describe, it, expect } from 'vitest'

// node_modules here is sparse (no @aws-sdk); mock the SDK so the module loads.
const { sendMock, getSignedUrlMock } = vi.hoisted(() => ({
  sendMock: vi.fn().mockResolvedValue({}),
  getSignedUrlMock: vi.fn().mockResolvedValue('https://signed/url'),
}))

vi.mock('../config', () => ({ config: { AWS_S3_BUCKET: 'bkt', AWS_REGION: 'us-east-1', AWS_ACCESS_KEY_ID: 'k', AWS_SECRET_ACCESS_KEY: 's' } }))
vi.mock('./s3', () => ({ s3: { send: sendMock } }))
vi.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: class { constructor(public input: any) {} },
  GetObjectCommand: class { constructor(public input: any) {} },
}))
vi.mock('@aws-sdk/s3-request-presigner', () => ({ getSignedUrl: getSignedUrlMock }))

import { recordingKey, signedPlaybackUrl } from './voiceRecordingStore'

describe('voiceRecordingStore', () => {
  it('builds a per-user recording key', () => {
    expect(recordingKey('u1', 'call_9')).toBe('voice/u1/call_9.wav')
  })
  it('returns a presigned playback url', async () => {
    await expect(signedPlaybackUrl('voice/u1/call_9.wav')).resolves.toBe('https://signed/url')
  })
})
