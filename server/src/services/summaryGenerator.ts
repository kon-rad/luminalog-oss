import { chatCompletion } from './aiClient'
import { PROMPTS } from './prompts'
import { resolveSummaryConfig, SummaryConfig } from '../config/summaryDefaults'

export const SUMMARY_MODEL = 'meta-llama/Llama-3.3-70B-Instruct-Turbo'

export async function generateSummaryText(params: {
  type: string
  content: string
  userConfig: Partial<SummaryConfig> | undefined | null
}): Promise<{ text: string; model: string; generatedAt: string }> {
  const cfg = resolveSummaryConfig(params.userConfig)
  const res = await chatCompletion(
    [
      { role: 'system', content: PROMPTS.summary(params.type, cfg) },
      { role: 'user', content: params.content },
    ],
    { model: SUMMARY_MODEL },
  )
  if (!res.ok) throw new Error(`Together AI error: ${res.status}`)
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> }
  return {
    text: data.choices[0].message.content.trim(),
    model: SUMMARY_MODEL,
    generatedAt: new Date().toISOString(),
  }
}
