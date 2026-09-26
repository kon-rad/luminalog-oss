#!/usr/bin/env node
/**
 * Reference CLI tool: sign an agent information request and optionally POST it.
 *
 * Usage:
 *   npx tsx scripts/signInfoRequest.ts \
 *     --key 0x... \
 *     --to @konrad \
 *     --webhook https://agent.example.com/reply \
 *     --name "Match agent" \
 *     --description "Matches founders." \
 *     --reason "You look like a co-founder fit." \
 *     --q "What are you building?" \
 *     --q "What co-founder do you want?" \
 *     [--ens alice.eth] \
 *     [--send http://localhost:3200]
 *
 * Prints the signed JSON to stdout. If --send is given, POSTs the signed
 * request to {baseUrl}/v1/inbox/requests and prints the response.
 *
 * NOTE: This is a standalone reference tool. It duplicates the signing constants
 * from the protocol module to avoid importing the server config (which requires
 * production env vars). For production signing, use the server's own signing path.
 */

import { privateKeyToAccount } from 'viem/accounts'
import { createHash, randomBytes } from 'crypto'

// Duplicated from services/infoRequests/protocol so this script is self-contained.
const REQUEST_PREFIX = 'Argo information request v1\n'

function canonicalPayload(b: {
  to: string; address: string; ens: string | undefined | null; name: string
  description: string; reason: string; questions: string[]
  webhookUrl: string; issuedAt: string; nonce: string
}): string {
  return JSON.stringify([
    b.to, b.address.toLowerCase(), b.ens ?? '', b.name, b.description,
    b.reason, b.questions, b.webhookUrl, b.issuedAt, b.nonce,
  ])
}

const sha256Hex = (s: string) => createHash('sha256').update(s, 'utf8').digest('hex')
const requestHash = (b: Parameters<typeof canonicalPayload>[0]) => sha256Hex(canonicalPayload(b))

// ---

function parseArgs(): Record<string, string | string[]> {
  const args = process.argv.slice(2)
  const map: Record<string, string | string[]> = {}
  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].slice(2)
      if (key === 'q') {
        const vals = map[key] ?? []
        const arr = Array.isArray(vals) ? vals : [vals]
        arr.push(args[++i])
        map[key] = arr
      } else {
        map[key] = args[++i]
      }
    }
  }
  return map
}

function usageAndExit(msg?: string): never {
  if (msg) console.error(msg)
  console.error(
    'Usage: npx tsx scripts/signInfoRequest.ts --key <pk> --to <recipient> --webhook <url> --name <name> --description <desc> --reason <reason> --q <q1> [--q <q2> ...] [--ens <ens>] [--send <baseUrl>]'
  )
  process.exit(1)
}

async function main() {
  const args = parseArgs()

  const key = (args.key as string | undefined) ?? usageAndExit('--key is required')
  const to = (args.to as string | undefined) ?? usageAndExit('--to is required')
  const webhookUrl = (args.webhook as string | undefined) ?? usageAndExit('--webhook is required')
  const name = (args.name as string | undefined) ?? usageAndExit('--name is required')
  const description = (args.description as string | undefined) ?? usageAndExit('--description is required')
  const reason = (args.reason as string | undefined) ?? usageAndExit('--reason is required')
  const questions = (args.q as string[] | undefined) ?? usageAndExit('--q (at least one) is required')
  const ens = args.ens as string | undefined
  const send = args.send as string | undefined

  if (!/^0x[0-9a-fA-F]{64}$/.test(key)) usageAndExit('--key must be a 64-char hex private key (0x-prefixed)')
  if (questions.length < 1 || questions.length > 10) usageAndExit('Provide 1-10 questions via --q')

  const account = privateKeyToAccount(key as `0x${string}`)

  const nonce = randomBytes(16).toString('hex')
  const issuedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z')

  const hash = requestHash({ to, address: account.address, ens, name, description, reason, questions, webhookUrl, issuedAt, nonce })
  const signature = await account.signMessage({ message: REQUEST_PREFIX + hash })

  const signed = {
    to,
    from: { address: account.address, ens, name, description },
    reason,
    questions,
    webhookUrl,
    issuedAt,
    nonce,
    signature,
  }

  const output = JSON.stringify(signed, null, 2)
  console.log(output)

  if (send) {
    const baseUrl = send.replace(/\/$/, '')
    const url = `${baseUrl}/v1/inbox/requests`
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: output,
      })
      const text = await res.text()
      console.error(`\n--- Server response (${res.status}) ---`)
      console.error(text)
    } catch (err) {
      console.error(`\n--- POST failed ---`)
      console.error(err instanceof Error ? err.message : String(err))
      process.exit(1)
    }
  }
}

main().catch(err => {
  console.error(err instanceof Error ? err.message : String(err))
  process.exit(1)
})