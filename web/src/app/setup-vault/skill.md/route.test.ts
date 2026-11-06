import { describe, it, expect } from 'vitest'
import { GET } from './route'

/* The site serves a few agent skills as files (see /blog/SKILL.md). This pins
 * the setup-vault one: an agent fetches it and saves it as a SKILL.md, so the
 * frontmatter and the trigger have to survive the round trip. */

describe('setup-vault/skill.md', () => {
  it('serves the skill as installable markdown', async () => {
    const res = GET()
    expect(res.headers.get('content-type')).toContain('text/markdown')
    expect(res.headers.get('access-control-allow-origin')).toBe('*')

    const body = await res.text()
    expect(body.startsWith('---\n')).toBe(true)
    expect(body).toContain('name: setup-vault')
    expect(body).toContain('# Set up your vault')
    // The trigger an agent matches on must be present, not just the title.
    expect(body).toContain('set up my vault')
  })
})
