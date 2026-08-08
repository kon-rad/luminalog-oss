import { describe, it, expect, vi } from 'vitest'

// The route module imports `db` from firebaseAuth, which parses a service-account
// env at load — mock it so these pure-builder tests need no Firebase config.
vi.mock('../middleware/firebaseAuth', () => ({ db: {} }))

import { buildCourseBadgeMetadata } from './courseBadge'

describe('buildCourseBadgeMetadata', () => {
  const fields = {
    name: 'AI Power Users · Module 1',
    course: 'ai-power-users',
    module: 'Module 1',
    date: 'August 8, 2026',
    time: '7:00 PM',
    location: 'Network School',
    imageUrl: 'https://images.lu.ma/event123.png',
    firstName: 'Konrad',
  }

  it('builds ERC-721 metadata with class facts, image and participant first name', () => {
    const m = buildCourseBadgeMetadata('12', fields)
    expect(m.name).toBe('Argo Course Badge — AI Power Users · Module 1')
    expect(m.image).toBe('https://images.lu.ma/event123.png')
    expect(m.description).toContain('Konrad')
    expect(m.attributes).toEqual([
      { trait_type: 'Course', value: 'ai-power-users' },
      { trait_type: 'Module', value: 'Module 1' },
      { trait_type: 'Date', value: 'August 8, 2026' },
      { trait_type: 'Time', value: '7:00 PM' },
      { trait_type: 'Location', value: 'Network School' },
      { trait_type: 'Participant', value: 'Konrad' },
    ])
  })

  it('never leaks answers or sensitive keys', () => {
    const json = JSON.stringify(buildCourseBadgeMetadata('1', fields))
    for (const banned of ['answers', 'answer', 'quiz', 'uid', 'email', 'wallet']) {
      expect(json).not.toContain(`"${banned}"`)
    }
  })

  it('omits an empty module attribute', () => {
    const m = buildCourseBadgeMetadata('3', { ...fields, module: '' })
    expect(m.attributes.find(a => a.trait_type === 'Module')).toBeUndefined()
  })
})
