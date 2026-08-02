#!/usr/bin/env python3
"""Build the /mybw2026-contest museum gallery from curated originals.

    npm run contest:media              # process everything that is missing
    npm run contest:media -- --sync    # adopt files you deleted from full/ as un-published
    npm run contest:media -- --force   # re-encode everything
    npm run contest:media -- --prune   # also delete derivatives for dropped items

`scripts/contest-media/curation.json` is the editable source of truth: which items
appear on the site (`keep`), and their room / title / caption / transcribed text /
knowledge-base topics. This script reads it, encodes web derivatives from the
originals, and regenerates `src/lib/contest/gallery.ts`.

Curating by deleting files: browse `public/contest/gallery/full/`, delete what you do
not want, then run with `--sync`. Anything published whose `full/` image has gone is
flipped to `"keep": false` in curation.json and its other derivatives are removed.
Without `--sync` a missing derivative just means "re-encode it", so deletions are
silently undone on the next run.

Never hand-edit `src/lib/contest/gallery.ts` — it is overwritten here.

Outputs, per kept item:
    public/contest/gallery/thumb/<id>.webp   long edge <=640   (grid tile / poster)
    public/contest/gallery/full/<id>.webp    long edge <=2000  (full-screen viewer)
    public/contest/gallery/video/<id>.mp4    videos only, H.264 <=1080, faststart

Requires: Python 3 with Pillow, and ffmpeg/ffprobe on PATH.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from datetime import datetime

try:
    from PIL import Image, ImageOps
except ImportError:
    sys.exit("Pillow is required:  pip3 install --user Pillow")

HERE = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.dirname(HERE)
CURATION = os.path.join(HERE, "contest-media", "curation.json")
OUT = os.path.join(WEB, "public", "contest", "gallery")
MANIFEST = os.path.join(WEB, "src", "lib", "contest", "gallery.ts")

THUMB_EDGE, THUMB_Q = 640, 72
FULL_EDGE, FULL_Q = 2000, 80
VIDEO_EDGE, VIDEO_CRF = 1080, 26

ROOM_ORDER = ["arrival", "economics", "numismatics", "islamic-finance", "bnm", "people"]

ROOMS = [
    (
        "arrival",
        "Arrival",
        "Getting to Sasana Kijang on Jalan Dato Onn, the nautilus staircase, the lockers, "
        "and the fold-out guide that maps the whole museum.",
    ),
    (
        "economics",
        "Economics Gallery",
        "How Malaysia earns its living — tin, rubber, palm oil, petroleum, semiconductors — "
        "and the infrastructure that made any of it possible.",
    ),
    (
        "numismatics",
        "Numismatics Gallery",
        "Money itself: tin money-trees, the trade dollars that gave the ringgit its name, "
        "cheques, coin minting, banknote design, and the road to ePayments.",
    ),
    (
        "islamic-finance",
        "Islamic Finance Gallery",
        "Riba, mudarabah, suftaja, takaful and sukuk — a thousand years of contract design, "
        "and how Malaysia turned it into a modern dual financial system.",
    ),
    (
        "bnm",
        "Bank Negara Malaysia Gallery",
        "The central bank's own story: why Malaya needed one, the 1958 Ordinance, the kijang "
        "logo, the mandate carved into the wall.",
    ),
    (
        "people",
        "The visit",
        "Us, in the building. Reflections, selfies, the group shot, and the walk past the vault.",
    ),
]


def run(cmd: list[str]) -> None:
    proc = subprocess.run(cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(f"{cmd[0]} failed:\n{proc.stderr.strip()[-1500:]}")


def probe(path: str) -> dict:
    """Video width/height/duration, with rotation applied."""
    out = subprocess.run(
        [
            "ffprobe", "-v", "error", "-select_streams", "v:0",
            "-show_entries", "stream=width,height:stream_side_data=rotation",
            "-show_entries", "format=duration",
            "-of", "json", path,
        ],
        capture_output=True, text=True, check=True,
    ).stdout
    data = json.loads(out)
    stream = data["streams"][0]
    w, h = int(stream["width"]), int(stream["height"])
    for sd in stream.get("side_data_list", []) or []:
        if abs(int(sd.get("rotation", 0))) in (90, 270):
            w, h = h, w
    return {"width": w, "height": h, "duration": float(data["format"]["duration"])}


def resize(img: "Image.Image", edge: int) -> "Image.Image":
    w, h = img.size
    if max(w, h) <= edge:
        return img.copy()
    s = edge / max(w, h)
    return img.resize((max(1, round(w * s)), max(1, round(h * s))), Image.LANCZOS)


def write_derivatives(img: "Image.Image", item_id: str) -> None:
    resize(img, THUMB_EDGE).save(f"{OUT}/thumb/{item_id}.webp", "WEBP", quality=THUMB_Q, method=6)
    resize(img, FULL_EDGE).save(f"{OUT}/full/{item_id}.webp", "WEBP", quality=FULL_Q, method=6)


def exif_shot_at(img: "Image.Image") -> str | None:
    try:
        raw = img.getexif().get(36867) or img.getexif().get(306)
        if raw:
            return datetime.strptime(str(raw), "%Y:%m:%d %H:%M:%S").isoformat()
    except Exception:
        pass
    return None


def process_image(src: str, item: dict, force: bool) -> dict:
    paths = [f"{OUT}/thumb/{item['id']}.webp", f"{OUT}/full/{item['id']}.webp"]
    with Image.open(src) as raw:
        shot_at = item.get("shotAt") or exif_shot_at(raw)
        oriented = ImageOps.exif_transpose(raw)
        width, height = oriented.size
        if force or not all(os.path.exists(p) for p in paths):
            write_derivatives(oriented.convert("RGB"), item["id"])
            did_work = True
        else:
            did_work = False
    return {"width": width, "height": height, "shotAt": shot_at, "encoded": did_work}


def process_video(src: str, item: dict, force: bool) -> dict:
    info = probe(src)
    mp4 = f"{OUT}/video/{item['id']}.mp4"
    posters = [f"{OUT}/thumb/{item['id']}.webp", f"{OUT}/full/{item['id']}.webp"]
    outputs = posters + [mp4]
    if not force and all(os.path.exists(p) for p in outputs):
        return {**info, "shotAt": item.get("shotAt"), "encoded": False}

    # Poster: let ffmpeg pick a representative (non-black, in-focus-ish) frame.
    tmp = f"{OUT}/.poster-{item['id']}.png"
    run(["ffmpeg", "-y", "-v", "error", "-i", src, "-vf", "thumbnail", "-frames:v", "1", tmp])
    with Image.open(tmp) as poster:
        write_derivatives(poster.convert("RGB"), item["id"])
    os.remove(tmp)

    # Web video: H.264 so it plays everywhere, faststart so it streams before it finishes.
    scale = f"scale='min({VIDEO_EDGE},iw)':'min({VIDEO_EDGE},ih)':force_original_aspect_ratio=decrease"
    run([
        "ffmpeg", "-y", "-v", "error", "-i", src,
        "-vf", f"{scale},scale=trunc(iw/2)*2:trunc(ih/2)*2",
        "-c:v", "libx264", "-preset", "slow", "-crf", str(VIDEO_CRF), "-pix_fmt", "yuv420p",
        "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", mp4,
    ])
    return {**info, "shotAt": item.get("shotAt"), "encoded": True}


def js(value) -> str:
    return json.dumps(value, ensure_ascii=False)


def render_manifest(records: list[dict]) -> str:
    rooms = "\n".join(
        f"  {{\n"
        f"    id: {js(rid)},\n"
        f"    label: {js(label)},\n"
        f"    blurb:\n      {js(blurb)},\n"
        f"  }},"
        for rid, label, blurb in ROOMS
        if any(r["room"] == rid for r in records)
    )

    entries = []
    for r in records:
        lines = [
            "  {",
            f"    id: {js(r['id'])},",
            f"    kind: {js(r['kind'])},",
            f"    room: {js(r['room'])},",
            f"    title: {js(r['title'])},",
            f"    caption: {js(r['caption'])},",
        ]
        if r.get("text"):
            lines.append(f"    text: {js(r['text'])},")
        if r["kind"] == "video":
            lines.append(f"    durationSec: {round(r['duration'], 2)},")
        lines += [
            f"    topics: {js(r['topics'])},",
            f"    width: {r['width']},",
            f"    height: {r['height']},",
            f"    shotAt: {js(r['shotAt']) if r['shotAt'] else 'null'},",
            "  },",
        ]
        entries.append("\n".join(lines))

    images = sum(1 for r in records if r["kind"] == "image")
    videos = len(records) - images

    return f"""// GENERATED FILE — do not edit by hand.
