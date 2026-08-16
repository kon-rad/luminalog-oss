import { describe, it, expect, vi } from 'vitest'
import { mountCognitiveMap } from './mount'
import { DOMAIN_VARS } from './theme'
import type { CognitiveMap } from './types'
import raw from '../fixtures/sample-map.json'

const fixture = raw as unknown as CognitiveMap

const host = () => {
  const div = document.createElement('div')
  document.body.appendChild(div)
  return div
}

describe('mountCognitiveMap', () => {
  it('renders an svg into the host', () => {
    const el = host()
    mountCognitiveMap(el, fixture)
    expect(el.querySelectorAll('svg')).toHaveLength(1)
  })

  it('applies the fallback theme as custom properties on the host', () => {
    const el = host()
    mountCognitiveMap(el, fixture)
    expect(el.style.getPropertyValue(DOMAIN_VARS.craft)).toBeTruthy()
  })

  it('lets the caller override any theme value', () => {
    const el = host()
    mountCognitiveMap(el, fixture, { theme: { [DOMAIN_VARS.craft]: '#123456' } })
    expect(el.style.getPropertyValue(DOMAIN_VARS.craft)).toBe('#123456')
  })

  it('calls onSelectBeat with the beat id when a node is clicked', () => {
    const onSelectBeat = vi.fn()
    const el = host()
    mountCognitiveMap(el, fixture, { onSelectBeat })
    el.querySelector<SVGGElement>('g[data-beat-id="b1"]')!.dispatchEvent(
      new MouseEvent('click', { bubbles: true }),
    )
    expect(onSelectBeat).toHaveBeenCalledWith('b1')
  })

  it('calls onSelectBeat when a node is activated by keyboard', () => {
    const onSelectBeat = vi.fn()
    const el = host()
    mountCognitiveMap(el, fixture, { onSelectBeat })
    el.querySelector<SVGGElement>('g[data-beat-id="b1"]')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    )
    expect(onSelectBeat).toHaveBeenCalledWith('b1')
  })

  it('replaces the drawing on update rather than appending', () => {
    const el = host()
    const handle = mountCognitiveMap(el, fixture)
    handle.update({ v: 1, beats: [fixture.beats[0]!], edges: [] })
    expect(el.querySelectorAll('svg')).toHaveLength(1)
    expect(el.querySelectorAll('g[data-beat-id]')).toHaveLength(1)
  })

  it('renders an empty state rather than throwing on an empty map', () => {
    const el = host()
    expect(() => mountCognitiveMap(el, { v: 1, beats: [], edges: [] })).not.toThrow()
    expect(el.querySelector('[data-cm-empty]')).toBeTruthy()
  })

  it('renders an empty state rather than throwing on a structurally invalid map', () => {
    const el = host()
    const broken = { v: 1, beats: fixture.beats, edges: [{ from: 'b0', to: 'nope' }] }
    expect(() => mountCognitiveMap(el, broken as unknown as CognitiveMap)).not.toThrow()
    expect(el.querySelector('[data-cm-empty]')).toBeTruthy()
  })

  it('removes everything on destroy', () => {
    const el = host()
    mountCognitiveMap(el, fixture).destroy()
    expect(el.children).toHaveLength(0)
  })
})
