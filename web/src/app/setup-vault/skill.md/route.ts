import { readFileSync } from 'node:fs'
import path from 'node:path'

/* The setup-vault skill, served as a file so any agent can install it:
 * fetch this, save it as skills/setup-vault/SKILL.md, and it can run it.
 *
 * Same shape as /blog/SKILL.md and /mybw2026-contest/skill.md: markdown,
 * CORS open, no key. The source of truth is the engine repo (kon-rad/argo);
 * src/lib/skills/setup-vault.md is the vendored copy this serves.
 *
 * Refresh the copy with: npm run skills:sync
 */

export const dynamic = 'force-static'

export function GET() {
  const skill = readFileSync(path.join(process.cwd(), 'src/lib/skills/setup-vault.md'), 'utf8')
  return new Response(skill, {
    headers: { 'Content-Type': 'text/markdown; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
  })
}
