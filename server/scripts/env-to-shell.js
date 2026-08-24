#!/usr/bin/env node
/**
 * Print `.env` as safely-quoted shell `export` lines.
 *
 * Why this exists: `pm2 restart --update-env` replays the environment snapshot
 * PM2 saved when the process first started, and `import 'dotenv/config'` will
 * NOT override a variable already present in `process.env`. So editing `.env`
 * and restarting silently keeps the OLD value. The shell env has to be
 * repopulated from `.env` before the restart.
 *
 * Hand-sourcing (`set -a; . ./.env`) does not work here: FIREBASE_SERVICE_ACCOUNT_JSON
 * is unquoted JSON, so a POSIX shell dies with `parse error near '}'`.
 *
 * Parsing goes through the app's own dotenv so the shell and the app agree on
 * how every value parses.
 *
 * Usage:
 *   node scripts/env-to-shell.js > /tmp/envexp.sh
 *   set -a; . /tmp/envexp.sh; set +a; rm -f /tmp/envexp.sh
 *   pm2 restart luminalog-api --update-env
 *
 * See ADR-0130.
 */
const path = process.argv[2] || '.env'
const parsed = require('dotenv').config({ path, override: true, quiet: true }).parsed

if (!parsed) {
  console.error(`env-to-shell: could not read ${path}`)
  process.exit(1)
}

// Single-quote for POSIX sh: wrap in '...' and turn any ' into '\''
const quote = v => "'" + String(v).replace(/'/g, "'\\''") + "'"

const lines = Object.keys(parsed).map(k => `export ${k}=${quote(parsed[k])}`)
process.stdout.write(lines.join('\n') + '\n')
