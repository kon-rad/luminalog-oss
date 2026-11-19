import { describe, it, expect } from 'vitest'
import { STORY_TYPES, storyPrompt, isStoryType } from './storyPrompts'
describe('Story prompt parsing', () => {
  it.each(Object.keys(STORY_TYPES))('has a short single-question fallback for %s', (type) => {
    if (!isStoryType(type)) throw Error('bad type')
    const result = storyPrompt(type)
    expect(result.text.split(/\s+/).length).toBeLessThanOrEqual(25)
    expect(result.text.match(/\?/g)).toHaveLength(1)
  })
  it.each(['', 'invalid', '{"story":null}', '{"story":{"question":42}}',
    JSON.stringify({ story: { question: 'word '.repeat(26) + '?' } }),
    '{"story":{"question":"Do this. What happened?"}}'])('falls back on malformed content', (raw) => {
    expect(storyPrompt('scene', raw)).toEqual(storyPrompt('scene'))
  })
})
