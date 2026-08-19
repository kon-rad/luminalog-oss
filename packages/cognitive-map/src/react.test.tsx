import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { CognitiveMapView } from './react'
import type { CognitiveMap } from './types'
import raw from '../fixtures/sample-map.json'

const fixture = raw as unknown as CognitiveMap

afterEach(cleanup)

describe('CognitiveMapView', () => {
  it('renders the map', () => {
    const { container } = render(<CognitiveMapView map={fixture} />)
    expect(container.querySelectorAll('g[data-beat-id]')).toHaveLength(5)
  })

  it('forwards beat selection', () => {
    const onSelectBeat = vi.fn()
    const { container } = render(<CognitiveMapView map={fixture} onSelectBeat={onSelectBeat} />)
    container.querySelector<SVGGElement>('g[data-beat-id="b2"]')!
      .dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onSelectBeat).toHaveBeenCalledWith('b2')
  })

  it('redraws when the map changes', () => {
    const { container, rerender } = render(<CognitiveMapView map={fixture} />)
    rerender(<CognitiveMapView map={{ v: 1, beats: [fixture.beats[0]!], edges: [] }} />)
    expect(container.querySelectorAll('g[data-beat-id]')).toHaveLength(1)
  })

  it('does not remount when only the callback identity changes', () => {
    const { container, rerender } = render(<CognitiveMapView map={fixture} onSelectBeat={vi.fn()} />)
    const svgBefore = container.querySelector('svg')
    rerender(<CognitiveMapView map={fixture} onSelectBeat={vi.fn()} />)
    expect(container.querySelector('svg')).toBe(svgBefore)
  })

  it('tears down on unmount', () => {
    const { container, unmount } = render(<CognitiveMapView map={fixture} />)
    unmount()
    expect(container.querySelectorAll('svg')).toHaveLength(0)
  })
})
