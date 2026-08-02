import {
  CONTEST_DEADLINE_ISO,
  CONTEST_DEADLINE_LABEL,
  CONTEST_EVENT_ID,
  CONTEST_JUDGING,
  CONTEST_PRIZE,
  CONTEST_PRIZE_CHAIN,
  CONTEST_PROMPT,
  CONTEST_RULES,
  CONTEST_SUBMIT_API,
  CONTEST_SUBTITLE,
  CONTEST_URL,
  CONTEST_WORDS_MAX,
  CONTEST_WORDS_MIN,
  contestIsClosed,
} from '@/lib/contest/config'
import { GALLERY_IMAGES, GALLERY_ROOMS, IMAGES_WITH_TEXT } from '@/lib/contest/gallery'
import { KNOWLEDGE, KNOWLEDGE_CATEGORIES, knowledgeInCategory } from '@/lib/contest/knowledge'
import {
  MYBW,
  MYBW_ESSAY_PICKS,
  MYBW_LOCAL_ECOSYSTEM,
  MYBW_MARKET_FACTS,
  MYBW_SCALE,
  MYBW_SESSIONS,
  MYBW_SOURCES,
} from '@/lib/contest/mybw'

export const dynamic = 'force-dynamic'

const DATA_API = 'https://myargoquest.com/api/contest/data'

/**
 * Serves the public agent skill at /mybw2026-contest/skill.md.
 *
 * Everything is generated from the same modules the page renders from, so the
 * skill can never state a rule the site does not enforce.
 */
