#!/usr/bin/env node
/*
 * blog-media: capture a post's screenshots straight into public/blog/.
 *
 * A blog post's images are hand-made today (a screenshot, a resize, a rename),
 * which is fine once and tedious every time. This script is the repeatable
 * version: a JSON config lists the shots, one browser session takes them all,
 * and sharp writes the final jpgs the post references.
 *
 * Usage (from web/):
 *   npm run blog:media -- scripts/blog-media/setup-vault.json
 *
 * Playwright and sharp are expected from the global install (the same
 * convention scripts/demo-day-pptx/build.js uses), so the runner sets
 * NODE_PATH=$(npm root -g). The script falls back to a local install if one
 * exists, and to the bundled Chromium if system Chrome is not present.
 *
 * Config:
 *   {
 *     "out": "public/blog",              // where the jpgs land
 *     "quality": 82,                     // jpg quality
 *     "maxWidth": 1920,                  // downscale anything wider
 *     "shots": [
 *       {
 *         "name": "my-post-1",           // writes <out>/my-post-1.jpg
 *         "url": "https://...",
 *         "viewport": { "width": 1280, "height": 800 },
 *         "deviceScaleFactor": 1.5,
 *         "fullPage": false,
 *         "clip": "#products",           // css selector to crop to (with padding)
 *         "padding": 24,                 // px of margin around a clip
 *         "waitFor": ".some-selector",   // wait for this before shooting
 *         "waitMs": 1200,                // extra settle time
 *         "dark": false                  // colour-scheme preference
 *       }
 *     ]
 *   }
 */

import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

/** Prefer a local playwright/sharp, fall back to the global install. */
function load(name) {
  try {
    return require(name)
  } catch {
    const globalRoot = process.env.NODE_PATH
    if (globalRoot) {
      const p = path.join(globalRoot, name)
      if (existsSync(p)) return require(p)
    }
    throw new Error(
      `Cannot resolve "${name}". Run with NODE_PATH=$(npm root -g), or npm i -D playwright sharp.`,
    )
  }
}

const { chromium } = load('playwright')
const sharp = load('sharp')

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

async function main() {
  const configArg = process.argv[2]
  if (!configArg) {
    console.error('usage: node scripts/blog-media/capture.mjs <config.json>')
    process.exit(2)
  }
  const configPath = path.isAbsolute(configArg) ? configArg : path.join(ROOT, configArg)
  const config = JSON.parse(await readFile(configPath, 'utf8'))

  const outDir = path.join(ROOT, config.out ?? 'public/blog')
  const quality = config.quality ?? 82
  const maxWidth = config.maxWidth ?? 1920
  await mkdir(outDir, { recursive: true })

  // System Chrome avoids a second Chromium download. Bundled Chromium is the
  // fallback for a machine without Chrome installed.
  let browser
  try {
    browser = await chromium.launch({ channel: 'chrome' })
  } catch {
    console.log('  (system Chrome not found, using bundled Chromium)')
    browser = await chromium.launch()
  }

  const results = []
  try {
    for (const shot of config.shots) {
      const context = await browser.newContext({
        viewport: shot.viewport ?? { width: 1280, height: 800 },
        deviceScaleFactor: shot.deviceScaleFactor ?? 1.5,
        colorScheme: shot.dark ? 'dark' : 'light',
        userAgent: shot.userAgent,
      })
      const page = await context.newPage()
      try {
        await page.goto(shot.url, { waitUntil: 'networkidle', timeout: 60000 })
        if (shot.waitFor) await page.waitForSelector(shot.waitFor, { timeout: 30000 })
        if (shot.waitMs) await page.waitForTimeout(shot.waitMs)

        const opts = { type: 'png' }
        if (shot.fullPage) opts.fullPage = true
        if (shot.clip) {
          const pad = shot.padding ?? 24
          const locator = page.locator(shot.clip).first()
          await locator.scrollIntoViewIfNeeded()
          // boundingBox() is viewport-relative; a fullPage clip is in document
          // coordinates, so add the scroll offset or the crop lands on whatever
          // happens to be at the top of the viewport.
          const box = await locator.evaluate((el) => {
            const r = el.getBoundingClientRect()
            return { x: r.x + window.scrollX, y: r.y + window.scrollY, width: r.width, height: r.height }
          })
          if (!box) throw new Error(`clip selector matched nothing: ${shot.clip}`)
          // Clip coordinates are page-relative, so the capture must be the whole
          // page; a viewport-only shot would put the crop outside the image.
          opts.fullPage = true
          opts.clip = {
            x: Math.max(0, Math.round(box.x - pad)),
            y: Math.max(0, Math.round(box.y - pad)),
            width: Math.round(box.width + pad * 2),
            height: Math.min(Math.round(box.height + pad * 2), shot.maxHeight ?? Number.MAX_SAFE_INTEGER),
          }
        }

        const png = await page.screenshot(opts)
        const target = path.join(outDir, `${shot.name}.jpg`)
        const img = sharp(png)
        const meta = await img.metadata()
        if (meta.width > maxWidth) img.resize({ width: maxWidth })
        const info = await img.jpeg({ quality, mozjpeg: true }).toFile(target)
        results.push({ name: shot.name, width: info.width, height: info.height, kb: Math.round(info.size / 1024) })
        console.log(`  ✓ ${shot.name}.jpg  ${info.width}x${info.height}  ${Math.round(info.size / 1024)} kB`)
      } finally {
        await context.close()
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`\n${results.length} image(s) written to ${path.relative(process.cwd(), outDir)}`)
  for (const r of results) console.log(`  ${r.name}.jpg  ${r.width}x${r.height}  ${r.kb} kB`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
