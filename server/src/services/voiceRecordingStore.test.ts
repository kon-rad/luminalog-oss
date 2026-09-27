import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'

// Hoist mocks so they're initialized before imports
const { sendMock, configMock } = vi.hoisted(() => ({
  sendMock: vi.fn().mockResolvedValue({}),
  configMock: {
    AWS_S3_BUCKET: 'test-bucket',
    AWS_REGION: 'us-east-1',
    AWS_ACCESS_KEY_ID: 'test-key',
    AWS_SECRET_ACCESS_KEY: 'test-secret',
    VAPI_PRIVATE_KEY: 'vapi-priv' as string | undefined,
  },
}))

vi.mock('../config', () => ({ config: configMock }))

vi.mock('./s3', () => ({ s3: { send: sendMock } }))

vi.mock('@aws-sdk/client-s3', () => ({
  PutObjectCommand: class { constructor(public input: any) {} },
  DeleteObjectCommand: class { constructor(public input: any) {} },
}))

import { stagingKey, finalRecordingKey, stageRecording, vapiRecordingEndpoint } from './voiceRecordingStore'

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

describe('stageRecording', () => {
  const fetchMock = vi.fn()
  beforeEach(() => {
    fetchMock.mockReset()
    sendMock.mockClear()
    configMock.VAPI_PRIVATE_KEY = 'vapi-priv'
    vi.stubGlobal('fetch', fetchMock)
  })
  afterEach(() => { vi.unstubAllGlobals() })

  it('downloads via the authenticated Vapi endpoint, not the private storage URL', async () => {
    fetchMock.mockResolvedValue(new Response(new Uint8Array([1, 2, 3]), {
      status: 200, headers: { 'content-type': 'audio/wav' },
    }))
    const key = await stageRecording('u1', 'call_9')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.vapi.ai/call/call_9/mono-recording',
      { headers: { Authorization: 'Bearer vapi-priv' } },
    )
    expect(key).toBe('users/u1/voice-staging/call_9.wav')
    expect(sendMock.mock.calls[0][0].input).toMatchObject({
      Bucket: 'test-bucket', Key: 'users/u1/voice-staging/call_9.wav', ContentType: 'audio/wav',
    })
  })

  it('returns null without calling Vapi when the private key is unset', async () => {
    configMock.VAPI_PRIVATE_KEY = undefined
    expect(await stageRecording('u1', 'call_9')).toBeNull()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns null and stages nothing on a non-OK download', async () => {
    fetchMock.mockResolvedValue(new Response('nope', { status: 401 }))
    expect(await stageRecording('u1', 'call_9')).toBeNull()
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('encodes the call id into the endpoint path', () => {
    expect(vapiRecordingEndpoint('a/b')).toBe('https://api.vapi.ai/call/a%2Fb/mono-recording')
  })
})
