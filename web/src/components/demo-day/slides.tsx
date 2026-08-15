import type { CSSProperties, ReactNode } from 'react'
import Flywheel from './Flywheel'
import { C, SANS, SERIF, STAGE_H, STAGE_W } from './theme'

/* ──────────────────────────────────────────────────────────────────────────
 * The sixteen slides of the final demo day deck.
 *
 * Source of truth for the narrative:
 *   secondbrain/Areas/argo/protocol-camp-updates/final-demo-day/
 *     final-brainstorming.md   (this deck)
 *     final-demo-day/script-1.md  (beat timings and claims guardrails)
 *
 * Anything not yet confirmed is rendered through <Missing>, which draws a
 * dashed amber slot rather than a made-up figure. Slides carrying one are
 * listed in the checklist under the stage.
 * ────────────────────────────────────────────────────────────────────────── */

export type Slide = {
  id: string
  /* Short name for the overview grid and the progress rail. */
  label: string
  /* Ink slides are the spine (stakes, thesis, close); paper slides carry detail. */
  tone: 'ink' | 'paper'
  body: ReactNode
  /* What Konrad says over the slide. Shown in the notes panel, exported as
   * PowerPoint speaker notes. */
  notes: string
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

/* A dashed slot standing in for an asset or figure that does not exist yet.
 * Deliberately loud: an empty box on a rehearsal run is a reminder, a
 * plausible-looking invented number is a liability in Q and A. */
function Missing({ children, height, style }: { children: ReactNode; height?: number; style?: CSSProperties }) {
  return (
    <div
      style={{
        border: `2px dashed ${C.accent}`,
        borderRadius: 16,
        background: 'rgba(206,127,68,0.07)',
        color: C.accent,
        fontFamily: SANS,
        fontSize: 17,
        fontWeight: 600,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        gap: 8,
        padding: 24,
        height,
        ...style,
      }}
    >
      {children}
    </div>
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

/* ── the deck ───────────────────────────────────────────────────────────── */

export const SLIDES: Slide[] = [
  {
    id: 'title',
    label: 'Title',
    tone: 'ink',
    notes:
      'My name is Konrad, this is Argo, and the title of this talk is the same one I am taking to Devcon in Mumbai. Photoshop for writing.',
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
    notes:
      'For most of history you could get by on what you knew. That era is closing. When everyone has the same models and the same answers on tap, the only differences left are the quality of your ideas and your ability to express them. That is not a soft skill any more, that is the whole game, and almost nobody is training for it.',
    body: (
      <Frame tone="ink" style={{ justifyContent: 'center' }}>
        <h2 style={{ fontFamily: SERIF, fontSize: 78, lineHeight: 1.14, fontWeight: 500, maxWidth: 1000 }}>
          Your ability to think, speak, and write is about to decide everything.
        </h2>
        <Watermark tone="ink" />
      </Frame>
    ),
  },

  {
    id: 'winston',
    label: 'Winston',
    tone: 'ink',
    todo: 'Winston clip trimmed to 0:38–0:53 and level matched',
    notes:
      'Play the fifteen second clip, then: Winston ran the MIT Artificial Intelligence Laboratory. He spent his life on machine intelligence and this is what he told his students mattered most. Speak, write, ideas, in that order. In the age of AI he is more right, because those three are the only things that do not come out of the box.',
    body: (
      <Frame tone="ink" style={{ justifyContent: 'center' }}>
        <div style={{ display: 'flex', gap: 56, alignItems: 'center' }}>
          <div style={{ flex: 1 }}>
            <blockquote
              style={{
                fontFamily: SERIF,
                fontSize: 40,
                lineHeight: 1.34,
                fontStyle: 'italic',
                borderLeft: `3px solid ${C.gold}`,
                paddingLeft: 30,
              }}
            >
              Your success in life will be determined largely by your ability to speak, your ability to write, and the
              quality of your ideas. In that order.
            </blockquote>
            <p style={{ fontFamily: SANS, fontSize: 21, color: C.creamMuted, marginTop: 26, paddingLeft: 33 }}>
              Patrick Winston, MIT
            </p>
          </div>
          <Missing height={300} style={{ width: 360 }}>
            <span style={{ fontSize: 30 }}>▶</span>
            <span>Winston clip, 15s</span>
            <span style={{ fontWeight: 400, fontSize: 14 }}>
              assets/winston-how-to-speak-first60.mp4, trimmed 0:38 to 0:53
            </span>
          </Missing>
        </div>
        <p style={{ fontFamily: SANS, fontSize: 13, color: C.creamMuted, position: 'absolute', left: 88, bottom: 44 }}>
          Patrick H. Winston, &ldquo;How to Speak&rdquo;, MIT OpenCourseWare. CC BY-NC-SA.
        </p>
      </Frame>
    ),
  },

  {
    id: 'dacc',
    label: 'The thesis',
    tone: 'ink',
    notes:
      'This is the middle rung of d/acc. The variable being optimised is not model capability, it is loop tightness. Same model, different number of turns. One shot prompt and generate is the replacement pattern. Real time collaboration is the augmentation pattern. Look at the mechanisms he named. All hardware, all years out, all measured in milliseconds of latency.',
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
    notes:
      'He made the Photoshop argument about images and never carried it to language. That is the gap I am building in. A daily writing loop is a feedback loop between a human and an AI that exists now, needs no implant, and runs on the interfaces everybody already has, text and voice. And language is the harder case, because with an image the artefact is the point, while with writing the artefact is a by product. The compression of thought is the cognition. Delegate the drawing and you lose a picture you did not make. Delegate the writing and you skip the step that was doing the thinking.',
    body: (
      <Frame tone="paper">
        <Eyebrow tone="paper">The unclaimed half</Eyebrow>
        <Headline size={54}>He made the Photoshop argument about images. Nobody carried it to language.</Headline>
        <div style={{ display: 'flex', gap: 26, marginTop: 44 }}>
          <div
            style={{
              flex: 1,
              background: C.paperElev,
              border: `1px solid ${C.hairPaper}`,
              borderRadius: 20,
              padding: '30px 32px',
            }}
          >
            <p style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, letterSpacing: '0.12em', color: C.textMuted }}>
              IMAGES
            </p>
            <p style={{ fontFamily: SERIF, fontSize: 31, marginTop: 14, lineHeight: 1.3 }}>
              Artist and AI trade drafts in real time. The artefact is the point.
            </p>
            <p style={{ fontFamily: SANS, fontSize: 19, color: C.textMuted, marginTop: 18 }}>Claimed. Shipping.</p>
          </div>
          <div
            style={{
              flex: 1,
              background: 'rgba(206,127,68,0.09)',
              border: `2px solid ${C.accent}`,
              borderRadius: 20,
              padding: '30px 32px',
            }}
          >
            <p style={{ fontFamily: SANS, fontSize: 15, fontWeight: 700, letterSpacing: '0.12em', color: C.accentDeep }}>
              LANGUAGE
            </p>
            <p style={{ fontFamily: SERIF, fontSize: 31, marginTop: 14, lineHeight: 1.3 }}>
              The artefact is a by product. The compression of thought is the cognition.
            </p>
            <p style={{ fontFamily: SANS, fontSize: 19, color: C.accentDeep, marginTop: 18, fontWeight: 600 }}>
              Open. This is where Argo is built.
            </p>
          </div>
        </div>
        <p style={{ fontFamily: SANS, fontSize: 21, color: C.textMuted, marginTop: 36 }}>
          Delegate the drawing and you lose a picture you did not make. Delegate the writing and you skip the step that
          was doing the thinking.
        </p>
      </Frame>
    ),
  },

  {
    id: 'what',
    label: 'What Argo is',
    tone: 'paper',
    notes:
      'You write or you just talk, and an AI companion that has read every entry you have ever made reads it back to you. A summary, the insights, the questions you should be asking yourself, and the connection to the thing you wrote eight months ago and forgot. They all kept a notebook. None of them had one that remembered.',
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
    todo: 'The 30 second launch film. Scripted in launch-ad/, not yet shot or cut.',
    notes:
      'Say nothing during the film. After it, one line: that launched on August 7th.',
    body: (
      <Frame tone="ink" style={{ padding: 0, justifyContent: 'center', alignItems: 'center' }}>
        <Missing style={{ width: 1120, height: 590, borderRadius: 0, border: 'none', background: '#0D0B08' }}>
          <span style={{ fontSize: 54, color: C.gold }}>▶</span>
          <span style={{ fontSize: 26, color: C.cream, fontFamily: SERIF, fontWeight: 400 }}>
            Launch film, 30 seconds, full bleed, sound up
          </span>
          <span style={{ fontWeight: 400, fontSize: 16, color: C.creamMuted, maxWidth: 640, lineHeight: 1.5 }}>
            Placeholder. The ten thirty-second spots are scripted and storyboarded in
            final-demo-day/launch-ad/, but no cut film exists yet. Drop the mp4 in as
            /demo-day/launch-film.mp4 and this slide plays it.
          </span>
        </Missing>
      </Frame>
    ),
  },

  {
    id: 'demo',
    label: 'Live demo',
    tone: 'paper',
    todo: 'Live device mirror. These stills are the fallback if the phone fails.',
    notes:
      'Three moves only, narrated while doing them. One, I talk, no blank page and no typing, and the word count climbs to seven hundred and fifty. Two, it comes back with what I actually said, tightened, plus the questions I should be asking myself, and it surfaces an entry from months ago on the same theme that I had genuinely forgotten writing. Three, every completed day adds a star, placed by the meaning of my words. That is my Soul.',
    body: (
      <Frame tone="paper">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
          <div>
            <Eyebrow tone="paper">Live on the device</Eyebrow>
            <Headline size={46}>Three moves. No menus.</Headline>
          </div>
          <p style={{ fontFamily: SANS, fontSize: 16, color: C.accentDeep, fontWeight: 600 }}>
            Fallback stills if the mirror drops
          </p>
        </div>
        <div style={{ display: 'flex', gap: 28, marginTop: 36, justifyContent: 'center' }}>
          {[
            { src: '/demo-day/shot-record.png', n: 'One', t: 'Talk. It captures and transcribes.' },
            { src: '/demo-day/shot-entry.png', n: 'Two', t: 'It reads you back, and surfaces what you forgot.' },
            { src: '/demo-day/shot-constellation.png', n: 'Three', t: 'The day becomes a star in your Soul.' },
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
    notes:
      'You are about to put the most honest thing you have ever written into an app, so the privacy cannot be a policy, it has to be architecture. Encrypted on your device with a key that only exists on your device. Our servers hold ciphertext. The whole thing is open source so you can read it rather than trust me. The journal AI runs confidential inference on Morpheus. Voice latency currently routes through a separate provider and moving it back is on the roadmap, and I would rather say that here than be asked it later.',
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
          Stated plainly on stage: voice latency currently routes through a separate provider. Moving it back is on the
          roadmap. Do not extend the confidential inference claim to voice.
        </p>
      </Frame>
    ),
  },

  {
    id: 'soul',
    label: 'The Soul',
    tone: 'ink',
    notes:
      'Every day you complete the human side of the loop, one star records it. It is soulbound on Base mainnet, so it cannot be bought, sold, or transferred. That makes it the thing the internet is short of right now, proof of a human who actually showed up over time. It is not a bolt on identity feature. It is the receipt for having run the d/acc loop for a year. Bots can fake a profile. They cannot fake a year of your thinking.',
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
    id: 'flywheel',
    label: 'The flywheel',
    tone: 'ink',
    notes:
      'Here is the part I actually want to be judged on. Jim Collins wrote about the flywheel in Good to Great. You do not get momentum from one big push, you get it from pushing the same wheel in the same direction until it turns itself. I am not buying users. I built a flywheel and every part of my life is a spoke on it.',
    body: (
      <Frame tone="ink" style={{ flexDirection: 'row', gap: 50, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <Eyebrow>Go to market</Eyebrow>
          <Headline size={54}>I am not buying users. I built a machine that feeds the app.</Headline>
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
    notes:
      'One, the podcast, on creativity, technology, and spirituality, and in every single episode I describe the app and ask the guest what they think of it. Two, a holistic creativity and STEM class for kids where we draw, journal, and teach each other a concept, and every family in the class gets a subscription. Three, an AI power users course for adults, free online to fill the funnel and paid in person, run in Singapore and now Cambodia, where people who just spent two hours learning to work with AI are exactly the people who understand why a private one matters. Four, the community, because a subscription is not an app, it is a membership. And all four turn into content, which feeds all four again.',
    body: (
      <Frame tone="paper">
        <Eyebrow tone="paper">The four spokes</Eyebrow>
        <Headline size={46}>Every one of them ends with the app.</Headline>
        <div style={{ display: 'flex', gap: 20, marginTop: 34 }}>
          {[
            { img: '/demo-day/spoke-podcast.jpg', h: 'The podcast', t: 'Creativity, technology, spirituality. Every episode describes the app and asks the guest what they think.' },
            { img: '/demo-day/spoke-kids.jpg', h: 'The kids class', t: 'Holistic creativity and STEM. Draw, journal, teach each other a concept. Every family gets a subscription.' },
            { img: '/demo-day/spoke-course.jpg', h: 'The AI course', t: 'Free online fills the funnel, paid in person. Singapore, and now Cambodia.' },
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
    id: 'results',
    label: 'The results',
    tone: 'ink',
    todo: 'Every figure on this slide. Pull from the platform dashboards and App Store Connect.',
    notes:
      'So is it turning. Read the five numbers off the slide, one sentence each, and say only what you can defend in question time. Every one of these came from the wheel and not from ad spend.',
    body: (
      <Frame tone="ink" style={{ justifyContent: 'center' }}>
        <Eyebrow>Is it turning</Eyebrow>
        <Headline size={54}>The numbers, and none of them bought.</Headline>
        <div style={{ display: 'flex', gap: 18, marginTop: 46 }}>
          {[
            { k: 'Views across channels', src: 'platform dashboards' },
            { k: 'App downloads since 7 Aug', src: 'App Store Connect' },
            { k: 'Views on the launch ad', src: 'per platform' },
            { k: 'Community events hosted', src: '3 at MyBW, confirm full count' },
            { k: 'Paying subscribers', src: 'confirm current figure' },
          ].map((t) => (
            <div
              key={t.k}
              style={{
                flex: 1,
                background: C.inkElev,
                border: `2px dashed ${C.accent}`,
                borderRadius: 18,
                padding: '26px 20px',
                textAlign: 'center',
              }}
            >
              <p style={{ fontFamily: SERIF, fontSize: 62, color: C.accent, lineHeight: 1 }}>&mdash;</p>
              <p style={{ fontFamily: SANS, fontSize: 17, fontWeight: 600, marginTop: 16, lineHeight: 1.35 }}>{t.k}</p>
              <p style={{ fontFamily: SANS, fontSize: 13.5, color: C.creamMuted, marginTop: 10 }}>{t.src}</p>
            </div>
          ))}
        </div>
        <p style={{ fontFamily: SANS, fontSize: 19, color: C.creamMuted, marginTop: 40 }}>
          Placeholders on purpose. Say only what you can defend in Q and A.
        </p>
      </Frame>
    ),
  },

  {
    id: 'testimonials',
    label: 'Testimonials',
    tone: 'paper',
    todo: 'Verbatim quotes, guest names and exact titles, and permission to show them.',
    notes:
      'These are on the record. One guest called it training for keeping your mind sharp. Another said private AI you can actually trust is the thing they had been waiting for. The parents keep telling me the same thing, which is that their kids love it. Every episode is a distribution channel and a testimonial at the same time.',
    body: (
      <Frame tone="paper">
        <Eyebrow tone="paper">On the record</Eyebrow>
        <Headline size={46}>Every episode is a channel and a testimonial at once.</Headline>
        <div style={{ display: 'flex', gap: 20, marginTop: 36 }}>
          {[
            { q: 'Training for keeping your mind sharp.', who: 'Podcast guest', note: 'Paraphrase. Pull the verbatim line from the recording.' },
            { q: 'Private AI you can actually trust is the thing I have been waiting for.', who: 'Podcast guest', note: 'Paraphrase. Confirm name, title, and permission.' },
            { q: 'My kid loves it.', who: 'Parent, kids class', note: 'Reported repeatedly. Get one on the record in writing.' },
            { q: '', who: 'AI course student', note: 'Not yet collected. Ask at the end of the next in person class.' },
          ].map((t, i) => (
            <div
              key={i}
              style={{
                flex: 1,
                background: t.q ? C.paperElev : 'rgba(206,127,68,0.07)',
                border: t.q ? `1px solid ${C.hairPaper}` : `2px dashed ${C.accent}`,
                borderRadius: 18,
                padding: '26px 24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                minHeight: 300,
              }}
            >
              <p style={{ fontFamily: SERIF, fontSize: 25, lineHeight: 1.35, fontStyle: 'italic' }}>
                {t.q ? `“${t.q}”` : 'Quote to collect'}
              </p>
              <div>
                <p style={{ fontFamily: SANS, fontSize: 17, fontWeight: 600, marginTop: 20 }}>{t.who}</p>
                <p style={{ fontFamily: SANS, fontSize: 13.5, color: C.accentDeep, marginTop: 8, lineHeight: 1.4 }}>
                  {t.note}
                </p>
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
    notes:
      'Vitalik argues the augmentation path is not just the nicer option, it is the safer one, and the mechanism is economic rather than technical. Keeping a human in every loop removes the incentive to hand over the planning. An AI that never writes for you keeps you in every loop by construction, so that incentive never forms. That is the whole argument, and it is why the app is built the way it is.',
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
    todo: 'THE ASK. One specific sentence. The single most important missing line in the deck.',
    notes:
      'Argo is live on iOS, there is a web portal, it is open source, the encryption is real, the journal AI is confidential, and the Soul is on Base mainnet today. Not a prototype. You can use it tonight. The reason I am confident is not the app, it is that I built a machine that feeds it and it is already turning. Then the ask, as one specific sentence, then stop talking.',
    body: (
      <Frame tone="ink" style={{ alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- deck art */}
        <img src="/demo-day/argo-emblem.png" alt="Argo" style={{ width: 132, marginBottom: 20 }} />
        <p style={{ fontFamily: SERIF, fontSize: 46, lineHeight: 1.3, maxWidth: 940 }}>
          Not a prototype, not a roadmap. You can use it tonight.
        </p>
        <p
          style={{
            fontFamily: SANS,
            fontSize: 17,
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
            color: C.accentLight,
            marginTop: 28,
          }}
        >
          Live on iOS and web · Open source · Built on Base · Devcon Mumbai
        </p>
        <Missing style={{ marginTop: 46, width: 720, height: 104 }}>
          <span>THE ASK</span>
          <span style={{ fontWeight: 400, fontSize: 15 }}>
            One specific sentence. The raise and what it buys, the introductions you want, or the pilot you want run.
          </span>
        </Missing>
      </Frame>
    ),
  },
]
