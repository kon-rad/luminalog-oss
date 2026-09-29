// Pure logic for "What Argo knows" (user facts): validates the client's plaintext
// request, renders the prompt blocks, and parses the model's operations.
// Dependency-free so it is unit-testable without config or Firebase, like
// dailyMirror.ts. Spec: docs/superpowers/specs/2026-09-28-user-facts-design.md
// (workspace root).

export const USER_FACT_CATEGORIES = [
  'person', 'place', 'work', 'goal', 'value', 'preference', 'struggle', 'commitment', 'lifeEvent',
] as const
export type UserFactCategory = typeof USER_FACT_CATEGORIES[number]

export const USER_FACTS_MAX_ENTRIES = 8
export const USER_FACTS_ENTRY_MAX_CHARS = 3000
export const USER_FACTS_MAX_KNOWN = 150
export const USER_FACTS_MAX_REJECTED = 50
export const USER_FACTS_MAX_OPS = 20
export const USER_FACTS_MAX_EVIDENCE = 8
export const USER_FACT_SUBJECT_MAX_CHARS = 60
export const USER_FACT_STATEMENT_MAX_CHARS = 200

export interface UserFactsEntry { id: string; date: string; title: string; text: string }

export interface KnownFact {
  ref: string
  category: UserFactCategory
  subject: string
  statement: string
  since: string | null
  userAuthored: boolean
}

export interface RejectedFact { category: UserFactCategory; statement: string }

export interface UserFactsRequest {
  entries: UserFactsEntry[]
  facts: KnownFact[]
  rejected: RejectedFact[]
}

export type UserFactOp =
  | { op: 'add'; category: UserFactCategory; subject: string; statement: string; evidence: string[] }
  | { op: 'update'; ref: string; statement: string; evidence: string[] }
  | { op: 'confirm'; ref: string; evidence: string[] }
  | { op: 'invalidate'; ref: string; reason: string; evidence: string[] }

const DAY = /^\d{4}-\d{2}-\d{2}$/

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max).trim() : ''
}

function isCategory(value: unknown): value is UserFactCategory {
  return typeof value === 'string' && (USER_FACT_CATEGORIES as readonly string[]).includes(value)
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter((v): v is Record<string, unknown> => !!v && typeof v === 'object')
    : []
}

/**
 * Validates a request. Entries are the WORK: the client marks every entry it sent
 * as read, so a malformed, duplicate or excess entry is a 400, never a silent drop.
 * Known and rejected facts are CONTEXT: malformed items are dropped and the lists
 * are capped (the client sends them in priority order).
 */
export function parseUserFactsRequest(body: unknown): UserFactsRequest | { error: string } {
  const b = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const rawEntries = Array.isArray(b.entries) ? b.entries : []
  if (rawEntries.length === 0) return { error: 'No entries to read' }
  if (rawEntries.length > USER_FACTS_MAX_ENTRIES) return { error: 'Too many entries' }

  const entries: UserFactsEntry[] = []
  const ids = new Set<string>()
  for (const raw of rawEntries) {
    const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
    const id = text(r.id, 200)
    const date = text(r.date, 10)
    const body = text(r.text, USER_FACTS_ENTRY_MAX_CHARS)
    if (!id || !DAY.test(date) || !body || ids.has(id)) return { error: 'Invalid entry' }
    ids.add(id)
    entries.push({ id, date, title: text(r.title, 120), text: body })
  }

  const facts: KnownFact[] = []
  const refs = new Set<string>()
  for (const r of records(b.facts)) {
    if (facts.length >= USER_FACTS_MAX_KNOWN) break
    const ref = text(r.ref, 20)
    const statement = text(r.statement, USER_FACT_STATEMENT_MAX_CHARS)
    if (!ref || refs.has(ref) || !isCategory(r.category) || !statement) continue
    refs.add(ref)
    const since = text(r.since, 10)
    facts.push({
      ref,
      category: r.category,
      subject: text(r.subject, USER_FACT_SUBJECT_MAX_CHARS),
      statement,
      since: DAY.test(since) ? since : null,
      userAuthored: r.userAuthored === true,
    })
  }

  const rejected: RejectedFact[] = []
  for (const r of records(b.rejected)) {
    if (rejected.length >= USER_FACTS_MAX_REJECTED) break
    const statement = text(r.statement, USER_FACT_STATEMENT_MAX_CHARS)
    if (!isCategory(r.category) || !statement) continue
    rejected.push({ category: r.category, statement })
  }

  return { entries, facts, rejected }
}

export function buildEntriesBlock(entries: UserFactsEntry[]): string {
  return entries
    .map(e => `[${e.id} | ${e.date}${e.title ? ` | ${e.title}` : ''}]\n${e.text}`)
    .join('\n\n---\n\n')
}

export function buildKnownFactsBlock(facts: KnownFact[]): string {
  if (facts.length === 0) return '(none yet)'
  return facts
    .map(f => [
      f.ref, f.category, f.subject || '(no subject)', f.statement,
      ...(f.since ? [`since ${f.since}`] : []),
      ...(f.userAuthored ? ['written by the user'] : []),
    ].join(' | '))
    .join('\n')
}

export function buildRejectedBlock(rejected: RejectedFact[]): string {
  if (rejected.length === 0) return '(none)'
  return rejected.map(r => `- ${r.category}: ${r.statement}`).join('\n')
}

/**
 * Parses the model's reply into validated ops, or null when there is no `ops`
 * array (the caller retries once). An op survives only when it cites at least one
 * entry of this batch, names a ref that was sent (for everything but `add`), and
 * is complete. Only the first op per ref counts. `{"ops":[]}` is a valid answer.
 */
export function parseUserFactOps(
  raw: string,
  ctx: { entryIds: ReadonlySet<string>; refs: ReadonlySet<string> },
): UserFactOp[] | null {
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) return null
  let data: unknown
  try { data = JSON.parse(match[0]) } catch { return null }
  const rawOps = (data as { ops?: unknown } | null)?.ops
  if (!Array.isArray(rawOps)) return null

  const ops: UserFactOp[] = []
  const touched = new Set<string>()
  for (const r of records(rawOps)) {
    if (ops.length >= USER_FACTS_MAX_OPS) break
    const cited = Array.isArray(r.evidence) ? r.evidence : []
    const evidence = [...new Set(cited.filter((e): e is string => typeof e === 'string' && ctx.entryIds.has(e)))]
      .slice(0, USER_FACTS_MAX_EVIDENCE)
    if (evidence.length === 0) continue

    if (r.op === 'add') {
      const subject = text(r.subject, USER_FACT_SUBJECT_MAX_CHARS)
      const statement = text(r.statement, USER_FACT_STATEMENT_MAX_CHARS)
      if (!isCategory(r.category) || !subject || !statement) continue
      ops.push({ op: 'add', category: r.category, subject, statement, evidence })
      continue
    }

    const ref = text(r.ref, 20)
    if (!ctx.refs.has(ref) || touched.has(ref)) continue
    if (r.op === 'confirm') {
      ops.push({ op: 'confirm', ref, evidence })
    } else if (r.op === 'update') {
      const statement = text(r.statement, USER_FACT_STATEMENT_MAX_CHARS)
      if (!statement) continue
      ops.push({ op: 'update', ref, statement, evidence })
    } else if (r.op === 'invalidate') {
      ops.push({ op: 'invalidate', ref, reason: text(r.reason, USER_FACT_STATEMENT_MAX_CHARS), evidence })
    } else {
      continue
    }
    touched.add(ref)
  }
  return ops
}
