# @argo/cognitive-map

The renderer for Argo's per-entry **cognitive map**: five to nine short phrases
("beats") drawn as labeled shapes, connected by labeled, polarised lines.

**This package is the single source of truth for the map's contract, layout, and
drawing.** It is dependency-free, framework-free, and shared by both clients.

```
packages/cognitive-map/src   <-- you are here, edit ONLY this
   |
   |-- sync-web.sh --> web/src/lib/cognitive-map/         (TypeScript source copy)
   |-- sync-ios.sh --> ios/LuminaLog/Resources/vendor/    (12KB esbuild IIFE)
                       ios/LuminaLog/Resources/map.html
```

## If you change anything in `src/`, run both syncs

```bash
npm run sync:web
npm run sync:ios
git add ../../web/src/lib/cognitive-map ../../ios/LuminaLog/Resources
```

Forget, and the shipped apps silently keep rendering the old code. `npm test` fails
if the copies and the source have drifted, so this is a red build rather than a
mystery, but it is on you to run the syncs and commit the result.

### Why copies instead of a dependency

Neither client can take a build-time dependency on this directory:

- `web/deploy.sh` rsyncs **only** the `web/` tree to the server, so a
  `file:../packages/cognitive-map` dependency would not exist remotely and the remote
  `npm run build` would fail.
- An Xcode build must never require Node, so iOS gets a prebuilt bundle.

## API

```ts
import { mountCognitiveMap, layout, renderSvg, isCognitiveMap } from '@argo/cognitive-map'
import { CognitiveMapView } from '@argo/cognitive-map/react'
```

| Export | Purpose |
|---|---|
| `mountCognitiveMap(el, map, opts)` | Mounts into a DOM element. Scale-to-fit, pinch/drag pan, tap-to-select. Returns `{ update, destroy }` |
| `CognitiveMapView` | React wrapper around the above |
| `layout(map)` | Pure. Map to positioned nodes and routed edges, in abstract units |
| `renderSvg(layout)` | Pure. Layout to an `SVGSVGElement` |
| `isCognitiveMap(value)` | Runtime validator, including referential integrity of edges |
| `wrapLabel(text, maxChars, maxLines)` | Pure greedy wrap |

`MountOptions`: `onSelectBeat`, `theme`, `colorScheme`, `emptyMessage`.

## Theming: the host owns the palette

The renderer sets **no colours of its own**. Every fill and stroke is a CSS custom
property that the host supplies, which is what lets one renderer follow the iOS
design system and the web design system without knowing either exists.

| Variable | Meaning |
|---|---|
| `--cm-craft` `--cm-body` `--cm-people` `--cm-place` `--cm-mind` `--cm-money` `--cm-other` | The seven life domains. Colour binds to domain and nothing else |
| `--cm-text` / `--cm-text-muted` | Beat labels / edge labels and chips |
| `--cm-surface` | **The ground the map sits on.** Used only to mask the edge curve behind its label. Set this to a *card* colour and every edge label renders as a visible pale box |
| `--cm-edge` | Edge strokes and arrowheads |
| `--cm-keeper` | The gold hairline on a keeper beat |

`DEFAULT_LIGHT` / `DEFAULT_DARK` are fallbacks for tests and plain browsers. iOS passes
values from `CognitiveMapTheme.swift`; web passes its Tailwind equivalents.

## Visual language

Shape binds to `kind`, colour binds to `domain`, and nothing else uses either channel.

| `kind` | Shape | | `tier` | |
|---|---|---|---|---|
| `event` | rect, r=4 | | `map` | drawn |
| `feeling` | ellipse | | `ledger` | stored, never drawn |
| `belief` | pill | | | |
| `intent` | dashed rect | | | |

Spine beats render larger and heavier; keepers carry a gold hairline; entity mentions
render as small chips at the node foot.

## Layout is hand-written and deterministic

`layout.ts` is a layered (Sugiyama-style) algorithm: break cycles by DFS, rank by
longest path, order each rank by barycenter sweeps, route edges as cubic beziers with
the label on the curve midpoint.

**The same map always produces byte-identical output**, and a test asserts it. That is
the reason this is not force-directed: a journal map that reshuffles on every open
reads as unreliable, and the product's whole claim is that it shows you your own words
faithfully. Force layouts also overlap labels, and every node here carries a wrapped
phrase.

Output is in **abstract units**; the mount scales to fit. Layout therefore never
depends on viewport, orientation, or platform.

## Compile-target constraint

This source is compiled by three toolchains: this package (ES2022), the Next build
(**no `target` set, so it defaults to ES5**), and esbuild for iOS. Do not spread or
directly iterate a `Map`/`Set` iterator; use `Array.from(...)` or `.forEach(...)`.
Spreading a `MapIterator` is a hard compile error in the Next build.

## The cross-language contract

`fixtures/sample-map.json` is decoded by **three** test suites: this package,
`server/src/services/cognitiveMap/types.test.ts`, and the iOS `CognitiveMapTests`. The
map schema is expressed once per language (TypeScript here and in the server, Swift on
iOS) because those trees deploy independently. Change a field and you must change the
fixture, which fails the other suites until they follow.

## Commands

```bash
npm test          # 73 tests
npm run build     # dist/cognitive-map.iife.js (12KB)
npm run sync:web  # copy source into the Next app
npm run sync:ios  # build + copy bundle and map.html into the iOS app
```
