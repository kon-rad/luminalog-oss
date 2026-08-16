import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

// Drift guard for the vendored copies.
//
// The renderer source lives here and is COPIED into two places that cannot take a
// build-time dependency on it: web/src/lib/cognitive-map (deploy.sh rsyncs only web/)
// and ios/LuminaLog/Resources/vendor (Xcode must not need Node). If someone edits the
// source and forgets `npm run sync:web` / `npm run sync:ios`, the shipped app silently
// keeps rendering the old code. This test makes that a red build instead.

const packageRoot = join(__dirname, '..')
const repoRoot = join(packageRoot, '..', '..')
const webDir = join(repoRoot, 'web', 'src', 'lib', 'cognitive-map')

const SHARED_FILES = [
  'types.ts', 'layout.ts', 'wrap.ts', 'rank.ts',
  'theme.ts', 'render.ts', 'mount.ts', 'index.ts', 'react.tsx',
]

describe('vendored web copy is in sync', () => {
  it.each(SHARED_FILES)('%s matches the source', (file) => {
    const copy = join(webDir, file)
    expect(existsSync(copy), `${file} missing from web. Run: npm run sync:web`).toBe(true)
    expect(
      readFileSync(copy, 'utf8'),
      `${file} differs from the source. Run: npm run sync:web`,
    ).toBe(readFileSync(join(packageRoot, 'src', file), 'utf8'))
  })

  it('does not vendor the test files or the iOS-only entry point', () => {
    for (const unwanted of ['types.test.ts', 'iife.ts', 'sync.test.ts']) {
      expect(existsSync(join(webDir, unwanted)), `${unwanted} should not be vendored`).toBe(false)
    }
  })
})

describe('vendored iOS bundle is present', () => {
  it('has both the bundle and its host page', () => {
    const resources = join(repoRoot, 'ios', 'LuminaLog', 'Resources')
    expect(existsSync(join(resources, 'vendor', 'cognitive-map.iife.js'))).toBe(true)
    expect(existsSync(join(resources, 'map.html'))).toBe(true)
  })

  it('ships map.html identical to the one in this package', () => {
    expect(readFileSync(join(repoRoot, 'ios', 'LuminaLog', 'Resources', 'map.html'), 'utf8'))
      .toBe(readFileSync(join(packageRoot, 'ios', 'map.html'), 'utf8'))
  })
})
