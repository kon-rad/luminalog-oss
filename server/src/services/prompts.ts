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

  insights: (): string => `You are analyzing a journal entry to surface meaningful insights.
Identify 3-5 key themes, emotions, patterns, or observations from this entry. Be thoughtful and specific to what the user actually wrote. Use second person.
Format your response using Markdown: use a short \`##\` heading for each theme or section, bold (\`**text**\`) for emphasis, and \`-\` bullet lists where it helps readability. Keep the prose flowing within each section.`,

  prompts: (): string => `You are generating follow-up journaling prompts based on a journal entry.
Generate exactly 5 open-ended questions that invite deeper reflection on the themes in this entry. Each prompt must be a single sentence ending with a question mark. Number them 1-5.`,

  dailyPrompt: (): string => `You are generating a personalized daily journaling prompt.
Based on the user's recent journal entries below, ask one specific, meaningful question that invites reflection today. The question should feel deeply personal, not generic. Return only the question itself — one sentence, ending with a question mark.`,

  dailyReport: (ctx: {
    name: string
    todayText: string
    relatedContext: string
    topEmotions: Array<{ name: string; score: number }>
  }): string => `You are writing a PUBLIC, social-media SHAREABLE "daily insights" card for a journaling app.

${ctx.name ? `The user's first name is ${ctx.name}.\n` : ''}TODAY'S JOURNALING (private — do not quote or reveal):
${ctx.todayText}

RELATED PAST REFLECTIONS (private — do not quote or reveal):
${ctx.relatedContext || 'None.'}

TOP EMOTIONS DETECTED TODAY: ${ctx.topEmotions.map(e => e.name).join(', ') || 'unknown'}

This card will be shared publicly. It is CRITICAL that it is safe to post:
- NEVER quote the journal text. NEVER reveal names of people, specific places, employers, health details, finances, or any identifying specifics.
- Write only abstracted, universal reflections the user would be proud to share publicly.
- Be warm, second-person ("you"), and genuinely insightful — not generic.

Return STRICT JSON ONLY (no markdown, no preamble) with exactly these keys:
{
  "insights": "1-2 sentences of insight about today's writing and how it relates to past reflections",
  "findings": "1-2 sentences naming an unsurprising-but-unnoticed observation about the user from another perspective",
  "question": "one open-ended question (ending with '?') prompting deeper self-discovery",
  "emotionSummary": "one warm sentence interpreting the top emotions above",
  "imageQuery": "2-4 generic, safe stock-photo search words for a background image matching today's emotional theme (no people, no identifiers)"
}`,
}
