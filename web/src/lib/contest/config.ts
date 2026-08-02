// Single source of truth for the MYBW 2026 essay-contest parameters.
//
// Everything that states a rule — the page tabs, the submission form, the public
// `/mybw2026-contest/skill.md` agent skill, and the `/api/contest/submit` endpoint —
// reads from here so the rules can never drift between surfaces.

export const CONTEST_EVENT_ID = 'mybw2026'

export const CONTEST_PROMPT =
  'How can blockchain technology be used to benefit Malaysia?'

export const CONTEST_SUBTITLE = 'Malaysia Blockchain Week 2026 Argo Essay Contest'

export const CONTEST_URL = 'https://myargoquest.com/mybw2026-contest'
export const CONTEST_SKILL_URL = 'https://myargoquest.com/mybw2026-contest/skill.md'
export const CONTEST_SUBMIT_API = 'https://myargoquest.com/api/contest/submit'

export const CONTEST_PRIZE = '$100 USDC'
export const CONTEST_PRIZE_CHAIN = 'Ethereum mainnet'

/** Word-count window for a valid entry. */
export const CONTEST_WORDS_MIN = 750
export const CONTEST_WORDS_MAX = 800

/**
 * Deadline: 12:00 noon Kuala Lumpur time (MYT, UTC+8) on Friday 7 August 2026.
 * Stored as an absolute instant so clients in any timezone agree on it.
 */
export const CONTEST_DEADLINE_ISO = '2026-08-07T04:00:00.000Z'
export const CONTEST_DEADLINE_LABEL =
  '12:00 noon Kuala Lumpur time (MYT, UTC+8) on Friday, 7 August 2026'
export const CONTEST_DEADLINE_SHORT = 'Fri 7 Aug 2026, 12:00 noon MYT'

/** True once the submission window has closed. */
export function contestIsClosed(now: Date = new Date()): boolean {
  return now.getTime() > Date.parse(CONTEST_DEADLINE_ISO)
}

export interface ContestRule {
  id: string
  /** Plain-text statement of the rule — reused verbatim by skill.md and the API. */
  text: string
}

export const CONTEST_RULES: ContestRule[] = [
  {
    id: 'open-to-all',
    text:
      'Anyone may enter. You do not need to have attended the Bank Negara Malaysia Museum event in person, and you do not need to have attended Malaysia Blockchain Week 2026.',
  },
  {
    id: 'deadline',
    text: `Your entry must be submitted by ${CONTEST_DEADLINE_LABEL}. Late entries are not judged.`,
  },
  {
    id: 'prompt',
    text: `Your essay must answer the prompt “${CONTEST_PROMPT}”.`,
  },
  {
    id: 'length',
    text: `Your essay must be between ${CONTEST_WORDS_MIN} and ${CONTEST_WORDS_MAX} words.`,
  },
  {
    id: 'published',
    text:
      'Your essay must be published on a public web page — a blog, Medium, Substack, YouTube, X, or anything similar — under your real name, and must be publicly readable without a login or paywall.',
  },
  {
    id: 'subtitle',
    text: `Your essay must include the subtitle “${CONTEST_SUBTITLE}” and a link to ${CONTEST_URL}.`,
  },
  {
    id: 'eth-address',
    text: `Your essay must include a public ${CONTEST_PRIZE_CHAIN} wallet address where the prize money can be sent.`,
  },
  {
    id: 'not-ai-generated',
    text:
      'Your essay must not be 100% AI-generated. You may use AI tastefully as a tool, but the thinking and the writing must be your own.',
  },
  {
    id: 'read-it',
    text:
      'You must have read your own essay in full before submitting it, and it must be your honest best effort at answering the prompt.',
  },
]

/** The judging + payout promise shown on the page and repeated in the skill. */
export const CONTEST_JUDGING =
  `Every submission is read by a panel of expert judges. The winner is announced three days ` +
  `after the deadline and awarded ${CONTEST_PRIZE} on ${CONTEST_PRIZE_CHAIN}.`
