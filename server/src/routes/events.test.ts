import { describe, expect, it, vi } from 'vitest'

// Hoisted by vitest, so the route module never touches real credentials.
vi.mock('../middleware/firebaseAuth', () => ({ db: {}, firebaseAuth: vi.fn() }))

import { publicEvent } from './events'

describe('publicEvent', () => {
  it('projects only the fields the website renders', () => {
    const out = publicEvent({
      slug: '2026-08-12-kids-stem-004',
      title: 'Kids STEM #004',
      date: '2026-08-12',
      time: '6:00 PM',
      location: 'NS Library',
      eventType: 'KIDS_STEM',
      lumaUrl: 'https://luma.com/sewwz1tk',
      coverUrl: '/events/2026-08-12-kids-stem-004/cover.jpg',
      description: 'Full text.',
      photos: [{ thumb: '/t.jpg', full: '/f.jpg' }],
      // Sync bookkeeping that must not reach the client.
      lumaSlug: 'sewwz1tk',
      lumaEventId: 'evt-BA7SgI1gtXD4Lre',
      lumaCoverUrl: 'https://images.lumacdn.com/secret.jpg',
      syncedAt: '2026-08-14T00:00:00.000Z',
      calendar: 'argo',
    })

    expect(Object.keys(out).sort()).toEqual([
      'coverUrl', 'date', 'description', 'eventType', 'location',
      'lumaUrl', 'photos', 'slug', 'time', 'title',
    ])
    expect(out).not.toHaveProperty('lumaCoverUrl')
    expect(out).not.toHaveProperty('syncedAt')
  })

  it('fills defaults for a partial document rather than emitting undefined', () => {
    const out = publicEvent({ slug: 'x' })
    expect(out.eventType).toBe('OTHER')
    expect(out.photos).toEqual([])
    expect(out.description).toBe('')
  })

  it('drops malformed photo entries', () => {
    const out = publicEvent({
      photos: [{ thumb: '/t.jpg', full: '/f.jpg' }, { thumb: '/only-thumb.jpg' }, null],
    })
    expect(out.photos).toEqual([{ thumb: '/t.jpg', full: '/f.jpg' }])
  })
})
