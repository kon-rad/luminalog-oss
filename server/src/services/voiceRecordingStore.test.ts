import { vi, describe, it, expect } from 'vitest'

// Hoist mocks so they're initialized before imports
const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn().mockResolvedValue({}),
}))

vi.mock('../config', () => ({
  config: {
    AWS_S3_BUCKET: 'test-bucket',
    AWS_REGION: 'us-east-1',
    AWS_ACCESS_KEY_ID: 'test-key',
    AWS_SECRET_ACCESS_KEY: 'test-secret',
  },
}))

vi.mock('./s3', () => ({ s3: { send: sendMock } }))

vi.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: class { constructor(public input: any) {} },
  DeleteObjectCommand: class { constructor(public input: any) {} },
}))

import { stagingKey, finalRecordingKey } from './voiceRecordingStore'

describe('voiceRecordingStore key builders', () => {
  it('stages under the user-scoped voice-staging prefix', () => {
    expect(stagingKey('u1', 'call_9')).toBe('users/u1/voice-staging/call_9.wav')
  })
  it('final key swaps voice-staging → voice under the same prefix', () => {
    expect(finalRecordingKey('u1', 'call_9')).toBe('users/u1/voice/call_9.wav')
    // Final key must be derivable from staging key by segment swap (client relies on this).
    expect(stagingKey('u1', 'call_9').replace('/voice-staging/', '/voice/'))
      .toBe(finalRecordingKey('u1', 'call_9'))
  })
})
