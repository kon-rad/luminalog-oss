import { privateKeyToAccount } from 'viem/accounts'
import { RESPONSE_PREFIX, sha256Hex } from './protocol'
import { isoSeconds } from './time'

export const MAX_ANSWER_CHARS = 2000

/** Every question answered exactly once. Swift omits nil optionals, so a missing
 *  `answer` key means declined, same as null or whitespace. */
export function normalizeAnswers(questions: string[], raw: unknown): Array<{ index: number; answer: string | null }> | null {
  if (!Array.isArray(raw) || raw.length !== questions.length) return null
  const out: Array<string | null | undefined> = new Array(questions.length).fill(undefined)
  for (const item of raw) {
    const index = (item as { index?: unknown })?.index
    const answer = (item as { answer?: unknown })?.answer
    if (typeof index !== 'number' || !Number.isInteger(index) || index < 0 || index >= questions.length) return null
    if (out[index] !== undefined) return null
    if (answer === undefined || answer === null) { out[index] = null; continue }
    if (typeof answer !== 'string' || answer.length > MAX_ANSWER_CHARS) return null
    out[index] = answer.trim() ? answer.trim() : null
  }
  return out.map((answer, index) => ({ index, answer: answer ?? null }))
}

export function buildResponseBody(a: {
  requestId: string
  username: string | null
  wallet: string | null
  questions: string[]
  answers: Array<{ index: number; answer: string | null }>
  respondedAt: Date
}): string {
  return JSON.stringify({
    type: 'argo.info-response.v1',
    requestId: a.requestId,
    respondent: { username: a.username, wallet: a.wallet },
    answers: a.answers.map(x => ({ question: a.questions[x.index], answer: x.answer, declined: x.answer === null })),
    respondedAt: isoSeconds(a.respondedAt),
  })
}

const validKey = (k: string | undefined): k is `0x${string}` => typeof k === 'string' && /^0x[0-9a-fA-F]{64}$/.test(k)

export function signerAddress(privateKey: string | undefined): string | null {
  return validKey(privateKey) ? privateKeyToAccount(privateKey).address : null
}

export async function signResponseBody(rawBody: string, privateKey: string): Promise<{ signer: string; signature: string }> {
  if (!validKey(privateKey)) throw new Error('invalid signer key')
  const account = privateKeyToAccount(privateKey)
  const signature = await account.signMessage({ message: RESPONSE_PREFIX + sha256Hex(rawBody) })
  return { signer: account.address, signature }
}