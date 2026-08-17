/* Build the Argo final demo day PowerPoint from HTML slides. See README.md.
 *
 *   node build.js [outfile]
 *
 * Slide content is the same narrative as the web deck at /final-demo-day
 * (src/components/demo-day/slides.tsx) — keep the two in step when either
 * changes. Layout is 720x405pt (16:9). Web-safe fonts only, because a font
 * that is not on the presenting machine is a deck that reflows on stage:
 * Georgia for the serif voice, Arial for the sans. Colours are the Argo
 * palette from globals.css. */

const fs = require('fs')
const path = require('path')

const pptxgen = require('pptxgenjs')
/* html2pptx ships with the Claude pptx skill rather than npm. Override with
 * HTML2PPTX when it lives somewhere else. */
const HTML2PPTX =
  process.env.HTML2PPTX ||
  path.join(
    process.env.HOME,
    '.claude/plugins/cache/buildwithclaude/all-skills/1.0.0/skills/pptx/scripts/html2pptx.js'
  )
const html2pptx = require(HTML2PPTX)
const sharp = require('sharp')

const OUT = process.argv[2] || path.join(__dirname, '../../public/demo-day/argo-final-demo-day.pptx')
const DIR = path.join(__dirname, 'slides')
const GEN = path.join(__dirname, '.build')
const PUB = path.join(__dirname, '../../public/demo-day')
fs.mkdirSync(DIR, { recursive: true })
fs.mkdirSync(GEN, { recursive: true })

const INK = '#16130E'
const INK_ELEV = '#221E18'
const CREAM = '#F3EEE4'
const CREAM_MUTED = '#A89E8F'
const PAPER = '#F4F0E9'
const PAPER_ELEV = '#FBF8F3'
const TEXT = '#2B2722'
const TEXT_MUTED = '#7C7468'
const ACCENT = '#CE7F44'
const ACCENT_DEEP = '#B96B33'
const ACCENT_LIGHT = '#E5A063'
const GOLD = '#F5C842'

const SERIF = 'Georgia, serif'
const SANS = 'Arial, Helvetica, sans-serif'

/* Slide HTML lives in slides/, so image paths are relative to that. A() reaches
 * the shipped assets in public/demo-day; G() reaches the ones this script
 * derives into .build (the flywheel raster, the dimmed watermark, the 16:9
 * crops). Both directories are gitignored except the originals. */
const A = (f) => path.relative(DIR, path.join(PUB, f))
const G = (f) => path.relative(DIR, path.join(GEN, f))

/* Derive the assets that are computed rather than shipped. */
async function prepare() {
  await sharp(fs.readFileSync(path.join(__dirname, 'flywheel.svg')))
    .resize(1200)
    .png()
    .toFile(path.join(GEN, 'flywheel.png'))

  /* PowerPoint drops CSS opacity, so the watermark is dimmed in the pixels. */
  const wm = await sharp(path.join(PUB, 'argo-watermark-cream.png')).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  for (let i = 3; i < wm.data.length; i += 4) wm.data[i] = Math.round(wm.data[i] * 0.32)
  await sharp(wm.data, { raw: wm.info }).png().toFile(path.join(GEN, 'argo-watermark-cream-dim.png'))

  for (const n of ['spoke-podcast', 'spoke-kids', 'spoke-course', 'spoke-community']) {
    await sharp(path.join(PUB, `${n}.jpg`))
      .resize(800, 450, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 88 })
      .toFile(path.join(GEN, `${n}-16x9.jpg`))
  }

  /* The three episode stills are already 16:9 off YouTube; re-encoding them at
   * card width keeps the pptx from carrying three 1280px jpegs it never shows
   * at that size. */
  for (const n of ['testimonial-johnston', 'testimonial-chong', 'testimonial-im']) {
    await sharp(path.join(PUB, `${n}.jpg`))
      .resize(560, 315, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 88 })
      .toFile(path.join(GEN, `${n}-16x9.jpg`))
  }

  /* The AI city photographs are phone shots at assorted aspects, and an <img>
   * with both dimensions set stretches rather than crops. Cropping here to the
   * exact rectangles the slide places them in is what keeps faces from being
   * squashed — hero and grid cells are close but not equal ratios, so two
   * passes rather than one. */
  await sharp(path.join(PUB, 'aicity-hero.jpg'))
    .resize(960, 702, { fit: 'cover', position: 'centre' })
    .jpeg({ quality: 88 })
    .toFile(path.join(GEN, 'aicity-hero-crop.jpg'))

  for (const n of ['aicity-sketch', 'aicity-puan', 'aicity-chairman', 'aicity-execs']) {
    await sharp(path.join(PUB, `${n}.jpg`))
      .resize(600, 452, { fit: 'cover', position: 'centre' })
      .jpeg({ quality: 88 })
      .toFile(path.join(GEN, `${n}-crop.jpg`))
  }
}

