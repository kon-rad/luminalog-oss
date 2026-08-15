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

/* ── the sixteen slides ─────────────────────────────────────────────────── */

const SLIDES = [
  {
    id: '01-title',
    tone: 'ink',
    notes:
      'My name is Konrad, this is Argo, and the title of this talk is the same one I am taking to Devcon in Mumbai. Photoshop for writing.',
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
    notes:
      'For most of history you could get by on what you knew. That era is closing. When everyone has the same models and the same answers on tap, the only differences left are the quality of your ideas and your ability to express them. That is not a soft skill any more, that is the whole game, and almost nobody is training for it.',
    html: (t) =>
      page(
        t,
        `<div class="pad" style="justify-content: center;">
  <h2 style="font-family: ${SERIF}; font-size: 38pt; line-height: 1.18; color: ${CREAM}; width: 540pt;">Your ability to think, speak, and write is about to decide everything.</h2>
  <img src="${G('argo-watermark-cream-dim.png')}" style="width: 88pt; height: 53pt; margin-top: 40pt; margin-left: 506pt;">
</div>`
      ),
  },

  {
    id: '03-winston',
    tone: 'ink',
    todo: 'Winston clip trimmed to 0:38-0:53 and level matched.',
    notes:
      'Play the fifteen second clip, then: Winston ran the MIT Artificial Intelligence Laboratory. He spent his life on machine intelligence and this is what he told his students mattered most. Speak, write, ideas, in that order. In the age of AI he is more right, because those three are the only things that do not come out of the box.',
    html: (t) =>
      page(
        t,
        `<div class="pad" style="justify-content: center;">
  <div class="row" style="align-items: center;">
    <div style="width: 370pt; border-left: 2pt solid ${GOLD}; padding-left: 16pt;">
      <p style="font-family: ${SERIF}; font-size: 19pt; line-height: 1.36; font-style: italic; color: ${CREAM};">Your success in life will be determined largely by your ability to speak, your ability to write, and the quality of your ideas. In that order.</p>
      <p style="font-family: ${SANS}; font-size: 11pt; color: ${CREAM_MUTED}; margin-top: 14pt;">Patrick Winston, MIT</p>
    </div>
    <div class="slot" style="width: 210pt; height: 150pt; margin-left: 26pt; display: flex; flex-direction: column; justify-content: center;">
      <p class="slotText" style="font-size: 16pt;">&#9654;</p>
      <p class="slotText" style="margin-top: 8pt;">Winston clip, 15 seconds</p>
      <p class="slotSmall">assets/winston-how-to-speak-first60.mp4<br>trimmed 0:38 to 0:53</p>
    </div>
  </div>
  <p style="font-family: ${SANS}; font-size: 7.5pt; color: ${CREAM_MUTED}; margin-top: 34pt;">Patrick H. Winston, &ldquo;How to Speak&rdquo;, MIT OpenCourseWare. CC BY-NC-SA.</p>
</div>`
      ),
  },

  {
    id: '04-dacc',
    tone: 'ink',
    notes:
      'This is the middle rung of d/acc. The variable being optimised is not model capability, it is loop tightness. Same model, different number of turns. One shot prompt and generate is the replacement pattern. Real time collaboration is the augmentation pattern. Look at the mechanisms he named. All hardware, all years out, all measured in milliseconds of latency.',
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
    notes:
      'He made the Photoshop argument about images and never carried it to language. That is the gap I am building in. A daily writing loop is a feedback loop between a human and an AI that exists now, needs no implant, and runs on the interfaces everybody already has, text and voice. And language is the harder case, because with an image the artefact is the point, while with writing the artefact is a by product. The compression of thought is the cognition. Delegate the drawing and you lose a picture you did not make. Delegate the writing and you skip the step that was doing the thinking.',
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
  <p style="font-family: ${SANS}; font-size: 11pt; line-height: 1.5; color: ${TEXT_MUTED}; margin-top: 22pt; width: 612pt;">Delegate the drawing and you lose a picture you did not make. Delegate the writing and you skip the step that was doing the thinking.</p>
</div>`
      ),
  },

  {
    id: '06-what',
    tone: 'paper',
    notes:
      'You write or you just talk, and an AI companion that has read every entry you have ever made reads it back to you. A summary, the insights, the questions you should be asking yourself, and the connection to the thing you wrote eight months ago and forgot. They all kept a notebook. None of them had one that remembered.',
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
    todo: 'The 30 second launch film. Scripted in launch-ad/, not yet shot or cut.',
    notes: 'Say nothing during the film. After it, one line: that launched on August 7th.',
    html: (t) =>
      page(
        t,
        `<div class="pad" style="justify-content: center; align-items: center;">
  <div class="slot" style="width: 620pt; height: 320pt; display: flex; flex-direction: column; justify-content: center;">
    <p class="slotText" style="font-size: 24pt; color: ${GOLD};">&#9654;</p>
    <p style="font-family: ${SERIF}; font-size: 16pt; color: ${CREAM}; text-align: center; margin-top: 12pt;">Launch film, 30 seconds, full bleed, sound up</p>
    <p class="slotSmall" style="margin-top: 12pt;">Placeholder. The ten thirty-second spots are scripted and storyboarded in final-demo-day/launch-ad/, but no cut film exists yet.</p>
  </div>
</div>`
      ),
  },

  {
    id: '08-demo',
    tone: 'paper',
    todo: 'Live device mirror. These stills are the fallback if the phone fails.',
    notes:
      'Three moves only, narrated while doing them. One, I talk, no blank page and no typing, and the word count climbs to seven hundred and fifty. Two, it comes back with what I actually said, tightened, plus the questions I should be asking myself, and it surfaces an entry from months ago on the same theme that I had genuinely forgotten writing. Three, every completed day adds a star, placed by the meaning of my words. That is my Soul.',
    html: (t) =>
      page(
        t,
        `<div class="pad">
  <p class="eyebrow">LIVE ON THE DEVICE</p>
  <h2 style="font-family: ${SERIF}; font-size: 24pt; color: ${TEXT};">Three moves. No menus.</h2>
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
      <img src="${A('shot-constellation.png')}" style="width: 97pt; height: 210pt; margin-left: 36pt;">
      <p style="font-family: ${SANS}; font-size: 8pt; font-weight: bold; letter-spacing: 1.3pt; color: ${ACCENT_DEEP}; margin-top: 8pt;">THREE</p>
      <p style="font-family: ${SANS}; font-size: 9.5pt; color: ${TEXT_MUTED}; margin-top: 4pt;">The day becomes a star in your Soul.</p>
    </div>
  </div>
</div>`
      ),
  },

  {
    id: '09-privacy',
    tone: 'ink',
    notes:
      'You are about to put the most honest thing you have ever written into an app, so the privacy cannot be a policy, it has to be architecture. Encrypted on your device with a key that only exists on your device. Our servers hold ciphertext. The whole thing is open source so you can read it rather than trust me. The journal AI runs confidential inference on Morpheus. Voice latency currently routes through a separate provider and moving it back is on the roadmap, and I would rather say that here than be asked it later.',
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
    <p style="font-family: ${SANS}; font-size: 9.5pt; line-height: 1.5; color: ${CREAM_MUTED};">Stated plainly on stage: voice latency currently routes through a separate provider. Moving it back is on the roadmap. Do not extend the confidential inference claim to voice.</p>
  </div>
</div>`
      ),
  },

  {
    id: '10-soul',
    tone: 'ink',
    notes:
      'Every day you complete the human side of the loop, one star records it. It is soulbound on Base mainnet, so it cannot be bought, sold, or transferred. That makes it the thing the internet is short of right now, proof of a human who actually showed up over time. It is not a bolt on identity feature. It is the receipt for having run the d/acc loop for a year. Bots can fake a profile. They cannot fake a year of your thinking.',
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
    id: '11-flywheel',
    tone: 'ink',
    notes:
      'Here is the part I actually want to be judged on. Jim Collins wrote about the flywheel in Good to Great. You do not get momentum from one big push, you get it from pushing the same wheel in the same direction until it turns itself. I am not buying users. I built a flywheel and every part of my life is a spoke on it.',
    html: (t) =>
      page(
        t,
        `<div class="pad" style="justify-content: center;">
  <div class="row" style="align-items: center;">
    <div style="width: 330pt;">
      <p class="eyebrow">GO TO MARKET</p>
      <h2 class="head" style="color: ${CREAM};">I am not buying users. I built a machine that feeds the app.</h2>
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
    notes:
      'One, the podcast, on creativity, technology, and spirituality, and in every single episode I describe the app and ask the guest what they think of it. Two, a holistic creativity and STEM class for kids where we draw, journal, and teach each other a concept, and every family in the class gets a subscription. Three, an AI power users course for adults, free online to fill the funnel and paid in person, run in Singapore and now Cambodia, where people who just spent two hours learning to work with AI are exactly the people who understand why a private one matters. Four, the community, because a subscription is not an app, it is a membership. And all four turn into content, which feeds all four again.',
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
${col('spoke-course-16x9.jpg', 'The AI course', 'Free online fills the funnel, paid in person. Singapore, and now Cambodia.')}
${col('spoke-community-16x9.jpg', 'The community', 'A subscription is not an app, it is a membership. And all of it becomes content.')}
  </div>
</div>`
      )
    },
  },

  {
    id: '13-results',
    tone: 'ink',
    todo: 'Every figure on this slide. Pull from the platform dashboards and App Store Connect.',
    notes:
      'So is it turning. Read the five numbers off the slide, one sentence each, and say only what you can defend in question time. Every one of these came from the wheel and not from ad spend.',
    html: (t) => {
      const tile = (k, src, first) => `
    <div class="slot" style="width: 115pt; height: 130pt; ${first ? '' : 'margin-left: 10pt;'} display: flex; flex-direction: column; justify-content: center;">
      <p style="font-family: ${SERIF}; font-size: 30pt; color: ${ACCENT}; text-align: center;">&mdash;</p>
      <p style="font-family: ${SANS}; font-size: 9.5pt; font-weight: bold; color: ${CREAM}; text-align: center; margin-top: 8pt; line-height: 1.35;">${k}</p>
      <p class="slotSmall" style="margin-top: 6pt;">${src}</p>
    </div>`
      return page(
        t,
        `<div class="pad" style="justify-content: center;">
  <p class="eyebrow">IS IT TURNING</p>
  <h2 class="head" style="color: ${CREAM};">The numbers, and none of them bought.</h2>
  <div class="row" style="margin-top: 26pt;">
${tile('Views across channels', 'platform dashboards', true)}
${tile('App downloads since 7 Aug', 'App Store Connect')}
${tile('Views on the launch ad', 'per platform')}
${tile('Community events hosted', '3 at MyBW, confirm full count')}
${tile('Paying subscribers', 'confirm current figure')}
  </div>
  <p style="font-family: ${SANS}; font-size: 10pt; color: ${CREAM_MUTED}; margin-top: 22pt;">Placeholders on purpose. Say only what you can defend in Q and A.</p>
</div>`
      )
    },
  },

  {
    id: '14-testimonials',
    tone: 'paper',
    todo: 'Verbatim quotes, guest names and exact titles, and permission to show them.',
    notes:
      'These are on the record. One guest called it training for keeping your mind sharp. Another said private AI you can actually trust is the thing they had been waiting for. The parents keep telling me the same thing, which is that their kids love it. Every episode is a distribution channel and a testimonial at the same time.',
    html: (t) => {
      const card = (q, who, note, empty, first) => `
    <div class="${empty ? 'slot' : 'card'}" style="width: 148pt; height: 178pt; ${first ? '' : 'margin-left: 12pt;'} padding: 14pt;">
      <p style="font-family: ${SERIF}; font-size: 13pt; font-style: italic; line-height: 1.36; color: ${TEXT};">${q}</p>
      <p style="font-family: ${SANS}; font-size: 9.5pt; font-weight: bold; color: ${TEXT}; margin-top: 14pt;">${who}</p>
      <p style="font-family: ${SANS}; font-size: 7.5pt; line-height: 1.4; color: ${ACCENT_DEEP}; margin-top: 5pt;">${note}</p>
    </div>`
      return page(
        t,
        `<div class="pad">
  <p class="eyebrow">ON THE RECORD</p>
  <h2 style="font-family: ${SERIF}; font-size: 24pt; color: ${TEXT};">Every episode is a channel and a testimonial at once.</h2>
  <div class="row" style="margin-top: 20pt;">
${card('&ldquo;Training for keeping your mind sharp.&rdquo;', 'Podcast guest', 'Paraphrase. Pull the verbatim line from the recording.', false, true)}
${card('&ldquo;Private AI you can actually trust is the thing I have been waiting for.&rdquo;', 'Podcast guest', 'Paraphrase. Confirm name, title, and permission.', false)}
${card('&ldquo;My kid loves it.&rdquo;', 'Parent, kids class', 'Reported repeatedly. Get one on the record in writing.', false)}
${card('Quote to collect', 'AI course student', 'Not yet collected. Ask at the end of the next in person class.', true)}
  </div>
</div>`
      )
    },
  },

  {
    id: '15-back-to-thesis',
    tone: 'ink',
    notes:
      'Vitalik argues the augmentation path is not just the nicer option, it is the safer one, and the mechanism is economic rather than technical. Keeping a human in every loop removes the incentive to hand over the planning. An AI that never writes for you keeps you in every loop by construction, so that incentive never forms. That is the whole argument, and it is why the app is built the way it is.',
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
    todo: 'THE ASK. One specific sentence. The single most important missing line in the deck.',
    notes:
      'Argo is live on iOS, there is a web portal, it is open source, the encryption is real, the journal AI is confidential, and the Soul is on Base mainnet today. Not a prototype. You can use it tonight. The reason I am confident is not the app, it is that I built a machine that feeds it and it is already turning. Then the ask, as one specific sentence, then stop talking.',
    html: (t) =>
      page(
        t,
        `<div class="pad" style="align-items: center; justify-content: center; text-align: center;">
  <img src="${A('argo-emblem.png')}" style="width: 54pt; height: 67pt;">
  <p style="font-family: ${SERIF}; font-size: 24pt; line-height: 1.3; color: ${CREAM}; width: 520pt; margin-top: 10pt;">Not a prototype, not a roadmap. You can use it tonight.</p>
  <p style="font-family: ${SANS}; font-size: 9pt; letter-spacing: 1.2pt; color: ${ACCENT_LIGHT}; margin-top: 16pt;">LIVE ON IOS AND WEB &middot; OPEN SOURCE &middot; BUILT ON BASE &middot; DEVCON MUMBAI</p>
  <div class="slot" style="width: 420pt; margin-top: 26pt;">
    <p class="slotText">THE ASK</p>
    <p class="slotSmall">One specific sentence. The raise and what it buys, the introductions you want, or the pilot you want run.</p>
  </div>
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

  for (const s of SLIDES) {
    const file = write(s.id, s.html(s.tone))
    const { slide } = await html2pptx(file, pptx, { tmpDir: __dirname })
    const notes = s.todo ? `${s.notes}\n\nSTILL MISSING: ${s.todo}` : s.notes
    slide.addNotes(notes)
  }

  await pptx.writeFile({ fileName: OUT })
  console.log(`wrote ${OUT} (${SLIDES.length} slides)`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
