/** ISO-8601 without milliseconds: iOS's `.iso8601` decoder rejects fractional seconds. */
export function isoSeconds(d: Date): string {
  return d.toISOString().replace(/\.\d{3}Z$/, 'Z')
}