function page(tone, inner, opts = {}) {
  const bg = tone === 'ink' ? INK : PAPER
  const fg = tone === 'ink' ? CREAM : TEXT
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*, *::before, *::after { box-sizing: border-box; }
html { background: ${bg}; }
body { width: 720pt; height: 405pt; margin: 0; padding: 0; background: ${bg}; color: ${fg};
       font-family: ${SANS}; display: flex; }
h1,h2,h3,p { margin: 0; }
.pad { margin: 30pt 42pt; flex: 1; display: flex; flex-direction: column; ${opts.padStyle || ''} }
.row { display: flex; }
.eyebrow { font-family: ${SANS}; font-size: 8.5pt; font-weight: bold; letter-spacing: 1.6pt;
           color: ${tone === 'ink' ? ACCENT_LIGHT : ACCENT_DEEP}; margin-bottom: 12pt; }
.head { font-family: ${SERIF}; font-size: 27pt; line-height: 1.15; }
.sub { font-family: ${SANS}; font-size: 12pt; line-height: 1.5;
       color: ${tone === 'ink' ? CREAM_MUTED : TEXT_MUTED}; margin-top: 14pt; }
.card { background: ${tone === 'ink' ? INK_ELEV : PAPER_ELEV};
        border: 1px solid ${tone === 'ink' ? '#332D24' : '#E3DCCE'}; border-radius: 9pt; padding: 14pt; }
.slot { background: ${tone === 'ink' ? '#1D1811' : '#F7EDE2'}; border: 2px solid ${ACCENT};
        border-radius: 9pt; padding: 14pt; }
.slotText { font-family: ${SANS}; font-size: 10pt; font-weight: bold; color: ${ACCENT}; text-align: center; }
.slotSmall { font-family: ${SANS}; font-size: 7.5pt; color: ${tone === 'ink' ? CREAM_MUTED : TEXT_MUTED};
             text-align: center; margin-top: 6pt; line-height: 1.4; }
</style></head><body>${inner}</body></html>`
}

function write(name, html) {
  const f = path.join(DIR, `${name}.html`)
  fs.writeFileSync(f, html)
  return f
}

/* ── video ──────────────────────────────────────────────────────────────────
 *
 * Two slides play a clip. html2pptx cannot emit video, so each one marks out
 * the rectangle with <div class="placeholder">, which html2pptx measures and
 * hands back in inches without drawing anything, and main() drops a real
 * addMedia() onto that exact rect afterwards. Position stays derived from the
 * HTML, so moving the layout moves the video with it.
 *
 * A missing file is not an error, and there are two rungs below it:
 *
 *   1. the local mp4, embedded — plays with no network, which is the only
 *      version you can rely on in a venue
 *   2. the YouTube embed — plays in place in PowerPoint, but only with working
 *      wifi and only if the room does not block YouTube
 *   3. the poster still — always renders, never plays
 *
 * launch-film.mp4 is deliberately not in the repo (34 MB), so a fresh clone
 * lands on rung 2 as a matter of course and the deck still builds. Masters for
 * both live in the vault; see README.md for the encodes. */
const media = (file, poster, youtube) => {
  const p = path.join(PUB, file)
  /* addMedia takes the cover as a data URI, not a path — it only checks for a
   * "base64," header, so the jpeg goes in as itself rather than being blown up
   * into a multi-megabyte PNG. Without a cover PowerPoint draws its own grey
   * play button over the slide. */
  const cover = () => `data:image/jpeg;base64,${fs.readFileSync(path.join(PUB, poster)).toString('base64')}`
  return { path: p, cover, poster: A(poster), youtube, has: fs.existsSync(p) }
}

/* PowerPoint wants the /embed/ form; a watch?v= or youtu.be link renders as a
 * dead frame. Sources: youtu.be/vq5cH0WguOU and youtube.com/watch?v=Ppl-TfO3Oqo. */
const WINSTON = media(
  'clip-winston-weapon.mp4',
  'clip-winston-weapon-poster.jpg',
  'https://www.youtube.com/embed/vq5cH0WguOU'
)
const FILM = media('launch-film.mp4', 'launch-film-poster.jpg', 'https://www.youtube.com/embed/Ppl-TfO3Oqo')

/* The rect for a clip. Measured and left empty whenever something playable is
 * going into it; the poster is only drawn as HTML when nothing is. */
const videoBox = (m, id, style) =>
  m.has || m.youtube
    ? `<div class="placeholder" id="${id}" style="${style}"></div>`
    : `<img src="${m.poster}" style="${style}">`

/* A QR code and its address, side by side. Written by scripts/demo-day-qr,
 * committed to public/demo-day, and rendered here exactly as the web deck
 * renders it in src/components/demo-day/slides.tsx.
 *
 * This is the fourth rung under the two films, below the embedded mp4, the
 * YouTube embed and the poster still: the one that still works when the
 * machine will not play video at all and the wifi is gone. On slide 16 it is
 * not a fallback, it is the ask.
 *
 * `plate` backs the pair in near-black for the one place it sits over the
 * film. The PNGs carry their own cream quiet zone, so no padding around the
 * image itself. */
const qr = (file, caption, url, { size = 48, plate = false, style = '' } = {}) =>
  `<div class="row" style="align-items: center; ${
    plate ? `padding: 7pt 10pt 7pt 7pt; border-radius: 8pt; background: #0B0906; border: 1px solid #332D24;` : ''
  } ${style}">
  <img src="${A(file)}" style="width: ${size}pt; height: ${size}pt; border-radius: 4pt;">
  <div style="text-align: left; margin-left: 8pt;">
    <p style="font-family: ${SANS}; font-size: 7pt; font-weight: bold; letter-spacing: 1.1pt; color: ${ACCENT_LIGHT};">${caption}</p>
    <p style="font-family: ${SANS}; font-size: 8.5pt; color: ${CREAM}; margin-top: 3pt;">${url}</p>
  </div>
