#!/bin/bash
# Deploy the LuminaLog web app (this web/ dir) to production.
# Usage: ./deploy.sh   (run from luminalog-oss/web)
set -e

# Host + SSH key come from the environment so no infrastructure details are
# committed to this public repo. Set both before running, e.g.:
#   export LUMINALOG_DEPLOY_SERVER=root@your-droplet-host
#   export LUMINALOG_DEPLOY_SSH_KEY=~/.ssh/your_key
SERVER="${LUMINALOG_DEPLOY_SERVER:?set LUMINALOG_DEPLOY_SERVER, e.g. root@your-droplet-host}"
SSH_KEY="${LUMINALOG_DEPLOY_SSH_KEY:?set LUMINALOG_DEPLOY_SSH_KEY, e.g. ~/.ssh/your_key}"
REMOTE_DIR="/root/luminalog/luminalog-web"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

# Refresh the past-events archive before the rsync, so a finished event reaches
# the site on the next deploy rather than waiting for someone to notice.
#
# This runs LOCALLY on purpose: the rsync below uses --delete, so a cover image
# written on the server but absent from this tree would be destroyed on the next
# deploy. Credentials come from the API server's .env, which is not in this repo.
#
# Fail-soft: Luma being down, slow, or having changed shape must never block a
# deploy. The archive already lives in Firestore, so a skipped sync just means
# the newest events wait for the next one.
echo "==> Refreshing the past-events archive from Luma ..."
if [ -f "$SRC_DIR/../server/.env" ]; then
  ( cd "$SRC_DIR" && npm run events:sync ) || \
    echo " WARNING: events sync failed, deploying with the existing archive"
else
  echo " skipped (../server/.env not found, so no Firestore credentials)"
fi

# ── Assets production needs that git deliberately does not carry ────────────
#
# Two files under public/demo-day/ are gitignored because they are large
# binaries git cannot delta-compress: the 34 MB launch film and the 42 MB
# PowerPoint export. Production can only get them by riding along in the rsync
# below, which makes this script the one place responsible for their existing
# on disk at all. A fresh clone has neither.
#
# That responsibility cuts both ways, because the rsync runs --delete. A deploy
# from a clone would not merely fail to ship these two, it would DELETE the good
# copies already on the server. So there are two mechanisms, and both matter:
#
#   1. this block, which regenerates whatever is missing, and
#   2. the `protect` filter rules on the rsync, which stop --delete removing a
#      remote copy we could not reproduce locally.
#
# Both are fail-soft, in the same spirit as the events sync above: a machine
# without ffmpeg, or without the pptx toolchain, must still be able to push a
# code change to production. The site degrades gracefully without either file —
# slide 7 falls back to its poster, and the deck's download button reads
# "PPTX not built" — so neither is worth blocking a deploy over.
VAULT="${ARGO_VAULT_DIR:-$HOME/Documents/secondbrain}"
FILM_MASTER="$VAULT/Areas/argo/protocol-camp/final-demo-day/launch-ad/launch-ad-1.mov"
FILM="$SRC_DIR/public/demo-day/launch-film.mp4"
PPTX="$SRC_DIR/public/demo-day/argo-final-demo-day.pptx"

echo "==> Checking the untracked demo day assets ..."

# The film goes first because the PowerPoint build embeds it. Build the pptx
# while the film is missing and it silently drops to the YouTube-embed rung and
# ships 7 MB instead of 42 — a deck that needs venue wifi to play its own advert.
# The order of these two blocks is load-bearing.
if [ -f "$FILM" ]; then
  echo " launch-film.mp4 present ($(du -h "$FILM" | cut -f1))"
elif [ -f "$FILM_MASTER" ] && command -v ffmpeg >/dev/null 2>&1; then
  # Encode settings are the ones in scripts/demo-day-pptx/README.md. The master
  # is 4K HEVC in a .mov, which PowerPoint on Windows will not play, so H.264 is
  # as much the point of this pass as the size is.
  echo " launch-film.mp4 missing — encoding from the vault master ..."
  if ffmpeg -y -loglevel error -i "$FILM_MASTER" -vf scale=1920:1080 \
       -c:v libx264 -crf 21 -preset medium -profile:v high -pix_fmt yuv420p \
       -c:a aac -b:a 192k -movflags +faststart "$FILM"; then
    echo " encoded ($(du -h "$FILM" | cut -f1))"
  else
    echo " WARNING: encode failed — the server keeps its existing copy"
  fi
