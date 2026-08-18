import { describe, it, expect } from 'vitest'
import { pickMimeType, MAX_RECORDING_MS, formatElapsed } from './recorder'

describe('pickMimeType', () => {
  it('prefers opus in webm where it is supported', () => {
    expect(pickMimeType(() => true)).toEqual({ mimeType: 'audio/webm;codecs=opus', ext: 'webm' })
  })

  // Safari, including every browser on iOS, has no webm recorder. A table at a
  // live event is mostly iPhones, so this fallback is the common path.
  it('falls back to mp4 on Safari', () => {
    const supported = (t: string) => t.startsWith('audio/mp4')
    expect(pickMimeType(supported)).toEqual({ mimeType: 'audio/mp4', ext: 'm4a' })
  })

  it('falls back to plain webm when the codec cannot be pinned', () => {
    const supported = (t: string) => t === 'audio/webm'
    expect(pickMimeType(supported)).toEqual({ mimeType: 'audio/webm', ext: 'webm' })
  })

  // An empty mimeType tells MediaRecorder to choose for itself, which is a
  // better outcome than throwing at a table mid-game.
  it('lets the browser choose when nothing is supported', () => {
    expect(pickMimeType(() => false)).toEqual({ mimeType: '', ext: 'webm' })
  })

  it('survives a browser with no isTypeSupported at all', () => {
    expect(pickMimeType(undefined)).toEqual({ mimeType: '', ext: 'webm' })
  })
})

describe('MAX_RECORDING_MS', () => {
  it('caps an answer at three minutes', () => {
    expect(MAX_RECORDING_MS).toBe(180000)
  })
})

describe('formatElapsed', () => {
  it('renders minutes and zero-padded seconds', () => {
    expect(formatElapsed(0)).toBe('0:00')
    expect(formatElapsed(9000)).toBe('0:09')
    expect(formatElapsed(65000)).toBe('1:05')
    expect(formatElapsed(180000)).toBe('3:00')
  })
})
