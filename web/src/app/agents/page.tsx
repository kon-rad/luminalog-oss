import type { Metadata } from 'next'
import { LegalLayout } from '@/components/legal'

export const metadata: Metadata = {
  title: 'Agent Information Requests, Argo',
  description:
    'Developer reference for sending wallet-signed information requests to Argo users and verifying their signed webhook replies.',
}

const API = 'https://api.luminalog.com'

/* ── Reference-page primitives (code blocks and tables aren't styled globally) ── */
function Code({ children }: { children: string }) {
  return (
    <pre
      style={{
        background: 'var(--surfaceAlt)',
        border: '1px solid var(--hairline)',
        borderRadius: 10,
        padding: '14px 16px',
        margin: '0 0 20px',
        overflowX: 'auto',
        fontSize: 13.5,
        lineHeight: 1.6,
        color: 'var(--text)',
      }}
    >
      <code>{children}</code>
    </pre>
  )
}

function C({ children }: { children: React.ReactNode }) {
  return (
    <code style={{ fontSize: '0.9em', background: 'var(--surfaceAlt)', padding: '1px 5px', borderRadius: 5, color: 'var(--text)' }}>
      {children}
    </code>
  )
}

function Table({ head, rows }: { head: string[]; rows: React.ReactNode[][] }) {
  const cell: React.CSSProperties = { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid var(--hairline)', verticalAlign: 'top' }
  return (
    <div style={{ overflowX: 'auto', margin: '0 0 20px' }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 14.5 }}>
        <thead>
          <tr>{head.map(h => <th key={h} style={{ ...cell, color: 'var(--text)', fontWeight: 700 }}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} style={cell}>{c}</td>)}</tr>)}
        </tbody>
      </table>
    </div>
  )
}

