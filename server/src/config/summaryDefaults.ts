export const DEFAULT_SUMMARY_WORD_LENGTH = 50

export const DEFAULT_SUMMARY_SYSTEM_PROMPT =
  `You are summarizing a {type} journal entry. ` +
  `Capture the key themes and emotional tone. Write in second person ` +
  `("you felt…", "you noticed…"). Be reflective and personal, not clinical.`

export interface SummaryConfig {
  wordLength: number
  systemPrompt: string
}

export function resolveSummaryConfig(
  user: Partial<SummaryConfig> | undefined | null,
): SummaryConfig {
  const wordLength =
    user && Number.isFinite(user.wordLength) && (user.wordLength as number) > 0
      ? (user.wordLength as number)
      : DEFAULT_SUMMARY_WORD_LENGTH
  const systemPrompt =
    user && typeof user.systemPrompt === 'string' && user.systemPrompt.trim().length > 0
      ? user.systemPrompt
      : DEFAULT_SUMMARY_SYSTEM_PROMPT
  return { wordLength, systemPrompt }
}
