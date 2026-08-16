// Builds the single IIFE bundle the iOS WKWebView loads. The web app imports the
// TypeScript sources directly through Next's transpilePackages, so it needs no build.
import { build } from 'esbuild'

await build({
  entryPoints: ['src/iife.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  globalName: 'CognitiveMap',
  target: ['safari15'],
  outfile: 'dist/cognitive-map.iife.js',
})

console.log('built dist/cognitive-map.iife.js')
