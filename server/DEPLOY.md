# Deploy luminalog-api to production

This is a generic deployment recipe. Replace the placeholders with your own values:

- `<server-host>` — your server's hostname or IP
- `<ssh-key>` — path to your SSH private key (e.g. `~/.ssh/id_ed25519`)
- `<deploy-user>` — the SSH user you deploy as
- `<app-dir>` — the directory on the server, e.g. `/srv/luminalog/luminalog-api`

## Step 1: Rsync files

```bash
rsync -avz --exclude node_modules --exclude dist --exclude .git \
  server/ \
  -e "ssh -i <ssh-key>" \
  <deploy-user>@<server-host>:<app-dir>/
```

## Step 2: Build on server

```bash
ssh -i <ssh-key> <deploy-user>@<server-host> "
  cd <app-dir>
  npm install --production=false
  npm run build
"
```

## Step 3: Create .env on server

SSH in and create the env file (see `.env.example` for the full list):
```bash
cat > <app-dir>/.env << 'EOF'
PORT=3200
NODE_ENV=production
FIREBASE_SERVICE_ACCOUNT_JSON=<paste stringified JSON — no newlines>
CHROMA_URL=http://localhost:8000
TOGETHER_AI_API_KEY=<key>
# Use a serverless-accessible embedding model. m2-bert is NOT serverless (needs a
# dedicated endpoint); e5-large-instruct is serverless and is what aiClient.ts targets.
TOGETHER_EMBEDDING_MODEL=intfloat/multilingual-e5-large-instruct
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_S3_BUCKET=<bucket>
AWS_REGION=us-east-1
VAPI_PUBLIC_KEY=<key>
VAPI_ASSISTANT_ID=<id — or leave empty if using assistantOverrides only>
VAPI_WEBHOOK_SECRET=$(openssl rand -hex 32)
MASTER_KEY=<base64 of exactly 32 random bytes — e.g. openssl rand -base64 32>
EOF
chmod 600 <app-dir>/.env
```

## Step 4: Start via PM2

```bash
ssh -i <ssh-key> <deploy-user>@<server-host> "
  cd <app-dir>
  set -a; source .env; set +a
  pm2 start ecosystem.config.js
  pm2 save
  pm2 list
"
```

## Step 5: Add nginx /v1/ block

Edit your site config (e.g. `/etc/nginx/sites-available/<your-domain>`) — add above the
existing `location /` block:

```nginx
location /v1/ {
    proxy_pass http://127.0.0.1:3200;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_cache_bypass $http_upgrade;
    proxy_buffering off;
    proxy_read_timeout 300s;
    proxy_send_timeout 300s;
}

location /health {
    proxy_pass http://127.0.0.1:3200;
}
```

Then: `nginx -t && systemctl reload nginx`

## Step 6: Smoke test

```bash
curl -s https://<your-domain>/health
# → {"status":"ok","chroma":"connected"}

curl -s -X POST https://<your-domain>/v1/rag/index \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
# → {"error":"Missing authorization header"}  (401 — auth working)
```

## Step 7: iOS — run xcodegen

```bash
cd ios
xcodegen generate
```

This resolves the Vapi SPM package. If the Vapi SDK API differs from what's in
`VapiVoiceCallService.swift`, adjust the callback names to match the real SDK.

## ChromaDB (vector store)

The API needs ChromaDB on the same host (`CHROMA_URL=http://localhost:8000`).
Run it durably (persistent bind-mount, localhost-only, restart policy) and back it
up using the tooling and runbook in **`deploy/chroma/`** — see
`deploy/chroma/README.md` for first-time setup, safe migration of an existing
container, security notes, and the backup/restore scripts.