</div>`

/* ── the eighteen slides ─────────────────────────────────────────────────── */

const SLIDES = [
  {
    id: '01-title',
    tone: 'ink',
    html: (t) =>
      page(
        t,
        `<div class="pad" style="align-items: center; justify-content: center; text-align: center;">
  <img src="${A('argo-emblem.png')}" style="width: 62pt; height: 77pt; margin-bottom: 6pt;">
  <h1 style="font-family: ${SERIF}; font-size: 44pt; color: ${CREAM};">Photoshop for Writing</h1>
  <p style="font-family: ${SANS}; font-size: 14pt; color: ${CREAM_MUTED}; margin-top: 12pt;">d/acc for how we write, speak and think</p>
  <p style="font-family: ${SANS}; font-size: 9pt; letter-spacing: 1.2pt; color: ${ACCENT_LIGHT}; margin-top: 28pt;">LIVE ON IOS AND WEB &middot; OPEN SOURCE &middot; BUILT ON BASE</p>
</div>`,
        { padStyle: '' }
      ),
  },

  {
    id: '02-stakes',
    tone: 'ink',
    html: (t) =>
      page(
        t,
        `<div class="pad" style="justify-content: center;">
  <h2 style="font-family: ${SERIF}; font-size: 38pt; line-height: 1.18; color: ${CREAM}; width: 540pt;">Your ability to think, speak, and write is about to decide everything in your life.</h2>
  <img src="${G('argo-watermark-cream-dim.png')}" style="width: 88pt; height: 53pt; margin-top: 40pt; margin-left: 506pt;">
</div>`
      ),
  },

  {
    id: '03-winston',
    tone: 'ink',
    /* The clip leads and the quote sits under it as a caption: the weapon
     * metaphor is the part the slide text does not carry, and it is the part
     * that lands. The quote stays on screen because the line gets said again
     * over it once the clip ends. */
    media: { m: WINSTON, id: 'winston-clip' },
    html: (t) =>
      page(
        t,
        `<div class="pad" style="align-items: center; justify-content: center;">
  ${videoBox(WINSTON, 'winston-clip', 'width: 384pt; height: 216pt; border-radius: 6pt;')}
  <div class="row" style="margin-top: 18pt; width: 470pt;">
    <div style="width: 2pt; background: ${GOLD}; flex-shrink: 0;"></div>
    <div style="padding-left: 14pt;">
      <p style="font-family: ${SERIF}; font-size: 13pt; line-height: 1.4; font-style: italic; color: ${CREAM};">Your success in life will be determined largely by your ability to speak, your ability to write, and the quality of your ideas. In that order.</p>
      <p style="font-family: ${SANS}; font-size: 9.5pt; color: ${CREAM_MUTED}; margin-top: 7pt;">Patrick Winston, MIT</p>
    </div>
  </div>
  <div class="row" style="align-items: flex-end; margin-top: 10pt; width: 470pt;">
    <p style="font-family: ${SANS}; font-size: 7.5pt; color: ${CREAM_MUTED}; flex: 1; text-align: left;">Patrick H. Winston, &ldquo;How to Speak&rdquo;, MIT OpenCourseWare. CC BY-NC-SA.</p>
    ${qr('qr-winston.png', 'LINK TO YOUTUBE VIDEO', 'youtu.be/vq5cH0WguOU', { size: 44 })}
  </div>
</div>`
      ),
  },

  {
    id: '04-dacc',
    tone: 'ink',
    html: (t) =>
      page(
        t,
        `<div class="pad">
  <p class="eyebrow">D/ACC, ONE YEAR LATER</p>
  <h2 class="head" style="color: ${CREAM}; width: 600pt;">Rung two is tighter and tighter feedback between AI and humans.</h2>
  <div class="row" style="margin-top: 30pt;">
    <div class="card" style="width: 186pt;">
      <p style="font-family: ${SANS}; font-size: 8pt; font-weight: bold; letter-spacing: 1.3pt; color: ${CREAM_MUTED};">TODAY</p>
      <p style="font-family: ${SANS}; font-size: 11pt; line-height: 1.45; color: ${CREAM}; margin-top: 8pt;">AI as tools, not highly autonomous agents</p>
    </div>
    <div class="slot" style="width: 186pt; margin-left: 14pt;">
      <p style="font-family: ${SANS}; font-size: 8pt; font-weight: bold; letter-spacing: 1.3pt; color: ${GOLD};">TOMORROW</p>
      <p style="font-family: ${SANS}; font-size: 11pt; line-height: 1.45; color: ${CREAM}; margin-top: 8pt;">Tighter and tighter feedback between AI and humans</p>
    </div>
    <div class="card" style="width: 186pt; margin-left: 14pt;">
      <p style="font-family: ${SANS}; font-size: 8pt; font-weight: bold; letter-spacing: 1.3pt; color: ${CREAM_MUTED};">OVER TIME</p>
      <p style="font-family: ${SANS}; font-size: 11pt; line-height: 1.45; color: ${CREAM}; margin-top: 8pt;">A tightly coupled combination of machines and us</p>
    </div>
  </div>
  <p style="font-family: ${SANS}; font-size: 12pt; line-height: 1.5; color: ${CREAM_MUTED}; margin-top: 26pt; width: 610pt;">The mechanisms he named for rung two: <span style="color: ${CREAM};">virtual reality, myoelectrics, brain computer interfaces.</span> All hardware. All years out.</p>