export default function AgentsPage() {
  return (
    <LegalLayout title="Agent Information Requests" updated="September 27, 2026">
      <p>
        Any agent with an Ethereum key can send an Argo user a short list of questions. The user
        sees the request in the Argo app, drafts answers from their own journal if they choose, edits
        them, and sends them back. Replies arrive at your webhook, signed by Argo. No API key or
        registration is needed.
      </p>

      <h2>How it works</h2>
      <ol style={{ paddingLeft: 22, margin: '0 0 20px' }}>
        <li>Your agent signs a request with its wallet key and POSTs it to <C>/v1/inbox/requests</C>.</li>
        <li>Argo verifies the signature (and your ENS name, if you send one) and places the request in the recipient&apos;s inbox.</li>
        <li>The recipient answers, declines individual questions, or ignores the request. Nothing is sent without their review.</li>
        <li>If they answer, Argo POSTs a signed reply to your <C>webhookUrl</C>. Requests expire after 30 days.</li>
      </ol>

      <h2>Addressing a user</h2>
      <Table
        head={['Form', 'Example', 'Notes']}
        rows={[
          [<C key="a">@username</C>, <C key="b">@konrad</C>, 'Case-insensitive. The @ is optional. Users choose a username in the app under Settings.'],
          [<C key="a">0x…</C>, <C key="b">0xabcd…1234</C>, "Matches the user's Argo Soul wallet or their linked sign-in wallet."],
        ]}
      />
      <p>There is no directory or search endpoint. Get the handle from the user.</p>

      <h2>Send a request</h2>
      <Code>{`POST ${API}/v1/inbox/requests
Content-Type: application/json`}</Code>
      <Table
        head={['Field', 'Type', 'Limits']}
        rows={[
          [<C key="f">to</C>, 'string', '1–64 chars: @username, username, or 0x address'],
          [<C key="f">from.address</C>, 'string', '0x + 40 hex; must be the signing address'],
          [<C key="f">from.ens</C>, 'string, optional', '3–255 chars; must resolve to from.address on Ethereum mainnet'],
          [<C key="f">from.name</C>, 'string', '1–80 chars, shown to the user'],
          [<C key="f">from.description</C>, 'string', '1–500 chars, shown to the user'],
          [<C key="f">reason</C>, 'string', '1–1000 chars, shown to the user'],
          [<C key="f">questions</C>, 'string[]', '1–10 questions, 1–500 chars each'],
          [<C key="f">webhookUrl</C>, 'string', 'Public https URL, up to 2048 chars; no credentials, localhost, or private IPs'],
          [<C key="f">issuedAt</C>, 'string', 'ISO-8601 with timezone, within 10 minutes of server time'],
          [<C key="f">nonce</C>, 'string', '16–128 chars of A–Z a–z 0–9 _ -'],
          [<C key="f">signature</C>, 'string', '0x-prefixed EIP-191 signature (below)'],
        ]}
      />
      <p>
        Success returns <C>201</C> with <C>{'{ "id", "status": "pending", "expiresAt" }'}</C>. The <C>id</C> is
        the request hash, and it comes back as <C>requestId</C> in the reply.
      </p>

      <h2>Sign it</h2>
      <p>
        Hash a JSON array of the fields in this exact order, then sign{' '}
        <C>{'"Argo information request v1\\n" + sha256hex'}</C> with <C>personal_sign</C> (EIP-191). A
        positional array means there is no key ordering to get wrong. Hash the strings exactly as you
        send them, with no trimming.
      </p>
      <Code>{`[to, from.address.toLowerCase(), from.ens ?? "", from.name, from.description,
 reason, questions, webhookUrl, issuedAt, nonce]`}</Code>

      <h3>JavaScript (viem)</h3>
      <Code>{`import { createHash, randomBytes } from 'node:crypto'
import { privateKeyToAccount } from 'viem/accounts'

const account = privateKeyToAccount(process.env.AGENT_KEY)
const body = {
  to: '@konrad',
  from: { address: account.address, name: 'Match Agent', description: 'Matches founders with co-founders.' },
  reason: 'You look like a strong co-founder fit.',
  questions: ['What are you building?', 'What skills are you looking for?'],
  webhookUrl: 'https://agent.example.com/replies',
  issuedAt: new Date().toISOString(),
  nonce: randomBytes(16).toString('hex'),
}
const payload = JSON.stringify([
  body.to, body.from.address.toLowerCase(), body.from.ens ?? '', body.from.name,
  body.from.description, body.reason, body.questions, body.webhookUrl, body.issuedAt, body.nonce,
])
const hash = createHash('sha256').update(payload, 'utf8').digest('hex')
body.signature = await account.signMessage({ message: 'Argo information request v1\\n' + hash })

const res = await fetch('${API}/v1/inbox/requests', {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
})`}</Code>

      <h3>Python (eth_account)</h3>
      <Code>{`import hashlib, json
from eth_account import Account
from eth_account.messages import encode_defunct

payload = json.dumps([
    body["to"], body["from"]["address"].lower(), body["from"].get("ens", ""),
    body["from"]["name"], body["from"]["description"], body["reason"],
    body["questions"], body["webhookUrl"], body["issuedAt"], body["nonce"],
], separators=(",", ":"), ensure_ascii=False)
digest = hashlib.sha256(payload.encode("utf-8")).hexdigest()
signed = Account.sign_message(encode_defunct(text="Argo information request v1\\n" + digest), private_key=KEY)
body["signature"] = "0x" + bytes(signed.signature).hex()  # the 0x prefix is required`}</Code>

      <h2>Errors</h2>
      <Table
        head={['Status', 'error', 'Meaning']}
        rows={[
          ['400', <C key="e">invalid_body</C>, 'A field is missing, the wrong type, or out of limits'],
          ['400', <C key="e">invalid_webhook</C>, 'Not https, has credentials, or points at a private or local address'],
          ['400', <C key="e">stale_request</C>, 'issuedAt is more than 10 minutes from server time'],
          ['401', <C key="e">bad_signature</C>, 'Malformed, or does not recover to from.address'],
          ['422', <C key="e">ens_mismatch</C>, 'from.ens does not resolve to from.address'],
          ['503', <C key="e">ens_unavailable</C>, 'ENS lookup failed; retry later'],
          ['404', <C key="e">recipient_not_found</C>, 'No Argo user matches to'],
          ['409', <C key="e">duplicate</C>, 'This exact signed request was already received'],
          ['429', <C key="e">rate_limited</C>, 'Over 30 requests an hour from your IP, or 3 a day from your address to one user'],
          ['429', <C key="e">inbox_full</C>, 'The user has 50 pending requests'],
        ]}
      />

      <h2>Receive the reply</h2>
      <p>
        Argo POSTs this body to your <C>webhookUrl</C>. There is one entry per question, in the
        original order, and a declined question has <C>answer: null</C>.
      </p>
      <Code>{`{
  "type": "argo.info-response.v1",
  "requestId": "<request hash>",
  "respondent": { "username": "konrad", "wallet": "0x…" },
  "answers": [
    { "question": "What are you building?", "answer": "A private AI journal.", "declined": false },
    { "question": "What skills are you looking for?", "answer": null, "declined": true }
  ],
  "respondedAt": "2026-09-27T10:05:00Z"
}`}</Code>
      <p>
        Headers: <C>X-Argo-Signer</C> (address) and <C>X-Argo-Signature</C>, an EIP-191 signature
        over <C>{'"Argo information response v1\\n" + sha256hex(raw body bytes)'}</C>. Return any 2xx.
        Argo retries network errors, 429, and 5xx up to 3 times. It does not retry other 4xx responses
        and does not follow redirects.
      </p>

      <h2>Verify the reply</h2>
      <p>
        Fetch Argo&apos;s signing address once from <C>GET {API}/v1/inbox/signer</C> and pin it. Check
        every reply against that pinned address, <strong>not</strong> against the <C>X-Argo-Signer</C>{' '}
        header, because anyone can set a header. Hash the raw bytes you received, before any JSON
        parsing.
      </p>
      <Code>{`import hashlib
from eth_account import Account
from eth_account.messages import encode_defunct

ARGO_SIGNER = "0x…"  # from GET /v1/inbox/signer, fetched once and pinned

def is_genuine(raw_body: bytes, signature: str) -> bool:
    digest = hashlib.sha256(raw_body).hexdigest()
    msg = encode_defunct(text="Argo information response v1\\n" + digest)
    return Account.recover_message(msg, signature=signature).lower() == ARGO_SIGNER.lower()`}</Code>

      <h2>Things to expect</h2>
      <ul style={{ paddingLeft: 22, margin: '0 0 20px' }}>
        <li><strong>Replies may never come.</strong> The user can ignore a request, and unanswered requests expire after 30 days.</li>
        <li><strong>Answers are written by a person.</strong> They may be drafted from the user&apos;s journal, but the user reviews and edits them before sending.</li>
        <li><strong>Deduplicate on requestId.</strong> A reply can arrive more than once in rare failure cases.</li>
        <li><strong>Only your questions are stored.</strong> Argo keeps the request until it is answered, ignored, or expired. Answers pass through to your webhook and are not stored on Argo&apos;s server.</li>
      </ul>
    </LegalLayout>
  )
}
