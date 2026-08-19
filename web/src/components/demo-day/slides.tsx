import type { CSSProperties, ReactNode } from 'react'
import Flywheel from './Flywheel'
import { C, SANS, SERIF, STAGE_H, STAGE_W } from './theme'

/* ──────────────────────────────────────────────────────────────────────────
 * The eighteen slides of the final demo day deck.
 *
 * Source of truth for the narrative:
 *   secondbrain/Areas/argo/protocol-camp/final-demo-day/
 *     final-brainstorming.md   (this deck)
 *     final-demo-day/script-1.md  (beat timings and claims guardrails)
 *
 * Every slide now carries real content: no amber placeholder slots, and no
 * production notes to himself rendered as slide copy. Figures come from
 * demo-day-metrics.md and quotes from interview-testimonials.md, both in the
 * vault beside the script. Nothing here is invented to fill a space — if a
 * number is not defensible in question time it is said out loud instead of put
 * on a tile. `todo` still marks the two slides with work outstanding, but that
 * shows only in the overview grid, never on the slide.
 * ────────────────────────────────────────────────────────────────────────── */

export type Slide = {
  id: string
  /* Short name for the overview grid and the progress rail. */
  label: string
  /* Ink slides are the spine (stakes, thesis, close); paper slides carry detail. */
  tone: 'ink' | 'paper'
  body: ReactNode
  /* Set when the slide still contains a placeholder that must be filled. */
  todo?: string
}

/* ── primitives ─────────────────────────────────────────────────────────── */

function Frame({
  tone,
  children,
  style,
}: {
  tone: 'ink' | 'paper'
  children: ReactNode
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        width: STAGE_W,
        height: STAGE_H,
        background: tone === 'ink' ? C.ink : C.paper,
        color: tone === 'ink' ? C.cream : C.text,
        padding: '68px 88px',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  )
}

function Eyebrow({ children, tone = 'ink' }: { children: ReactNode; tone?: 'ink' | 'paper' }) {
  return (
    <p
      style={{
        fontFamily: SANS,
        fontSize: 15,
        fontWeight: 700,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: tone === 'ink' ? C.accentLight : C.accentDeep,
        marginBottom: 22,
      }}
    >
      {children}
    </p>
  )
}

function Headline({ children, size = 62 }: { children: ReactNode; size?: number }) {
  return (
    <h2 style={{ fontFamily: SERIF, fontSize: size, lineHeight: 1.1, fontWeight: 500, letterSpacing: '-0.015em' }}>
      {children}
    </h2>
  )
}

function Sub({ children, tone = 'ink' }: { children: ReactNode; tone?: 'ink' | 'paper' }) {
  return (
    <p
      style={{
        fontFamily: SANS,
        fontSize: 24,
        lineHeight: 1.5,
        color: tone === 'ink' ? C.creamMuted : C.textMuted,
        maxWidth: 900,
        marginTop: 26,
      }}
    >
      {children}
    </p>
  )
}

function Shot({ src, alt, h = 470 }: { src: string; alt: string; h?: number }) {
  /* eslint-disable-next-line @next/next/no-img-element -- fixed-size deck art, no layout shift to guard against */
  return <img src={src} alt={alt} style={{ height: h, width: 'auto', borderRadius: 22, boxShadow: '0 18px 50px rgba(0,0,0,0.35)' }} />
}

function Photo({ src, alt, style }: { src: string; alt: string; style?: CSSProperties }) {
  /* eslint-disable-next-line @next/next/no-img-element -- as above */
  return <img src={src} alt={alt} style={{ width: '100%', height: '100%', objectFit: 'cover', ...style }} />
}

function Watermark({ tone }: { tone: 'ink' | 'paper' }) {
  /* eslint-disable-next-line @next/next/no-img-element -- decorative */
  return (
    <img
      src={tone === 'ink' ? '/demo-day/argo-watermark-cream.png' : '/demo-day/argo-watermark-ink-alpha.png'}
      alt=""
      style={{ position: 'absolute', right: 54, bottom: 40, width: 132, opacity: tone === 'ink' ? 0.3 : 0.22 }}
    />
  )
}

function Rule({ tone }: { tone: 'ink' | 'paper' }) {
  return <div style={{ height: 1, background: tone === 'ink' ? C.hairInk : C.hairPaper, margin: '30px 0' }} />
}

/* A clip on a slide. Click to play, deliberately — nothing on this deck starts
 * on its own, so arriving on a slide early never puts sound in the room.
 *
 * Stopping on exit is free: Deck renders only the active slide's body, so
 * navigating away unmounts the element and the audio goes with it. The key is
 * what guarantees that — without it React may keep a <video> alive across two
 * slides that happen to have the same shape, and the sound follows you.
 *
 * preload="metadata" is load-bearing rather than tidy: the overview grid mounts
 * all eighteen bodies at once, so preload="auto" would pull every clip in the
 * deck the moment you press G.
 *
 * The z-index is what makes the controls clickable at all. Deck lays two
 * invisible click-to-advance buttons over the whole stage, after the slide body
 * in the DOM, so without this a click on play just moved the deck on. Frame is
 * position:relative with z-index auto and so creates no stacking context, which
 * means lifting the video here is enough to put it above them. Clicking a video
 * therefore no longer advances the deck — use the arrows or Next, which is the
 * right trade when the alternative is a film you cannot start. */
