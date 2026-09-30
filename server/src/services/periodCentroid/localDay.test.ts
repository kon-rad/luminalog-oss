import { describe, it, expect, vi, beforeEach } from 'vitest'

const journalDocs: Record<string, any> = {}
const userDocs: Record<string, any> = {}
let failReads = false

vi.mock('../../middleware/firebaseAuth', () => ({
  db: {
    collection: (name: string) => ({
      doc: (id: string) => ({
        async get() {
          if (failReads) throw new Error('firestore down')
          const data = (name === 'journals' ? journalDocs : userDocs)[id]
          return { exists: data !== undefined, data: () => data }
        },
      }),
    }),
  },
}))

import { localDayFor, resolveEntryLocalDay } from './localDay'

const day = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m - 1, d) / 86_400_000)
const timestamp = (iso: string) => ({ toDate: () => new Date(iso) })

beforeEach(() => {
  for (const k of Object.keys(journalDocs)) delete journalDocs[k]
  for (const k of Object.keys(userDocs)) delete userDocs[k]
  failReads = false
})

describe('localDayFor', () => {
  it('files 07:30 in UTC+8 under the local day, not the UTC day', () => {
    // 07:30 on Sat 26 Sep in Kuala Lumpur is 23:30 UTC on Fri 25 Sep.
    expect(localDayFor(new Date('2026-09-25T23:30:00Z'), 'Asia/Kuala_Lumpur', 0)).toBe(day(2026, 9, 26))
  })

  it('uses UTC when the user has no timezone (the old behaviour)', () => {
    expect(localDayFor(new Date('2026-09-25T23:30:00Z'), undefined, 0)).toBe(day(2026, 9, 25))
  })

  it('falls back when there is no timestamp', () => {
    expect(localDayFor(null, 'Asia/Kuala_Lumpur', 7)).toBe(7)
  })
})

describe('resolveEntryLocalDay', () => {
  it("reads the entry's createdAt and the profile timezone", async () => {
    journalDocs.e1 = { userId: 'u1', createdAt: timestamp('2026-09-25T23:30:00Z') }
    userDocs.u1 = { timezone: 'Asia/Kuala_Lumpur' }
    expect(await resolveEntryLocalDay('u1', 'e1', 99)).toBe(day(2026, 9, 26))
  })

  it('uses UTC for a user with no timezone', async () => {
    journalDocs.e1 = { userId: 'u1', createdAt: timestamp('2026-09-25T23:30:00Z') }
    userDocs.u1 = {}
    expect(await resolveEntryLocalDay('u1', 'e1', 99)).toBe(day(2026, 9, 25))
  })

  it('ignores an entry owned by someone else', async () => {
    journalDocs.e1 = { userId: 'u2', createdAt: timestamp('2026-09-25T23:30:00Z') }
    userDocs.u1 = { timezone: 'Asia/Kuala_Lumpur' }
    expect(await resolveEntryLocalDay('u1', 'e1', 99)).toBe(99)
  })

  it('falls back when the entry doc is missing', async () => {
    userDocs.u1 = { timezone: 'Asia/Kuala_Lumpur' }
    expect(await resolveEntryLocalDay('u1', 'missing', 99)).toBe(99)
  })

  it('falls back when Firestore throws', async () => {
    failReads = true
    expect(await resolveEntryLocalDay('u1', 'e1', 99)).toBe(99)
  })
})
