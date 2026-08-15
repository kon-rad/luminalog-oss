# Final demo day deck, PowerPoint export

Builds `public/demo-day/argo-final-demo-day.pptx` — the sixteen-slide deck for the
Protocol Camp final demo day, with the spoken script attached to each slide as
PowerPoint speaker notes.

The same narrative renders on the web at [`/final-demo-day`](../../src/app/final-demo-day/page.tsx),
driven by `src/components/demo-day/slides.tsx`. **The two are separate
implementations of one deck** — the web version uses Newsreader and the real
component tree, the PowerPoint version re-lays it out in web-safe fonts so it
survives being opened on a machine that is not yours. If you change the story,
change both.

## Build

```sh
node scripts/demo-day-pptx/build.js            # writes to public/demo-day/
node scripts/demo-day-pptx/build.js out.pptx   # or somewhere else
```

Dependencies are `pptxgenjs`, `sharp`, `playwright`, and `html2pptx.js`. The
first three can be global (`npm i -g pptxgenjs sharp playwright`, then run with
`NODE_PATH=$(npm root -g)`) or local dev dependencies. `html2pptx.js` ships with
the Claude `pptx` skill rather than npm; the script looks for it under
`~/.claude/plugins/...` and honours `HTML2PPTX=/path/to/html2pptx.js`.

## What it generates

- `slides/*.html` — one file per slide at 720×405pt, the intermediate that
  html2pptx measures and converts. Gitignored, safe to delete.
- `.build/` — derived art: the flywheel raster from `flywheel.svg`, the dimmed
  watermark (PowerPoint drops CSS opacity, so it is baked into the pixels), and
  16:9 crops of the four spoke photographs. Gitignored.

Original art lives in `public/demo-day/` and is committed.

## Checking it

```sh
soffice --headless --convert-to pdf public/demo-day/argo-final-demo-day.pptx
pdftoppm -png -r 110 argo-final-demo-day.pdf slide
```

Read the images. html2pptx catches overflow and reports it as a build error,
but it cannot tell you that a line broke somewhere ugly.

## Still open

Five slides carry deliberate placeholders rather than invented content. They are
marked in the deck with an amber slot, and listed in the `todo` field of each
slide in both implementations:

| Slide | Missing |
|---|---|
| 3. Winston | The clip, trimmed to 0:38–0:53 and level matched |
| 7. Launch film | The 30 second film. Scripted in the vault, not yet shot |
| 8. Live demo | Live device mirror; the stills are the fallback |
| 13. The results | Every figure. Dashboards and App Store Connect |
| 14. Testimonials | Verbatim quotes, titles, and permission to show them |
| 16. Close | THE ASK, as one specific sentence |