function Video({ src, poster, style }: { src: string; poster: string; style?: CSSProperties }) {
  return (
    <video
      key={src}
      src={src}
      poster={poster}
      controls
      playsInline
      preload="metadata"
      style={{ display: 'block', background: '#000', position: 'relative', zIndex: 1, ...style }}
    />
  )
}

/* A QR code and the address it goes to, side by side.
 *
 * On the two film slides this is failure insurance. Both clips are embedded as
 * local mp4 and neither needs a network, but a projector that will not play
 * video is an ordinary way for a demo day to go wrong, and a code on the slide
 * turns two dead minutes into "scan this, I will talk over it". On the close it
 * is the ask itself.
 *
 * The address is printed next to the code rather than left implicit. Half a room
 * will not raise a phone for a QR, the back row cannot resolve one anyway, and
 * `myargoquest.com` is short enough to remember on the walk out.
 *
 * The PNGs carry their own cream quiet zone, so the image needs no padding of
 * its own — see scripts/demo-day-qr/build.js, which writes them. `plate` backs
 * the pair in ink for the one place it sits over moving video. */
function Qr({
  src,
  caption,
  url,
  size = 96,
  tone = 'ink',
  plate = false,
  style,
}: {
  src: string
  caption: string
  url: string
  size?: number
  tone?: 'ink' | 'paper'
  plate?: boolean
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        ...(plate
          ? {
              padding: '12px 18px 12px 12px',
              borderRadius: 14,
              background: 'rgba(11,9,6,0.82)',
              border: `1px solid ${C.hairInk}`,
            }
          : null),
        ...style,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- fixed-size deck art */}
      <img src={src} alt={`QR code for ${url}`} style={{ width: size, height: size, borderRadius: 8, display: 'block' }} />
      <div style={{ textAlign: 'left' }}>
        <p
          style={{
            fontFamily: SANS,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: tone === 'ink' ? C.accentLight : C.accentDeep,
          }}
        >
          {caption}
        </p>
        <p style={{ fontFamily: SANS, fontSize: 15, color: tone === 'ink' ? C.cream : C.text, marginTop: 5 }}>{url}</p>
      </div>
    </div>
  )
}

/* ── the deck ───────────────────────────────────────────────────────────── */