</div>`
      ),
  },

  {
    id: '05-gap',
    tone: 'paper',
    html: (t) =>
      page(
        t,
        `<div class="pad">
  <p class="eyebrow">THE UNCLAIMED HALF</p>
  <h2 class="head" style="color: ${TEXT}; width: 600pt;">He made the Photoshop argument about images. Nobody carried it to language.</h2>
  <div class="row" style="margin-top: 26pt;">
    <div class="card" style="width: 300pt; padding: 18pt;">
      <p style="font-family: ${SANS}; font-size: 8.5pt; font-weight: bold; letter-spacing: 1.4pt; color: ${TEXT_MUTED};">IMAGES</p>
      <p style="font-family: ${SERIF}; font-size: 16pt; line-height: 1.32; color: ${TEXT}; margin-top: 8pt;">Artist and AI trade drafts in real time. The artefact is the point.</p>
      <p style="font-family: ${SANS}; font-size: 10pt; color: ${TEXT_MUTED}; margin-top: 10pt;">Claimed. Shipping.</p>
    </div>
    <div class="slot" style="width: 300pt; margin-left: 12pt; padding: 18pt;">
      <p style="font-family: ${SANS}; font-size: 8.5pt; font-weight: bold; letter-spacing: 1.4pt; color: ${ACCENT_DEEP};">LANGUAGE</p>
      <p style="font-family: ${SERIF}; font-size: 16pt; line-height: 1.32; color: ${TEXT}; margin-top: 8pt;">The artefact is a by product. The compression of thought is the cognition.</p>
      <p style="font-family: ${SANS}; font-size: 10pt; font-weight: bold; color: ${ACCENT_DEEP}; margin-top: 10pt;">Open. This is where Argo is built.</p>
    </div>
  </div>
  <div class="row" style="margin-top: 16pt;">
    <div style="width: 2pt; background: ${ACCENT}; flex-shrink: 0;"></div>
    <div style="padding-left: 13pt;">
      <p style="font-family: ${SANS}; font-size: 7.5pt; font-weight: bold; letter-spacing: 1.2pt; color: ${ACCENT_DEEP};">CONSTRUCTIONISM &middot; SEYMOUR PAPERT, MIT, 1980</p>
      <p style="font-family: ${SERIF}; font-size: 12.5pt; line-height: 1.35; color: ${TEXT}; margin-top: 6pt;">You learn by building something public. The artefact and the understanding build each other.</p>
      <p style="font-family: ${SERIF}; font-size: 12.5pt; line-height: 1.35; color: ${ACCENT_DEEP}; margin-top: 3pt;">Argo never builds it for you. The human stays in every loop by construction &mdash; that is rung two.</p>
    </div>
  </div>
  <p style="font-family: ${SANS}; font-size: 10.5pt; line-height: 1.5; color: ${TEXT_MUTED}; margin-top: 14pt; width: 612pt;">Delegate the writing and you lose the ability to think for yourself. You lose the ability to write, to speak, and to have quality ideas.</p>
</div>`
      ),
  },

  {
    id: '06-what',
    tone: 'paper',
    html: (t) =>
      page(
        t,
        `<div class="pad">
  <div class="row" style="align-items: flex-start;">
    <div style="width: 330pt;">
      <p class="eyebrow">THE PRODUCT</p>
      <h2 class="head" style="color: ${TEXT};">A private journaling AI that never writes for you.</h2>
      <p class="sub">Write it or say it. A companion that has read every entry you have ever made reads it back: a summary, the insights, the questions to ask yourself, and the entry from eight months ago you forgot you wrote.</p>
      <p style="font-family: ${SERIF}; font-size: 17pt; font-style: italic; line-height: 1.35; color: ${TEXT}; margin-top: 22pt;">They all kept a notebook. None of them had one that remembered.</p>
    </div>
    <img src="${A('shot-home.png')}" style="width: 130pt; height: 281pt; margin-left: 24pt;">
    <img src="${A('shot-entry.png')}" style="width: 109pt; height: 236pt; margin-left: 12pt; margin-top: 45pt;">
  </div>
</div>`
      ),
  },

  {
    id: '07-film',
    tone: 'ink',
    /* Full bleed, nothing on top. The film carries its own end card, so a
     * title or a watermark here is only competing with it.
     *
     * The QR is the one exception, and it sits top right rather than bottom
     * right because the player's controls run along the bottom edge — same
     * reasoning as the web deck. It earns the intrusion by being the only
     * thing on this slide that means anything if the film does not run. */
    media: { m: FILM, id: 'launch-film' },
    html: (t) =>
      page(
        t,
        `<div style="position: relative; width: 720pt; height: 405pt;">
  ${videoBox(FILM, 'launch-film', 'width: 720pt; height: 405pt;')}
  ${qr('qr-launch-ad.png', 'WATCH THE FILM', 'youtu.be/Ppl-TfO3Oqo', {
    size: 44,
    plate: true,
    style: 'position: absolute; top: 14pt; right: 14pt;',
  })}
