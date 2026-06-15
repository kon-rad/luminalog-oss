# LuminaLog — Landing Page Design Prompt

Design prompt for the LuminaLog marketing landing page. Each section below is a self-contained prompt describing one section of the page. Reference the iOS app prototype (`luminalog-ios/`) for visual language, component style, and colour tokens — the landing page should feel like a natural extension of the app, not a separate brand.

---

## Global Design Context

Include with every section prompt:

> LuminaLog is an AI-powered video journaling app that makes you superhuman — through genuine, compounding self-knowledge. It captures your life in text, voice, video, and handwritten photos; analyses your words, face, voice, and patterns across time; connects your past to your present goals; and asks you the questions that move things forward. The brand is warm, calm, and deeply serious about human growth — not a productivity tool, not a social app, not a wellness dashboard. The design language should feel like a quiet journal on warm paper: generous whitespace, one amber accent, Newsreader serif for headlines and pull quotes, a clean system sans-serif for body and UI text. The audience is reflective adults (25–45) who want to grow — in any area they choose — and want a tool that actually sees them. The page should feel like the app itself, not like a SaaS marketing page.

---

## Design System (translate from iOS prototype)

### Colour palette

| Token | Light value | Usage |
|---|---|---|
| `bg` | `#F4F0E9` | Page background — warm cream paper |
| `bgElev` | `#FBF8F3` | Slightly elevated backgrounds |
| `surface` | `#FFFDFA` | Cards, modal surfaces |
| `surfaceAlt` | `#F0EBE1` | Subtle dividers, alternating sections |
| `text` | `#2B2722` | Primary headings and body |
| `text2` | `#7C7468` | Secondary body, captions |
| `text3` | `#A89F92` | Tertiary labels, placeholders |
| `accent` | `#CE7F44` | Amber/terracotta — buttons, links, highlights |
| `accentDeep` | `#B96B33` | Gradient end, hover states |
| `accentSoft` | `#F5E7D5` | Tinted accent backgrounds |
| `hairline` | `rgba(60,50,40,0.07)` | Borders, dividers |
| `shadow` | `0 1px 2px rgba(70,50,30,0.05), 0 8px 24px rgba(70,50,30,0.07)` | Card elevation |

**Growth dimension accent colours** (used sparingly — they accent, never dominate):

| Dimension | Hex |
|---|---|
| Intellect | `#4A7FD4` deep blue |
| Spirit | `#9B72CF` soft violet |
| Emotion | `#E8748A` rose petal |
| Art / Creativity | `#7DBF72` amber green |

### Typography

- **Display / hero headlines:** Newsreader, weight 500–600, italic variant for pull quotes, tracking -0.3 to -0.5px
- **Section headings:** Newsreader, weight 600, 32–48px
- **Body / UI text:** `-apple-system, "SF Pro Text", system-ui, sans-serif` — clean, legible, weight 400–600
- **Overlines / labels:** system sans, uppercase, 11–12px, letter-spacing 1.0–1.4px, `text3` colour
- **Pull quotes:** Newsreader italic, 20–26px, `text2` colour, with a left amber border 3px or a quote icon

### Spacing & layout

- Max content width: 1100px, centred
- Section vertical padding: 96–120px desktop, 64–80px mobile
- Cards: `border-radius: 24px`, `border: 1px solid hairline`, `background: surface`, `box-shadow: shadow`
- Buttons: `border-radius: 14px`, 52px height, weight 600, `padding: 0 28px`
- No harsh lines or heavy borders — hairline only
- Generous whitespace; never crowded

### Component vocabulary (lifted from iOS prototype)

- **Prompt card:** amber gradient (`accent → accentDeep`), 26px radius, white serif quote text, white CTA button — the emotional centrepiece of the app; use one on the landing page as a live demo illustration
- **AI sparkle icon:** `✦` or the SVG sparkle from the app — signals AI-generated content
- **Type pills:** rounded pill badges (Text / Voice / Video / Image) using per-type hue on soft tinted background
- **Entry row:** avatar glyph + serif body preview + relative timestamp
- **Stat cards:** white surface cards with soft shadow, bold metric, light label

---

## Section 1 — Navigation Bar

**Prompt:**

Design a minimal fixed navigation bar for the LuminaLog landing page.

