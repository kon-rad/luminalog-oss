#!/usr/bin/env node
/* ──────────────────────────────────────────────────────────────────────────
 * QR codes for the final demo day deck.
 *
 * Three codes, written to public/demo-day/ as PNG and committed:
 *
 *   qr-winston.png   the Patrick Winston clip on YouTube
 *   qr-launch-ad.png the Argo launch film on YouTube
 *   qr-argo.png      myargoquest.com, the landing page behind all four asks
 *
 * Two of these are failure insurance. The deck embeds both films as local mp4
 * and the .pptx carries them inside the file, but a projector that will not
 * play video is a normal way for a demo day to go wrong, and a code on the
 * slide turns that from a dead two minutes into "scan this, I will talk over
 * it". The third is the actual ask.
 *
 * PNG rather than SVG because the same art has to survive the PowerPoint
 * export, and PowerPoint does not rasterise SVG the way a browser does.
 *
 * Dark modules on a cream card, not the inverse. Inverted codes scan on most
 * modern phones and fail on enough older ones that it is not worth the risk in
 * a room you only get one pass at; the cream card keeps it on-palette instead.
 * Error correction is M, and the margin is the full four-module quiet zone the
 * spec asks for — a QR pushed flush to the edge of its card is the other common
 * way these fail from the back of a room.
 *
 *   node scripts/demo-day-qr/build.js
 * ────────────────────────────────────────────────────────────────────────── */

const fs = require('fs')
const path = require('path')
const QRCode = require('qrcode')

const OUT = path.join(__dirname, '..', '..', 'public', 'demo-day')

/* Palette from src/components/demo-day/theme.ts. Kept literal: this script
 * writes committed art and should not import the TypeScript deck to do it. */
const INK = '#16130E'
const CREAM = '#F3EEE4'

/* 1080px is far more than the ~150px the code occupies on a 1280x720 stage,
 * and costs a few KB. The headroom is for the .pptx, which gets scaled by
 * whatever machine opens it. */
const SIZE = 1080

/* Short forms on purpose. youtu.be/<id> is 11 characters less than the watch
 * URL, which is a whole version smaller in modules and visibly chunkier —
 * easier to scan at distance and at an angle. Both resolve to the same video. */
const CODES = [
  { name: 'qr-winston', url: 'https://youtu.be/vq5cH0WguOU', what: 'Winston, How to Speak' },
  { name: 'qr-launch-ad', url: 'https://youtu.be/Ppl-TfO3Oqo', what: 'Argo launch film' },
  { name: 'qr-argo', url: 'https://myargoquest.com', what: 'Argo landing page' },
]

async function main() {
  fs.mkdirSync(OUT, { recursive: true })
  for (const { name, url, what } of CODES) {
    const file = path.join(OUT, `${name}.png`)
    await QRCode.toFile(file, url, {
      type: 'png',
      width: SIZE,
      margin: 4,
      errorCorrectionLevel: 'M',
      color: { dark: INK, light: CREAM },
    })
    const kb = (fs.statSync(file).size / 1024).toFixed(1)
    console.log(`${name}.png  ${kb} KB  ${url}  (${what})`)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