</div>`,
        { padStyle: '' }
      ),
  },

  {
    id: '08-demo',
    tone: 'paper',
    html: (t) =>
      page(
        t,
        `<div class="pad">
  <p class="eyebrow">LIVE ON THE DEVICE</p>
  <h2 style="font-family: ${SERIF}; font-size: 24pt; color: ${TEXT};">Three moves.</h2>
  <div class="row" style="margin-top: 16pt; justify-content: center;">
    <div style="width: 170pt; text-align: center;">
      <img src="${A('shot-record.png')}" style="width: 97pt; height: 210pt; margin-left: 36pt;">
      <p style="font-family: ${SANS}; font-size: 8pt; font-weight: bold; letter-spacing: 1.3pt; color: ${ACCENT_DEEP}; margin-top: 8pt;">ONE</p>
      <p style="font-family: ${SANS}; font-size: 9.5pt; color: ${TEXT_MUTED}; margin-top: 4pt;">Talk. It captures and transcribes.</p>
    </div>
    <div style="width: 170pt; text-align: center;">
      <img src="${A('shot-entry.png')}" style="width: 97pt; height: 210pt; margin-left: 36pt;">
      <p style="font-family: ${SANS}; font-size: 8pt; font-weight: bold; letter-spacing: 1.3pt; color: ${ACCENT_DEEP}; margin-top: 8pt;">TWO</p>
      <p style="font-family: ${SANS}; font-size: 9.5pt; color: ${TEXT_MUTED}; margin-top: 4pt;">It reads you back, and surfaces what you forgot.</p>
    </div>
    <div style="width: 170pt; text-align: center;">
      <img src="${A('shot-voice.jpeg')}" style="width: 97pt; height: 210pt; margin-left: 36pt;">
      <p style="font-family: ${SANS}; font-size: 8pt; font-weight: bold; letter-spacing: 1.3pt; color: ${ACCENT_DEEP}; margin-top: 8pt;">THREE</p>
      <p style="font-family: ${SANS}; font-size: 9.5pt; color: ${TEXT_MUTED}; margin-top: 4pt;">A thinking assistant you talk to, out loud.</p>
    </div>
  </div>
</div>`
      ),
  },

  {
    id: '09-privacy',
    tone: 'ink',
    html: (t) =>
      page(
        t,
        `<div class="pad">
  <p class="eyebrow">PRIVACY IS ARCHITECTURE, NOT POLICY</p>
  <h2 style="font-family: ${SERIF}; font-size: 32pt; color: ${CREAM};">Nobody can read it. Not even us.</h2>
  <div class="row" style="margin-top: 28pt;">
    <div class="card" style="width: 186pt; padding: 16pt;">
      <p style="font-family: ${SERIF}; font-size: 15pt; color: ${GOLD};">Zero knowledge</p>
      <p style="font-family: ${SANS}; font-size: 10pt; line-height: 1.5; color: ${CREAM_MUTED}; margin-top: 8pt;">Encrypted on your device with a key that only exists there. Our servers hold ciphertext.</p>
    </div>
    <div class="card" style="width: 186pt; margin-left: 14pt; padding: 16pt;">
      <p style="font-family: ${SERIF}; font-size: 15pt; color: ${GOLD};">Open source</p>
      <p style="font-family: ${SANS}; font-size: 10pt; line-height: 1.5; color: ${CREAM_MUTED}; margin-top: 8pt;">You do not have to take my word for any of it. You can read it.</p>
    </div>
    <div class="card" style="width: 186pt; margin-left: 14pt; padding: 16pt;">
      <p style="font-family: ${SERIF}; font-size: 15pt; color: ${GOLD};">Confidential inference</p>
      <p style="font-family: ${SANS}; font-size: 10pt; line-height: 1.5; color: ${CREAM_MUTED}; margin-top: 8pt;">The journal AI runs on Morpheus, inside a trusted execution environment.</p>
    </div>
  </div>
  <div style="border-left: 2pt solid ${ACCENT}; padding-left: 12pt; margin-top: 24pt; width: 600pt;">
    <p style="font-family: ${SANS}; font-size: 9.5pt; line-height: 1.5; color: ${CREAM_MUTED};">Voice latency currently routes through a separate provider. Moving it back is on the roadmap.</p>
  </div>
</div>`
      ),
  },

  {
    id: '10-soul',
    tone: 'ink',
    html: (t) =>
      page(
        t,
        `<div class="pad" style="justify-content: center;">
  <div class="row" style="align-items: center;">
    <div style="width: 380pt;">
      <p class="eyebrow">A CREDENTIAL YOU OWN. ON BASE.</p>
      <h2 class="head" style="color: ${CREAM};">The Soul is the ledger of the loop.</h2>
      <p class="sub">One star per completed day, placed by the meaning of your words. Soulbound on Base mainnet: it cannot be bought, sold, or transferred. Not a bolt on identity feature, the receipt for having run the loop for a year.</p>
      <p style="font-family: ${SERIF}; font-size: 16pt; font-style: italic; color: ${GOLD}; margin-top: 18pt;">Bots can fake a profile. They cannot fake a year of your thinking.</p>
    </div>
    <img src="${A('shot-constellation.png')}" style="width: 138pt; height: 299pt; margin-left: 42pt;">
  </div>
</div>`
      ),
  },

  {
    /* Numbered 10b rather than 11 so the ids after it keep matching their
     * existing filenames. Order comes from this array, not from the number.
     * Worth a renumbering pass once the ai-city slide lands here too. */
    id: '10b-papert',
    tone: 'paper',
    /* See the matching slide in src/components/demo-day/slides.tsx for why it
     * sits after the Soul rather than after the gap, and why the departure
     * from Papert is stated rather than smoothed over. */
    html: (t) =>
      page(
        t,
        `<div class="pad" style="justify-content: center;">
  <p class="eyebrow">CONSTRUCTIONISM &middot; SEYMOUR PAPERT, MIT, 1980</p>
  <h2 class="head" style="color: ${TEXT}; width: 600pt;">The training ground is private. The artefact is not.</h2>
  <p class="sub" style="width: 590pt;">Papert&rsquo;s learner built in public &mdash; the program on the screen, the robot on the table. Argo splits that in two. The construction happens somewhere nobody can read, and what leaves is the proof you ran it and the thinking you carry out with you.</p>
  <div class="row" style="margin-top: 20pt;">
