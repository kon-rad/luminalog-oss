import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../config', () => ({
  config: { AWS_S3_BUCKET: 'luminalog-bucket', AWS_REGION: 'us-east-1' },
}))
const { send } = vi.hoisted(() => ({ send: vi.fn() }))
vi.mock('../s3', () => ({ s3: { send } }))
vi.mock('@aws-sdk/client-s3', () => ({ PutObjectCommand: vi.fn((input: any) => ({ __put: input })) }))

import { renderSoulPng, renderAndStoreSoulImage, heroKey, heroUrl } from './soulImage'

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47]) // ‰PNG

beforeEach(() => {
  vi.clearAllMocks()
})

describe('renderSoulPng', () => {
  it('renders a valid PNG for an empty (nascent) soul', () => {
    const buf = renderSoulPng([])
    expect(buf.subarray(0, 4).equals(PNG_MAGIC)).toBe(true)
    expect(buf.length).toBeGreaterThan(100)
  })

  it('renders a valid PNG for a populated point-set', () => {
    const points = Array.from({ length: 12 }, (_, i) => ({
      x: Math.cos(i), y: Math.sin(i), z: (i % 5) / 5 - 0.5,
    }))
    const buf = renderSoulPng(points)
    expect(buf.subarray(0, 4).equals(PNG_MAGIC)).toBe(true)
    expect(buf.length).toBeGreaterThan(1000)
  })

  it('is deterministic — same points yield identical bytes', () => {
    const pts = [{ x: 0.1, y: 0.2, z: 0.3 }, { x: -0.5, y: 0.4, z: -0.2 }]
    expect(renderSoulPng(pts).equals(renderSoulPng(pts))).toBe(true)
  })

  it('clamps out-of-cube coordinates without throwing', () => {
    expect(() => renderSoulPng([{ x: 9, y: -9, z: 42 }])).not.toThrow()
  })
})

describe('heroKey / heroUrl', () => {
  it('keys by token id and builds the bucket URL', () => {
    expect(heroKey('7')).toBe('soul/7/hero.png')
    expect(heroUrl('7')).toBe('https://luminalog-bucket.s3.us-east-1.amazonaws.com/soul/7/hero.png')
  })
})

describe('renderAndStoreSoulImage', () => {
  it('uploads a PNG to the hero key and returns the public URL', async () => {
    const url = await renderAndStoreSoulImage('9', [{ x: 0, y: 0, z: 0 }])
    expect(send).toHaveBeenCalledOnce()
    const put = send.mock.calls[0][0].__put
    expect(put.Bucket).toBe('luminalog-bucket')
    expect(put.Key).toBe('soul/9/hero.png')
    expect(put.ContentType).toBe('image/png')
    expect(Buffer.isBuffer(put.Body)).toBe(true)
    expect(put.Body.subarray(0, 4).equals(PNG_MAGIC)).toBe(true)
    expect(url).toBe('https://luminalog-bucket.s3.us-east-1.amazonaws.com/soul/9/hero.png')
  })
})
