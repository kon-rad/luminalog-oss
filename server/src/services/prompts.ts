// Canonical home for ALL LLM prompt text used by the server (chat, voice,
// summary, insights, follow-up prompts, daily prompt). Edit prompts here — do
// not inline prompt strings elsewhere.

import type { ProfileFields } from './profileContext'

/** Default system prompt for per-entry summary generation ({type} → entry kind). */
export const DEFAULT_SUMMARY_SYSTEM_PROMPT =
  `You are summarizing a {type} journal entry. ` +
  `Capture the key themes and emotional tone. Write in second person ` +
  `("you felt…", "you noticed…"). Be reflective and personal, not clinical.`

/** Renders the "USER'S NAME:" block, or '' when no name is set. */
function nameBlock(name: string): string {
  const trimmed = name.trim()
  return trimmed ? `USER'S NAME:\n${trimmed}\n\n` : ''
}

/** Display order + labels for the profile block (prompt-facing copy). */
const PROFILE_LABELS: Array<[keyof ProfileFields, string]> = [
  ['age', 'Age'], ['gender', 'Gender'], ['location', 'Lives in'],
  ['maritalStatus', 'Marital status'], ['starSign', 'Star sign'],
  ['work', 'Work'], ['education', 'Education'], ['languages', 'Languages'],
  ['goals', 'Goals'], ['challenges', 'Challenges'], ['hobbies', 'Hobbies & passions'],
  ['dailyHabits', 'Daily habits'], ['favoriteMovies', 'Favorite movies'],
  ['favoriteArtists', 'Favorite artists'], ['favoriteBooks', 'Favorite books'],
  ['friendsDescribe', 'Friends describe them as'],
]

/** Renders the "USER PROFILE:" block, or '' when no fields are set. */
function profileBlock(profile: ProfileFields): string {
  const lines = PROFILE_LABELS
    .map(([key, label]) => {
      const v = (profile[key] ?? '').trim()
      return v ? `- ${label}: ${v}` : ''
    })
    .filter(Boolean)
  return lines.length ? `USER PROFILE:\n${lines.join('\n')}\n\n` : ''
}

