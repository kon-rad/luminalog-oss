/**
 * The suite defaults to the `node` environment (see vitest.config.ts), but this
 * component renders real DOM and the map renderer builds SVG elements.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, cleanup, fireEvent } from '@testing-library/react'
import type { JournalEntry } from '@/lib/firestore/models'

const ensureCognitiveMap = vi.fn()
vi.mock('@/lib/ai/entryMap', () => ({
  ensureCognitiveMap: (...a: unknown[]) => ensureCognitiveMap(...a),
}))
vi.mock('@/lib/theme', () => ({ useTheme: () => ({ resolvedMode: 'light' }) }))

const { CognitiveMapPanel } = await import('./CognitiveMapPanel')

const mapped = {
  id: 'e1',
  type: 'text',
  content: 'Signed up. I was relieved.',
  cognitiveMap: {
    map: {
      v: 1,
      beats: [{
        id: 'b0', tier: 'map', kind: 'event', text: 'Signed up', quote: 'Signed up.',
        quoteStart: 0, domain: 'craft', isSpine: true, isKeeper: false,
        generality: 0.1, keepScore: 0.2, degree: 0, mentions: [],
      }],
      edges: [],
    },
    generatedAt: new Date(),
    model: 'm',
    version: 1,
  },
} as unknown as JournalEntry

const unmapped = (id: string) =>
  ({ id, type: 'text', content: 'Words.' }) as unknown as JournalEntry

beforeEach(() => {
  vi.resetAllMocks()
  ensureCognitiveMap.mockResolvedValue(false)
})
afterEach(cleanup)

describe('CognitiveMapPanel', () => {
  it('draws an existing map', async () => {
    const { container } = render(<CognitiveMapPanel entry={mapped} />)
    await waitFor(() => {
      expect(container.querySelectorAll('g[data-beat-id]')).toHaveLength(1)
    })
  })

  it('does not generate for an entry that already has a map', async () => {
    render(<CognitiveMapPanel entry={mapped} />)
    await waitFor(() => expect(ensureCognitiveMap).not.toHaveBeenCalled())
  })

  it('shows a waiting state and generates for an unmapped entry', async () => {
    let resolve: (v: boolean) => void = () => {}
    ensureCognitiveMap.mockReturnValue(new Promise<boolean>((r) => { resolve = r }))

    render(<CognitiveMapPanel entry={unmapped('e2')} />)

    expect(await screen.findByText(/Reading your entry/i)).toBeTruthy()
    expect(ensureCognitiveMap).toHaveBeenCalled()
    resolve(true)
  })

  it('offers a retry when generation fails', async () => {
    render(<CognitiveMapPanel entry={unmapped('e3')} />)
    expect(await screen.findByRole('button', { name: /try again/i })).toBeTruthy()
  })

  it('retries when the retry button is clicked', async () => {
    render(<CognitiveMapPanel entry={unmapped('e4')} />)
    const button = await screen.findByRole('button', { name: /try again/i })
    ensureCognitiveMap.mockClear()
    fireEvent.click(button)
    await waitFor(() => expect(ensureCognitiveMap).toHaveBeenCalledTimes(1))
  })

  it('opens the source quote when a beat is clicked', async () => {
    const { container } = render(<CognitiveMapPanel entry={mapped} />)
    await waitFor(() => expect(container.querySelector('g[data-beat-id="b0"]')).toBeTruthy())

    fireEvent.click(container.querySelector('g[data-beat-id="b0"]')!)

    expect(await screen.findByText(/In your words/i)).toBeTruthy()
    // The quote is highlighted in place, not the whole entry.
    const mark = container.querySelector('mark')
    expect(mark?.textContent).toBe('Signed up.')
  })
})
