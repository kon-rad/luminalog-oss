// Non-sensitive type data only. All model instructions live in prompts.ts.
export const STORY_TYPES = {
  scene: { label: 'Scene', text: 'What is one moment from today you would want to remember?' },
  title: { label: 'Title the day', text: 'If today were a chapter, what would you call it?' },
  wisdom: { label: 'Wisdom', text: 'What is one thing you handled well today?' },
  choice: { label: 'Deliberate choice', text: 'What is one thing you deliberately chose to do today?' },
  connection: { label: 'Connection', text: 'What moment with another person stands out from today?' },
  tellSomeone: { label: 'Tell someone', text: 'What moment from today would you like to tell someone about?' },
  energy: { label: 'Energy', text: 'What is one thing that gave you energy today?' },
  yourself: { label: 'Most like yourself', text: 'When did you feel most like yourself today?' },
} as const
export type StoryType = keyof typeof STORY_TYPES
export const STORY_TYPE_ORDER = Object.keys(STORY_TYPES) as StoryType[]
export function isStoryType(value: unknown): value is StoryType {
  return typeof value === 'string' && Object.hasOwn(STORY_TYPES, value)
}
export function storyPrompt(type: StoryType, raw?: string) {
  let text = STORY_TYPES[type].text as string
  try {
    const parsed = JSON.parse(raw?.match(/\{[\s\S]*\}/)?.[0] ?? '')
    const question = parsed.story?.question ?? parsed.story?.text
    if (typeof question === 'string') {
      const q = question.trim()
      if (q.length <= 240 && q.split(/\s+/).length <= 25 &&
          q.endsWith('?') && (q.match(/\?/g) ?? []).length === 1 && !/[\r\n.!]/.test(q)) text = q
    }
  } catch { /* Safe fallback, without another model call. */ }
  return { area: STORY_TYPES[type].label, text, storyType: type }
}

/** A missing or malformed model item falls back independently for that type. */
export function storyPromptSet(raw?: string) {
  let stories: unknown[] = []
  try {
    const parsed = JSON.parse(raw?.match(/\{[\s\S]*\}/)?.[0] ?? '')
    stories = Array.isArray(parsed.stories) ? parsed.stories : []
  } catch { /* Every type receives its safe fallback. */ }
  return STORY_TYPE_ORDER.map(type => {
    const item = stories.find((candidate: any) => candidate?.storyType === type) as any
    return storyPrompt(type, JSON.stringify({ story: { question: item?.question ?? item?.text } }))
  })
}
