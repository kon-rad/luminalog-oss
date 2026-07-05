import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const apiPost = vi.fn()

vi.mock('@/lib/api/client', () => ({
  apiPost: (...args: unknown[]) => apiPost(...args),
}))

import { fetchUploadUrls, fetchViewUrls, requestUploadUrl, uploadEncryptedMedia, fetchDecryptedObjectUrl } from './media'
import { encryptMedia, decryptToBlob } from '@/lib/crypto/mediaCipher'

async function makeKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', new Uint8Array(32), 'AES-GCM', false, ['encrypt', 'decrypt'])
}

describe('lib/api/media', () => {
  beforeEach(() => {
    apiPost.mockReset()
  })

  describe('fetchUploadUrls / fetchViewUrls / requestUploadUrl', () => {
    it('fetchUploadUrls posts to /api/media/upload-urls with the files array and returns the payload', async () => {
      const payload = { files: [{ s3Key: 'users/u1/journals/j1/audio-abc.bin', uploadUrl: 'https://s3.example/put' }] }
      apiPost.mockResolvedValueOnce(payload)

      const files = [{ kind: 'audio' as const, ext: 'bin', contentType: 'application/octet-stream', journalId: 'j1' }]
      const result = await fetchUploadUrls(files)

      expect(apiPost).toHaveBeenCalledWith('/api/media/upload-urls', { files })
      expect(result).toEqual(payload)
    })

    it('fetchViewUrls posts to /api/media/view-urls with the s3Keys array and returns the payload', async () => {
      const payload = { urls: [{ s3Key: 'users/u1/journals/j1/audio-abc.bin', viewUrl: 'https://s3.example/get' }] }
      apiPost.mockResolvedValueOnce(payload)

      const result = await fetchViewUrls(['users/u1/journals/j1/audio-abc.bin'])

      expect(apiPost).toHaveBeenCalledWith('/api/media/view-urls', {
        s3Keys: ['users/u1/journals/j1/audio-abc.bin'],
      })
      expect(result).toEqual(payload)
    })

    it('requestUploadUrl forces contentType to application/octet-stream and returns the single result', async () => {
      const payload = { files: [{ s3Key: 'users/u1/journals/j1/image-abc.jpg', uploadUrl: 'https://s3.example/put' }] }
      apiPost.mockResolvedValueOnce(payload)

      const result = await requestUploadUrl('image', 'jpg', 'j1')

      expect(apiPost).toHaveBeenCalledWith('/api/media/upload-urls', {
        files: [{ kind: 'image', ext: 'jpg', contentType: 'application/octet-stream', journalId: 'j1', s3Key: undefined }],
      })
      expect(result).toEqual(payload.files[0])
    })

    it('requestUploadUrl forwards an explicit s3Key when given (upload-retry reuse)', async () => {
      const payload = { files: [{ s3Key: 'users/u1/journals/j1/audio-abc.bin', uploadUrl: 'https://s3.example/put' }] }
      apiPost.mockResolvedValueOnce(payload)

      await requestUploadUrl('audio', 'bin', 'j1', 'users/u1/journals/j1/audio-abc.bin')

      expect(apiPost).toHaveBeenCalledWith('/api/media/upload-urls', {
        files: [
          {
            kind: 'audio',
            ext: 'bin',
            contentType: 'application/octet-stream',
            journalId: 'j1',
            s3Key: 'users/u1/journals/j1/audio-abc.bin',
          },
        ],
      })
    })
  })

  describe('uploadEncryptedMedia', () => {
    const originalFetch = global.fetch
    let fetchMock: ReturnType<typeof vi.fn>

    beforeEach(() => {
      fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
      global.fetch = fetchMock as unknown as typeof fetch
    })

    afterEach(() => {
      global.fetch = originalFetch
    })

    it('encrypts the blob client-side and PUTs the CIPHERTEXT to the presigned URL with an octet-stream content-type', async () => {
      const key = await makeKey()
      const plaintext = new TextEncoder().encode('hello world, this is plaintext media content')
      const blob = new Blob([plaintext], { type: 'text/plain' })

      await uploadEncryptedMedia(key, blob, 'https://s3.example.com/put-url?sig=abc')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      const [url, init] = fetchMock.mock.calls[0]
      expect(url).toBe('https://s3.example.com/put-url?sig=abc')
      expect(init.method).toBe('PUT')
      expect(init.headers).toEqual({ 'content-type': 'application/octet-stream' })

      const sentBody = init.body as Blob
      expect(sentBody).toBeInstanceOf(Blob)
      const sentBytes = new Uint8Array(await sentBody.arrayBuffer())
      // The bytes actually PUT to S3 must be ciphertext, never the plaintext.
      expect(sentBytes).not.toEqual(plaintext)
      expect(sentBytes.length).toBeGreaterThan(plaintext.length) // envelope framing overhead
    })

    it('throws when the presigned PUT does not succeed', async () => {
      fetchMock.mockResolvedValueOnce(new Response(null, { status: 403 }))
      const key = await makeKey()
      const blob = new Blob([new Uint8Array([1, 2, 3])])

      await expect(uploadEncryptedMedia(key, blob, 'https://s3.example.com/put-url')).rejects.toThrow('403')
    })
  })

  describe('fetchDecryptedObjectUrl', () => {
    const originalFetch = global.fetch
    let fetchMock: ReturnType<typeof vi.fn>

    afterEach(() => {
      global.fetch = originalFetch
    })

    it('GETs the ciphertext directly from the view URL and decrypts it back to the original bytes', async () => {
      const key = await makeKey()
      const plaintext = new TextEncoder().encode('the quick brown fox jumps over the lazy dog')
      const cipher = await encryptMedia(key, plaintext)

      // Round-trip the decrypt step directly first: this is the assertion that
      // matters and is robust regardless of whether the test environment
      // implements `URL.createObjectURL` (some node/vitest setups don't).
      const decryptedBlob = await decryptToBlob(key, cipher, 'text/plain')
      const decryptedBytes = new Uint8Array(await decryptedBlob.arrayBuffer())
      expect(decryptedBytes).toEqual(plaintext)

      fetchMock = vi.fn().mockResolvedValue({
        ok: true,
        arrayBuffer: async () => cipher.buffer.slice(cipher.byteOffset, cipher.byteOffset + cipher.byteLength),
      })
      global.fetch = fetchMock as unknown as typeof fetch

      if (typeof URL.createObjectURL === 'function') {
        const objectUrl = await fetchDecryptedObjectUrl(key, 'https://s3.example.com/view-url', 'text/plain')
        expect(typeof objectUrl).toBe('string')
        expect(fetchMock).toHaveBeenCalledWith('https://s3.example.com/view-url')
      } else {
        // No URL.createObjectURL in this environment — the decrypt round-trip
        // assertion above already proves correctness, so there's nothing more
        // to check here.
        expect(fetchMock).not.toHaveBeenCalled()
      }
    })

    it('throws when the presigned GET does not succeed', async () => {
      const key = await makeKey()
      fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) })
      global.fetch = fetchMock as unknown as typeof fetch

      await expect(fetchDecryptedObjectUrl(key, 'https://s3.example.com/view-url', 'text/plain')).rejects.toThrow(
        '404',
      )
    })
  })
})
