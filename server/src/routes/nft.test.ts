import { describe, it, expect, vi, beforeEach } from 'vitest'

let queryResult: any = { empty: true, docs: [] }
vi.mock('../middleware/firebaseAuth', () => ({
  db: {
    collection: () => ({
      where: () => ({ limit: () => ({ get: async () => queryResult }) }),
    }),
  },
}))

import { buildNftMetadata, getNftMetadata, getPublicPoints } from './nft'

beforeEach(() => {
  queryResult = { empty: true, docs: [] }
})

describe('buildNftMetadata', () => {
  it('builds standard ERC-721 metadata with count attributes', () => {
    const m = buildNftMetadata('12', { stars: 41, streak: 5, totalWords: 61234, imageUrl: 'https://s3/hero.png' })
    expect(m).toEqual({
      name: 'LuminaLog Soul #12',
      description: 'A constellation grown from 41 days of journaling.',
      image: 'https://s3/hero.png',
      animation_url: 'https://luminalog.com/soul/12',
      attributes: [
        { trait_type: 'Stars', value: 41 },
        { trait_type: 'Day streak', value: 5 },
        { trait_type: 'Total words', value: 61234 },
      ],
    })
  })

  it('prefixes the description with the owner name when provided', () => {
    const m = buildNftMetadata('5', { stars: 15, streak: 15, totalWords: 49643, username: 'Konrad' })
    expect(m.description).toBe("Konrad's constellation grown from 15 days of journaling.")
  })

  it('uses singular "day" for one star and a default image when none rendered', () => {
    const m = buildNftMetadata('1', { stars: 1, streak: 1, totalWords: 800 })
    expect(m.description).toBe('A constellation grown from 1 day of journaling.')
    expect(m.image).toBe('https://luminalog.com/soul/1/hero.png')
  })

  it('exposes ONLY non-sensitive fields — no coordinates, vectors, or text', () => {
    const m = buildNftMetadata('7', { stars: 3, streak: 2, totalWords: 2400, imageUrl: 'https://s3/x.png' })
    const json = JSON.stringify(m)
    expect(Object.keys(m).sort()).toEqual(['animation_url', 'attributes', 'description', 'image', 'name'])
    for (const banned of ['points', 'x', 'y', 'z', 'vector', 'embedding', 'centroid', 'dayIndex', 'text', 'content']) {
      expect(json).not.toContain(`"${banned}"`)
    }
    // attribute values are all numbers (never raw content)
    expect(m.attributes.every(a => typeof a.value === 'number')).toBe(true)
  })
})

describe('getNftMetadata', () => {
  it('returns null when no user holds the token', async () => {
    queryResult = { empty: true, docs: [] }
    expect(await getNftMetadata('99')).toBeNull()
  })

  it('assembles metadata from the holder’s constellation point-set + stats', async () => {
    queryResult = {
      empty: false,
      docs: [{
        data: () => ({
          nft: { tokenId: '2' },
          constellation: {
            version: 4,
            imageUrl: 'https://s3/2/hero.png',
            points: [{ x: 1, y: 2, z: 3 }, { x: 4, y: 5, z: 6 }, { x: 7, y: 8, z: 9 }],
          },
          stats: { streakCount: 6, totalWords: 5100, goalDayWords: 800 },
        }),
      }],
    }
    const m = await getNftMetadata('2')
    expect(m).not.toBeNull()
    expect(m!.name).toBe('LuminaLog Soul #2')
    expect(m!.image).toBe('https://s3/2/hero.png')
    expect(m!.attributes).toEqual([
      { trait_type: 'Stars', value: 3 },
      { trait_type: 'Day streak', value: 6 },
      { trait_type: 'Total words', value: 5100 },
    ])
    // the point coordinates must NOT leak into published metadata
    expect(JSON.stringify(m)).not.toContain('"points"')
  })

  it('uses the holder’s first name (from displayName) in the description', async () => {
    queryResult = {
      empty: false,
      docs: [{
        data: () => ({
          nft: { tokenId: '2' },
          displayName: 'Konrad Gnat',
          constellation: { points: [{ x: 0 }, { x: 1 }] },
          stats: { streakCount: 3, totalWords: 100, goalDayWords: 100 },
        }),
      }],
    }
    const m = await getNftMetadata('2')
    expect(m!.description).toBe("Konrad's constellation grown from 2 days of journaling.")
  })

  it('defaults missing constellation/stats to zeros', async () => {
    queryResult = { empty: false, docs: [{ data: () => ({ nft: { tokenId: '3' } }) }] }
    const m = await getNftMetadata('3')
    expect(m!.attributes).toEqual([
      { trait_type: 'Stars', value: 0 },
      { trait_type: 'Day streak', value: 0 },
      { trait_type: 'Total words', value: 0 },
    ])
  })
})

describe('getPublicPoints', () => {
  it('returns null when no user holds the token', async () => {
    queryResult = { empty: true, docs: [] }
    expect(await getPublicPoints('99')).toBeNull()
  })

  it('returns coordinates + size only, stripping all temporal/identifying fields', async () => {
    queryResult = {
      empty: false,
      docs: [{
        data: () => ({
          nft: { tokenId: '2' },
          constellation: {
            version: 4,
            points: [
              { dayIndex: 20272, date: '2026-07-03', x: 0.4, y: -0.1, z: 0.8, wordCount: 812, streakAtEarn: 5 },
              { dayIndex: 20273, date: '2026-07-04', x: -0.2, y: 0.3, z: 0.1, wordCount: 900, streakAtEarn: 6 },
            ],
          },
        }),
      }],
    }
    const soul = await getPublicPoints('2')
    expect(soul).toEqual({
      tokenId: '2',
      stars: 2,
      points: [
        { x: 0.4, y: -0.1, z: 0.8, wordCount: 812 },
        { x: -0.2, y: 0.3, z: 0.1, wordCount: 900 },
      ],
    })
    // hard privacy assertion: no date / dayIndex / streak leak
    const json = JSON.stringify(soul)
    for (const banned of ['date', 'dayIndex', 'streakAtEarn', 'vector', 'embedding']) {
      expect(json).not.toContain(`"${banned}"`)
    }
  })

  it('handles a minted-but-empty constellation (nascent soul)', async () => {
    queryResult = { empty: false, docs: [{ data: () => ({ nft: { tokenId: '3' } }) }] }
    expect(await getPublicPoints('3')).toEqual({ tokenId: '3', stars: 0, points: [] })
  })
})