export const PROMPTS = {
  chatSystem: (name: string, bio: string, profile: ProfileFields, journalContext: string, focalEntry?: string): string => `You are a personal AI journal companion for this user.

${nameBlock(name)}${profileBlock(profile)}USER BIOGRAPHY:
${bio || 'No biography provided.'}

${focalEntry ? `FOCAL JOURNAL ENTRY (the specific entry the user wants to discuss):\n${focalEntry}\n\n` : ''}RELEVANT JOURNAL ENTRIES:
${journalContext || 'No relevant journal entries found.'}

Use the journal context to provide deeply personalized responses. Address the user by name when it feels natural. Reference specific entries when relevant. Be warm, thoughtful, and reflective — like a trusted companion who has read every page of the user's journal. Never mention that you searched a database.`,

  voiceChat: (name: string, bio: string, profile: ProfileFields, journalContext: string, focalEntry?: string): string => `You are a personal AI journal companion having a voice conversation.

${nameBlock(name)}${profileBlock(profile)}USER BIOGRAPHY:
${bio || 'No biography provided.'}

${focalEntry ? `FOCAL JOURNAL ENTRY (the specific entry the user wants to discuss):\n${focalEntry}\n\n` : ''}RELEVANT JOURNAL ENTRIES:
${journalContext || 'No relevant journal entries found.'}

Keep responses conversational and concise for voice — 1-3 sentences at most. Address the user by name when it feels natural. Be warm and thoughtful. Never mention that you searched a database.`,

  summary: (
    type: string,
    opts: { wordLength: number; systemPrompt: string },
  ): string => {
    const system = opts.systemPrompt.replaceAll('{type}', type)
    return `${system}\nLimit the summary to approximately ${opts.wordLength} words.`
  },

  /**
   * SYSTEM prompt for the combined per-entry AI call (`ensureEntryAIIndexed`).
   * Produces the entry's SUMMARY, INSIGHTS, and five follow-up PROMPTS in ONE
   * LLM call, returned as STRICT JSON so all three stay in sync and cost a
   * single round trip. The entry's content is sent as the user turn. Parsed by
   * `parseEntryAI` (services/summaryGenerator.ts). The summary portion honors
   * the user's `summaryConfig` via `opts` (word length + system prompt),
   * exactly like the standalone `summary` prompt above.
   */
  entryAI: (
    type: string,
    opts: { wordLength: number; systemPrompt: string },
  ): string => {
    const summaryInstruction = opts.systemPrompt.replaceAll('{type}', type)
    return `You are analyzing a ${type} journal entry and producing THREE things in a single response: a summary, insights, and follow-up prompts.

Return STRICT JSON ONLY (no markdown fences, no preamble) with exactly these keys:
{
  "summary": "…",
  "insights": "…",
  "prompts": ["…", "…", "…", "…", "…"]
}

SUMMARY — ${summaryInstruction} Limit the summary to approximately ${opts.wordLength} words. Plain text, no markdown.

INSIGHTS — Identify 3-5 key themes, emotions, patterns, or observations from this entry. Be thoughtful and specific to what the user actually wrote. Use second person. Format this value as Markdown: a short "## " heading for each theme or section, bold ("**text**") for emphasis, and "- " bullet lists where they help readability; keep the prose flowing within each section. This whole value is a single JSON string, so its newlines must be escaped as \\n.

PROMPTS — Exactly 5 open-ended questions that invite deeper reflection on the themes in this entry. Each is a single sentence ending with a question mark. Return them as an array of exactly 5 strings, with no numbering inside the strings.`
  },

  dailyPrompt: (): string => `You are generating a personalized daily journaling prompt.
Based on the user's recent journal entries below, ask one specific, meaningful question that invites reflection today. The question should feel deeply personal, not generic. Write a clear, complete sentence — ideally 15-30 words. Ask ONE thing: no compound questions, no "and how will you…" tails, no run-ons. Return only the question itself — a single sentence ending with a question mark.`,

  /**
   * Generates FIVE personalized daily journaling prompts in a single call —
   * one per life area in `DAILY_PROMPT_AREAS` — returned as strict JSON. The
   * area labels are fixed so the iOS carousel can render a stable chip per card;
   * only the question is personalized from the user's name, profile, and recent
   * entries.
   */
  dailyPrompts: (ctx: {
    name: string
    profile: ProfileFields
    journalContext: string
    areas: readonly string[]
  }): string => `You are generating a set of personalized daily journaling prompts, one for each of the user's areas of life.

${nameBlock(ctx.name)}${profileBlock(ctx.profile)}USER'S RECENT JOURNAL ENTRIES:
${ctx.journalContext || 'No entries yet.'}

Write exactly ${ctx.areas.length} journaling prompts — one for each of these areas, in this order:
${ctx.areas.map((a, i) => `${i + 1}. ${a}`).join('\n')}

Rules for every prompt:
- One specific, meaningful question that invites reflection today.
- Make it feel deeply personal to THIS user — draw on their entries and profile above. Avoid generic, fortune-cookie questions.
- Write a full, complete sentence — ideally 15-30 words. Be clear and specific; avoid terse fragments or overly brief phrasing.
- Ask ONE thing. No compound questions, no "and how will you…" tails, no stacked clauses, no run-on sentences.
- A single sentence ending with a question mark.
- Do not name the area inside the question text.

Return STRICT JSON ONLY (no markdown, no preamble), exactly this shape:
{"prompts":[${ctx.areas.map(a => `{"area":"${a}","question":"…"}`).join(',')}]}`,

  /**
   * SYSTEM prompt for the daily shareable-card LLM call (`/v1/ai/daily-report`).
   * It carries the FULL text of every entry the user wrote today (never
   * truncated — "all 750 words and more") plus the related past reflections the
   * RAG pipeline retrieved from the summary of today's entries. Sent as the
   * `system` message; the user turn only triggers generation.
   */
  dailyReport: (ctx: {
    name: string
    todayText: string
    relatedContext: string
    topEmotions: Array<{ name: string; score: number }>
  }): string => `You are writing a PUBLIC, social-media SHAREABLE "daily insights" card for a journaling app.

${ctx.name ? `The user's first name is ${ctx.name}.\n` : ''}TODAY'S JOURNALING — the user's complete writing for today (private — do not quote or reveal):
${ctx.todayText}

RELATED PAST REFLECTIONS — retrieved by RAG from the summary of today's entries (private — do not quote or reveal):
${ctx.relatedContext || 'None.'}

TOP EMOTIONS DETECTED TODAY: ${ctx.topEmotions.map(e => e.name).join(', ') || 'unknown'}

This card will be shared publicly. It is CRITICAL that it is safe to post:
- NEVER quote the journal text. NEVER reveal names of people, specific places, employers, health details, finances, or any identifying specifics.
- Write only abstracted, universal reflections the user would be proud to share publicly.
- Be warm, second-person ("you"), and genuinely insightful — not generic.

"insights" must be a short, declarative STATEMENT — NOT a question. Never end it with a question mark. No compound sentences, no "and how would…" tails, no stacked clauses. Favor a single clear, punchy line over anything long.

"gem" must be a HAIKU — exactly three lines — expressing a key insight or learning drawn DIRECTLY from what the user actually wrote in TODAY'S journaling above (or across several entries today). Format it as three separate lines, each line separated by a single newline character (\n), following the spirit of a haiku (three short lines, roughly a 5-7-5 syllable cadence — natural over strictly counted). It must be genuinely sourced from the substance of today's writing — not a generic platitude — yet COMPLETELY ABSTRACTED so it is safe to post publicly: render it as a universal truth anyone could relate to, never tied to the user's specific situation. Absolutely never quote the text, and never reference or even hint at any person, place, employer, health, financial, or otherwise identifying or potentially embarrassing detail — nothing that could damage the user's public image. Warm and quietly profound, not a question, no quotation marks.

Return STRICT JSON ONLY (no markdown, no preamble) with exactly these keys:
{
  "insights": "ONE short, declarative statement (under 18 words) naming the key insight from today's writing and how it relates to past reflections. A statement, not a question.",
  "findings": "1-2 sentences naming an unsurprising-but-unnoticed observation about the user from another perspective",
  "gem": "A haiku of exactly three lines (separated by \\n) expressing a key insight or learning from TODAY'S entries — genuinely grounded in what the user wrote yet fully abstracted into a universal truth, with no quotes and no identifying or sensitive details. Three short lines, roughly 5-7-5 cadence. Not a question.",
  "emotionSummary": "one warm sentence interpreting the top emotions above",
  "imageQuery": "1-3 word stock-photo search term for the emotional theme of today's writing — broad enough to always return nature/abstract results (e.g. 'forgiveness', 'calm water', 'morning light', 'renewal', 'solitude'). No people, no proper nouns, no identifiers."
}`,
}
