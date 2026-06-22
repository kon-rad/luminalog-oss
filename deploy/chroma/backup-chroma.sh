#!/usr/bin/env bash
#
# Back up the production ChromaDB data directory to this local machine.
#
# Runs FROM YOUR LOCAL COMPUTER. It SSHes to the droplet, snapshots the Chroma
# bind-mount into a tarball, downloads it here with a timestamped name, removes
# the remote temp file, and prunes old local backups.
#
# Config via env vars (defaults are placeholders — set the host via env):
#   CHROMA_SSH_HOST       droplet host/IP            (REQUIRED, e.g. root@your-host)
#   CHROMA_SSH_USER       ssh user                   (default root)
#   CHROMA_SSH_KEY        ssh private key path       (default ~/.ssh/id_ed25519)
#   CHROMA_REMOTE_DIR     remote data dir            (default /srv/luminalog/chroma-data)
#   CHROMA_CONTAINER      container name             (default chroma)
#   LOCAL_BACKUP_DIR      where to store backups     (default ./chroma-backups)
#   BACKUP_RETENTION      how many backups to keep   (default 14)
#
# Flags:
#   --live    Do NOT stop the container during the snapshot (zero downtime, but
#             the archive may catch an in-progress write). Default is a brief
#             stop/start for a consistent snapshot (Chroma uses SQLite + hnsw
#             files; a quick stop guarantees a clean copy).
#
# Examples:
#   ./backup-chroma.sh
#   CHROMA_SSH_KEY=~/.ssh/your_key ./backup-chroma.sh
#   ./backup-chroma.sh --live

set -euo pipefail

CHROMA_SSH_HOST="${CHROMA_SSH_HOST:?set CHROMA_SSH_HOST to your droplet host/IP}"
CHROMA_SSH_USER="${CHROMA_SSH_USER:-root}"
CHROMA_SSH_KEY="${CHROMA_SSH_KEY:-$HOME/.ssh/id_ed25519}"
CHROMA_REMOTE_DIR="${CHROMA_REMOTE_DIR:-/srv/luminalog/chroma-data}"
CHROMA_CONTAINER="${CHROMA_CONTAINER:-chroma}"
LOCAL_BACKUP_DIR="${LOCAL_BACKUP_DIR:-./chroma-backups}"
BACKUP_RETENTION="${BACKUP_RETENTION:-14}"

STOP_CONTAINER=1
[ "${1:-}" = "--live" ] && STOP_CONTAINER=0

TS="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="chroma-${TS}.tgz"
REMOTE_TMP="/tmp/${ARCHIVE}"
SSH=(ssh -i "$CHROMA_SSH_KEY" -o BatchMode=yes "${CHROMA_SSH_USER}@${CHROMA_SSH_HOST}")

echo "==> Backing up Chroma from ${CHROMA_SSH_USER}@${CHROMA_SSH_HOST}:${CHROMA_REMOTE_DIR}"
mkdir -p "$LOCAL_BACKUP_DIR"

# Build the remote snapshot command. We tar the CONTENTS of the data dir so the
# archive restores cleanly into any target dir. A brief stop guarantees a
# consistent SQLite/hnsw snapshot unless --live was passed.
REMOTE_CMD="set -e
if [ ! -d '${CHROMA_REMOTE_DIR}' ]; then echo 'remote data dir missing: ${CHROMA_REMOTE_DIR}' >&2; exit 1; fi"
if [ "$STOP_CONTAINER" -eq 1 ]; then
  REMOTE_CMD="${REMOTE_CMD}
echo '    pausing container ${CHROMA_CONTAINER} for a consistent snapshot...'
docker stop '${CHROMA_CONTAINER}' >/dev/null 2>&1 || echo '    (container not running; snapshotting files as-is)'"
fi
REMOTE_CMD="${REMOTE_CMD}
tar czf '${REMOTE_TMP}' -C '${CHROMA_REMOTE_DIR}' ."
if [ "$STOP_CONTAINER" -eq 1 ]; then
  REMOTE_CMD="${REMOTE_CMD}
docker start '${CHROMA_CONTAINER}' >/dev/null 2>&1 || true"
fi
REMOTE_CMD="${REMOTE_CMD}
echo \"    remote archive: \$(du -h '${REMOTE_TMP}' | cut -f1)\""

echo "==> Creating remote snapshot${STOP_CONTAINER:+ (brief container pause)}..."
"${SSH[@]}" "$REMOTE_CMD"

echo "==> Downloading to ${LOCAL_BACKUP_DIR}/${ARCHIVE}"
scp -i "$CHROMA_SSH_KEY" "${CHROMA_SSH_USER}@${CHROMA_SSH_HOST}:${REMOTE_TMP}" "${LOCAL_BACKUP_DIR}/${ARCHIVE}"

echo "==> Removing remote temp file"
"${SSH[@]}" "rm -f '${REMOTE_TMP}'"

echo "==> Verifying archive integrity"
if ! gzip -t "${LOCAL_BACKUP_DIR}/${ARCHIVE}"; then
  echo "ERROR: downloaded archive failed gzip integrity check" >&2
  exit 1
fi
ENTRIES="$(tar tzf "${LOCAL_BACKUP_DIR}/${ARCHIVE}" | wc -l | tr -d ' ')"
SIZE="$(du -h "${LOCAL_BACKUP_DIR}/${ARCHIVE}" | cut -f1)"
echo "    OK — ${ENTRIES} entries, ${SIZE}"

echo "==> Pruning old backups (keeping newest ${BACKUP_RETENTION})"
# List newest-first, skip the first N, delete the rest.
ls -1t "${LOCAL_BACKUP_DIR}"/chroma-*.tgz 2>/dev/null | tail -n +"$((BACKUP_RETENTION + 1))" | while read -r old; do
  echo "    removing $(basename "$old")"
  rm -f "$old"
done

echo "==> Done. Latest backup: ${LOCAL_BACKUP_DIR}/${ARCHIVE}"