//
// Source of truth: scripts/contest-media/curation.json
// Regenerate with: npm run contest:media
//
// {images} photographs and {videos} video{'' if videos == 1 else 's'} from the Bank Negara Malaysia
// Museum & Art Gallery visit on 30 July 2026 (Malaysia Blockchain Week 2026 · Argo
// Essay Contest).
//
// `text` holds wall/label copy transcribed from the photograph — it is what makes the
// Knowledge Base cross-linkable and what an agent reading `/mybw2026-contest/skill.md`
// ultimately consumes. `topics` are KnowledgeEntry slugs (see ./knowledge.ts).
//
// Derivatives:
//   /contest/gallery/thumb/<id>.webp   long edge <={THUMB_EDGE}   (tile, and video poster)
//   /contest/gallery/full/<id>.webp    long edge <={FULL_EDGE}  (full-screen viewer)
//   /contest/gallery/video/<id>.mp4    videos only, H.264 <={VIDEO_EDGE}, faststart

export type GalleryRoom =
{chr(10).join(f"  | {js(rid)}" for rid, _, _ in ROOMS if any(r['room'] == rid for r in records))}

export type GalleryKind = 'image' | 'video'

export interface GalleryImage {{
  id: string
  kind: GalleryKind
  room: GalleryRoom
  title: string
  caption: string
  /** Text transcribed from signage/labels visible in the media, if any. */
  text?: string
  /** Videos only: runtime in seconds. */
  durationSec?: number
  /** Slugs of related knowledge-base entries. */
  topics: string[]
  /** Original capture dimensions (all derivatives keep this aspect ratio). */
  width: number
  height: number
  /** Capture time, ISO 8601, local Kuala Lumpur time. */
  shotAt: string | null
}}