else
  echo " WARNING: launch-film.mp4 missing, and no vault master to encode from."
  echo "          Set ARGO_VAULT_DIR if your vault is not at $VAULT."
  echo "          The server keeps its existing copy; see scripts/demo-day-pptx/README.md."
fi

# Rebuild the pptx when it is absent, or when something it is built from has
# changed since. Not on every deploy: it drives a headless browser over sixteen
# slides, and it needs html2pptx from the Claude pptx skill, which is not on
# every machine. NODE_PATH is a fallback for the globally-installed pptxgenjs,
# sharp and playwright — node still prefers a local node_modules if there is one.
PPTX_STALE=0
if [ ! -f "$PPTX" ]; then
  PPTX_STALE=1
else
  for src in "$SRC_DIR/scripts/demo-day-pptx/build.js" \
             "$SRC_DIR/scripts/demo-day-pptx/flywheel.svg" \
             "$FILM"; do
    if [ -f "$src" ] && [ "$src" -nt "$PPTX" ]; then PPTX_STALE=1; fi
  done
fi

if [ "$PPTX_STALE" = "1" ]; then
  echo " argo-final-demo-day.pptx missing or out of date — building ..."
  if ( cd "$SRC_DIR" && NODE_PATH="${NODE_PATH:-$(npm root -g 2>/dev/null)}" \
         node scripts/demo-day-pptx/build.js ); then
    echo " built ($(du -h "$PPTX" | cut -f1))"
  else
    echo " WARNING: pptx build failed — the server keeps its existing copy."
    echo "          With none at all the deck's download button reads 'PPTX not built'."
  fi
else
  echo " argo-final-demo-day.pptx present and current ($(du -h "$PPTX" | cut -f1))"
fi

echo "==> Syncing $SRC_DIR -> $SERVER:$REMOTE_DIR ..."
# NOTE: .env.local is intentionally excluded — the server keeps its own .env.local
# with NEXT_PUBLIC_* vars baked in at build time. Never let a local file overwrite it.
#
# --delete keeps the remote tree an exact mirror of this one. Without it, files
# deleted or moved locally linger on the server and get compiled into the next
# build: a route that was moved away kept importing a symbol its lib no longer
# exported, which broke `npm run build` until the orphan was removed by hand.
# Excluded paths (node_modules, .next, .env.local, ...) are never deleted.
#
# The two `protect` rules are the safety net under the asset block above. They
# stop --delete removing those files from the server when they are absent here,
# which is the difference between a deploy from a fresh clone being a no-op for
# the demo day assets and it wiping 76 MB of video off production. Protect does
# not block transfer: when the file IS present locally it still ships normally.
rsync -avz --delete \
  --filter='protect public/demo-day/launch-film.mp4' \
  --filter='protect public/demo-day/argo-final-demo-day.pptx' \
  --exclude node_modules \
  --exclude .next \
  --exclude out \
  --exclude .git \
  --exclude '.env.local' \
  "$SRC_DIR/" \
  -e "ssh -i $SSH_KEY" \
  "$SERVER:$REMOTE_DIR/"

echo "==> Installing deps and building on server..."
ssh -i "$SSH_KEY" "$SERVER" "
  set -e
  cd $REMOTE_DIR
  npm install --production=false
  npm run build
"

echo "==> Restarting PM2..."
ssh -i "$SSH_KEY" "$SERVER" "
  set -e
  cd $REMOTE_DIR
  if pm2 list | grep -q luminalog-web; then
    pm2 restart luminalog-web --update-env
  else
    pm2 start ecosystem.config.js
  fi
  pm2 save
"

echo "==> Waiting for restart..."
sleep 3

echo "==> Health check..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://luminalog.com)
if [ "$STATUS" = "200" ]; then
  echo " — OK (HTTP $STATUS)"
else
  echo " — unexpected status $STATUS — check nginx/PM2 logs"
fi

echo "==> Deploy complete."
