import { describe, it, expect } from 'vitest'
import { layout, type LayoutNode } from './layout'
import { renderSvg, nodeShapePath, DOMAIN_VARS, DEFAULT_LIGHT, DEFAULT_DARK } from './render'
import type { BeatKind, CognitiveMap } from './types'
import raw from '../fixtures/sample-map.json'

const fixture = raw as unknown as CognitiveMap

describe('nodeShapePath', () => {
  const node = (kind: BeatKind): Pick<LayoutNode, 'kind' | 'w' | 'h'> => ({ kind, w: 100, h: 50 })

  it('draws an event as a lightly rounded rect', () => {
    const shape = nodeShapePath(node('event'))
    expect(shape.tag).toBe('rect')
    expect(shape.attrs.rx).toBe('4')
  })

  it('draws a feeling as an ellipse', () => {
    expect(nodeShapePath(node('feeling')).tag).toBe('ellipse')
  })

  it('draws a belief as a full pill', () => {
    expect(nodeShapePath(node('belief')).attrs.rx).toBe('25')
  })

  it('draws an intent dashed', () => {
    expect(nodeShapePath(node('intent')).attrs['stroke-dasharray']).toBeTruthy()
  })
})

describe('renderSvg', () => {
  const svg = () => renderSvg(layout(fixture))

  it('produces an svg sized to the layout', () => {
    const el = svg()
    expect(el.tagName.toLowerCase()).toBe('svg')
    expect(el.getAttribute('viewBox')).toMatch(/^0 0 \d+(\.\d+)? \d+(\.\d+)?$/)
  })

  it('renders one shape group per drawn beat, tagged with its id', () => {
    expect(svg().querySelectorAll('g[data-beat-id]')).toHaveLength(5)
  })

  it('colours a node from its domain custom property, never a literal', () => {
    const group = svg().querySelector('g[data-beat-id="b0"]')!
    const shape = group.querySelector('rect, ellipse')!
    expect(shape.getAttribute('stroke')).toBe(`var(${DOMAIN_VARS.craft})`)
  })

  it('marks a keeper so it can carry the gold hairline', () => {
    expect(svg().querySelector('g[data-beat-id="b2"]')!.getAttribute('data-keeper')).toBe('true')
  })

  it('marks non-spine beats so they can render quieter', () => {
    expect(svg().querySelector('g[data-beat-id="b2"]')!.getAttribute('data-spine')).toBe('false')
  })

  it('renders every edge label', () => {
    const labels = [...svg().querySelectorAll('text.cm-edge-label')].map(t => t.textContent)
    expect(labels).toContain('drained')
    expect(labels).toContain('lifted')
  })

  it('shows polarity as a sign beside the edge label', () => {
    const signs = [...svg().querySelectorAll('text.cm-edge-polarity')].map(t => t.textContent)
    expect(signs).toContain('+')
    expect(signs).toContain('−')
  })

  it('renders entity chips', () => {
    const chips = [...svg().querySelectorAll('text.cm-chip')].map(t => t.textContent)
    expect(chips).toContain('the beta')
  })

  it('gives every beat group an accessible label', () => {
    const group = svg().querySelector('g[data-beat-id="b0"]')!
    expect(group.getAttribute('role')).toBe('button')
    expect(group.getAttribute('aria-label')).toContain('Only three people signed up')
  })

  it('defines a light and a dark value for every domain', () => {
    for (const varName of Object.values(DOMAIN_VARS)) {
      expect(DEFAULT_LIGHT[varName]).toBeTruthy()
      expect(DEFAULT_DARK[varName]).toBeTruthy()
    }
  })
})
