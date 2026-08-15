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

echo "==> Syncing $SRC_DIR -> $SERVER:$REMOTE_DIR ..."
# NOTE: .env.local is intentionally excluded — the server keeps its own .env.local
# with NEXT_PUBLIC_* vars baked in at build time. Never let a local file overwrite it.
#
# --delete keeps the remote tree an exact mirror of this one. Without it, files
# deleted or moved locally linger on the server and get compiled into the next
# build: a route that was moved away kept importing a symbol its lib no longer
# exported, which broke `npm run build` until the orphan was removed by hand.
# Excluded paths (node_modules, .next, .env.local, ...) are never deleted.
rsync -avz --delete \
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
