#!/bin/bash
# Deploy the LuminaLog API (this server/ dir) to production.
# Usage: ./deploy.sh   (run from luminalog-oss/server)
set -e

SERVER="root@<server-host>"
SSH_KEY="$HOME/.ssh/<ssh-key>"
REMOTE_DIR="/root/luminalog/luminalog-api"
SRC_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> Syncing $SRC_DIR -> $SERVER:$REMOTE_DIR ..."
# NOTE: .env is intentionally excluded — the server keeps its own .env
# (with secrets + MASTER_KEY). Never let a local .env overwrite it.
rsync -avz --exclude node_modules --exclude dist --exclude .git --exclude '.env' \
  "$SRC_DIR/" \
  -e "ssh -i $SSH_KEY" \
  "$SERVER:$REMOTE_DIR/"

echo "==> Installing deps and building on server..."
ssh -i "$SSH_KEY" "$SERVER" "
  cd $REMOTE_DIR
  npm install --production=false
  npm run build
"

echo "==> Restarting PM2 (--update-env picks up MASTER_KEY)..."
ssh -i "$SSH_KEY" "$SERVER" "
  cd $REMOTE_DIR
  pm2 restart luminalog-api --update-env
  pm2 save
"

echo "==> Waiting for restart..."
sleep 3

echo "==> Health check..."
curl -sf https://api.luminalog.com/health && echo " — OK" || \
  curl -sf https://luminalog.com/health && echo " — OK (via luminalog.com)"

echo "==> Deploy complete."
