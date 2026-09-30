import { describe, it, expect } from 'vitest'
import { parseBackfillArgs } from './backfillArgs'

describe('parseBackfillArgs', () => {
  it('defaults to dry-run, all users', () => {
    expect(parseBackfillArgs([])).toEqual({ live: false, onlyUser: null })
  })
  it('parses --live --user u1', () => {
    expect(parseBackfillArgs(['--live', '--user', 'u1'])).toEqual({ live: true, onlyUser: 'u1' })
  })
  it('rejects --user with a missing uid', () => {
    expect(parseBackfillArgs(['--live', '--user'])).toHaveProperty('error')
  })
  it('rejects --user with an empty uid', () => {
    expect(parseBackfillArgs(['--user', ''])).toHaveProperty('error')
  })
  it('rejects --user followed by a flag', () => {
    expect(parseBackfillArgs(['--user', '--live'])).toHaveProperty('error')
  })
  it('rejects the --user=abc form', () => {
    expect(parseBackfillArgs(['--user=abc'])).toHaveProperty('error')
  })
  it('rejects unknown flags', () => {
    expect(parseBackfillArgs(['--lvie'])).toHaveProperty('error')
  })
})