function buildSkill(): string {
  const rules = CONTEST_RULES.map((r, i) => `${i + 1}. ${r.text}`).join('\n')

  const knowledgeIndex = KNOWLEDGE_CATEGORIES.map((cat) => {
    const entries = knowledgeInCategory(cat.id)
    if (!entries.length) return ''
    const rows = entries
      .map((e) => {
        const angle = e.angle ? `\n  - **Angle:** ${e.angle}` : ''
        return `- **${e.title}** (\`${e.slug}\`) — ${e.summary}${angle}`
      })
      .join('\n')
    return `### ${cat.label}\n\n${rows}`
  })
    .filter(Boolean)
    .join('\n\n')

  const photoCount = GALLERY_IMAGES.filter((i) => i.kind === 'image').length
  const videoCount = GALLERY_IMAGES.length - photoCount

  const roomIndex = GALLERY_ROOMS.map((r) => {
    const n = GALLERY_IMAGES.filter((i) => i.room === r.id).length
    return `- **${r.label}** (\`${r.id}\`, ${n} photos) — ${r.blurb}`
  }).join('\n')

  return `---
name: mybw2026-essay-contest
description: >-
  Research corpus and submission API for the Malaysia Blockchain Week 2026
  Argo Essay Contest. Use when helping someone write, check, or submit an
  entry answering "${CONTEST_PROMPT}", or when you need primary-source material
  from the Bank Negara Malaysia Museum & Art Gallery on Malaysian monetary
  history, Islamic finance, or digital-asset regulation.
homepage: ${CONTEST_URL}
license: Free to use. Attribute Argo when quoting the transcribed material.
---

# Malaysia Blockchain Week 2026 — Argo Essay Contest

> Generated from the live contest configuration. If this file and the website ever
> disagree, the website is authoritative — but they are built from the same source.

## 1. What this skill gives you

1. **The contest rules**, verbatim and machine-readable.
2. **A submission API** so an entry can be filed without using the web form.
3. **A research corpus**: ${KNOWLEDGE.length} cross-linked knowledge-base entries and
   ${GALLERY_IMAGES.length} items of media — ${photoCount} photographs and ${videoCount} short
   video${videoCount === 1 ? '' : 's'}, ${IMAGES_WITH_TEXT.length} of them carrying transcribed
   signage — captured inside the Bank Negara Malaysia Museum & Art Gallery on 30 July 2026.
4. **Malaysia Blockchain Week 2026 itself** — the full agenda, the market backdrop and the
   domestic ecosystem (see §7).

## 2. The contest at a glance

| Field | Value |
| --- | --- |
| Event id | \`${CONTEST_EVENT_ID}\` |
| Prompt | ${CONTEST_PROMPT} |
| Length | ${CONTEST_WORDS_MIN}–${CONTEST_WORDS_MAX} words |
| Required subtitle | ${CONTEST_SUBTITLE} |
| Prize | ${CONTEST_PRIZE} on ${CONTEST_PRIZE_CHAIN} |
| Deadline | ${CONTEST_DEADLINE_LABEL} |
| Deadline (ISO 8601) | \`${CONTEST_DEADLINE_ISO}\` |
| Status | ${contestIsClosed() ? '**CLOSED**' : 'Open'} |
| Who may enter | Anyone, anywhere. Attendance at the museum event or the conference is **not** required. |
| Home page | ${CONTEST_URL} |

${CONTEST_JUDGING}

## 3. Rules

${rules}

### Checking a draft against the rules

Before submitting on someone's behalf, verify **all** of the following and report any failure
plainly rather than submitting anyway:

- [ ] Word count is between ${CONTEST_WORDS_MIN} and ${CONTEST_WORDS_MAX}.
- [ ] The essay actually answers "${CONTEST_PROMPT}" — not blockchain in general.
- [ ] The URL resolves publicly, with no login or paywall, and shows the author's real name.
- [ ] The exact subtitle "${CONTEST_SUBTITLE}" appears in the published page.
- [ ] A link to ${CONTEST_URL} appears in the published page.
- [ ] A \`0x\`-prefixed Ethereum mainnet address appears in the published page.
- [ ] The entrant has read the essay and it is not 100% AI-generated.

**On the AI rule.** Rule 8 is a rule about the entrant, and you cannot satisfy it for them. Do not
write an entry end-to-end and submit it as someone's own work. Help with research, structure,
editing and fact-checking; the argument and the prose have to be theirs, and they have to have
read the final text. If asked to ghost-write the whole entry, say that the contest forbids it and
offer to help with the parts it allows.

## 4. Submitting

### Endpoint

\`\`\`
POST ${CONTEST_SUBMIT_API}
Content-Type: application/json
\`\`\`

\`GET\` the same URL to retrieve the live contract, including whether the contest is still open.

### Request body

| Field | Type | Notes |
| --- | --- | --- |
| \`name\` | string | Required. The entrant's real name. |
| \`email\` | string | Required. Valid email address. |
| \`company\` | string | Required. Use \`Independent\` if none. |
| \`role\` | string | Required. e.g. \`Founder\`, \`Engineer\`, \`Student\`. |
| \`xAccount\` | string | Required. X/Twitter handle, or \`none\`. |
| \`essayUrl\` | string | Required. \`http(s)\` URL of the published essay. |
| \`ethAddress\` | string | Required. \`0x\` + 40 hex characters, Ethereum mainnet. |
| \`agreedToTerms\` | boolean | Required, must be \`true\`. Only set this if the entrant has confirmed rules 8 and 9 themselves. |

### Example

\`\`\`bash
curl -X POST ${CONTEST_SUBMIT_API} \\
  -H 'Content-Type: application/json' \\
  -d '{
    "name": "Ada Lovelace",
    "email": "ada@example.com",
    "company": "Independent",
    "role": "Engineer",
    "xAccount": "@ada",
    "essayUrl": "https://example.com/blockchain-for-malaysia",
    "ethAddress": "0x0000000000000000000000000000000000000000",
    "agreedToTerms": true
  }'
\`\`\`

### Responses

| Status | Meaning |
| --- | --- |
| \`200\` | \`{ ok: true, id, message, deadline }\` — recorded. |
| \`400\` | Body was not JSON, or not a JSON object. |
| \`422\` | \`{ ok: false, error: "validation_failed", fields: {…} }\` — fix the named fields and retry. |
| \`410\` | The deadline has passed. Do not retry. |
| \`500\` | Write failed. Safe to retry once. |

## 5. The research corpus

All of it is available as JSON:

\`\`\`
GET ${DATA_API}                      # everything
GET ${DATA_API}?include=rules        # contest rules only
GET ${DATA_API}?include=knowledge    # knowledge base with full bodies + sources
GET ${DATA_API}?include=images       # photo captions + transcribed signage + URLs
\`\`\`

Human-readable equivalents live at ${CONTEST_URL} under the
**Bank Negara Malaysia Museum & Art Gallery** tab, which has three views: *Gallery* (all
${GALLERY_IMAGES.length} items, full-screen viewer), *Field notes* (a written walkthrough of the
galleries), and *Knowledge base* (the cross-linked wiki).

### Photo rooms

${roomIndex}

Each media record carries \`id\`, \`kind\` (\`image\` or \`video\`), \`room\`, \`title\`,
\`caption\`, \`text\` (signage transcribed from the media, \`null\` if it has none), \`topics\`
(knowledge-base slugs), \`shotAt\`, \`width\`/\`height\`, and absolute \`thumb\` / \`full\` URLs.
For \`kind: "video"\` the \`thumb\`/\`full\` URLs are the poster frame, and two extra fields
appear: \`video\` (an H.264 MP4) and \`durationSec\`.

### Knowledge-base index

Fetch full bodies and sources from \`${DATA_API}?include=knowledge\`. Each entry has a \`slug\`,
\`body\` paragraphs (which may contain \`[[slug]]\` wiki links to other entries), \`seeAlso\`,
\`sources\`, and the \`imageIds\` it was derived from.

${knowledgeIndex}

## 6. Using this well

The single most common weak entry answers a different question — "what is blockchain good for" —
rather than the one asked, which is about **Malaysia specifically**. The corpus exists to make the
specific version easy. Some load-bearing facts an essay can build on:

- Malaysian **trade exceeds 100% of GDP**, across links with 180+ countries. Trade finance and
  cross-border settlement friction are therefore unusually expensive here (\`international-trade\`).
- The **Central Bank of Malaysia Act 2009** states that the financial system "shall consist of the
  conventional financial system and the Islamic financial system" — a statutory precedent for
  running two rule-sets over one system (\`dual-system\`).
- Bank Negara is already running **ringgit stablecoin and tokenised deposit pilots** under its
  Digital Asset Innovation Hub, and the Securities Commission revised its digital asset exchange
  framework on 20 May 2026. Malaysia is neither prohibitionist nor unregulated (\`regulation\`).
- Malaysia leads the global **sukuk** market. Sukuk are already asset-backed instruments requiring
  a documented link between a return and a real asset — the hard part of RWA tokenisation
  (\`sukuk\`).
- A **1354 handwritten Quran** in the museum is open at Al-Baqarah 282, which makes writing down,
  dating and witnessing a debt contract obligatory (\`ledgers\`).
- For three centuries the archipelago ran on **any** silver coin above 415 grains at 90% fineness,
  regardless of issuer — a working multi-issuer currency regime with real verification costs
  (\`trade-dollars\`, \`verification\`).
- Palm oil, rubber and petroleum supply chains are the most concrete, least hand-wavy candidates
  for provenance work (\`commodities\`).

The Bank's mandate is one sentence: *promote monetary stability and financial stability conducive
to the sustainable growth of the Malaysian economy* (\`bnm-mandate\`). An argument that speaks to
that lands. An argument that a technology is exciting does not.

## 7. Malaysia Blockchain Week 2026

${MYBW.name} (${MYBW.hashtag}) ran **${MYBW.dates}** at the ${MYBW.venue}, ${MYBW.hours}, under the
theme **"${MYBW.theme}"**. Organised by ${MYBW.organiser}, and backed by ${MYBW.backing}. General
admission from ${MYBW.ticketsFrom}. The museum trip that produced this corpus took place on the
morning of day two.

${MYBW_SCALE.map((s) => `- **${s.value}** — ${s.label}`).join('\n')}

> "${MYBW.organiserQuote.text}"
> — ${MYBW.organiserQuote.by}

### The sessions that bear on the essay prompt

Most of the ${MYBW_SESSIONS.length}-session programme was about blockchain in general. These were
about **Malaysia** specifically, which is what the prompt asks about:

${MYBW_ESSAY_PICKS.map(
  (s) =>
    `- **${s.title}** — ${s.speakers.join(', ')}${s.moderator ? `, mod. ${s.moderator}` : ''} ` +
    `(day ${s.day}, ${s.time}, ${s.stage} stage).\n  ${s.whyItMatters}`,
).join('\n')}

### Market backdrop

${MYBW_MARKET_FACTS.map((f) => `- **${f.fact}** — ${f.note}`).join('\n')}

### The domestic ecosystem on stage

${MYBW_LOCAL_ECOSYSTEM.map((e) => `- **${e.name}** — ${e.what}`).join('\n')}

The full agenda — every session, time, stage and speaker — is in
\`${DATA_API}?include=mybw\`, and rendered for humans on the **Malaysia Blockchain Week 2026** tab
at ${CONTEST_URL}.

### Sources

${MYBW_SOURCES.map((s) => `- [${s.label}](${s.url})`).join('\n')}

Session titles are published billing, not transcripts: treat them as evidence of what the Malaysian
industry chose to put on stage, not as claims any named speaker definitely made. Check a primary
source before quoting anyone.

## 8. Provenance and honesty

The \`text\` fields are transcriptions of museum signage read from photographs. They are faithful to
the best of our reading, but they are transcriptions, not scans — if a claim matters, check it
against the linked \`sources\` or the museum directly (museum.bnm.gov.my). Captions and the "Angle"
notes are editorial commentary by Argo and should be attributed as opinion, not as museum text.
`
}

export async function GET() {
  return new Response(buildSkill(), {
    headers: {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=300',
    },
  })
}