${[
  ['Objects to think with', 'The Soul: a year of your own thinking, in a form you can actually look at.'],
  ['Microworlds', 'A container where the only thing that governs is your own thinking.'],
  ['Mathland', 'You learn French by living in France. This is somewhere you live to learn to think.'],
  ['Debugging, not failing', 'The AI asks. It never corrects, and it never writes the line for you.'],
  ['Hard fun', 'It refuses to do the work. That is not a limitation, it is the product.'],
]
  .map(
    ([h, body], n) => `    <div class="card" style="width: 120pt; ${n ? 'margin-left: 9pt;' : ''} padding: 12pt;">
      <p style="font-family: ${SERIF}; font-size: 13pt; line-height: 1.25; color: ${ACCENT_DEEP};">${h}</p>
      <p style="font-family: ${SANS}; font-size: 9pt; line-height: 1.5; color: ${TEXT_MUTED}; margin-top: 7pt;">${body}</p>
    </div>`
  )
  .join('\n')}
  </div>
</div>`
      ),
  },

  {
    id: '11-flywheel',
    tone: 'ink',
    html: (t) =>
      page(
        t,
        `<div class="pad" style="justify-content: center;">
  <div class="row" style="align-items: center;">
    <div style="width: 330pt;">
      <p class="eyebrow">GO TO MARKET</p>
      <h2 class="head" style="color: ${CREAM};">I built a machine that feeds the app.</h2>
      <p class="sub">You do not get momentum from one big push. You get it from pushing the same wheel in the same direction until it turns itself. Every part of my life is a spoke on it.</p>
      <p style="font-family: ${SANS}; font-size: 9.5pt; color: ${CREAM_MUTED}; margin-top: 16pt;">Jim Collins, Good to Great</p>
    </div>
    <img src="${G('flywheel.png')}" style="width: 276pt; height: 230pt; margin-left: 20pt;">
  </div>
</div>`
      ),
  },

  {
    id: '12-spokes',
    tone: 'paper',
    html: (t) => {
      const col = (img, h, body, first) => `
    <div style="width: 148pt; ${first ? '' : 'margin-left: 12pt;'}">
      <img src="${G(img)}" style="width: 148pt; height: 83pt;">
      <p style="font-family: ${SERIF}; font-size: 14pt; color: ${TEXT}; margin-top: 10pt;">${h}</p>
      <p style="font-family: ${SANS}; font-size: 9pt; line-height: 1.5; color: ${TEXT_MUTED}; margin-top: 6pt;">${body}</p>
    </div>`
      return page(
        t,
        `<div class="pad">
  <p class="eyebrow">THE FOUR SPOKES</p>
  <h2 style="font-family: ${SERIF}; font-size: 24pt; color: ${TEXT};">Every one of them ends with the app.</h2>
  <div class="row" style="margin-top: 20pt;">
${col('spoke-podcast-16x9.jpg', 'The podcast', 'Creativity, technology, spirituality. Every episode describes the app and asks the guest what they think.', true)}
${col('spoke-kids-16x9.jpg', 'The kids class', 'Holistic creativity and STEM. Draw, journal, teach each other a concept. Every family gets a subscription.')}
${col('spoke-course-16x9.jpg', 'The AI course', 'Free online fills the funnel, paid in person. Singapore, Cambodia, and on YouTube.')}
${col('spoke-community-16x9.jpg', 'The community', 'A subscription is not an app, it is a membership. And all of it becomes content.')}
  </div>
</div>`
      )
    },
  },

  {
    /* Numbered 12b for the same reason 10b is: order comes from this array, not
     * from the id, and renaming the later files would churn slides/ for nothing. */
    id: '12b-ai-city',
    tone: 'paper',
    /* Every claim here is Konrad's own and none is checked against a primary
     * source — "future Deputy Prime Minister of Malaysia" is a prediction, not
     * a title anyone holds. See the matching slide in slides.tsx. */
    html: (t) =>
      page(
        t,
        `<div class="pad">
  <p class="eyebrow">FOREST CITY, MALAYSIA</p>
  <h2 style="font-family: ${SERIF}; font-size: 24pt; color: ${TEXT};">Argo sits on the council building an AI city.</h2>
  <p style="font-family: ${SANS}; font-size: 10pt; line-height: 1.5; color: ${TEXT_MUTED}; margin-top: 10pt; width: 620pt;">Crypto natives from the global crypto community, forming an open source collective to build a network state &mdash; a United States of America 2.0. AI at the centre, healthy by default, a culture of multicultural self actualization. On the ground with a future Deputy Prime Minister of Malaysia, CC Puan, founder of Malaysia&rsquo;s first unicorn, and the chairman of Forest City.</p>
  <div class="row" style="margin-top: 14pt;">
    <img src="${G('aicity-hero-crop.jpg')}" style="width: 320pt; height: 234pt; border-radius: 6pt;">
    <div style="margin-left: 8pt;">
      <div class="row">
        <img src="${G('aicity-sketch-crop.jpg')}" style="width: 150pt; height: 113pt; border-radius: 5pt;">
        <img src="${G('aicity-puan-crop.jpg')}" style="width: 150pt; height: 113pt; border-radius: 5pt; margin-left: 8pt;">
      </div>
      <div class="row" style="margin-top: 8pt;">
        <img src="${G('aicity-chairman-crop.jpg')}" style="width: 150pt; height: 113pt; border-radius: 5pt;">
        <img src="${G('aicity-execs-crop.jpg')}" style="width: 150pt; height: 113pt; border-radius: 5pt; margin-left: 8pt;">
      </div>
    </div>
  </div>
