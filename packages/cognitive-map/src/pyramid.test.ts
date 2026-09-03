import { describe, it, expect, vi } from 'vitest'
import { mountZoomPyramid } from './pyramid'
import type { CognitiveMap } from './types'

const host = () => {
  const div = document.createElement('div')
  document.body.appendChild(div)
  return div
}

const weekPoints = [
  { periodIndex: 1, x: 0, y: 0, z: 0, childCount: 3, parentIndex: 202601 },
  { periodIndex: 2, x: 5, y: 5, z: 0, childCount: 1, parentIndex: 202601 },
]

describe('mountZoomPyramid', () => {
  it('requests the initial tier once on mount', () => {
    const onNeedTierData = vi.fn()
    mountZoomPyramid(host(), { onNeedTierData })
    expect(onNeedTierData).toHaveBeenCalledWith('week')
    expect(onNeedTierData).toHaveBeenCalledTimes(1)
  })

  it('renders dots once setTierData answers for the current tier', () => {
    const el = host()
    const handle = mountZoomPyramid(el)
    handle.setTierData('week', weekPoints)
    expect(el.querySelectorAll('g[data-period-index]')).toHaveLength(2)
  })

  it('ignores setTierData for a tier that is not currently shown', () => {
    const el = host()
    const handle = mountZoomPyramid(el)
    handle.setTierData('month', [{ periodIndex: 9, x: 0, y: 0, z: 0, childCount: 1, parentIndex: null }])
    expect(el.querySelectorAll('g[data-period-index]')).toHaveLength(0)
  })

  it('focuses a dot on click and requests its narrative, without changing tier', () => {
    const onFocusChange = vi.fn()
    const onNeedNarrative = vi.fn()
    const el = host()
    const handle = mountZoomPyramid(el, { onFocusChange, onNeedNarrative })
    handle.setTierData('week', weekPoints)
    el.querySelector<SVGGElement>('g[data-period-index="1"]')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    )
    expect(onFocusChange).toHaveBeenCalledWith({
      periodType: 'week', periodIndex: 1, childCount: 3, narrative: null,
    })
    expect(onNeedNarrative).toHaveBeenCalledWith('week', 1)
    expect(el.querySelectorAll('g[data-period-index]')).toHaveLength(2) // still week tier
  })

  it('focuses on Enter keydown same as click', () => {
    const onFocusChange = vi.fn()
    const el = host()
    const handle = mountZoomPyramid(el, { onFocusChange })
    handle.setTierData('week', weekPoints)
    el.querySelector<SVGGElement>('g[data-period-index="2"]')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    )
    expect(onFocusChange).toHaveBeenCalledWith(
      expect.objectContaining({ periodIndex: 2 }),
    )
  })

  it('applies a pushed narrative to a focused dot without a redundant re-request', () => {
    const onFocusChange = vi.fn()
    const onNeedNarrative = vi.fn()
    const el = host()
    const handle = mountZoomPyramid(el, { onFocusChange, onNeedNarrative })
    handle.setTierData('week', weekPoints)
    el.querySelector<SVGGElement>('g[data-period-index="1"]')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    )
    handle.setNarrative('week', 1, 'A steady week of shipping.')
    expect(onFocusChange).toHaveBeenLastCalledWith({
      periodType: 'week', periodIndex: 1, childCount: 3, narrative: 'A steady week of shipping.',
    })
    expect(onNeedNarrative).toHaveBeenCalledTimes(1)
  })

  it("drillIn on a non-day tier requests the child tier and shows only that parent's children", () => {
    const onNeedTierData = vi.fn()
    const el = host()
    const handle = mountZoomPyramid(el, { onNeedTierData, initialTier: 'week' })
    handle.setTierData('week', weekPoints)
    handle.drillIn(1)
    expect(onNeedTierData).toHaveBeenCalledWith('day')

    handle.setTierData('day', [
      { periodIndex: 100, x: 0, y: 0, z: 0, childCount: 1, parentIndex: 1 },
      { periodIndex: 101, x: 1, y: 1, z: 0, childCount: 1, parentIndex: 2 }, // different parent
    ])
    expect(el.querySelectorAll('g[data-period-index]')).toHaveLength(1)
    expect(el.querySelector('g[data-period-index="100"]')).toBeTruthy()
  })

  it('drillIn on a day dot requests the entry and shows it once pushed, delegating to mountCognitiveMap', () => {
    const onNeedEntry = vi.fn()
    const el = host()
    const handle = mountZoomPyramid(el, { onNeedEntry, initialTier: 'day' })
    handle.setTierData('day', [{ periodIndex: 100, x: 0, y: 0, z: 0, childCount: 1, parentIndex: 1 }])
    handle.drillIn(100)
    expect(onNeedEntry).toHaveBeenCalledWith(100)
    expect(el.querySelector('[data-cm-entry-loading]')).toBeTruthy()

    const map: CognitiveMap = { v: 1, beats: [], edges: [] }
    handle.setEntryMap(100, map)
    // mountCognitiveMap renders its own empty state for a beats-free map; either
    // way the loading placeholder must be gone and the day dots must not be back.
    expect(el.querySelector('[data-cm-entry-loading]')).toBeFalsy()
    expect(el.querySelectorAll('g[data-period-index]')).toHaveLength(0)
  })

  it('zoomOut from a drilled-in tier returns to the parent view without a new fetch', () => {
    const onNeedTierData = vi.fn()
    const el = host()
    const handle = mountZoomPyramid(el, { onNeedTierData, initialTier: 'week' })
    handle.setTierData('week', weekPoints)
    handle.drillIn(1)
    handle.setTierData('day', [{ periodIndex: 100, x: 0, y: 0, z: 0, childCount: 1, parentIndex: 1 }])
    onNeedTierData.mockClear()

    handle.zoomOut()
    expect(el.querySelectorAll('g[data-period-index]')).toHaveLength(2) // back to both weeks
    expect(onNeedTierData).not.toHaveBeenCalled() // week tier already cached
  })

  it('zoomOut past the top of the stack moves to the coarser tier, unfiltered', () => {
    const onNeedTierData = vi.fn()
    const el = host()
    const handle = mountZoomPyramid(el, { onNeedTierData, initialTier: 'week' })
    handle.setTierData('week', weekPoints)
    handle.zoomOut()
    expect(onNeedTierData).toHaveBeenCalledWith('month')
  })

  it('zoomOut does nothing at the lifetime tier', () => {
    const onNeedTierData = vi.fn()
    const el = host()
    mountZoomPyramid(el, { onNeedTierData, initialTier: 'lifetime' }).zoomOut()
    expect(onNeedTierData).toHaveBeenCalledTimes(1) // only the initial request, no second call
  })

  it('zoomOut from entry view returns to the day tier it came from', () => {
    const el = host()
    const handle = mountZoomPyramid(el, { initialTier: 'day' })
    handle.setTierData('day', [{ periodIndex: 100, x: 0, y: 0, z: 0, childCount: 1, parentIndex: 1 }])
    handle.drillIn(100)
    handle.setEntryMap(100, { v: 1, beats: [], edges: [] })
    handle.zoomOut()
    expect(el.querySelectorAll('g[data-period-index]')).toHaveLength(1)
  })

  it('forwards onSelectBeat from the delegated entry map', () => {
    const onSelectBeat = vi.fn()
    const el = host()
    const handle = mountZoomPyramid(el, { onSelectBeat, initialTier: 'day' })
    handle.setTierData('day', [{ periodIndex: 100, x: 0, y: 0, z: 0, childCount: 1, parentIndex: 1 }])
    handle.drillIn(100)
    handle.setEntryMap(100, {
      v: 1,
      beats: [{
        id: 'b1', tier: 'map', kind: 'event', text: 'Shipped', quote: 'Shipped',
        quoteStart: 0, domain: 'craft', isSpine: false, isKeeper: false,
        generality: 0, keepScore: 0, degree: 0, mentions: [],
      }],
      edges: [],
    })
    el.querySelector<SVGGElement>('g[data-beat-id="b1"]')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    )
    expect(onSelectBeat).toHaveBeenCalledWith('b1')
  })

  it('removes everything on destroy', () => {
    const el = host()
    const handle = mountZoomPyramid(el)
    handle.setTierData('week', weekPoints)
    handle.destroy()
    expect(el.children).toHaveLength(0)
  })
})
