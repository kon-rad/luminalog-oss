# Contest media pipeline

Everything the `/mybw2026-contest` **Bank Negara Malaysia Museum & Art Gallery** tab shows —
the tile grid, the full-screen viewer, the figures in *Field notes*, the photo strips in the
*Knowledge base*, and the `images` array in `/api/contest/data` — is built from two things:

| | |
| --- | --- |
| `curation.json` | What appears, and its words. **Edit this.** |
| The originals | Full-resolution photos/videos, kept **outside** the public repo at `<workspace-root>/assets/contest-originals/`. |

`src/lib/contest/gallery.ts` is **generated**. Don't hand-edit it; your changes get overwritten.

## Curating

Two ways, same result.

### A. Delete the files you don't want (visual)

Open `public/contest/gallery/full/` in Finder, view it as icons, and delete the redundant
images. Then:

```bash
npm run contest:media -- --sync
```

`--sync` reconciles `curation.json` to whatever is left in `full/`: anything published whose
full-size image has gone is flipped to `"keep": false`, and its thumbnail and MP4 are removed
too. It prints exactly what it dropped.

> **`--sync` is required.** Without it, a missing derivative just means "not encoded yet", so a
> plain re-run silently regenerates everything you deleted. Deleting files is only a durable
> curation gesture when you follow it with `--sync`.

Nothing is destroyed: the originals are untouched and the transcription stays in
`curation.json`, so restoring an item is flipping one flag back to `true` and re-running.

### B. Edit the flags directly

Open `curation.json` and set `"keep": false` on anything you want off the site:

```jsonc
{
  "id": "img3184",
  "file": "IMG_3184.jpeg",
  "kind": "image",
  "keep": false,          // ← drops it from the gallery, the API, and the agent skill
  "room": "people",
  "title": "Second look",
  "caption": "Kerosene lamp visible over one shoulder…",
  "text": "…",           // transcribed signage; omit if the media has none
  "topics": ["semiconductors", "infrastructure"],
  "shotAt": "2026-07-30T12:19:28"
}
```

Then:

```bash
npm run contest:media -- --prune
```

`--prune` also deletes the derivative files for anything you dropped, so they stop being
committed. Without it the files stay on disk but are absent from the site. (`--sync` implies
`--prune`.)

The other editable fields:

- **`title` / `caption`** — shown under the photo in the viewer and in *Field notes* figures.
- **`text`** — signage transcribed from the media. This is what makes the Knowledge Base
  cross-linkable and it is the primary-source material the agent skill serves. Omit the key
  entirely for media with no readable text.
- **`topics`** — slugs from `src/lib/contest/knowledge.ts`. These drive the "Read more" chips in
  the viewer and the "From the gallery" strip on each wiki entry. A slug that doesn't exist is
  silently ignored, so check your spelling.
- **`room`** — one of `arrival`, `economics`, `numismatics`, `islamic-finance`, `bnm`, `people`.
  Rooms become the filter chips above the grid. A room with no kept items disappears.

Ordering is automatic: by room, then capture time.

## Adding new media

1. Drop the original into `<workspace-root>/assets/contest-originals/`.
2. Add an entry to `curation.json` with a new `id` (`imgNNNN` / `vidNNNN`), the `file` name,
   `kind`, `room`, `title`, `caption`, `topics`, and ideally `shotAt`.
3. `npm run contest:media`

`shotAt` is read from EXIF for images when you leave it out; videos have no EXIF, so set it.

## What gets produced

| Output | Size | Used for |
| --- | --- | --- |
| `public/contest/gallery/thumb/<id>.webp` | long edge ≤ 640 | grid tiles, wiki strips, article figures, **and video poster frames** |
| `public/contest/gallery/full/<id>.webp` | long edge ≤ 2000 | full-screen viewer |
| `public/contest/gallery/video/<id>.mp4` | H.264, ≤ 1080, faststart | videos only |

Video posters are chosen by ffmpeg's `thumbnail` filter, which picks a representative frame
rather than frame 0 — so you don't get a black or motion-blurred first frame. `+faststart`
moves the MP4 index to the front so playback starts before the file finishes downloading.

Re-runs are incremental: existing derivatives are reused, so a curation-only change takes a
second or two. Use `--force` to re-encode everything (after changing a quality constant).

## Requirements

- Python 3 with Pillow — `pip3 install --user Pillow`
- `ffmpeg` and `ffprobe` on `PATH` (only needed if any kept item is a video)

## Why the originals live outside the repo

`luminalog-oss/` is public. The 118 originals are ~305 MB of full-resolution camera files;
the committed WebP/MP4 derivatives are ~29 MB. Keeping originals in the private workspace root
keeps the public repo small and means the raw files are never published.
