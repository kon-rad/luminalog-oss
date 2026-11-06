#!/usr/bin/env node
/*
 * skills-sync: refresh the vendored agent skills this site serves.
 *
 * The website serves a few agent skills as files (see /blog/SKILL.md,
 * /mybw2026-contest/skill.md, /setup-vault/skill.md). Any skill that belongs to
 * another repo is vendored under src/lib/skills/ so the site build never
 * depends on a live fetch, and this script keeps the copy in step.
 *
 * Usage (from web/):
 *   npm run skills:sync          # fetch and write
 *   npm run skills:sync -- --check   # fail if the vendored copy is behind
 *
 * Source of truth: the engine repo kon-rad/argo.
 */

import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const SKILLS = [
  {
    file: 'src/lib/skills/setup-vault.md',
    url: 'https://raw.githubusercontent.com/kon-rad/argo/main/skills/setup-vault/SKILL.md',
  },
]

const check = process.argv.includes('--check')

async function fetchSkill(skill) {
  const res = await fetch(skill.url, { headers: { 'cache-control': 'no-cache' } })
  if (!res.ok) throw new Error(`${skill.url} -> HTTP ${res.status}`)
  return res.text()
}

async function main() {
  let stale = 0
  for (const skill of SKILLS) {
    const target = path.join(ROOT, skill.file)
    const fresh = await fetchSkill(skill)
    const current = existsSync(target) ? await readFile(target, 'utf8') : null
    if (current === fresh) {
      console.log(`  = ${skill.file} (up to date)`)
      continue
    }
    stale++
    if (check) {
      console.log(`  ! ${skill.file} is out of date`)
    } else {
      await writeFile(target, fresh)
      console.log(`  ✓ ${skill.file} updated`)
    }
  }
  if (check && stale > 0) {
    console.error(`\n${stale} vendored skill(s) behind the engine. Run: npm run skills:sync`)
    process.exit(1)
  }
  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
