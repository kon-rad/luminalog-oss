# Production ChromaDB — durable storage, security, and backups

This directory holds everything needed to run ChromaDB durably on the
luminalog-api droplet and to back it up to your local machine.

- `docker-compose.yml` — Chroma with a persistent host bind-mount, localhost-only
  port, and a restart policy. **Run on the droplet.**
- `backup-chroma.sh` — snapshot + download the prod data to your machine. **Run locally.**
- `restore-chroma.sh` — push a backup back onto the droplet (destructive). **Run locally.**

## Context

- The API (PM2 `luminalog-api`) and Chroma run on the **same droplet** (`165.22.103.109`).
  The API talks to Chroma via `CHROMA_URL=http://localhost:8000`.
- Data lives at the host path **`/srv/luminalog/chroma-data`**, bind-mounted into the
  container at `/chroma/chroma`. Because it's on the host (not the container's
  writable layer), it survives `docker restart`, `docker compose down/up`, and
  image upgrades.
- The collections used: `journals` (chat-RAG content chunks) and
  `journal_summaries` (one summary vector per entry, powering the Related tab).

## Security notes

- **Not internet-exposed.** The compose file binds the port to `127.0.0.1:8000`
  only. Chroma 0.5.x has no authentication by default, so it must never listen on
  a public interface. Verify with `ss -tlnp | grep 8000` → it should show
  `127.0.0.1:8000`, not `0.0.0.0:8000`. Also confirm the droplet firewall
  (e.g. `ufw`) does not allow inbound 8000.
- **Restricted data dir.** `chmod 700 /srv/luminalog/chroma-data` (root-only).
- **Content is already encrypted at rest.** The documents stored in Chroma are
  field-encrypted ciphertext (AES-256-GCM via the app's DEK), and titles in
  metadata are encrypted too — only the embedding vectors and non-sensitive
  metadata (ids, type, date) are plaintext. A copy of the data dir cannot reveal
  journal text without the per-user keys.
- **Optional hardening:** Chroma supports static-token auth
  (`CHROMA_SERVER_AUTHN_CREDENTIALS` / `CHROMA_SERVER_AUTHN_PROVIDER`). Given the
  localhost-only binding this is optional; add it if you ever expose the port.

---

## 1. First-time provisioning (fresh, no existing Chroma)

On the droplet:

```bash
mkdir -p /srv/luminalog/chroma-data && chmod 700 /srv/luminalog/chroma-data
mkdir -p /srv/luminalog/deploy/chroma
# copy docker-compose.yml here (rsync from repo, or paste it)
cd /srv/luminalog/deploy/chroma
docker compose up -d
curl -s localhost:8000/api/v1/heartbeat   # -> {"nanosecond heartbeat": ...}
```

Then point the API at it (already the default): `CHROMA_URL=http://localhost:8000`.

---

## 2. Migrating an EXISTING ad-hoc container without data loss

The live Chroma was started ad-hoc, so its data may currently sit in the
container's writable layer (lost on recreate) **or** in some mount. Do this
carefully — **copy the data out before removing the old container.**

```bash
# a) Identify the running container and inspect its mounts.
docker ps --format '{{.Names}}\t{{.Image}}\t{{.Ports}}'
OLD=chromadb              # <-- set to the actual container name from the line above
docker inspect "$OLD" --format '{{json .Mounts}}' | python3 -m json.tool

# b) Prepare the durable bind-mount dir.
mkdir -p /srv/luminalog/chroma-data && chmod 700 /srv/luminalog/chroma-data

# c) Snapshot the CURRENT data out of the old container into the bind dir.
#    /chroma/chroma is the default persist path for chromadb/chroma images.
docker cp "$OLD:/chroma/chroma/." /srv/luminalog/chroma-data/
ls -la /srv/luminalog/chroma-data        # sanity-check: chroma.sqlite3 + index dirs present

# d) Record the pre-migration collection counts so you can verify after cutover.
curl -s localhost:8000/api/v1/collections | python3 -m json.tool   # note the counts

# e) Stop & remove the old container (data is now safely in the bind dir).
docker stop "$OLD" && docker rm "$OLD"

# f) Bring up the managed, durable container.
cd /srv/luminalog/deploy/chroma
docker compose up -d

# g) Verify: heartbeat + the data survived.
curl -s localhost:8000/api/v1/heartbeat
```

Verify the collections look right (counts match step d). A quick check from the
API server dir:

```bash
cd /root/luminalog/luminalog-api
node -e "const {ChromaClient}=require('chromadb');(async()=>{const c=new ChromaClient({path:'http://localhost:8000'});const col=await c.getOrCreateCollection({name:'journal_summaries'});console.log('journal_summaries count:',await col.count());})()"
```

If the old container had **no** persistent data (embeddings were never working —
e.g. the old `m2-bert` embedding model error), the bind dir will just start
empty and fill as entries are (re)indexed; then run the backfill (below).

### After migration: make sure embeddings actually work

Production must use a **serverless-accessible** embedding model. Set in the API
`.env` (`/root/luminalog/luminalog-api/.env`):

```
TOGETHER_EMBEDDING_MODEL=intfloat/multilingual-e5-large-instruct
```

then `pm2 restart luminalog-api`. To populate summary vectors for existing
entries, run from the API dir:

```bash
cd /root/luminalog/luminalog-api
npx tsx scripts/backfill-summaries.ts            # or --force to rebuild all
```

> Note: changing the embedding model changes vector dimensions
> (e5-large = 1024). If the `journals`/`journal_summaries` collections already
> hold vectors from a different model, delete those collections first (or
> `--force` re-index), since a Chroma collection is locked to one dimension.

---

## 3. Backups (download prod data to your local machine)

From your **local** checkout (`deploy/chroma/`):

```bash
# one-off
./backup-chroma.sh

# custom key / host
CHROMA_SSH_KEY=~/.ssh/luminalog CHROMA_SSH_HOST=165.22.103.109 ./backup-chroma.sh

# zero-downtime snapshot (slightly less consistent)
./backup-chroma.sh --live
```

Backups land in `./chroma-backups/chroma-<timestamp>.tgz`, are integrity-checked,
and pruned to the newest `BACKUP_RETENTION` (default 14). The script briefly
stops the container during the snapshot for a consistent copy unless `--live`.

`chroma-backups/` is gitignored — backups are never committed.

### Schedule it (local cron example — daily at 02:30)

```cron
30 2 * * * cd /Users/konradgnat/dev/startups/luminalog/luminalog-oss/deploy/chroma && CHROMA_SSH_KEY=$HOME/.ssh/id_ed25519 ./backup-chroma.sh >> $HOME/chroma-backup.log 2>&1
```

(For server-side scheduling instead, the same `tar` step can run from a droplet
cron and push to object storage; the local pull above is the simplest "download
to our computer" path you asked for.)

---

## 4. Restore (push a backup back to prod) — destructive

```bash
./restore-chroma.sh ./chroma-backups/chroma-20260617-140000.tgz --yes
```

It uploads the archive, stops the container, moves the current data dir aside to
`/srv/luminalog/chroma-data.pre-restore-<ts>` (rollback), extracts the backup,
restarts, and waits for the heartbeat. Delete the `.pre-restore-*` copy once
you've confirmed the restore is good.
