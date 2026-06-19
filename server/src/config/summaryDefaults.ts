import { DEFAULT_SUMMARY_SYSTEM_PROMPT } from '../services/prompts'

export const DEFAULT_SUMMARY_WORD_LENGTH = 50

// Prompt text is owned by services/prompts.ts (the single home for LLM prompts).
export { DEFAULT_SUMMARY_SYSTEM_PROMPT }

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
