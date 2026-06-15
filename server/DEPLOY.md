# Deploy luminalog-api to production

Server: <server-host> · SSH key: ~/.ssh/<ssh-key> (or <ssh-key>)

## Step 1: Rsync files

```bash
cd <home>/dev/startups/luminalog
rsync -avz --exclude node_modules --exclude dist --exclude .git \
  luminalog-api/ \
  -e "ssh -i ~/.ssh/<ssh-key>" \
  root@<server-host>:/root/luminalog/luminalog-api/
```

## Step 2: Build on server

```bash
ssh -i ~/.ssh/<ssh-key> root@<server-host> "
  cd /root/luminalog/luminalog-api
  npm install --production=false
  npm run build
"
```

## Step 3: Create .env on server

SSH in and run:
```bash
cat > /root/luminalog/luminalog-api/.env << 'EOF'
PORT=3200
NODE_ENV=production
FIREBASE_SERVICE_ACCOUNT_JSON=<paste stringified JSON — no newlines>
CHROMA_URL=http://localhost:8000
TOGETHER_AI_API_KEY=<key>
TOGETHER_EMBEDDING_MODEL=togethercomputer/m2-bert-80M-8k-retrieval
AWS_ACCESS_KEY_ID=<key>
AWS_SECRET_ACCESS_KEY=<secret>
AWS_S3_BUCKET=<bucket>
AWS_REGION=us-east-1
VAPI_PUBLIC_KEY=<key>
VAPI_ASSISTANT_ID=<id — or leave empty if using assistantOverrides only>
VAPI_WEBHOOK_SECRET=$(openssl rand -hex 32)
EOF
chmod 600 /root/luminalog/luminalog-api/.env
```

## Step 4: Start via PM2

```bash
ssh -i ~/.ssh/<ssh-key> root@<server-host> "
  cd /root/luminalog/luminalog-api
  set -a; source .env; set +a
  pm2 start ecosystem.config.js
  pm2 save
  pm2 list
"
```

## Step 5: Add nginx /v1/ block

Edit `/etc/nginx/sites-available/luminalog.com` — add above the existing `location /` block:

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
curl -s https://luminalog.com/health
# → {"status":"ok","chroma":"connected"}

curl -s -X POST https://luminalog.com/v1/rag/index \
  -H "Content-Type: application/json" \
  -d '{}' | jq .
# → {"error":"Missing authorization header"}  (401 — auth working)
```

## Step 7: iOS — run xcodegen

```bash
cd <home>/dev/startups/luminalog/ios-luminalog
xcodegen generate
```

This resolves the Vapi SPM package. If the Vapi SDK API differs from what's in
VapiVoiceCallService.swift, adjust the callback names to match the real SDK.
