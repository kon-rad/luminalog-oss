import { describe, it, expect } from 'vitest'
import {
  InterviewMarkerParser,
  LIFE_INTERVIEW_SCRIPT,
  findLifeInterviewSection,
} from './lifeInterviewScript'
import { PROMPTS } from './prompts'

/** Feeds a reply in pieces and returns what would be spoken plus the tag. */
function run(deltas: string[]) {
  const parser = new InterviewMarkerParser()
  let text = ''
  let marker: any
  for (const d of deltas) {
    const out = parser.feed(d)
    text += out.text
    if (out.marker) marker = out.marker
  }
  text += parser.flush()
  return { text, marker }
}

describe('life interview script', () => {
  it('has seven sections with unique item keys that start with the section letter', () => {
    expect(LIFE_INTERVIEW_SCRIPT.sections.map((s) => s.key)).toEqual(['A', 'B', 'C', 'D', 'E', 'F', 'G'])
    const keys = LIFE_INTERVIEW_SCRIPT.sections.flatMap((s) => s.items.map((i) => i.key))
    expect(new Set(keys).size).toBe(keys.length)
    for (const section of LIFE_INTERVIEW_SCRIPT.sections) {
      expect(section.items.length).toBeGreaterThan(0)
      expect(section.opening.length).toBeGreaterThan(20)
      for (const item of section.items) expect(item.key.startsWith(section.key)).toBe(true)
    }
  })

  it('warns before the sections that ask about painful events', () => {
    expect(LIFE_INTERVIEW_SCRIPT.sections.filter((s) => s.sensitive).map((s) => s.key)).toEqual(['C', 'E'])
  })

  it('keeps item keys short enough for the tag parser', () => {
    for (const section of LIFE_INTERVIEW_SCRIPT.sections) {
      for (const item of section.items) expect(item.key).toMatch(/^[A-Z0-9]{1,6}$/)
    }
  })

  it('finds a section by key', () => {
    expect(findLifeInterviewSection('E')?.title).toBe('Challenges')
    expect(findLifeInterviewSection('Q')).toBeUndefined()
  })
})

describe('InterviewMarkerParser', () => {
  it('extracts a tag delivered in one piece', () => {
    expect(run(['[#B3] Tell me more.'])).toEqual({
      text: 'Tell me more.',
      marker: { item: 'B3', sectionComplete: false },
    })
  })

  it('extracts a tag split across deltas, character by character', () => {
    const out = run('[#C1] What happened?'.split(''))
    expect(out.text).toBe('What happened?')
    expect(out.marker).toEqual({ item: 'C1', sectionComplete: false })
  })

  it('tolerates leading whitespace and lower case', () => {
    expect(run(['\n [#a1]', ' Go on.']).marker).toEqual({ item: 'A1', sectionComplete: false })
  })

  it('reads DONE as the end of the section', () => {
    expect(run(['[#DONE] Thank you.'])).toEqual({
      text: 'Thank you.',
      marker: { item: null, sectionComplete: true },
    })
  })

  it('passes an untagged reply through untouched', () => {
    expect(run(['Take ', 'your time.'])).toEqual({ text: 'Take your time.', marker: undefined })
  })

  it('does not swallow ordinary brackets', () => {
    expect(run(['[laughs] ', 'Go on.']).text).toBe('[laughs] Go on.')
    expect(run(['[#this is not a tag] ok']).text).toBe('[#this is not a tag] ok')
  })

  it('releases a lone bracket when the stream ends', () => {
    expect(run(['['])).toEqual({ text: '[', marker: undefined })
  })

  it('only looks at the start of a reply', () => {
    const out = run(['[#B1] First. ', '[#B2] is not a tag here.'])
    expect(out.marker).toEqual({ item: 'B1', sectionComplete: false })
    expect(out.text).toBe('First. [#B2] is not a tag here.')
  })
})

describe('PROMPTS.lifeInterview', () => {
  const section = findLifeInterviewSection('C')!
  const prompt = PROMPTS.lifeInterview({
    name: 'Sam',
    section,
    currentItem: 'C1',
    resumed: false,
    sceneProbes: 'SCENE-PROBES',
    challengeProbes: 'CHALLENGE-PROBES',
  })

  it('lists every question of the section and the current one', () => {
    for (const item of section.items) expect(prompt).toContain(item.question)
    expect(prompt).toContain('the current question is C1')
    expect(prompt).toContain('[#C1]')
    expect(prompt).toContain('[#DONE]')
  })

  it('forbids advice, imposed meaning and character judgements, and carries the safety rule', () => {
    expect(prompt).toContain('Do not give advice')
    expect(prompt).toContain('Do not suggest a lesson')
    expect(prompt).toContain('Do not describe their character')
    expect(prompt).toContain('you are an AI')
    expect(prompt).toContain('crisis line')
  })

  it('does not reintroduce the interview on a fresh sitting', () => {
    expect(prompt).toContain('already spoken a short opening')
    expect(prompt).not.toContain('coming back')
  })
})