- **Left:** `LuminaLog` wordmark — the `bookOpen` icon (from the iOS prototype) in amber beside the name set in Newsreader weight 600 or system sans weight 700. Compact and warm.
- **Right:** two items — `Sign In` (ghost/text style, `text2` colour) and `Download` (filled amber button, `border-radius: 12px`, compact).
- Background: `bg` at full opacity on scroll; on load, slightly transparent with `backdrop-filter: blur(20px)`.
- A hairline `border-bottom` appears on scroll only.
- Mobile: collapses to a single `Download` amber button.

---

## Section 2 — Hero

**Prompt:**

Design the LuminaLog hero section. The goal is to land the core promise — that this app makes you superhuman — before any feature explanation. The emotional register is expansive, not modest.

**Layout (desktop): split — left text, right visual.**

**Left column:**

- **Overline:** `AI Video Journal · Personal Growth` — system sans, uppercase, 12px, amber, letter-spacing 1.2px
- **Headline:** `Become superhuman.` — Newsreader, 64–72px, weight 600, `text` colour, tracking -0.6px. This is the boldest, most confident line on the page. It earns the claim with everything below it.
- **Subheadline:** `LuminaLog captures your life in video, voice, text, and writing — then analyses your face, your tone, your patterns, and your history to show you things about yourself you would never have seen alone.` — system sans, 18–20px, `text2`, line-height 1.6, max-width 480px
- **CTA row:** Primary `Download on the App Store` (amber filled button, 52px, App Store badge styling); secondary `See how it works ↓` (text link, `accent` colour, no underline)
- **Trust strip beneath CTAs:** four micro-claims in a row — `🔒 Encrypted` · `📱 On-device AI` · `⭐ Open source` · `🚫 Never trained on your data` — system sans 12px, `text3`, separated by `·`. Wrap to two lines on mobile.

**Right column:**

- An iPhone frame (match the iOS prototype frame style from `frames/ios-frame.jsx`) showing the Home screen: the amber gradient prompt card with a sample question (*"What were you really afraid of last Thursday — and have you felt that before?"*), two stat cards below, the top of the recent entries list. The frame is slightly tilted (~4°) and casts a warm shadow on the page.
- Behind the phone: a very soft radial glow in `accentSoft` — like the light from the screen spilling onto warm paper.

**Mobile:** stacked — text first, iPhone mockup below, scaled to fill the viewport width.