export interface GalleryRoomMeta {{
  id: GalleryRoom
  label: string
  blurb: string
}}

export const GALLERY_ROOMS: GalleryRoomMeta[] = [
{rooms}
]

export const GALLERY_IMAGES: GalleryImage[] = [
{chr(10).join(entries)}
]

export const thumbSrc = (id: string) => `/contest/gallery/thumb/${{id}}.webp`
export const fullSrc = (id: string) => `/contest/gallery/full/${{id}}.webp`
export const videoSrc = (id: string) => `/contest/gallery/video/${{id}}.mp4`

/** Poster frame for a video — the same asset the grid uses as its tile. */
export const posterSrc = thumbSrc

/** Media tagged with a knowledge-base topic slug, in gallery order. */
export function imagesForTopic(slug: string): GalleryImage[] {{
  return GALLERY_IMAGES.filter((img) => img.topics.includes(slug))
}}

export function imageById(id: string): GalleryImage | undefined {{
  return GALLERY_IMAGES.find((img) => img.id === id)
}}

/** Everything carrying transcribed signage — the corpus the agent skill exposes. */
export const IMAGES_WITH_TEXT = GALLERY_IMAGES.filter((img) => Boolean(img.text))
"""


ESSAY = os.path.join(WEB, "src", "components", "contest", "MuseumEssay.tsx")


def check_essay_figures(published: set[str]) -> list[str]:
    """Report <Figure id="..."> references in the field-notes article that are no longer published.

    A dropped figure renders as nothing at all, so without this check curating an image out
    silently punches a hole in the article.
    """
    if not os.path.exists(ESSAY):
        return []
    import re

    referenced = re.findall(r'<Figure\s+id="([a-z0-9]+)"', open(ESSAY).read())
    return [i for i in dict.fromkeys(referenced) if i not in published]


def adopt_deletions(doc: dict) -> None:
    """Reconcile curation.json to what is actually in full/.

    Anything currently published whose full-size derivative has been deleted is taken as an
    intentional removal and flipped to `keep: false`. This only ever flips keep off, never on,
    and never touches the originals — so a mistake is undone by editing one flag back to true.

    Skipped on a cold checkout (no derivatives on disk), which would otherwise read as
    "the user deleted everything".
    """
    full_dir = f"{OUT}/full"
    if not os.path.isdir(full_dir) or not os.listdir(full_dir):
        print("--sync: no full/ derivatives on disk yet — nothing to reconcile, skipping.")
        return

    present = {f[: -len(".webp")] for f in os.listdir(full_dir) if f.endswith(".webp")}
    deleted = [i for i in doc["items"] if i.get("keep", True) and i["id"] not in present]
    if not deleted:
        print("--sync: full/ matches curation.json — nothing to un-publish.")
        return

    print(f'--sync: {len(deleted)} item(s) missing from full/ -> setting "keep": false')
    for item in deleted:
        item["keep"] = False
        print(f"  - {item['id']:<10} {item['title']}")

    with open(CURATION, "w") as fh:
        json.dump(doc, fh, indent=1, ensure_ascii=False)
        fh.write("\n")
    print(f"  updated {os.path.relpath(CURATION, WEB)}\n")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--force", action="store_true", help="re-encode even if derivatives exist")
    ap.add_argument("--prune", action="store_true", help="delete derivatives for dropped items")
    ap.add_argument(
        "--sync",
        action="store_true",
        help="treat items deleted from full/ as un-published: set keep:false, then prune them",
    )
    args = ap.parse_args()

    doc = json.load(open(CURATION))
    src_dir = os.path.normpath(os.path.join(HERE, "contest-media", doc["sourceDir"]))
    if not os.path.isdir(src_dir):
        sys.exit(f"sourceDir not found: {src_dir}\nFix 'sourceDir' in {CURATION}.")

    for sub in ("thumb", "full", "video"):
        os.makedirs(f"{OUT}/{sub}", exist_ok=True)

    if args.sync:
        adopt_deletions(doc)
        args.prune = True

    order = {r: i for i, r in enumerate(ROOM_ORDER)}
    items = sorted(doc["items"], key=lambda x: (order.get(x["room"], 99), x.get("shotAt") or "", x["id"]))

    kept, dropped, encoded, missing = [], [], 0, []
    for item in items:
        if not item.get("keep", True):
            dropped.append(item["id"])
            continue
        path = os.path.join(src_dir, item["file"])
        if not os.path.exists(path):
            missing.append(f"{item['id']} → {item['file']}")
            continue
        try:
            info = (process_video if item["kind"] == "video" else process_image)(path, item, args.force)
        except Exception as exc:
            sys.exit(f"\n{item['id']} ({item['file']}) failed:\n  {exc}")
        encoded += 1 if info.pop("encoded") else 0
        kept.append({**item, **info})
        print(f"  {item['id']:<10} {item['kind']:<6} {item['title'][:52]}")

    if missing:
        print("\nMissing source files (skipped):")
        for m in missing:
            print(f"  ! {m}")

    if args.prune and dropped:
        removed = 0
        for item_id in dropped:
            for p in (f"{OUT}/thumb/{item_id}.webp", f"{OUT}/full/{item_id}.webp", f"{OUT}/video/{item_id}.mp4"):
                if os.path.exists(p):
                    os.remove(p)
                    removed += 1
        print(f"\nPruned {removed} derivative file(s) for {len(dropped)} dropped item(s).")

    open(MANIFEST, "w").write(render_manifest(kept))

    broken = check_essay_figures({r["id"] for r in kept})
    if broken:
        print(
            f"\nWARNING: {os.path.relpath(ESSAY, WEB)} references "
            f"{len(broken)} un-published figure(s), which will render as blank gaps:"
        )
        for item_id in broken:
            print(f"  ! <Figure id=\"{item_id}\" />  — point it at a published id, or drop the line")

    def dir_mb(path: str) -> float:
        return sum(
            os.path.getsize(os.path.join(path, f)) for f in os.listdir(path)
        ) / 1024 / 1024

    imgs = sum(1 for r in kept if r["kind"] == "image")
    print(
        f"\n{len(kept)} item(s) published — {imgs} image(s), {len(kept) - imgs} video(s); "
        f"{len(dropped)} dropped{'' if args.prune else ' (run with --prune to delete their files)'}."
    )
    print(f"Re-encoded {encoded}; reused {len(kept) - encoded} existing derivative set(s).")
    print(
        f"thumb {dir_mb(f'{OUT}/thumb'):.1f} MB · full {dir_mb(f'{OUT}/full'):.1f} MB · "
        f"video {dir_mb(f'{OUT}/video'):.1f} MB"
    )
    print(f"Wrote {os.path.relpath(MANIFEST, WEB)}")
    if shutil.which("ffmpeg") is None:
        print("\nNote: ffmpeg was not found — videos could not be encoded.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
