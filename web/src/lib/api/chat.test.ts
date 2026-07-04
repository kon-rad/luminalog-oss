import { describe, it, expect, vi, beforeEach } from 'vitest'

const getIdToken = vi.fn()

vi.mock('@/lib/firebase', () => ({
  auth: {
    get currentUser() {
      return { getIdToken }
    },
  },
}))

import { streamChat } from '@/lib/api/chat'

function sseStream(text: string): ReadableStream<Uint8Array> {
  const bytes = new TextEncoder().encode(text)
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
}

function chunkedSseStream(chunks: string[]): ReadableStream<Uint8Array> {
  let i = 0
  return new ReadableStream({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close()
        return
      }
      controller.enqueue(new TextEncoder().encode(chunks[i]))
      i++
    },
  })
}

describe('streamChat SSE parsing', () => {
  beforeEach(() => {
    getIdToken.mockReset()
    vi.unstubAllGlobals()
  })

  it('accumulates deltas in order and resolves on [DONE]', async () => {
    getIdToken.mockResolvedValue('token')
    const body = sseStream('data: {"delta":"He"}\n\ndata: {"delta":"llo"}\n\ndata: [DONE]\n\n')
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const onDelta = vi.fn()
    await streamChat('chat-1', 'hi', undefined, { onDelta })

    expect(onDelta).toHaveBeenNthCalledWith(1, 'He')
    expect(onDelta).toHaveBeenNthCalledWith(2, 'llo')
    expect(onDelta).toHaveBeenCalledTimes(2)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('/api/ai/chat')
    expect(init.headers.authorization).toBe('Bearer token')
    expect(init.headers.accept).toBe('text/event-stream')
    expect(JSON.parse(init.body)).toEqual({ chatId: 'chat-1', message: 'hi' })
  })

  it('includes journalId in the body only when provided', async () => {
    getIdToken.mockResolvedValue('token')
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(sseStream('data: [DONE]\n\n'), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await streamChat('chat-1', 'hi', 'journal-9', { onDelta: vi.fn() })

    const [, init] = fetchMock.mock.calls[0]
    expect(JSON.parse(init.body)).toEqual({ chatId: 'chat-1', message: 'hi', journalId: 'journal-9' })
  })

  it('rejects when an in-band {"error":...} frame arrives', async () => {
    getIdToken.mockResolvedValue('token')
    const body = sseStream('data: {"delta":"He"}\n\ndata: {"error":"Stream failed"}\n\n')
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(streamChat('chat-1', 'hi', undefined, { onDelta: vi.fn() })).rejects.toThrow(
      'Stream failed',
    )
  })

  it('force-refreshes the token and retries once on a 401, then streams normally', async () => {
    getIdToken.mockResolvedValueOnce('stale').mockResolvedValueOnce('fresh')
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 401 }))
      .mockResolvedValueOnce(new Response(sseStream('data: {"delta":"ok"}\n\ndata: [DONE]\n\n'), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const onDelta = vi.fn()
    await streamChat('chat-1', 'hi', undefined, { onDelta })

    expect(getIdToken).toHaveBeenNthCalledWith(1, false)
    expect(getIdToken).toHaveBeenNthCalledWith(2, true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(onDelta).toHaveBeenCalledWith('ok')
  })

  it('throws when the retried request is still non-2xx', async () => {
    getIdToken.mockResolvedValue('token')
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(streamChat('chat-1', 'hi', undefined, { onDelta: vi.fn() })).rejects.toThrow(
      'chat 500',
    )
  })

  it('tolerates a non-JSON payload by treating it as a raw delta', async () => {
    getIdToken.mockResolvedValue('token')
    const body = sseStream('data: plain-text-chunk\n\ndata: [DONE]\n\n')
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const onDelta = vi.fn()
    await streamChat('chat-1', 'hi', undefined, { onDelta })

    expect(onDelta).toHaveBeenCalledWith('plain-text-chunk')
  })

  it('buffers a data: line split across multiple stream chunks', async () => {
    getIdToken.mockResolvedValue('token')
    const body = chunkedSseStream(['data: {"del', 'ta":"partial"}\n\ndata: [DONE]\n\n'])
    const fetchMock = vi.fn().mockResolvedValue(new Response(body, { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const onDelta = vi.fn()
    await streamChat('chat-1', 'hi', undefined, { onDelta })

    expect(onDelta).toHaveBeenCalledWith('partial')
  })
})
