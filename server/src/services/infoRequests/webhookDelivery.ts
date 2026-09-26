import https from 'node:https'
import dns from 'node:dns'
import net from 'node:net'

/**
 * Outbound POST to an agent-supplied URL. The URL is attacker-controlled, so this
 * is the SSRF boundary: https only, no redirects, and every resolved address is
 * checked inside the socket's own `lookup`, which pins the connection to the IP
 * that was checked (no DNS-rebinding window between check and connect).
 */

const blockList = new net.BlockList()
for (const [addr, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.168.0.0', 16], ['198.18.0.0', 15],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) blockList.addSubnet(addr, prefix, 'ipv4')
for (const [addr, prefix] of [
  ['::', 128], ['::1', 128], ['fc00::', 7], ['fe80::', 10], ['ff00::', 8],
] as const) blockList.addSubnet(addr, prefix, 'ipv6')

export function isPrivateAddress(ip: string): boolean {
  const family = net.isIP(ip)
  if (family === 4) return blockList.check(ip, 'ipv4')
  if (family === 6) {
    // IPv6-mapped IPv4 addresses (e.g., ::ffff:127.0.0.1) are not correctly
    // blocked by BlockList due to a Node.js limitation, so check the IPv4 part explicitly.
    const lowerIp = ip.toLowerCase()
    if (lowerIp.startsWith('::ffff:')) {
      const v4Part = lowerIp.slice(7)
      if (net.isIP(v4Part) === 4) return isPrivateAddress(v4Part)
    }
    return blockList.check(ip, 'ipv6')
  }
  return true
}

const stripBrackets = (host: string) => host.replace(/^\[|\]$/g, '')

export function isAcceptableWebhookUrl(raw: string): boolean {
  if (typeof raw !== 'string' || raw.length > 2048) return false
  let url: URL
  try { url = new URL(raw) } catch { return false }
  if (url.protocol !== 'https:' || url.username || url.password) return false
  const host = stripBrackets(url.hostname).toLowerCase()
  if (!host || host === 'localhost' || host.endsWith('.localhost')) return false
  // IP literals never reach `lookup`, so they must be checked here.
  if (net.isIP(host) && isPrivateAddress(host)) return false
  return true
}

const safeLookup = ((hostname: string, options: any, callback: any) => {
  dns.lookup(hostname, { all: true }, (err, addresses) => {
    if (err) return callback(err)
    const list = addresses as dns.LookupAddress[]
    if (list.length === 0 || list.some(a => isPrivateAddress(a.address))) {
      const e = Object.assign(new Error(`blocked address for ${hostname}`), { code: 'EBLOCKED' })
      return callback(e)
    }
    if (options?.all) return callback(null, list)
    callback(null, list[0].address, list[0].family)
  })
}) as unknown as net.LookupFunction

export type PostFn = (
  url: URL, body: string, headers: Record<string, string>, timeoutMs: number,
) => Promise<{ status?: number; error?: string; blocked?: boolean }>

const httpsPost: PostFn = (url, body, headers, timeoutMs) =>
  new Promise(resolve => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'content-length': String(Buffer.byteLength(body)),
        'user-agent': 'Argo-InfoRequests/1',
        ...headers,
      },
      lookup: safeLookup,
      timeout: timeoutMs,
    }, res => {
      let detail = ''
      res.on('data', (chunk: Buffer) => { if (detail.length < 4096) detail += chunk.toString('utf8') })
      res.on('end', () => {
        const status = res.statusCode ?? 0
        resolve({ status, error: status >= 300 ? detail.slice(0, 300) || `HTTP ${status}` : undefined })
      })
      res.on('error', e => resolve({ error: e.message }))
    })
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', (e: NodeJS.ErrnoException) => resolve({ error: e.message, blocked: e.code === 'EBLOCKED' }))
    req.end(body)
  })

export interface DeliveryOptions {
  attempts: number
  backoffMs: number[]
  timeoutMs: number
  sleep: (ms: number) => Promise<void>
  post: PostFn
}

export interface WebhookResult { ok: boolean; status?: number; error?: string; attempts: number }

const DEFAULTS: DeliveryOptions = {
  attempts: 3,
  backoffMs: [0, 1000, 3000],
  timeoutMs: 10_000,
  sleep: ms => new Promise(r => setTimeout(r, ms)),
  post: httpsPost,
}

const retryable = (r: { status?: number; blocked?: boolean }) =>
  !r.blocked && (r.status === undefined || r.status === 429 || r.status >= 500)

export async function deliverWebhook(
  rawUrl: string,
  body: string,
  headers: Record<string, string>,
  options: Partial<DeliveryOptions> = {},
): Promise<WebhookResult> {
  const opts = { ...DEFAULTS, ...options }
  if (!isAcceptableWebhookUrl(rawUrl)) return { ok: false, error: 'invalid_webhook', attempts: 0 }
  const url = new URL(rawUrl)
  let last: { status?: number; error?: string; blocked?: boolean } = {}
  for (let attempt = 1; attempt <= opts.attempts; attempt++) {
    const wait = opts.backoffMs[attempt - 1] ?? 0
    if (wait > 0) await opts.sleep(wait)
    last = await opts.post(url, body, headers, opts.timeoutMs)
    if (last.status !== undefined && last.status >= 200 && last.status < 300) {
      return { ok: true, status: last.status, attempts: attempt }
    }
    if (!retryable(last)) return { ok: false, status: last.status, error: last.error, attempts: attempt }
  }
  return { ok: false, status: last.status, error: last.error, attempts: opts.attempts }
}
