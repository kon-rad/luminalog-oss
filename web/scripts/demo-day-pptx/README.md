# Final demo day deck, PowerPoint export

Builds `public/demo-day/argo-final-demo-day.pptx` — the eighteen-slide deck for the
Protocol Camp final demo day, with the Winston clip and the launch film embedded
as playable video.

**No speaker notes, deliberately.** The deck ships without a script attached to
any slide. Konrad presents from his own, kept in the vault at
`Areas/argo/protocol-camp/final-demo-day/final-demo-day/`, so the file can be
handed to anyone without a rehearsal script riding along in the notes pane.

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

## The two videos

Slides 3 and 7 embed real video, so the deck plays on a machine with no network.
That is what takes the file from ~1.7 MB to ~41 MB — worth it, because the one
thing you cannot recover from on stage is the venue wifi.

Both are encoded from masters in the vault under
`Areas/argo/protocol-camp/final-demo-day/`. Re-derive them with:

```sh
# Slide 3, Winston. Cut ends on "in that order" — the master runs on into the
# next sentence and is cut off mid-word at 0:41. loudnorm is not optional: the
# lecture-hall audio is quiet enough to disappear on a venue PA.
ffmpeg -ss 0.5 -i clip-weapon.mp4 -t 30.1 -vf scale=1280:720 \
  -c:v libx264 -crf 23 -preset slow -profile:v high -pix_fmt yuv420p \
  -af loudnorm=I=-16:TP=-1.5:LRA=11 -c:a aac -b:a 128k -movflags +faststart \
  public/demo-day/clip-winston-weapon.mp4

# Slide 7, the launch film. The master is 4K HEVC in a .mov, which PowerPoint on
# Windows will not play; H.264 is the point of this pass as much as the size is.
ffmpeg -i launch-ad/launch-ad-1.mov -vf scale=1920:1080 \
  -c:v libx264 -crf 21 -preset medium -profile:v high -pix_fmt yuv420p \
  -c:a aac -b:a 192k -movflags +faststart \
  public/demo-day/launch-film.mp4
```

Each also has a `*-poster.jpg` next to it, used as the PowerPoint cover image
(otherwise PowerPoint draws a grey play button) and as the web `<video poster>`.

**`launch-film.mp4` is gitignored.** 34 MB of video that git cannot delta-compress
does not belong in a ~4 MB public repo. It still reaches production, because
`deploy.sh` rsyncs the whole tree and does not consult `.gitignore`. The Winston
clip is 5 MB and is committed.

### When a video is missing

The build never fails over an absent clip; it drops a rung and says so.

| | Plays | Needs |
|---|---|---|
| Local mp4 embedded | in place | nothing — this is the one to present from |
| YouTube embed | in place | working wifi, and a venue that does not block YouTube |
| Poster still | not at all | — |

A fresh clone has no `launch-film.mp4`, so it builds at rung 2 automatically and
prints `! 07-film: … linking YouTube instead`. That deck is ~7 MB rather than 41.

The links, also the manual backup if the embed misbehaves on the day:

- Winston, "How to Speak" — <https://youtu.be/vq5cH0WguOU>
- Argo launch film — <https://www.youtube.com/watch?v=Ppl-TfO3Oqo>

PowerPoint needs the `/embed/` form of these, which is what `build.js` stores;
the watch and youtu.be forms render as a dead frame.

## Checking it

```sh
soffice --headless --convert-to pdf public/demo-day/argo-final-demo-day.pptx
pdftoppm -png -r 110 argo-final-demo-day.pdf slide
```

Read the images. html2pptx catches overflow and reports it as a build error,
but it cannot tell you that a line broke somewhere ugly.

## Still open

Every slide now carries real content. There are no amber placeholder slots left,
and no production notes rendered as slide copy. What remains outstanding is
tracked in the `todo` field in `slides.tsx`, which flags a slide "needs work" in
the overview grid but never prints anything on the slide itself:

| Slide | Outstanding |
|---|---|
| 8. Live demo | Live device mirror; the stills are the fallback |
| 16. Close | Where the four asks point — links, or one QR covering all four |

Cleared on 2026-08-15: slides 3 and 7 got their real video, 13 got its figures
from the vault's `demo-day-metrics.md`, 14 got three named quotes from
`interview-testimonials.md`, and 16 got the four asks.

Two caveats that live outside this repo and are worth knowing before presenting:

- **Slide 13 uses the all-owned-channels framing** for both views and watch
  hours, which includes the founder channel going back to 2017. The tile says so
  and prints the Argo-only split underneath. The research doc is emphatic that
  the two framings must never be blended silently — if you would rather claim
  only the Argo-branded numbers, they are 5,793 views and 51.9 hours.
- **Slide 14 quotes are trimmed for spoken disfluency**, nothing more. The
  timestamps on each card are there so any of them can be checked against tape.
  Whether each guest has agreed to appear on a slide is not something this repo
  can know.

Separately, and not a deck problem: the spoken script in the vault runs 7:00 and
budgets no beat at all for the launch film. With the film and the longer Winston
cut the talk is nearer 8:05. The running order needs re-timing.