</div>`
      ),
  },

  {
    id: '13-results',
    tone: 'ink',
    html: (t) => {
      /* Figures from the vault's demo-day-metrics.md, 2026-08-15, each read off
       * the platform's own dashboard. Views and hours are both the all-owned-
       * channels framing and say so; the Argo-only split is printed rather than
       * left for someone to ask about. Downloads, subscribers and followers are
       * deliberately not here — small absolutes in a grid read as a failed
       * claim, and they belong in the narration instead. */
      const tile = (n, k, src, first) => `
    <div class="card" style="width: 115pt; height: 132pt; ${first ? '' : 'margin-left: 9pt;'} border-top: 2.5pt solid ${ACCENT}; padding: 11pt; display: flex; flex-direction: column; justify-content: center;">
      <p style="font-family: ${SERIF}; font-size: 26pt; color: ${ACCENT}; text-align: center;">${n}</p>
      <p style="font-family: ${SANS}; font-size: 9pt; font-weight: bold; color: ${CREAM}; text-align: center; margin-top: 7pt; line-height: 1.35;">${k}</p>
      <p style="font-family: ${SANS}; font-size: 7pt; color: ${CREAM_MUTED}; text-align: center; margin-top: 6pt; line-height: 1.45;">${src}</p>
    </div>`
      return page(
        t,
        `<div class="pad" style="justify-content: center;">
  <p class="eyebrow">IS IT TURNING</p>
  <h2 class="head" style="color: ${CREAM};">What nine months of the flywheel produced.</h2>
  <div class="row" style="margin-top: 24pt;">
${tile('21,898', 'Views across the channels', '5,793 of them on Argo&rsquo;s own, from zero in 9 months', true)}
${tile('517', 'Hours actually watched', 'Not impressions. Time people chose to spend.')}
${tile('91%', 'Of the launch film watched', '0:31 of 0:34, at an 80% click-through rate')}
${tile('75', 'Events hosted', '186 people in the Argo community')}
${/* Not Argo's money and not a raise: the capital already in the ground at
    Forest City, where the AI city collective works. See the vault's
    demo-day-metrics.md — the figure is unverified against a primary source. */ ''}
${tile('$100B', 'Invested in Forest City', 'USD, in the project we are coordinating with to bring the AI city there.')}
  </div>
  <p style="font-family: ${SANS}; font-size: 9.5pt; color: ${CREAM_MUTED}; margin-top: 20pt;">Nine months of output, five owned channels, 75 events. The app is eight days old.</p>
</div>`
      )
    },
  },

  {
    id: '14-testimonials',
    tone: 'paper',
    html: (t) => {
      /* From the recordings, transcribed in the vault's
       * interview-testimonials.md, trimmed for spoken disfluency and for length.
       * Timestamps stay on the card so each one can be checked against tape.
       *
       * The credential line under each name is the guest's own claim, supplied
       * by Konrad and not checked against a primary source. The episode still
       * above the quote is the YouTube thumbnail, cropped 16:9 in prepare(). */
      const card = (img, q, who, cred, note, first) => `
    <div class="card" style="width: 200pt; height: 275pt; ${first ? '' : 'margin-left: 18pt;'} border-top: 2.5pt solid ${ACCENT}; padding: 0; overflow: hidden;">
      <img src="${G(img)}" style="width: 200pt; height: 112pt;">
      <div style="padding: 12pt 14pt 14pt;">
        <p style="font-family: ${SERIF}; font-size: 9.5pt; font-style: italic; line-height: 1.38; color: ${TEXT};">&ldquo;${q}&rdquo;</p>
        <p style="font-family: ${SANS}; font-size: 9.5pt; font-weight: bold; color: ${TEXT}; margin-top: 9pt;">${who}</p>
        <p style="font-family: ${SANS}; font-size: 7pt; line-height: 1.35; color: ${TEXT_MUTED}; margin-top: 3pt;">${cred}</p>
        <p style="font-family: ${SANS}; font-size: 7pt; color: ${ACCENT_DEEP}; margin-top: 4pt;">${note}</p>
      </div>
    </div>`
      return page(
        t,
        `<div class="pad">
  <p class="eyebrow">ON THE RECORD</p>
  ${/* 21pt, not the 24pt the other paper slides use: Georgia is wider than the
      web deck's Newsreader, and at 24pt this headline takes a second line and
      pushes the timestamp off the bottom of the first two cards. */ ''}
  <h2 style="font-family: ${SERIF}; font-size: 21pt; color: ${TEXT};">Every episode is a channel and a testimonial at once.</h2>
  <div class="row" style="margin-top: 18pt;">
