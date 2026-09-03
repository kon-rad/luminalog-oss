import { describe, it, expect } from 'vitest'
import { renderPyramidSvg } from './pyramidRender'
import { layoutPyramid } from './pyramidLayout'

describe('renderPyramidSvg', () => {
  it('draws one circle group per point, tagged with its periodIndex', () => {
    const layout = layoutPyramid([
      { periodIndex: 10, x: 0, y: 0, childCount: 1 },
      { periodIndex: 20, x: 1, y: 1, childCount: 1 },
    ])
    const svg = renderPyramidSvg(layout, null)
    expect(svg.querySelectorAll('g[data-period-index]')).toHaveLength(2)
    expect(svg.querySelector('g[data-period-index="10"]')).toBeTruthy()
  })

  it('dims a dot with no narrative and shows full opacity once it has one', () => {
    const layout = layoutPyramid(
      [
        { periodIndex: 1, x: 0, y: 0, childCount: 1 },
        { periodIndex: 2, x: 1, y: 0, childCount: 1 },
      ],
      new Set([2]),
    )
    const svg = renderPyramidSvg(layout, null)
    const unlabeled = svg.querySelector('g[data-period-index="1"] circle')!
    const labeled = svg.querySelector('g[data-period-index="2"] circle')!
    expect(Number(unlabeled.getAttribute('opacity'))).toBeLessThan(1)
    expect(Number(labeled.getAttribute('opacity'))).toBe(1)
  })

  it('draws a focus ring only around the focused dot', () => {
    const layout = layoutPyramid([{ periodIndex: 5, x: 0, y: 0, childCount: 1 }])
    const focused = renderPyramidSvg(layout, 5)
    const unfocused = renderPyramidSvg(layout, null)
    expect(focused.querySelectorAll('g[data-period-index="5"] circle')).toHaveLength(2)
    expect(unfocused.querySelectorAll('g[data-period-index="5"] circle')).toHaveLength(1)
  })

  it('makes every dot a focusable, tappable element', () => {
    const layout = layoutPyramid([{ periodIndex: 1, x: 0, y: 0, childCount: 1 }])
    const svg = renderPyramidSvg(layout, null)
    const g = svg.querySelector('g[data-period-index="1"]')!
    expect(g.getAttribute('role')).toBe('button')
    expect(g.getAttribute('tabindex')).toBe('0')
  })
})
