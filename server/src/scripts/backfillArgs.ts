export type BackfillArgs = { live: boolean; onlyUser: string | null } | { error: string }

/** Strict parser for backfillPeriodCentroids flags. Pure: no db or config imports. */
export function parseBackfillArgs(argv: string[]): BackfillArgs {
  let live = false
  let onlyUser: string | null = null
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--live') {
      live = true
    } else if (a === '--user') {
      const v = argv[i + 1]
      if (v === undefined || v.trim() === '' || v.startsWith('--')) {
        return { error: '--user requires a uid value' }
      }
      onlyUser = v
      i += 1
    } else if (a.startsWith('--user=')) {
      return { error: 'use "--user <uid>", not "--user=<uid>"' }
    } else {
      return { error: `unknown argument: ${a}` }
    }
  }
  return { live, onlyUser }
}
