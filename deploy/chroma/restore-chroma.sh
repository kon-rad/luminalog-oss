#!/usr/bin/env bash
#
# Restore a ChromaDB backup (created by backup-chroma.sh) onto the droplet.
#
# Runs FROM YOUR LOCAL COMPUTER. It uploads the chosen archive, stops the
# container, REPLACES the remote data directory with the archive contents, and
# restarts the container.
#
# *** DESTRUCTIVE *** — this overwrites the production Chroma data. You must pass
# --yes to proceed.
#
# Config via env vars (same defaults as backup-chroma.sh):
#   CHROMA_SSH_HOST  CHROMA_SSH_USER  CHROMA_SSH_KEY
#   CHROMA_REMOTE_DIR  CHROMA_CONTAINER
#
# Usage:
#   ./restore-chroma.sh ./chroma-backups/chroma-20260617-140000.tgz --yes

set -euo pipefail

ARCHIVE="${1:-}"
CONFIRM="${2:-}"

if [ -z "$ARCHIVE" ] || [ ! -f "$ARCHIVE" ]; then
  echo "Usage: $0 <local-archive.tgz> --yes" >&2
  exit 1
fi
if [ "$CONFIRM" != "--yes" ]; then
  echo "Refusing to restore without --yes (this OVERWRITES production Chroma data)." >&2
  echo "Run: $0 \"$ARCHIVE\" --yes" >&2
  exit 1
fi
if ! gzip -t "$ARCHIVE"; then
  echo "ERROR: $ARCHIVE is not a valid gzip archive" >&2
  exit 1
fi

CHROMA_SSH_HOST="${CHROMA_SSH_HOST:-165.22.103.109}"
CHROMA_SSH_USER="${CHROMA_SSH_USER:-root}"
CHROMA_SSH_KEY="${CHROMA_SSH_KEY:-$HOME/.ssh/id_ed25519}"
CHROMA_REMOTE_DIR="${CHROMA_REMOTE_DIR:-/srv/luminalog/chroma-data}"
CHROMA_CONTAINER="${CHROMA_CONTAINER:-chroma}"

SSH=(ssh -i "$CHROMA_SSH_KEY" -o BatchMode=yes "${CHROMA_SSH_USER}@${CHROMA_SSH_HOST}")
TS="$(date +%Y%m%d-%H%M%S)"
REMOTE_TMP="/tmp/chroma-restore-${TS}.tgz"

echo "==> Uploading ${ARCHIVE} to ${CHROMA_SSH_HOST}:${REMOTE_TMP}"
scp -i "$CHROMA_SSH_KEY" "$ARCHIVE" "${CHROMA_SSH_USER}@${CHROMA_SSH_HOST}:${REMOTE_TMP}"

echo "==> Restoring on the droplet (the current data dir is moved aside, not deleted)"
"${SSH[@]}" "set -e
docker stop '${CHROMA_CONTAINER}' >/dev/null 2>&1 || true
if [ -d '${CHROMA_REMOTE_DIR}' ]; then
  mv '${CHROMA_REMOTE_DIR}' '${CHROMA_REMOTE_DIR}.pre-restore-${TS}'
fi
mkdir -p '${CHROMA_REMOTE_DIR}'
chmod 700 '${CHROMA_REMOTE_DIR}'
tar xzf '${REMOTE_TMP}' -C '${CHROMA_REMOTE_DIR}'
rm -f '${REMOTE_TMP}'
docker start '${CHROMA_CONTAINER}' >/dev/null 2>&1 || echo '    container not found — run: docker compose up -d'
echo '    previous data preserved at ${CHROMA_REMOTE_DIR}.pre-restore-${TS}'"

echo "==> Waiting for heartbeat..."
sleep 6
if "${SSH[@]}" "curl -sf -m 8 http://localhost:8000/api/v1/heartbeat >/dev/null"; then
  echo "==> Restore complete — Chroma is responding."
  echo "    Once verified, you can delete the rollback copy: ${CHROMA_REMOTE_DIR}.pre-restore-${TS}"
else
  echo "WARNING: Chroma did not respond to heartbeat. Check 'docker logs ${CHROMA_CONTAINER}'." >&2
  echo "         Rollback: stop container, restore ${CHROMA_REMOTE_DIR}.pre-restore-${TS}, start again." >&2
  exit 1
fi
