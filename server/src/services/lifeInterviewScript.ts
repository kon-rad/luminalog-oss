/**
 * The Life Story Interview: a guided voice interview about the user's whole life.
 *
 * The structure (life chapters, key scenes, future, challenges, beliefs, theme)
 * follows Dan P. McAdams' Life Story Interview II (Foley Center for the Study of
 * Lives, Northwestern University, revised 2007). The wording here is our own,
 * shortened for speech.
 *
 * This file is DATA: the sections and questions. The interviewer's rules live in
 * `PROMPTS.lifeInterview` (prompts.ts). The client fetches this script to show
 * the current question on screen and to speak the section opening locally.
 */

export interface LifeInterviewItem {
  /** Stable id, section letter plus number: "B3". Sent by the model as a tag. */
  key: string
  /** Short label for the progress UI. */
  title: string
  /** The question as asked aloud and shown on screen. */
  question: string
}

export interface LifeInterviewSection {
  /** "A" to "G". */
  key: string
  title: string
  /** Rough length of the sitting, for the UI. An estimate, not a limit. */
  minutes: number
  /** True when the section asks about painful events; the UI warns first. */
  sensitive: boolean
  /** Spoken by the phone when the sitting connects, before the first question. */
  opening: string
  items: LifeInterviewItem[]
}

export interface LifeInterviewScript {
  /** Bump when questions change so saved progress can be read against the right script. */
  version: string
  sections: LifeInterviewSection[]
}

/** What the model is told to ask for when a scene is missing detail. */
export const SCENE_PROBES =
  'what happened, when and where it was, who was there, what they were thinking and feeling, why it matters to them, and what it says about who they are'

/** What the model is told to ask for when a challenge is missing detail. */
export const CHALLENGE_PROBES =
  'what it was, how it came about, how they dealt with it, and what it has meant for their life since'

export const LIFE_INTERVIEW_SCRIPT: LifeInterviewScript = {
  version: '2026-11-18',
  sections: [
    {
      key: 'A',
      title: 'Life chapters',
      minutes: 20,
      sensitive: false,
      opening:
        "This is an interview about the story of your life. There are no right or wrong answers, and it isn't therapy. I'm here to listen. Let's start with the big picture. Imagine your life is a book. What would the main chapters be? Give each one a title and tell me a little about it.",
      items: [
        {
          key: 'A1',
          title: 'The chapters',
          question:
            'Imagine your life is a book. What are its main chapters? Give each one a title, say briefly what it is about, and how one led to the next. Two to seven chapters is plenty.',
        },
      ],
    },
    {
      key: 'B',
      title: 'Key scenes: the bright ones',
      minutes: 20,
      sensitive: false,
      opening:
        "Now a few scenes that stand out in your story. For each one, tell me what happened, where you were, who was there, and what you were thinking and feeling. Let's begin with a high point. What is a moment in your life that stands out as especially good?",
      items: [
        {
          key: 'B1',
          title: 'High point',
          question:
            'What is a moment in your life that stands out as especially good? Tell me what happened, where and when, who was there, and what you were feeling.',
        },
        {
          key: 'B2',
          title: 'Turning point',
          question:
            'Looking back, what moment changed your direction, or changed how you saw yourself? What happened, and what was different afterwards?',
        },
        {
          key: 'B3',
          title: 'Good early memory',
          question:
            'What is a happy memory from your childhood or teenage years? Tell me the scene in as much detail as you can.',
        },
        {
          key: 'B4',
          title: 'Vivid adult memory',
          question:
            'What is one scene from your adult life, one you have not told me yet, that you remember especially clearly? What happened?',
        },
      ],
    },
    {
      key: 'C',
      title: 'Key scenes: the hard and the deep',
      minutes: 20,
      sensitive: true,
      opening:
        "This part asks about some harder moments, and then two different ones. You can skip any question, just say skip. First, a low point. It doesn't have to be the lowest, only a very hard moment. What happened?",
      items: [
        {
          key: 'C1',
          title: 'Low point',
          question:
            'What is a low point in your story? It does not have to be the lowest, only a very hard moment. What happened, and what were you thinking and feeling?',
        },
        {
          key: 'C2',
          title: 'Hard early memory',
          question:
            'What is a difficult memory from your childhood or teenage years? Tell me as much or as little as you want.',
        },
        {
          key: 'C3',
          title: 'Something larger',
          question:
            'Have you had a moment where you felt part of something larger than yourself? It might be spiritual, or in nature, or with other people. What happened?',
        },
        {
          key: 'C4',
          title: 'A wise moment',
          question:
            'Tell me about a time you acted wisely, made a wise choice, or gave someone good advice. What happened?',
        },
      ],
    },
    {
      key: 'D',
      title: 'What comes next',
      minutes: 10,
      sensitive: false,
      opening:
        "Your story also includes where it's going. Let's talk about the future. What do you see as the next chapter of your life?",
      items: [
        {
          key: 'D1',
          title: 'The next chapter',
          question: 'What do you see as the next chapter of your life? What is coming?',
        },
        {
          key: 'D2',
          title: 'Hopes and plans',
          question: 'What are your hopes, dreams and plans for that chapter? What do you most want to happen?',
        },
        {
          key: 'D3',
          title: 'Life project',
          question:
            'Is there a project you are giving your life to, in work, family or anything else? What is it, how did you come to it, and why does it matter to you or to others?',
        },
      ],
    },
    {
      key: 'E',
      title: 'Challenges',
      minutes: 20,
      sensitive: true,
      opening:
        "This part is about the challenges in your life: the hardest one, then health, loss and regret. Skip anything you'd prefer not to tell. Looking back over your whole life, what has been the greatest challenge you have faced?",
      items: [
        {
          key: 'E1',
          title: 'Greatest challenge',
          question:
            'What has been the greatest challenge you have faced? How did it come about, how did you deal with it, and what has it meant for your life?',
        },
        {
          key: 'E2',
          title: 'Health',
          question:
            'Has there been a time when your health, or the health of someone close to you, became a serious problem? What happened, and how did you cope?',
        },
        {
          key: 'E3',
          title: 'Loss',
          question:
            'What is the greatest loss of a person you have lived through, by death or by separation? How did you cope, and how has it shaped you?',
        },
        {
          key: 'E4',
          title: 'Failure or regret',
          question:
            'What is the failure or regret that stays with you most? How did it happen, and how have you lived with it?',
        },
      ],
    },
    {
      key: 'F',
      title: 'What you believe',
      minutes: 15,
      sensitive: false,
      opening:
        "Now a few questions about what you believe and value. Take your time with these. To start, how would you describe your beliefs about what is right and what matters, religious or not?",
      items: [
        {
          key: 'F1',
          title: 'Ethics and faith',
          question:
            'How would you describe your beliefs about what is right and what matters? If religion or spirituality is part of your life, tell me about that too.',
        },
        {
          key: 'F2',
          title: 'The wider world',
          question:
            'How do you think about social or political questions? Are there causes you care strongly about?',
        },
        {
          key: 'F3',
          title: 'How your views changed',
          question: 'How have your beliefs and values changed over your life? What changed them?',
        },
        {
          key: 'F4',
          title: 'One value',
          question: 'What do you think is the most important value in human life? Why that one?',
        },
      ],
    },
    {
      key: 'G',
      title: 'The theme',
      minutes: 10,
      sensitive: false,
      opening:
        "This is the last part. Think back over everything: the chapters, the scenes, the challenges, and where you're headed. Do you see a theme or an idea that runs through your whole story?",
      items: [
        {
          key: 'G1',
          title: 'Life theme',
          question:
            'Looking over your whole story, past and future, do you see a central theme or idea that runs through it? What is it?',
        },
        {
          key: 'G2',
          title: 'Anything else',
          question: 'Is there anything else I should know to understand your life story?',
        },
      ],
    },
  ],
}

