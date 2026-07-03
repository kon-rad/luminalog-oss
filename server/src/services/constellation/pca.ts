export interface Point3D {
  x: number
  y: number
  z: number
}

/**
 * Deterministic projection of N D-dimensional vectors to 3D via PCA.
 *
 * - Centers the data (subtract column mean).
 * - Extracts up to 3 principal directions with power iteration + deflation.
 *   Only min(3, N-1) directions exist for N points; missing axes stay 0
 *   (this IS the cold-start fallback: N=1 → origin, N=2 → a line, N=3 → a plane).
 * - Canonical sign per axis (largest-magnitude coordinate made positive) so the
 *   layout never mirror-flips between recomputes.
 * - Uniformly scales all coordinates into the unit cube [-1, 1].
 *
 * Pure and deterministic: same input → identical output.
 */
export function pcaTo3D(vectors: number[][]): Point3D[] {
  const n = vectors.length
  if (n === 0) return []
  if (n === 1) return [{ x: 0, y: 0, z: 0 }]

  const d = vectors[0].length

  // Center.
  const mean = new Array<number>(d).fill(0)
  for (const v of vectors) for (let j = 0; j < d; j++) mean[j] += v[j]
  for (let j = 0; j < d; j++) mean[j] /= n
  const R = vectors.map(v => v.map((x, j) => x - mean[j])) // n×d, deflated in place below

  const maxComps = Math.min(3, n - 1)
  const coords: number[][] = Array.from({ length: n }, () => [0, 0, 0])

  for (let c = 0; c < maxComps; c++) {
    const v = topDirection(R, d)
    for (let i = 0; i < n; i++) {
      let p = 0
      for (let j = 0; j < d; j++) p += R[i][j] * v[j]
      coords[i][c] = p
      for (let j = 0; j < d; j++) R[i][j] -= p * v[j] // deflate
    }
  }

  // Canonical sign per axis.
  for (let c = 0; c < 3; c++) {
    let idx = 0
    let mag = 0
    for (let i = 0; i < n; i++) {
      const a = Math.abs(coords[i][c])
      if (a > mag) { mag = a; idx = i }
    }
    if (coords[idx][c] < 0) for (let i = 0; i < n; i++) coords[i][c] = -coords[i][c]
  }

  // Uniform scale into the unit cube.
  let maxAbs = 0
  for (const row of coords) for (const x of row) if (Math.abs(x) > maxAbs) maxAbs = Math.abs(x)
  const s = maxAbs > 0 ? 1 / maxAbs : 0
  return coords.map(([x, y, z]) => ({ x: x * s, y: y * s, z: z * s }))
}

/** Top right-singular vector of centered matrix R (n×d) via power iteration. */
function topDirection(R: number[][], d: number, iters = 200): number[] {
  const n = R.length
  // Deterministic, non-degenerate init (no Math.random — must stay reproducible).
  let v = new Array<number>(d)
  for (let j = 0; j < d; j++) v[j] = Math.sin(j + 1)
  normalize(v)

  for (let it = 0; it < iters; it++) {
    const Rv = new Array<number>(n).fill(0)
    for (let i = 0; i < n; i++) {
      let sum = 0
      for (let j = 0; j < d; j++) sum += R[i][j] * v[j]
      Rv[i] = sum
    }
    const w = new Array<number>(d).fill(0)
    for (let i = 0; i < n; i++) {
      const row = R[i]
      const rv = Rv[i]
      for (let j = 0; j < d; j++) w[j] += row[j] * rv
    }
    const norm = Math.sqrt(w.reduce((a, x) => a + x * x, 0))
    if (norm < 1e-12) break
    for (let j = 0; j < d; j++) w[j] /= norm
    v = w
  }
  return v
}

function normalize(v: number[]): void {
  const norm = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1
  for (let j = 0; j < v.length; j++) v[j] /= norm
}
