export interface PyramidLayoutInput {
  periodIndex: number
  x: number
  y: number
  childCount: number
}

export interface PyramidLayoutPoint {
  periodIndex: number
  x: number
  y: number
  r: number
  hasNarrative: boolean
}

export interface PyramidLayout {
  points: PyramidLayoutPoint[]
  width: number
  height: number
}

const CANVAS = 800
const PADDING = 80
const MIN_R = 10
const MAX_R = 36

/**
 * Pure: raw PCA-projected points to normalized, tappable dot positions. Min-max
 * normalizes x/y into the canvas (a degenerate zero-span axis, including the
 * single-point case, centers on that axis rather than collapsing to a corner) and
 * sizes radius by childCount on a log scale, so one huge outlier period never
 * swamps every other dot's radius.
 */
export function layoutPyramid(
  points: PyramidLayoutInput[],
  narrativePeriodIndexes: ReadonlySet<number> = new Set(),
): PyramidLayout {
  if (points.length === 0) return { points: [], width: CANVAS, height: CANVAS }

  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const spanX = maxX - minX
  const spanY = maxY - minY
  const maxChild = Math.max(...points.map(p => p.childCount), 1)

  const positioned = points.map(p => {
    const nx = spanX === 0 ? 0.5 : (p.x - minX) / spanX
    const ny = spanY === 0 ? 0.5 : (p.y - minY) / spanY
    return {
      periodIndex: p.periodIndex,
      x: PADDING + nx * (CANVAS - PADDING * 2),
      y: PADDING + ny * (CANVAS - PADDING * 2),
      r: MIN_R + (MAX_R - MIN_R) * (Math.log(p.childCount + 1) / Math.log(maxChild + 1)),
      hasNarrative: narrativePeriodIndexes.has(p.periodIndex),
    }
  })
  return { points: positioned, width: CANVAS, height: CANVAS }
}