${card('testimonial-johnston-16x9.jpg', 'A good use case for privacy preserving AI. People want to talk through their most personal thoughts. It&rsquo;s not something you want to publish with Claude or OpenAI.', 'David Johnston', 'Coined &ldquo;decentralized applications&rdquo; and &ldquo;smart agents&rdquo;. Bitcoin pioneer and investor.', 'Argo Podcast &middot; 34:23', true)}
${card('testimonial-chong-16x9.jpg', 'It is not just about what you experienced throughout the day. It is also about how you felt. Many people just observe. They don&rsquo;t realize how they feel, and then they don&rsquo;t know what they want.', 'Chong Ing Kai', 'Founder of Stickem. Asia 30 Under 30. Won the US$1M Hult Prize global final, London, 2025.', 'Argo Podcast &middot; 38:29')}
${card('testimonial-im-16x9.jpg', 'Journal apps help you keep track of your thoughts, get the raw data that you can then refashion into some shareable information.', 'Daniel Im', 'Student of Geoffrey Hinton, the godfather of AI. Building Belief Market.', 'Argo Podcast &middot; 52:07')}
  </div>
</div>`
      )
    },
  },

  {
    id: '15-back-to-thesis',
    tone: 'ink',
    html: (t) =>
      page(
        t,
        `<div class="pad" style="justify-content: center;">
  <p class="eyebrow">WHY IT IS BUILT THIS WAY</p>
  <div style="border-left: 2pt solid ${GOLD}; padding-left: 16pt; width: 590pt;">
    <p style="font-family: ${SERIF}; font-size: 19pt; font-style: italic; line-height: 1.38; color: ${CREAM};">By involving human feedback at each step of decision-making, we reduce the incentive to offload high-level planning responsibility to the AI itself.</p>
    <p style="font-family: ${SANS}; font-size: 10pt; color: ${CREAM_MUTED}; margin-top: 12pt;">Vitalik Buterin, My Techno-Optimism</p>
  </div>
  <p style="font-family: ${SERIF}; font-size: 20pt; line-height: 1.35; color: ${CREAM}; margin-top: 30pt; width: 600pt;">An AI that never writes for you keeps the human in every loop by construction, so the incentive never forms. This is the loop, shipping today.</p>
</div>`
      ),
  },

  {
    id: '16-close',
    tone: 'ink',
    html: (t) =>
      page(
        t,
        `<div class="pad" style="align-items: center; justify-content: center; text-align: center;">
  <img src="${A('argo-emblem.png')}" style="width: 42pt; height: 52pt;">
  <p style="font-family: ${SERIF}; font-size: 22pt; line-height: 1.3; color: ${CREAM}; width: 520pt; margin-top: 8pt;">Not a prototype, not a roadmap. You can use it tonight.</p>
  <p style="font-family: ${SANS}; font-size: 8.5pt; letter-spacing: 1.2pt; color: ${ACCENT_LIGHT}; margin-top: 12pt;">LIVE ON IOS AND WEB &middot; OPEN SOURCE &middot; BUILT ON BASE &middot; DEVCON MUMBAI</p>
  <p style="font-family: ${SANS}; font-size: 8.5pt; font-weight: bold; letter-spacing: 1.6pt; color: ${ACCENT_LIGHT}; margin-top: 22pt;">THE ASK</p>
  <div class="row" style="margin-top: 10pt;">
${['Download the app', 'Join the community', 'Subscribe to the podcast', 'Subscribe to the AI courses']
  .map(
    (ask, n) => `    <div class="card" style="width: 140pt; height: 66pt; ${n ? 'margin-left: 9pt;' : ''} border-top: 2.5pt solid ${ACCENT}; padding: 10pt;">
      <p style="font-family: ${SANS}; font-size: 8.5pt; font-weight: bold; color: ${ACCENT};">${n + 1}</p>
      <p style="font-family: ${SERIF}; font-size: 12pt; line-height: 1.3; color: ${CREAM}; margin-top: 5pt;">${ask}</p>
    </div>`
  )
  .join('\n')}
  </div>
  ${qr('qr-argo.png', 'START HERE', 'myargoquest.com', { size: 46, style: 'margin-top: 12pt;' })}
</div>`
      ),
  },
]

async function main() {
  await prepare()

  const pptx = new pptxgen()
  pptx.layout = 'LAYOUT_16x9'
  pptx.author = 'Konrad Gnat'
  pptx.title = 'Argo, Final Demo Day'
  pptx.subject = 'Photoshop for Writing: d/acc for how we write, speak and think'

  /* No addNotes anywhere. The deck ships without a speaker script on purpose;
   * Konrad's lives in the vault, outside this repo. */
  for (const s of SLIDES) {
    const file = write(s.id, s.html(s.tone))
    const { slide, placeholders } = await html2pptx(file, pptx, { tmpDir: __dirname })

    if (s.media) {
      const m = s.media.m
      const at = placeholders.find((p) => p.id === s.media.id)
      if (m.has || m.youtube) {
        if (!at) throw new Error(`${s.id}: no placeholder "${s.media.id}" came back from html2pptx`)
        const rect = { x: at.x, y: at.y, w: at.w, h: at.h }
        if (m.has) {
          slide.addMedia({ type: 'video', path: m.path, cover: m.cover(), ...rect })
        } else {
          console.warn(` ! ${s.id}: ${path.basename(m.path)} not found, linking YouTube instead (needs network on the day)`)
          slide.addMedia({ type: 'online', link: m.youtube, cover: m.cover(), ...rect })
        }
      } else {
        console.warn(` ! ${s.id}: no video and no YouTube link, poster still only`)
      }
    }
  }

  await pptx.writeFile({ fileName: OUT })
  const mb = (fs.statSync(OUT).size / 1e6).toFixed(1)
  console.log(`wrote ${OUT} (${SLIDES.length} slides, ${mb} MB)`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