export const SLIDES: Slide[] = [
  {
    id: 'title',
    label: 'Title',
    tone: 'ink',
    body: (
      <Frame tone="ink" style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- deck art */}
        <img src="/demo-day/argo-emblem.png" alt="Argo" style={{ width: 150, marginBottom: 18 }} />
        <h1 style={{ fontFamily: SERIF, fontSize: 96, fontWeight: 500, letterSpacing: '-0.02em' }}>
          Photoshop for Writing
        </h1>
        <p style={{ fontFamily: SANS, fontSize: 26, color: C.creamMuted, marginTop: 22 }}>
          d/acc for how we write, speak and think
        </p>
        <p
          style={{
            fontFamily: SANS,
            fontSize: 16,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: C.accentLight,
            marginTop: 54,
          }}
        >
          Live on iOS and web · Open source · Built on Base
        </p>
      </Frame>
    ),
  },

  {
    id: 'stakes',
    label: 'The stakes',
    tone: 'ink',
    body: (
      <Frame tone="ink" style={{ justifyContent: 'center' }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 78, lineHeight: 1.14, fontWeight: 500, maxWidth: 1000 }}>
          Your ability to think, speak, and write is about to decide everything in your life.
        </h2>
        <Watermark tone="ink" />
      </Frame>
    ),
  },

  {
    id: 'winston',
    label: 'Winston',
    tone: 'ink',
    /* The clip carries the weapon metaphor, which the slide text does not, so
     * the video leads and the quote sits under it as a caption. It stays on
     * screen because the line gets said again over it once the clip ends. */
    body: (
      <Frame tone="ink" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <Video
          src="/demo-day/clip-winston-weapon.mp4"
          poster="/demo-day/clip-winston-weapon-poster.jpg"
          style={{ width: 720, height: 405, borderRadius: 14, boxShadow: '0 18px 50px rgba(0,0,0,0.45)' }}
        />
        <div style={{ display: 'flex', marginTop: 34, maxWidth: 860 }}>
          <div style={{ width: 3, background: C.gold, flexShrink: 0 }} />
          <div style={{ paddingLeft: 24 }}>
            <blockquote style={{ fontFamily: SERIF, fontSize: 26, lineHeight: 1.4, fontStyle: 'italic' }}>
              Your success in life will be determined largely by your ability to speak, your ability to write, and the
              quality of your ideas. In that order.
            </blockquote>
            <p style={{ fontFamily: SANS, fontSize: 17, color: C.creamMuted, marginTop: 12 }}>Patrick Winston, MIT</p>
          </div>
        </div>
        <p style={{ fontFamily: SANS, fontSize: 13, color: C.creamMuted, position: 'absolute', left: 88, bottom: 30 }}>
          Patrick H. Winston, &ldquo;How to Speak&rdquo;, MIT OpenCourseWare. CC BY-NC-SA.
        </p>
        <Qr
          src="/demo-day/qr-winston.png"
          caption="Link to YouTube video"
          url="youtu.be/vq5cH0WguOU"
          size={88}
          style={{ position: 'absolute', right: 80, bottom: 26 }}
        />
      </Frame>
    ),
  },

  {
    id: 'dacc',
    label: 'The thesis',
    tone: 'ink',
    body: (
      <Frame tone="ink">
        <Eyebrow>d/acc, one year later</Eyebrow>
        <Headline size={52}>Rung two is tighter and tighter feedback between AI and humans.</Headline>
        <Rule tone="ink" />
        <div style={{ display: 'flex', gap: 22, marginTop: 10 }}>
          {[
            { n: 'Today', t: 'AI as tools, not highly autonomous agents' },
            { n: 'Tomorrow', t: 'Tighter and tighter feedback between AI and humans' },
            { n: 'Over time', t: 'A tightly coupled combination of machines and us' },
          ].map((r, i) => (
            <div
              key={r.n}
              style={{
                flex: 1,
                background: i === 1 ? 'rgba(245,200,66,0.10)' : C.inkElev,
                border: `1px solid ${i === 1 ? C.gold : C.hairInk}`,
                borderRadius: 18,
                padding: '24px 26px',
              }}
            >
              <p
                style={{
                  fontFamily: SANS,
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                  color: i === 1 ? C.gold : C.creamMuted,
                  marginBottom: 12,
                }}
              >
                {r.n}
              </p>
              <p style={{ fontFamily: SANS, fontSize: 20, lineHeight: 1.42 }}>{r.t}</p>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: SANS, fontSize: 22, color: C.creamMuted, marginTop: 34 }}>
          The mechanisms he named for rung two:{' '}
          <span style={{ color: C.cream }}>virtual reality, myoelectrics, brain computer interfaces.</span> All
          hardware. All years out.
        </p>
      </Frame>
    ),
  },

  {
    id: 'gap',
    label: 'The gap',
    tone: 'paper',
    body: (
      <Frame tone="paper">
        <Eyebrow tone="paper">The unclaimed half</Eyebrow>
        <Headline size={44}>He made the Photoshop argument about images. Nobody carried it to language.</Headline>
        <div style={{ display: 'flex', gap: 26, marginTop: 30 }}>
          <div
            style={{
              flex: 1,
              background: C.paperElev,
              border: `1px solid ${C.hairPaper}`,
              borderRadius: 20,
              padding: '24px 28px',
            }}
          >
            <p style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, letterSpacing: '0.12em', color: C.textMuted }}>
              IMAGES
            </p>
            <p style={{ fontFamily: SERIF, fontSize: 26, marginTop: 12, lineHeight: 1.3 }}>
              Artist and AI trade drafts in real time. The artefact is the point.
            </p>
            <p style={{ fontFamily: SANS, fontSize: 18, color: C.textMuted, marginTop: 14 }}>Claimed. Shipping.</p>
          </div>
          <div
            style={{
              flex: 1,
              background: 'rgba(206,127,68,0.09)',
              border: `2px solid ${C.accent}`,
              borderRadius: 20,
              padding: '24px 28px',
            }}
          >
            <p style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, letterSpacing: '0.12em', color: C.accentDeep }}>
              LANGUAGE
            </p>
            <p style={{ fontFamily: SERIF, fontSize: 26, marginTop: 12, lineHeight: 1.3 }}>
              The artefact is a by product. The compression of thought is the cognition.
            </p>
            <p style={{ fontFamily: SANS, fontSize: 18, color: C.accentDeep, marginTop: 14, fontWeight: 600 }}>
              Open. This is where Argo is built.
            </p>
          </div>
        </div>

        {/* Papert under the two cards, not above them.
         *
         * The order is the argument: here is the unclaimed half, here is the
         * forty-six-year-old theory that says the unclaimed half is the half
         * that matters, therefore delegate and you lose. Putting him above the
         * cards would separate the headline from its own evidence.
         *
         * The gold left rule is the same treatment slide 3 gives Winston, on
         * purpose — this deck cites two dead academics and they should look
         * like the same move.
         *
         * Note the live tension with the LANGUAGE card directly above: Papert's
         * whole point is that the public artefact is load-bearing, and that card
         * calls the artefact a by product. The band resolves it rather than
         * ducking it — the artefact Papert means is the entry, the Soul and the
         * map, not the polished prose. Anyone in the room who knows Papert will
         * go looking for that contradiction, so it is answered on the slide. */}
        <div style={{ display: 'flex', marginTop: 26 }}>
          <div style={{ width: 3, background: C.accent, flexShrink: 0 }} />
          <div style={{ paddingLeft: 22 }}>
            <p
              style={{
                fontFamily: SANS,
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: '0.14em',
                color: C.accentDeep,
              }}
            >
              CONSTRUCTIONISM · SEYMOUR PAPERT, MIT, 1980
            </p>
            <p style={{ fontFamily: SERIF, fontSize: 22, lineHeight: 1.35, marginTop: 9 }}>
              You learn by building something public. The artefact and the understanding build each other.
            </p>
            <p style={{ fontFamily: SERIF, fontSize: 22, lineHeight: 1.35, marginTop: 5, color: C.accentDeep }}>
              Argo never builds it for you. The human stays in every loop by construction — that is rung two.
            </p>
          </div>
        </div>

        <p style={{ fontFamily: SANS, fontSize: 19, color: C.textMuted, marginTop: 20 }}>
          Delegate the writing and you lose the ability to think for yourself. You lose the ability to write, to speak,
          and to have quality ideas.
        </p>
      </Frame>
    ),
  },

  {
    id: 'what',
    label: 'What Argo is',
    tone: 'paper',
    body: (
      <Frame tone="paper" style={{ flexDirection: 'row', gap: 44, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <Eyebrow tone="paper">The product</Eyebrow>
          <Headline size={54}>A private journaling AI that never writes for you.</Headline>
          <Sub tone="paper">
            Write it or say it. A companion that has read every entry you have ever made reads it back: a summary, the
            insights, the questions to ask yourself, and the entry from eight months ago you forgot you wrote.
          </Sub>
          <p style={{ fontFamily: SERIF, fontSize: 32, fontStyle: 'italic', marginTop: 40, lineHeight: 1.35 }}>
            They all kept a notebook. None of them had one that remembered.
          </p>
        </div>
        {/* Heights stay inside the frame padding: the tallest shot must clear
         * the bottom edge, not sit on it. */}
        <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <Shot src="/demo-day/shot-home.png" alt="Argo home screen with the Soul" h={500} />
          <Shot src="/demo-day/shot-entry.png" alt="An entry read back with an AI summary" h={420} />
        </div>
      </Frame>
    ),
  },

  {
    id: 'film',
    label: 'Launch film',
    tone: 'ink',
    /* Full bleed and nothing else. No title, no watermark, no caption: the film
     * has its own end card, and anything on top of it is competing with it.
     *
     * The one exception is the QR, and it earns the exception by being the only
     * thing on the slide that matters when the film does not run. It sits in the
     * bottom corner over 33 seconds of moving image, which is a real cost —
     * accept it, or reach for the version below that hides it during playback,
     * because a slide whose whole content is a still frame and no way through is
     * worse than a small card in the corner. */
    body: (
      <Frame tone="ink" style={{ padding: 0 }}>
        <Video
          src="/demo-day/launch-film.mp4"
          poster="/demo-day/launch-film-poster.jpg"
          style={{ width: STAGE_W, height: STAGE_H, objectFit: 'cover' }}
        />
        <Qr
          src="/demo-day/qr-launch-ad.png"
          caption="Watch the film"
          url="youtu.be/Ppl-TfO3Oqo"
          size={80}
          plate
          /* Top right, not bottom right: the browser's own video controls live
           * along the bottom edge, and a card parked over the mute and
           * fullscreen buttons is a card that breaks the film to advertise it. */
          style={{ position: 'absolute', right: 26, top: 26, zIndex: 2 }}
        />
      </Frame>
    ),
  },

  {
    id: 'demo',
    label: 'Live demo',
    tone: 'paper',
    todo: 'Live device mirror. These stills are the fallback if the phone fails.',
    body: (
      <Frame tone="paper">
        <Eyebrow tone="paper">Live on the device</Eyebrow>
        <Headline size={46}>Three moves.</Headline>
        <div style={{ display: 'flex', gap: 28, marginTop: 36, justifyContent: 'center' }}>
          {[
            { src: '/demo-day/shot-record.png', n: 'One', t: 'Talk. It captures and transcribes.' },
            { src: '/demo-day/shot-entry.png', n: 'Two', t: 'It reads you back, and surfaces what you forgot.' },
            { src: '/demo-day/shot-voice.jpeg', n: 'Three', t: 'A thinking assistant you talk to, out loud.' },
          ].map((s) => (
            <div key={s.n} style={{ textAlign: 'center' }}>
              <Shot src={s.src} alt={s.t} h={370} />
              <p style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, letterSpacing: '0.12em', color: C.accentDeep, marginTop: 16 }}>
                {s.n.toUpperCase()}
              </p>
              <p style={{ fontFamily: SANS, fontSize: 18, color: C.textMuted, marginTop: 6, maxWidth: 290 }}>{s.t}</p>
            </div>
          ))}
        </div>
      </Frame>
    ),
  },

  {
    id: 'privacy',
    label: 'Privacy',
    tone: 'ink',
    body: (
      <Frame tone="ink">
        <Eyebrow>Privacy is architecture, not policy</Eyebrow>
        <Headline size={62}>Nobody can read it. Not even us.</Headline>
        <div style={{ display: 'flex', gap: 22, marginTop: 46 }}>
          {[
            { h: 'Zero knowledge', t: 'Encrypted on your device with a key that only exists there. Our servers hold ciphertext.' },
            { h: 'Open source', t: 'You do not have to take my word for any of it. You can read it.' },
            { h: 'Confidential inference', t: 'The journal AI runs on Morpheus, inside a trusted execution environment.' },
          ].map((c) => (
            <div
              key={c.h}
              style={{ flex: 1, background: C.inkElev, border: `1px solid ${C.hairInk}`, borderRadius: 18, padding: '28px 28px' }}
            >
              <p style={{ fontFamily: SERIF, fontSize: 29, color: C.gold, marginBottom: 14 }}>{c.h}</p>
              <p style={{ fontFamily: SANS, fontSize: 19, lineHeight: 1.5, color: C.creamMuted }}>{c.t}</p>
            </div>
          ))}
        </div>
        <p
          style={{
            fontFamily: SANS,
            fontSize: 18,
            color: C.creamMuted,
            marginTop: 40,
            borderLeft: `2px solid ${C.accent}`,
            paddingLeft: 18,
          }}
        >
          Voice latency currently routes through a separate provider. Moving it back is on the roadmap.
        </p>
      </Frame>
    ),
  },

  {
    id: 'soul',
    label: 'The Soul',
    tone: 'ink',
    body: (
      <Frame tone="ink" style={{ flexDirection: 'row', gap: 56, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <Eyebrow>A credential you own. On Base.</Eyebrow>
          <Headline size={54}>The Soul is the ledger of the loop.</Headline>
          <Sub>
            One star per completed day, placed by the meaning of your words. Soulbound on Base mainnet: it cannot be
            bought, sold, or transferred. Not a bolt on identity feature, the receipt for having run the loop for a
            year.
          </Sub>
          <p style={{ fontFamily: SERIF, fontSize: 30, fontStyle: 'italic', marginTop: 34, color: C.gold }}>
            Bots can fake a profile. They cannot fake a year of your thinking.
          </p>
        </div>
        <Shot src="/demo-day/shot-constellation.png" alt="The Soul constellation" h={560} />
      </Frame>
    ),
  },

  {
    id: 'papert',
    label: 'Papert',
    tone: 'paper',
    todo: 'Copy on this slide is a draft, not Konrad\'s words. Rewrite before it is presented.',
    /* Placed after the Soul, not after the gap.
     *
     * Two reasons. The talk is already why-heavy at the front — the product
     * does not appear until 2:35 of seven minutes — and a second dead academic
     * in that block makes the one real structural problem worse. And the
     * argument on this slide is a privacy argument, not a premise: it only
     * pays off once the room has seen the encrypted container (9) and the
     * Soul (10). "They cannot fake a year of your thinking" is the setup line
     * for it, and it is spoken one slide earlier.
     *
     * Paper tone in an otherwise ink stretch (9, 10, 12 are all ink). That is
     * deliberate twice over: it punctuates the run visually, and it rhymes
     * with slide 5, the other place Papert appears. Papert shows up on paper
     * both times.
     *
     * The departure is the point of the slide. Constructionism says the
     * artefact is public and shareable; Argo's container is unreadable by
     * anyone, including us. Rather than soften Papert to fit, the slide splits
     * his artefact in two — the construction stays private, the proof and the
     * thinking go out. Claiming Papert without naming where you leave him is
     * the version a judge who knows him takes apart. */
    body: (
      <Frame tone="paper" style={{ justifyContent: 'center' }}>
        <Eyebrow tone="paper">Constructionism · Seymour Papert, MIT, 1980</Eyebrow>
        <Headline size={54}>The training ground is private. The artefact is not.</Headline>
        <p style={{ fontFamily: SANS, fontSize: 22, lineHeight: 1.5, color: C.textMuted, marginTop: 26, maxWidth: 1010 }}>
          Papert&rsquo;s learner built in public — the program on the screen, the robot on the table. Argo splits that in
          two. The construction happens somewhere nobody can read, and what leaves is the proof you ran it and the
          thinking you carry out with you.
        </p>
        <div style={{ display: 'flex', gap: 14, marginTop: 38 }}>
          {[
            { h: 'Objects to think with', t: 'The Soul: a year of your own thinking, in a form you can actually look at.' },
            { h: 'Microworlds', t: 'A container where the only thing that governs is your own thinking.' },
            { h: 'Mathland', t: 'You learn French by living in France. This is somewhere you live to learn to think.' },
            { h: 'Debugging, not failing', t: 'The AI asks. It never corrects, and it never writes the line for you.' },
            { h: 'Hard fun', t: 'It refuses to do the work. That is not a limitation, it is the product.' },
          ].map((c) => (
            <div
              key={c.h}
              style={{
                flex: 1,
                background: C.paperElev,
                border: `1px solid ${C.hairPaper}`,
                borderRadius: 16,
                padding: '26px 22px',
              }}
            >
              <p style={{ fontFamily: SERIF, fontSize: 24, lineHeight: 1.25, color: C.accentDeep }}>{c.h}</p>
              <p style={{ fontFamily: SANS, fontSize: 17, lineHeight: 1.5, color: C.textMuted, marginTop: 14 }}>{c.t}</p>
            </div>
          ))}
        </div>
      </Frame>
    ),
  },

  {
    id: 'flywheel',
    label: 'The flywheel',
    tone: 'ink',
    body: (
      <Frame tone="ink" style={{ flexDirection: 'row', gap: 50, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <Eyebrow>Go to market</Eyebrow>
          <Headline size={54}>I built a machine that feeds the app.</Headline>
          <Sub>
            You do not get momentum from one big push. You get it from pushing the same wheel in the same direction
            until it turns itself. Every part of my life is a spoke on it.
          </Sub>
          <p style={{ fontFamily: SANS, fontSize: 18, color: C.creamMuted, marginTop: 30 }}>
            Jim Collins, Good to Great
          </p>
        </div>
        <Flywheel size={460} />
      </Frame>
    ),
  },

  {
    id: 'spokes',
    label: 'Four spokes',
    tone: 'paper',
    body: (
      <Frame tone="paper">
        <Eyebrow tone="paper">The four spokes</Eyebrow>
        <Headline size={46}>Every one of them ends with the app.</Headline>
        <div style={{ display: 'flex', gap: 20, marginTop: 34 }}>
          {[
            { img: '/demo-day/spoke-podcast.jpg', h: 'The podcast', t: 'Creativity, technology, spirituality. Every episode describes the app and asks the guest what they think.' },
            { img: '/demo-day/spoke-kids.jpg', h: 'The kids class', t: 'Holistic creativity and STEM. Draw, journal, teach each other a concept. Every family gets a subscription.' },
            { img: '/demo-day/spoke-course.jpg', h: 'The AI course', t: 'Free online fills the funnel, paid in person. Singapore, Cambodia, and on YouTube.' },
            { img: '/demo-day/spoke-community.jpg', h: 'The community', t: 'A subscription is not an app, it is a membership. And all of it becomes content.' },
          ].map((s) => (
            <div
              key={s.h}
              style={{
                flex: 1,
                background: C.paperElev,
                border: `1px solid ${C.hairPaper}`,
                borderRadius: 18,
                overflow: 'hidden',
              }}
            >
              <div style={{ height: 158 }}>
                <Photo src={s.img} alt={s.h} />
              </div>
              <div style={{ padding: '20px 22px 24px' }}>
                <p style={{ fontFamily: SERIF, fontSize: 26, marginBottom: 10 }}>{s.h}</p>
                <p style={{ fontFamily: SANS, fontSize: 16.5, lineHeight: 1.5, color: C.textMuted }}>{s.t}</p>
              </div>
            </div>
          ))}
        </div>
      </Frame>
    ),
  },

  {
    id: 'ai-city',
    label: 'The AI city',
    tone: 'paper',
    /* The fifth spoke, and the only one that is not a channel: a seat on the
     * council of a collective building an AI city at Forest City. Every claim
     * on this slide is Konrad's own and none is checked against a primary
     * source — the Deputy Prime Minister line is a prediction, not a title. */
    todo: 'Partner claims unverified. Confirm what may be said publicly before this is presented.',
    body: (
      <Frame tone="paper">
        <Eyebrow tone="paper">Forest City, Malaysia</Eyebrow>
        <Headline size={44}>Argo sits on the council building an AI city.</Headline>
        <p style={{ fontFamily: SANS, fontSize: 19, lineHeight: 1.5, color: C.textMuted, marginTop: 16, maxWidth: 1050 }}>
          Crypto natives from the global crypto community, forming an open source collective to build a network state — a United States
          of America 2.0. AI at the centre, healthy by default, a culture of multicultural self&nbsp;actualization.
          On the ground with a future Deputy Prime Minister of Malaysia, CC&nbsp;Puan, founder of Malaysia&rsquo;s first
          unicorn, and the chairman of Forest&nbsp;City.
        </p>
        <div style={{ display: 'flex', gap: 14, marginTop: 24, height: 372 }}>
          <div style={{ flex: '0 0 556px', borderRadius: 16, overflow: 'hidden' }}>
            <Photo src="/demo-day/aicity-hero.jpg" alt="The collective at Forest City" />
          </div>
          {/* Four supporting frames: the founding sketch, and the three rooms
            * where the partnerships were actually made. */}
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { src: '/demo-day/aicity-sketch.jpg', alt: 'The founding sketch: principles and core values' },
              { src: '/demo-day/aicity-puan.jpg', alt: 'CC Puan' },
              { src: '/demo-day/aicity-chairman.jpg', alt: 'With the chairman of Forest City' },
              { src: '/demo-day/aicity-execs.jpg', alt: 'The collective and local executives' },
            ].map((p) => (
              <div key={p.src} style={{ borderRadius: 14, overflow: 'hidden' }}>
                <Photo src={p.src} alt={p.alt} />
              </div>
            ))}
          </div>
        </div>
      </Frame>
    ),
  },

  {
    id: 'results',
    label: 'The results',
    tone: 'ink',
    /* Figures from [[demo-day-metrics]], 2026-08-15. Every one is read off the
     * platform's own dashboard. Views and watch hours are both the all-owned-
     * channels framing, stated on the tile — the one thing the research doc is
     * emphatic about is never mixing that framing with the Argo-only one
     * silently, so the Argo-only split is printed underneath rather than left
     * to be asked about.
     *
     * Downloads, subscribers and follower counts are deliberately absent. Small
     * absolute numbers in a tile grid read as a claim that failed; they belong
     * in the narration where the framing carries them. */
    body: (
      <Frame tone="ink" style={{ justifyContent: 'center' }}>
        <Eyebrow>Is it turning</Eyebrow>
        <Headline size={54}>What nine months of the flywheel produced.</Headline>
        <div style={{ display: 'flex', gap: 16, marginTop: 40 }}>
          {[
            { n: '21,898', k: 'Views across the channels', src: '5,793 of them on Argo’s own, from zero in 9 months' },
            { n: '517', k: 'Hours actually watched', src: 'Not impressions. Time people chose to spend.' },
            { n: '91%', k: 'Of the launch film watched', src: '0:31 of 0:34, at an 80% click-through rate' },
            { n: '75', k: 'Events hosted', src: '186 people in the Argo community' },
            /* Not Argo's money and not Argo's raise — the capital already in the
              * ground at Forest City, where the AI city collective is working.
              * The tile says "invested in" for that reason; the narration has to
              * carry the rest or this reads as a raise. */
            { n: '$100B', k: 'Invested in Forest City', src: 'USD, in the project we are coordinating with to bring the AI city there.' },
          ].map((t) => (
            <div
              key={t.k}
              style={{
                flex: 1,
                background: C.inkElev,
                border: `1px solid ${C.hairInk}`,
                borderTop: `3px solid ${C.accent}`,
                borderRadius: 18,
                padding: '24px 18px',
                textAlign: 'center',
              }}
            >
              <p style={{ fontFamily: SERIF, fontSize: 52, color: C.accent, lineHeight: 1 }}>{t.n}</p>
              <p style={{ fontFamily: SANS, fontSize: 16, fontWeight: 600, marginTop: 14, lineHeight: 1.35 }}>{t.k}</p>
              <p style={{ fontFamily: SANS, fontSize: 13, color: C.creamMuted, marginTop: 10, lineHeight: 1.45 }}>
                {t.src}
              </p>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: SANS, fontSize: 17, color: C.creamMuted, marginTop: 34 }}>
          Nine months of output, five owned channels, 75 events. The app is eight days old.
        </p>
      </Frame>
    ),
  },

  {
    id: 'testimonials',
    label: 'Testimonials',
    tone: 'paper',
    /* Verbatim from the recordings, in [[interview-testimonials]]. Trimmed for
     * spoken disfluency ("uh", restarts) and nothing else — no words added, no
     * sentences stitched together from different parts of an answer. Timestamps
     * are on the card so any of them can be checked against the tape. */
    body: (
      <Frame tone="paper">
        <Eyebrow tone="paper">On the record</Eyebrow>
        <Headline size={46}>Every episode is a channel and a testimonial at once.</Headline>
        <div style={{ display: 'flex', gap: 24, marginTop: 34 }}>
          {[
            {
              q: 'A good use case for privacy preserving AI. People want to talk through their most personal thoughts. It’s not something you want to publish with Claude or OpenAI.',
              who: 'David Johnston',
              cred: 'Coined “decentralized applications” and “smart agents”. Bitcoin pioneer and investor.',
              note: 'Argo Podcast · 34:23',
              img: '/demo-day/testimonial-johnston.jpg',
            },
            {
              q: 'It is not just about what you experienced throughout the day. It is also about how you felt. Many people just observe. They don’t realize how they feel, and then they don’t know what they want.',
              who: 'Chong Ing Kai',
              cred: 'Founder of Stickem. Asia 30 Under 30. Won the US$1M Hult Prize global final, London, 2025.',
              note: 'Argo Podcast · 38:29',
              img: '/demo-day/testimonial-chong.jpg',
            },
            {
              q: 'Journal apps help you keep track of your thoughts, get the raw data that you can then refashion into some shareable information.',
              who: 'Daniel Im',
              cred: 'Student of Geoffrey Hinton, the godfather of AI. Building Belief Market.',
              note: 'Argo Podcast · 52:07',
              img: '/demo-day/testimonial-im.jpg',
            },
          ].map((t, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: C.paperElev,
                border: `1px solid ${C.hairPaper}`,
                borderTop: `3px solid ${C.accent}`,
                borderRadius: 18,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                overflow: 'hidden',
              }}
            >
              {/* Full 16:9, never cropped — every still carries its own title
                * lockup and a cover crop cuts the words in half. */}
              <Photo src={t.img} alt="" style={{ height: 'auto', aspectRatio: '16 / 9', flexShrink: 0 }} />
              <p
                style={{
                  fontFamily: SERIF,
                  fontSize: 19,
                  lineHeight: 1.36,
                  fontStyle: 'italic',
                  padding: '18px 24px 0',
                }}
              >{`“${t.q}”`}</p>
              <div style={{ padding: '0 24px 22px' }}>
                <p style={{ fontFamily: SANS, fontSize: 17, fontWeight: 600, marginTop: 14 }}>{t.who}</p>
                {/* Claims are the guests' own, unverified against a primary source —
                  * see the caveat in [[final-demo-prep]]. */}
                <p style={{ fontFamily: SANS, fontSize: 12.5, lineHeight: 1.35, color: C.textMuted, marginTop: 5 }}>
                  {t.cred}
                </p>
                <p style={{ fontFamily: SANS, fontSize: 12.5, color: C.accentDeep, marginTop: 7 }}>{t.note}</p>
              </div>
            </div>
          ))}
        </div>
      </Frame>
    ),
  },

  {
    id: 'back-to-thesis',
    label: 'Back to the thesis',
    tone: 'ink',
    body: (
      <Frame tone="ink" style={{ justifyContent: 'center' }}>
        <Eyebrow>Why it is built this way</Eyebrow>
        <blockquote
          style={{
            fontFamily: SERIF,
            fontSize: 38,
            lineHeight: 1.36,
            fontStyle: 'italic',
            borderLeft: `3px solid ${C.gold}`,
            paddingLeft: 30,
            maxWidth: 1000,
          }}
        >
          By involving human feedback at each step of decision-making, we reduce the incentive to offload high-level
          planning responsibility to the AI itself.
        </blockquote>
        <p style={{ fontFamily: SANS, fontSize: 20, color: C.creamMuted, marginTop: 22, paddingLeft: 33 }}>
          Vitalik Buterin, My Techno-Optimism
        </p>
        <Rule tone="ink" />
        <p style={{ fontFamily: SERIF, fontSize: 40, lineHeight: 1.3, maxWidth: 1020 }}>
          An AI that never writes for you keeps the human in every loop by construction, so the incentive never forms.
          This is the loop, shipping today.
        </p>
      </Frame>
    ),
  },

  {
    id: 'close',
    label: 'Close and ask',
    tone: 'ink',
    todo: 'The spoken ask. One sentence, said out loud — the QR only works if he tells them to raise a phone.',
    body: (
      <Frame tone="ink" style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- deck art */}
        <img src="/demo-day/argo-emblem.png" alt="Argo" style={{ width: 84, marginBottom: 12 }} />
        <p style={{ fontFamily: SERIF, fontSize: 38, lineHeight: 1.3, maxWidth: 940 }}>
          Not a prototype, not a roadmap. You can use it tonight.
        </p>
        <p
          style={{
            fontFamily: SANS,
            fontSize: 15,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: C.accentLight,
            marginTop: 20,
          }}
        >
          Live on iOS and web · Open source · Built on Base · Devcon Mumbai
        </p>
        <p
          style={{
            fontFamily: SANS,
            fontSize: 14,
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: C.accentLight,
            marginTop: 34,
          }}
        >
          THE ASK
        </p>
        <div style={{ display: 'flex', gap: 16, marginTop: 16 }}>
          {['Download the app', 'Join the community', 'Subscribe to the podcast', 'Subscribe to the AI courses'].map(
            (ask, n) => (
              <div
                key={ask}
                style={{
                  width: 250,
                  padding: '16px 18px',
                  borderRadius: 14,
                  background: C.inkElev,
                  border: `1px solid ${C.hairInk}`,
                  borderTop: `3px solid ${C.accent}`,
                }}
              >
                <p style={{ fontFamily: SANS, fontSize: 13, fontWeight: 700, color: C.accent, marginBottom: 6 }}>
                  {n + 1}
                </p>
                <p style={{ fontFamily: SERIF, fontSize: 21, lineHeight: 1.3, color: C.cream }}>{ask}</p>
              </div>
            )
          )}
        </div>
        {/* One code, not four. Four QRs on a slide is four phones failing to
         * decide which one to point at, so the landing page is the code.
         *
         * The caption says "start here" and not "all four start here", which it
         * cannot say yet: on 2026-08-17 src/app/page.tsx links to /founding,
         * GitHub and X, and to nothing for the podcast, the community or the
         * courses. Put the four links on the landing page and the stronger
         * caption becomes true — until then it would be a claim a judge can
         * disprove in the ten seconds after they scan it. */}
        <Qr
          src="/demo-day/qr-argo.png"
          caption="Start here"
          url="myargoquest.com"
          size={92}
          style={{ marginTop: 22 }}
        />
      </Frame>
    ),
  },
]
