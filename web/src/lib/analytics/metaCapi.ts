/**
 * Meta Conversions API payload helpers.
 *
 * These live outside the route file on purpose: a Next.js App Router route
 * module may only export the framework's own names (GET, POST, runtime, and so
 * on), so exporting testable helpers from `route.ts` fails the build with
 * "is not a valid Route export field". Keeping them here also means they can be
 * unit tested without pulling the route's request handling into the test.
 */

/** Meta requires lowercase, trimmed, then SHA-256 hex for hashed fields. */
export async function sha256Lower(value: string): Promise<string> {
  const normalised = value.trim().toLowerCase()
  const bytes = new TextEncoder().encode(normalised)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function buildUserData(input: {
  email: string | null
  ip: string | null
  userAgent: string | null
  fbp: string | null
  fbc: string | null
}): Promise<Record<string, unknown>> {
  const data: Record<string, unknown> = {}
  if (input.email) data.em = await sha256Lower(input.email)
  if (input.ip) data.client_ip_address = input.ip
  if (input.userAgent) data.client_user_agent = input.userAgent
  // fbp and fbc are Meta's own cookie values and must NOT be hashed.
  if (input.fbp) data.fbp = input.fbp
  if (input.fbc) data.fbc = input.fbc
  return data
}
