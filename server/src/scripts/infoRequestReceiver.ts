#!/usr/bin/env node
/**
 * Reference receiver demo server: listens for webhook replies from Argo.
 *
 * Usage:
 *   npx tsx scripts/infoRequestReceiver.ts [--port 3201] [--key 0x...]
 *
 * The signing key can also be set via INFO_RESPONSE_SIGNER_PRIVATE_KEY env var.
 *
 * Endpoints:
 *   POST /replies    --- receives webhook replies (logs X-Argo-Signer, X-Argo-Signature, body)
 *   GET  /signer     --- returns { address } for this server's signing key
 *   GET  /health     --- returns { ok: true }
 *   GET  /           --- landing page
 */

import { privateKeyToAccount } from 'viem/accounts'

function parseArgs(): Record<string, string> {
  const args = process.argv.slice(2)
  const map: Record<string, string> = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      map[args[i].slice(2)] = args[++i] ?? ''
    }
  }
  return map
}

const args = parseArgs()
const PORT = parseInt(args.port ?? process.env.PORT ?? '3201', 10)
const KEY = args.key ?? process.env.INFO_RESPONSE_SIGNER_PRIVATE_KEY

let signerAddress: string | null = null
if (KEY && /^0x[0-9a-fA-F]{64}$/.test(KEY)) {
  signerAddress = privateKeyToAccount(KEY as `0x${string}`).address
}

// Dynamic import to avoid a hard startup crash when express is not installed.
async function main() {
  const express = (await import('express')).default
  const app = express()
  app.use(express.json())

  // POST /replies --- receive webhook reply
  app.post('/replies', (req: any, res: any) => {
    const signer = req.headers['x-argo-signer'] ?? '(missing)'
    const signature = req.headers['x-argo-signature'] ?? '(missing)'
    console.log('--- Incoming reply ---')
    console.log('X-Argo-Signer:', signer)
    console.log('X-Argo-Signature:', signature)
    console.log('Body:', JSON.stringify(req.body, null, 2))
    res.status(204).end()
  })

  // GET /signer --- attestation address
  app.get('/signer', (_req: any, res: any) => {
    if (!signerAddress) {
      res.status(503).json({ error: 'signer_unconfigured' })
      return
    }
    res.json({ address: signerAddress })
  })

  // GET /health
  app.get('/health', (_req: any, res: any) => {
    res.json({ ok: true })
  })

  // GET / --- landing page
  app.get('/', (_req: any, res: any) => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Argo Info Request Receiver</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 600px; margin: 40px auto; padding: 0 20px; line-height: 1.6; }
    h1 { color: #333; }
    code { background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }
    ul { padding-left: 20px; }
    li { margin: 8px 0; }
    .addr { font-family: monospace; font-size: 0.9em; color: #666; }
  </style>
</head>
<body>
  <h1>Argo Info Request Receiver</h1>
  <p>This is a reference webhook receiver for the Argo Agent Information Requests protocol.</p>
  <p class="addr">Signing address: <code>${signerAddress ?? '(unconfigured)'}</code></p>
  <h2>Endpoints</h2>
  <ul>
    <li><code>POST /replies</code> --- receive webhook replies</li>
    <li><code>GET /signer</code> --- signing address for verifying response signatures</li>
    <li><code>GET /health</code> --- health check</li>
    <li><code>GET /</code> --- this page</li>
  </ul>
  <h2>Usage</h2>
  <p>When creating an info request, point <code>--webhook</code> to <code>https://your-host/replies</code>.</p>
  <p>Verify response signatures against the address returned by <code>GET /signer</code>.</p>
</body>
</html>`
    res.type('html').send(html)
  })

  app.listen(PORT, () => {
    console.log(`Info request receiver listening on http://localhost:${PORT}`)
    console.log(`  POST /replies  --- receive webhook replies`)
    console.log(`  GET  /signer   --- ${signerAddress ?? '(unconfigured)'}`)
    console.log(`  GET  /health   --- ok`)
    if (!signerAddress) {
      console.warn('  WARNING: no signing key configured. GET /signer will return 503.')
      console.warn('  Set INFO_RESPONSE_SIGNER_PRIVATE_KEY env var or pass --key.')
    }
  })
}

main().catch(err => {
  console.error('Failed to start:', err instanceof Error ? err.message : String(err))
  process.exit(1)
})