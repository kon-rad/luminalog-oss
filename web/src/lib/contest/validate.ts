// Pure validation for the MYBW 2026 essay-contest submission form. Kept separate
// from the React component so it can be unit-tested without jsdom/firebase, so the
// rules in firestore.rules have a single client-side mirror, and so the public
// /api/contest/submit endpoint validates exactly what the form validates.

export const CONTEST_EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
export const CONTEST_URL_RE = /^https?:\/\/.+/i
/** EIP-55-agnostic check: 0x followed by 40 hex characters. */
export const CONTEST_ETH_RE = /^0x[0-9a-fA-F]{40}$/

export type ContestField =
  | 'name'
  | 'email'
  | 'company'
  | 'role'
  | 'xAccount'
  | 'essayUrl'
  | 'ethAddress'
  | 'agreedToTerms'

export interface ContestSubmissionInput {
  name: string
  email: string
  company: string
  role: string
  xAccount: string
  essayUrl: string
  /** Ethereum mainnet address the prize would be sent to. */
  ethAddress: string
  agreedToTerms: boolean
}

export type ContestValidation =
  | { ok: true }
  | { ok: false; errors: Partial<Record<ContestField, string>> }

const MAX = 200

/**
 * Validate a contest submission. Mirrors the create-rule constraints in
 * firestore.rules so the user sees friendly errors before the write is rejected.
 */
export function validateContestSubmission(input: ContestSubmissionInput): ContestValidation {
  const errors: Partial<Record<ContestField, string>> = {}

  const name = input.name.trim()
  if (!name) errors.name = 'Please enter your name.'
  else if (name.length >= MAX) errors.name = 'Name is too long.'

  const email = input.email.trim()
  if (!email) errors.email = 'Please enter your email.'
  else if (!CONTEST_EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address.'

  const company = input.company.trim()
  if (!company) errors.company = 'Please enter the company you work for.'
  else if (company.length >= MAX) errors.company = 'Company name is too long.'

  const role = input.role.trim()
  if (!role) errors.role = 'Please enter your role.'
  else if (role.length >= MAX) errors.role = 'Role is too long.'

  const xAccount = input.xAccount.trim()
  if (!xAccount) errors.xAccount = 'Please enter your X account.'
  else if (xAccount.length >= MAX) errors.xAccount = 'X account is too long.'

  const essayUrl = input.essayUrl.trim()
  if (!essayUrl) errors.essayUrl = 'Please paste the link to your published essay.'
  else if (!CONTEST_URL_RE.test(essayUrl)) errors.essayUrl = 'Enter a full URL starting with http:// or https://.'
  else if (essayUrl.length >= 2000) errors.essayUrl = 'That URL is too long.'

  const ethAddress = input.ethAddress.trim()
  if (!ethAddress) errors.ethAddress = 'Please enter the Ethereum mainnet address for the prize.'
  else if (!CONTEST_ETH_RE.test(ethAddress))
    errors.ethAddress = 'Enter a valid Ethereum address — 0x followed by 40 hex characters.'

  if (!input.agreedToTerms) errors.agreedToTerms = 'Please confirm you agree to the contest terms.'

  return Object.keys(errors).length === 0 ? { ok: true } : { ok: false, errors }
}