**Background:** `bg` (#F4F0E9) — warm cream. No dark here. The hero should feel like opening a quality journal, not a tech product page.

---

## Section 3 — The Core Promise (See What You Cannot See)

**Prompt:**

Design a full-width, text-dominant section that delivers the philosophical heart of LuminaLog: **the AI shows you what you cannot see about yourself.** This is not about features. It is about a capability that changes how you develop as a person.

**Layout:** centred, max-width 700px, generous vertical whitespace. No images — the words carry the weight.

- **Overline:** `The one thing that changes everything` — uppercase, 12px, amber, letter-spacing 1.2px
- **Headline:** `You cannot see your own patterns. We can.` — Newsreader, 48–54px, weight 600, centred, tracking -0.4px
- **Body paragraph 1:** `Most people move through life without ever truly seeing themselves. They repeat the same fears. Ask the wrong questions. Miss the connections between where they are and where they've been. Not because they're not thoughtful — but because no one can see themselves clearly from inside their own head.` — system sans, 18px, `text2`, centred, line-height 1.75
- **Body paragraph 2:** `LuminaLog gives you the outside view. Every entry you write, speak, or film is indexed and remembered. The AI reads across everything — your words, your voice, your face, your history — and shows you what it sees: the patterns you're repeating, the questions you should be asking, the connections between your past and your present goals that you would never have made alone.` — system sans, 18px, `text2`, centred, line-height 1.75
- **Pull quote:** `"It's the first time I've ever had a conversation about my journal that didn't start with me explaining who I am — and the first time something showed me a pattern I was completely blind to."` — Newsreader italic, 22px, `text2`, left amber border 3px, max-width 560px, centred block

- **Visual:** a simplified iPhone chat screen. The AI bubble (left, serif, warm surface card) says: *"You've mentioned fear of being misunderstood in seven entries over the past four months — always right before a creative project. You never named it that way. Does that resonate?"* The user bubble (right, amber) replies: *"I didn't realize I was doing that."* — This single exchange is the product proof. It should feel like a quiet revelation, not a feature demo.

**Background:** `surfaceAlt` (#F0EBE1).

---

## Section 4 — What You Unlock (The Superhuman Layer)

**Prompt:**

Design a section that names the six specific capabilities LuminaLog gives you — things you literally cannot do without it. This is the closest thing to a feature list on the page, but it should read as a list of unlocked human abilities, not software specs.

**Headline:** `What you unlock.` — Newsreader, 42px, weight 600, left-aligned (desktop)
**Subhead:** `Six capabilities you did not have before.` — system sans, 18px, `text2`, left-aligned

**Layout:** a 2×3 grid of compact cards (desktop); 1 column on mobile. Each card is minimal — icon, bold title, two sentences.

Card style: `surface` background, `border-radius: 20px`, `border: 1px solid hairline`, `box-shadow: shadowSoft`, `padding: 24px`. Amber sparkle icon top-left. Title system sans 17px weight 700 `text`. Body system sans 14px `text2` line-height 1.55.

Cards:

| # | Title | Body |
|---|---|---|
| 1 | **Grow in any direction** | Set any goal — intellectual, creative, spiritual, emotional, professional. The AI links your entries to it and tracks your progress across time. |
| 2 | **See things differently** | The AI reads across months of entries and returns a view of you that you could never construct from inside your own head. Your perspective expands. |
| 3 | **Ask the right questions** | LuminaLog doesn't give you answers — it gives you the questions you weren't asking. The ones drawn from your actual history that unlock the next level of clarity. |
| 4 | **Spot invisible patterns** | Recurring fears, creative blocks, emotional cycles, belief contradictions. The AI finds what repeats and shows it to you plainly, without judgment. |
| 5 | **Connect past to present** | A goal from last month linked to an insight from six months ago. A current fear traced back to something you wrote and forgot. The dots you never connected — connected. |
| 6 | **Get holistic feedback from video** | When you record a video entry, the AI analyses your face, tone of voice, and energy — not just your words. It notices what you didn't say. |

**Background:** `bg`.

---

## Section 5 — Capture (Four Formats)

**Prompt:**

Design a section showing that LuminaLog accepts any format — text, voice, video, or a photo of handwritten pages — and that every format feeds the same AI memory.

**Headline:** `Journal the way you think.` — Newsreader, 40px, weight 600, left-aligned (desktop)
**Subhead:** `Write it. Say it. Film it. Or photograph the page.` — system sans, 20px, `text2`
**Secondary line:** `Every format you use becomes part of your AI's memory.` — system sans, 16px, `text3`, italic

**Layout:** a 2×2 grid of feature cards (desktop), single column (mobile). Each card:

- `surface` background, `border-radius: 24px`, `border: 1px solid hairline`, `box-shadow: shadowSoft`
- Top: the **type pill** from the iOS prototype with its per-type colour
- **Card headline** and **card body** — see below
- **Card visual:** a small iPhone snippet showing that entry type in use

Card content:

| Type | Pill colour | Headline | Body |
|---|---|---|---|
| **Text** | Amber `#CE7F44` | Write what's on your mind. | A clean, distraction-free editor. No formatting toolbars, no pressure. Just you and the page — and an AI that will remember every word. |
| **Voice** | Rose `#C16C6C` | Speak your thoughts. | Record as you go — LuminaLog transcribes in real time, on your device. Your voice stays private. Your tone is analysed for patterns you didn't notice. |
| **Video** | Violet `#897BA8` | Film yourself. | Record a moment, a reflection, a conversation with yourself. The AI reads your words — and watches your face and hears your voice for what's beneath them. |
| **Image** | Green `#6E8C77` | Photograph your notebook. | Already journaling on paper? Snap the page. We read your handwriting, make it searchable, and add it to your AI's memory. |

---

## Section 6 — Video Intelligence (Face + Voice Analysis)

**Prompt:**

Design a dedicated section for LuminaLog's most distinctive capability: the AI analysing video entries — your face, tone, energy, and expression — to surface insights that no text journal can reach. This is a bold differentiator and should be treated as a primary feature, not a footnote.

**Layout:** right image, left text (desktop). Reverse on mobile. Dark section — use `bg` `#16130E` (iOS dark theme). This should feel like a private, intimate moment of honest feedback, not a surveillance feature.

**Left text column:**

- **Overline:** `Video Intelligence` — uppercase, 12px, amber
- **Headline:** `It sees what you don't say.` — Newsreader, 40px, weight 600, white (`#F3EEE4`)
- **Body:** `When you record a video entry, LuminaLog doesn't just transcribe your words. The AI analyses your facial expressions, your tone of voice, your energy, and your body language — then offers feedback and observations that go far beyond what you said out loud. It might notice tension you didn't name. Joy you underplayed. A shift in your voice when you talked about a specific person or topic. This is insight at a level no text journal can reach.` — system sans, 17px, `#A89E8F` (iOS dark text2), line-height 1.7
- **Below body:** three short insight chips — amber-bordered pills in soft dark surface, each a sample AI observation:
  - `✦ "Your voice tightened noticeably when you mentioned the project deadline."`
  - `✦ "You smiled three times talking about Thursday — you didn't mention it as a good day."`
  - `✦ "This is the fourth entry where your energy dropped when you brought up that relationship."`
  - These chips are in Newsreader italic, 14px, `#F3EEE4`, and convey the intimacy and specificity of what the AI sees.

**Right visual:** an iPhone in dark mode showing the Video entry detail screen — a paused video at the top (a person recording themselves, face visible), the transcript below, and beneath that an AI insights card with one of the observation chips expanded. The amber sparkle icon precedes the AI label. The phone sits in darkness with a faint amber glow behind it.

**Background:** `#16130E` — the one second dark section on the page. Should feel intimate and honest, not cold or corporate.

---

## Section 7 — Reflect (AI Analysis + Patterns)

**Prompt:**

Design a section explaining how the AI analyses each entry and connects it to everything else you've recorded. The emphasis is on pattern detection and cross-entry intelligence — not just single-entry summaries.

**Layout:** left iPhone visual, right text (desktop). Reverse on mobile.

**Left visual:** an iPhone showing the Journal Detail Insights tab — a generated insights card with 2–3 findings: *"A recurring pattern of self-doubt appearing before creative projects — this is the sixth entry where it surfaces."* · *"An undertone of gratitude you don't name directly."* · *"The fear you described here connects closely to what you wrote in March."* Below, the amber `Generate 5 prompts →` button.

**Right text column:**

- **Overline:** `AI Analysis` — uppercase, 12px, amber
- **Headline:** `Your life, reflected back.` — Newsreader, 40px, weight 600
- **Body:** `Every entry receives an AI-generated summary and a set of insights — not just from what you wrote today, but from everything the AI knows about you. It finds the themes threading through your last six months, the emotional patterns you couldn't name, and the connections between your current goals and things you recorded and forgot. Then it offers five new questions drawn from your actual history to take you deeper.` — system sans, 17px, `text2`, line-height 1.65
- **Below body:** a stat card (matching the iOS component) — `✦ Daily prompt · One personalized question each morning, drawn from your recent themes` — amber sparkle, `surface` card, soft shadow
- **Below that:** a second stat card — `✦ Cross-entry patterns · The AI reads across your entire journal, not just today's entry` — same style

**Background:** `bg`.

---

## Section 8 — Converse (AI Chat + Voice Call)

**Prompt:**

Design a section showing both conversation modes — text chat and live voice call — with emphasis on the depth of context the AI brings to every exchange.

**Headline:** `Talk to your journal.` — Newsreader, 40px, weight 600, centred
**Subhead:** `Text or live voice. Your companion has read, watched, and listened to everything.` — system sans, 18px, `text2`, centred

**Layout:** two iPhones side by side, centred on `bg`, gentle opposite tilts (±3°). Left phone: chat conversation screen with a meaningful exchange — the AI message references a specific past entry and names a pattern. Right phone: voice call screen — the breathing amber orb, `AI listening` label, waveform beneath. Small amber sparkle divider between the phones.

Below the phones, two short copy blocks side by side:

- **Text chat:** `Think out loud. Untangle a decision. Ask about a pattern you've noticed. The AI replies in full, drawing on your biography and your entire journal — never generic, always yours.`
- **Voice call:** `A real-time voice conversation with a companion that already knows your story. It listens with context, asks the questions you need, and notices what you leave out.`

Both copy blocks: system sans 16px, `text2`, max-width 280px, centred.

**Background:** `#16130E` dark warm — this and the Video Intelligence section are the two dark sections. The amber orb glow from the right phone spills softly into the background. Intimate, not cold.

---

## Section 9 — The Four Dimensions + Any Area You Choose

**Prompt:**

Design a section communicating that LuminaLog supports growth across four foundational dimensions — but also in any direction the user defines. The prism metaphor: one beam of light (your life) refracted into the full spectrum of who you are.

**Headline:** `The full spectrum of yourself.` — Newsreader, 40px, weight 600, centred
**Subhead:** `Four dimensions to start. Any direction you choose.` — system sans, 17px, `text2`, centred

**Visual:** a large centred illustration of the prism motif from the icon design brief — a crystal or teardrop shape, a single white-gold beam entering from the left, four coloured bands fanning out on the right. Clean, digital, refined — not garish. Approximately 400×260px. The four bands flow directly into the four dimension labels below.

**Below the prism:** four compact cards in a row (2×2 on mobile), each in its dimension colour at ~10% tint:

| Dimension | Icon | Label | Description |
|---|---|---|---|
| Intellect | Open book | `Intellectual` | Track your ideas, reading, and how your thinking evolves. Ask the AI what you believe now versus six months ago. |
| Spirit | Sparkle / mandala | `Spiritual` | Hold your questions about meaning, practice, and belief. See your inner life take shape over time. |
| Emotion | Wave / heart | `Emotional` | Witness your feelings without judgment. Let the AI name the patterns you're inside of. |
| Art | Brush / pen | `Artistic` | Document your creative process and output. Let your journal become a record of your craft developing. |

Card style: `border-radius: 20px`, soft border in dimension colour at 20% opacity, `surface` background, 20px padding. Title in dimension colour, body in `text2`.

**Below the four cards:** a full-width callout in `accentSoft` background, `border-radius: 20px`, centred text:

> `Not limited to these four. Tell LuminaLog what you're working on — a leadership skill, a creative practice, a relationship pattern, a professional goal — and it tracks your growth in that direction.`

Callout: system sans 16px, `text2`, max-width 560px, centred. Small amber sparkle left of the text.

**Background:** `bg`.

---

## Section 10 — Privacy & Trust

**Prompt:**

Design the privacy section as a first-class claim, not a footnote. The deeper the self-knowledge, the more private the data must be. This section earns the trust that Section 2 asks for.

**Headline:** `Private by design. Verifiable by code.` — Newsreader, 40px, weight 600
**Subhead:** `Your journal holds the most private data you own. Here is exactly how we protect it.` — system sans, 18px, `text2`

**Layout:** a single large card on `surfaceAlt` background, `border-radius: 28px`, soft shadow, `surface` card interior. Five privacy claims — four in a 2×2 grid, one full-width row below.

Each claim: a small amber lock/shield icon left, **bold label**, supporting sentence right.

1. **Encrypted end-to-end** — Every entry, voice recording, video, and image is encrypted in transit and at rest. Your data is never sent in plaintext to anyone.
2. **On-device transcription & OCR** — Speech-to-text and handwriting recognition run entirely on your iPhone using Apple's on-device frameworks. Your voice and handwriting never leave your device.
3. **Never used to train AI** — Your journal is never used to train AI models. Not ours. Not anyone else's. Full stop.
4. **Open source** — The iOS app and backend API are publicly available on GitHub. Our privacy claims are not trust — they are code anyone can read and verify.

Fifth claim (full-width):

5. **Full deletion, always** — Delete your account and everything goes with it — every entry, every AI vector, every media file, every record. Permanently. One tap. No retention.

At the bottom of the card: `View on GitHub →` in `accent` colour, 14px.

**Background:** `surfaceAlt` (#F0EBE1).

---

## Section 11 — How It Works (3 Steps)

**Prompt:**

Design a clean "how it works" section. Three steps, each a single complete thought. The loop is daily and lightweight.

**Headline:** `Simple from day one.` — Newsreader, 38px, weight 600, centred

**Layout:** three horizontal steps connected by a dashed amber line (desktop); vertical stack with left connecting line on mobile.

Each step:
- **Step number:** Newsreader, 60px, weight 600, `accentSoft` colour — large, ghosted, behind the card content
- **Icon:** a simple line icon in amber
- **Title:** system sans, 18px, weight 700, `text`
- **Body:** system sans, 15px, `text2`, 2 sentences max

Steps:

1. **Capture** — `plus` icon — Write, speak, film, or photograph your handwritten page. One tap, any format, all in one place.
2. **Reflect** — `sparkle` icon — Get AI insights, pattern analysis, and five new questions from each entry. Every morning, one personalized prompt drawn from your recent life.
3. **Converse** — `chat` icon — Open a text or voice conversation with your AI companion. It already knows your whole story — and it uses all of it.

**Background:** `bg`.

---

## Section 12 — Pricing

**Prompt:**

Design a pricing section — two tiers, clean, non-aggressive.

**Headline:** `Start free. Go deeper with Pro.` — Newsreader, 38px, weight 600, centred

**Layout:** two pricing cards side by side (desktop), stacked on mobile.

**Free card:**
- Label: `Free` — system sans, 14px, weight 600, uppercase, `text3`
- Price: `$0` — Newsreader, 48px, weight 600, `text`
- Feature list (checkmarks in `text3`): Unlimited text journaling · Daily personalized prompt · Limited AI insights · Limited chat
- CTA: ghost/outline button — `Download free` — `accent` border, `accent` text

**Pro card** (featured — `surface` card with amber top accent bar):
- Label: `Pro` — uppercase, amber
- Price: `$X.99 / month` — Newsreader, 48px; `or $XX.99 / year` beneath in system sans 14px `text3`
- Badge: `Most popular` — small amber pill top-right
- Feature list (amber checkmarks): Everything in Free · Voice, video & photo entries · AI video intelligence (face + voice analysis) · Unlimited AI insights & pattern detection · Unlimited chat · Live voice conversations
- CTA: filled amber button — `Start Pro free`
- Beneath CTA: `Cancel anytime. No tricks.` — 13px, `text3`, centred

---

## Section 13 — Final CTA

**Prompt:**

Design the closing section. The last thing a visitor sees before the footer. The register is expansive — this is an invitation to become more than you are, not a reminder to download an app.

**Layout:** centred, full-width.

Option A (warm cream):
- Headline: `The clearest view of yourself you've ever had.` — Newsreader, 48–54px, weight 600, centred, `text`
- Subhead: `It starts with one entry.` — Newsreader italic, 28px, `text2`, centred
- Body: `Free to start. Two minutes to your first entry.` — system sans, 17px, `text3`, centred
- CTA: large amber button `Download LuminaLog` — 56px height, 24px radius, weight 600

Option B (dark amber gradient — the prompt card at full section width):
- Same copy in white/cream text on `accent → accentDeep` gradient
- CTA button: white with `accentDeep` text
- Feels like the hero promise closing back on itself — confident and warm

**Recommend Option B** — the amber gradient makes the close feel like the beginning again; it bookends the page. Propose both for client approval.

**Background:** per option above.

---

## Section 14 — Footer

**Prompt:**

Design a minimal, warm footer.

- Left: `LuminaLog` wordmark (bookOpen icon + name, same as nav)
- Centre: `Made for people who want to become more than they are.` — Newsreader italic, 15px, `text3`
- Right: `Privacy Policy · Terms · Support · GitHub` — system sans 13px, `text3`
- Below hairline divider: `© 2026 LuminaLog` — 12px, `text3`, centred
- Background: `bg`, hairline top border only. No dark footer.

---

## Messaging Hierarchy (copy reference)

1. **Hero:** Become superhuman.
2. **Core promise:** You cannot see your own patterns. We can.
3. **What you unlock:** Six capabilities you did not have before.
4. **Capture:** Journal the way you think. Every format. One memory.
5. **Video intelligence:** It sees what you don't say.
6. **Reflect:** Your life, reflected back. Patterns across time.
7. **Converse:** Talk to your journal. It already knows everything.
8. **Growth dimensions:** The full spectrum of yourself. Any direction you choose.
9. **Privacy:** Private by design. Verifiable by code.
10. **CTA close:** The clearest view of yourself you've ever had.

---

## Page Flow (section order)

1. Nav
2. Hero — `Become superhuman.`
3. Core Promise — `You cannot see your own patterns. We can.` *(surfaceAlt)*
4. What You Unlock — the six capabilities
5. Capture — four entry formats
6. Video Intelligence — face + voice analysis *(dark section)*
7. Reflect — AI insights + pattern detection
8. Converse — text chat + voice call *(dark section)*
9. Four Dimensions + any area
10. Privacy — five claims
11. How It Works — three steps
12. Pricing
13. Final CTA *(amber gradient)*
14. Footer

---

## What to Avoid

- Opening with features before the core promise — the hero earns attention with a bold claim, not a feature list
- Underselling the video intelligence capability — face and voice analysis is the sharpest differentiator; give it its own section
- Stock photography of people journaling — use the iOS app mockups as all visual evidence
- More than two dark sections (Video Intelligence and Converse) — the rest of the page stays warm cream
- Any language suggesting therapy, treatment, productivity metrics, or social sharing
- Overuse of the dimension colours — they accent, never dominate
- Soft or hedged headline copy — "Become superhuman" is meant to be said plainly; do not soften it to "journal better"
- Rounded corners below 14px or above 28px — maintain the soft, consistent corner rhythm from the app
- Heavy or outlined icons — use the SF-symbol-style thin line icons from the iOS prototype
