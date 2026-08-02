import { NextResponse } from 'next/server'
import { addDoc, collection, serverTimestamp } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { validateContestSubmission, type ContestSubmissionInput } from '@/lib/contest/validate'
import {
  CONTEST_DEADLINE_ISO,
  CONTEST_DEADLINE_LABEL,
  CONTEST_EVENT_ID,
  CONTEST_JUDGING,
  CONTEST_PROMPT,
  CONTEST_RULES,
  CONTEST_SKILL_URL,
  CONTEST_SUBTITLE,
  CONTEST_WORDS_MAX,
  CONTEST_WORDS_MIN,
  contestIsClosed,
} from '@/lib/contest/config'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

const json = (body: unknown, status = 200) =>
  NextResponse.json(body, { status, headers: CORS })

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

/**
 * GET — self-describing contract, so an agent that finds this URL without the
 * skill file can still work out how to submit.
 */
export async function GET() {
  return json({
    endpoint: '/api/contest/submit',
    method: 'POST',
    contentType: 'application/json',
    event: CONTEST_EVENT_ID,
    prompt: CONTEST_PROMPT,
    wordCount: { min: CONTEST_WORDS_MIN, max: CONTEST_WORDS_MAX },
    requiredSubtitle: CONTEST_SUBTITLE,
    deadline: { iso: CONTEST_DEADLINE_ISO, label: CONTEST_DEADLINE_LABEL },
    closed: contestIsClosed(),
    judging: CONTEST_JUDGING,
    rules: CONTEST_RULES,
    skill: CONTEST_SKILL_URL,
    body: {
      name: 'string, required — your real name',
      email: 'string, required — valid email address',
      company: 'string, required — the company you work for (use "Independent" if none)',
      role: 'string, required — your role',
      xAccount: 'string, required — your X/Twitter handle (use "none" if you have none)',
      essayUrl: 'string, required — https URL of the published essay',
      ethAddress: 'string, required — 0x-prefixed Ethereum mainnet address, 40 hex chars',
      agreedToTerms: 'boolean, required — must be true; see rules',
    },
  })
}

/** Coerce an unknown JSON body into the shape the shared validator expects. */
function coerce(raw: Record<string, unknown>): ContestSubmissionInput {
  const str = (v: unknown) => (typeof v === 'string' ? v : '')
  return {
    name: str(raw.name),
    email: str(raw.email),
    company: str(raw.company),
    role: str(raw.role),
    xAccount: str(raw.xAccount),
    essayUrl: str(raw.essayUrl),
    ethAddress: str(raw.ethAddress),
    agreedToTerms: raw.agreedToTerms === true,
  }
}

export async function POST(req: Request) {
  if (contestIsClosed()) {
    return json(
      {
        ok: false,
        error: 'closed',
        message: `Submissions closed at ${CONTEST_DEADLINE_LABEL}.`,
        deadline: CONTEST_DEADLINE_ISO,
      },
      410,
    )
  }

  let raw: unknown
  try {
    raw = await req.json()
  } catch {
    return json({ ok: false, error: 'invalid_json', message: 'Request body must be JSON.' }, 400)
  }

  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    return json({ ok: false, error: 'invalid_body', message: 'Request body must be a JSON object.' }, 400)
  }

  const input = coerce(raw as Record<string, unknown>)
  const result = validateContestSubmission(input)
  if (!result.ok) {
    return json(
      {
        ok: false,
        error: 'validation_failed',
        message: 'One or more fields are missing or invalid.',
        fields: result.errors,
        rules: CONTEST_RULES,
      },
      422,
    )
  }

  try {
    const doc = await addDoc(collection(db, 'contestSubmissions'), {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      company: input.company.trim(),
      role: input.role.trim(),
      xAccount: input.xAccount.trim(),
      essayUrl: input.essayUrl.trim(),
      ethAddress: input.ethAddress.trim(),
      agreedToTerms: true,
      event: CONTEST_EVENT_ID,
      source: 'api',
      createdAt: serverTimestamp(),
      userAgent: req.headers.get('user-agent') ?? null,
    })

    return json({
      ok: true,
      id: doc.id,
      message: `Entry received. ${CONTEST_JUDGING}`,
      deadline: CONTEST_DEADLINE_ISO,
    })
  } catch (err) {
    console.error('contest api submit failed', err)
    return json(
      { ok: false, error: 'write_failed', message: 'Could not record the submission. Please retry.' },
      500,
    )
  }
}