export function findLifeInterviewSection(key: string): LifeInterviewSection | undefined {
  return LIFE_INTERVIEW_SCRIPT.sections.find((s) => s.key === key)
}

/** The tag the model writes when the section is finished. */
export const INTERVIEW_DONE_TAG = 'DONE'

export interface InterviewMarker {
  /** Item key the reply is about, or null when the section is finished. */
  item: string | null
  sectionComplete: boolean
}

/**
 * Pulls the leading `[#B3]` or `[#DONE]` tag out of a streamed reply.
 *
 * The interviewer starts every reply with the tag of the item it is on. The tag
 * must never be spoken, so text is held back until we know whether the reply
 * starts with one. Deltas can split the tag anywhere.
 */
export class InterviewMarkerParser {
  private buffer = ''
  private settled = false
  private trimLeading = false
  /** Longest tag we wait for: "[#" + up to 6 characters + "]". */
  private static readonly MAX_TAG_LENGTH = 9

  /** Feed one streamed delta. Returns the text safe to speak and the tag, once. */
  feed(delta: string): { text: string; marker?: InterviewMarker } {
    if (this.settled) {
      if (!this.trimLeading) return { text: delta }
      // The space after the tag can arrive in a later delta than the tag itself.
      const text = delta.replace(/^\s+/, '')
      if (text.length > 0) this.trimLeading = false
      return { text }
    }
    this.buffer += delta
    const candidate = this.buffer.trimStart()
    if (candidate.length === 0) return { text: '' }

    const prefix = '[#'
    const couldBeTag =
      candidate.length < prefix.length ? prefix.startsWith(candidate) : candidate.startsWith(prefix)
    if (!couldBeTag) return this.settle(this.buffer)

    const close = candidate.indexOf(']')
    if (close === -1) {
      // Still open: keep waiting unless it has run on too long to be a tag.
      if (candidate.length <= InterviewMarkerParser.MAX_TAG_LENGTH) return { text: '' }
      return this.settle(this.buffer)
    }
    const tag = candidate.slice(prefix.length, close).trim().toUpperCase()
    const rest = candidate.slice(close + 1).replace(/^\s+/, '')
    if (!/^[A-Z0-9]{1,6}$/.test(tag)) return this.settle(this.buffer)
    this.settled = true
    this.buffer = ''
    this.trimLeading = rest.length === 0
    const marker: InterviewMarker =
      tag === INTERVIEW_DONE_TAG ? { item: null, sectionComplete: true } : { item: tag, sectionComplete: false }
    return { text: rest, marker }
  }

  /** Call when the stream ends: releases anything still held back. */
  flush(): string {
    if (this.settled) return ''
    this.settled = true
    const held = this.buffer
    this.buffer = ''
    return held
  }

  private settle(text: string): { text: string } {
    this.settled = true
    this.buffer = ''
    return { text }
  }
}
