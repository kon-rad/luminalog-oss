import { describe, expect, it } from 'vitest'
import { classify } from './classify'

describe('classify', () => {
  it('tags the new categories that used to fall through to OTHER', () => {
    expect(classify('Kids Wholistic Creativity and STEM Class #004')).toBe('KIDS_STEM')
    expect(classify('Hatha-Vinyasa Yoga')).toBe('YOGA')
    expect(classify('K-Pop Dance Lesson by Adina')).toBe('DANCE')
    expect(classify('Sauna🔥+ Ice bath🧊')).toBe('WELLNESS')
    expect(classify('Beach Vibes Party')).toBe('SOCIAL')
    expect(classify('Tech, Creativity and Spirituality Dinner [MYBW]')).toBe('SOCIAL')
    expect(classify('Coffee & Network (Near to Venue)')).toBe('SOCIAL')
  })

  it('keeps the existing categories working', () => {
    expect(classify('Muay Thai at NS Gym')).toBe('MUAY_THAI')
    expect(classify('Robotics Club 007')).toBe('ROBOTICS_CLUB')
    expect(classify('Demos, Pitches, and Talks')).toBe('DEMO_DAY')
    expect(classify('Code is Law: Film Screening & Discussion')).toBe('FILM_DISCUSSION')
    expect(classify('Synthesis Hackathon Cobuild Session')).toBe('HACKATHON')
    expect(classify('OpenClaw Use Cases Workshop')).toBe('WORKSHOP')
    expect(classify('Zero to Agent: Launch OpenClaw on Augmi.world')).toBe('WORKSHOP')
    expect(classify('Crypto Natives Trip to Bank and Art Museum')).toBe('OTHER')
  })

  it('classifies both AI Power Users sessions as workshops', () => {
    // "Module 2" matches on `agent`, but "Day 1" only matches on the course name.
    expect(classify('AI Power Users · Module 2: Agent Mastery and Vibe Coding')).toBe('WORKSHOP')
    expect(classify('AI Power Users · Day 1: Build Your Private AI Second Brain')).toBe('WORKSHOP')
  })

  it('matches the Luma typo in "Robtics Club 010"', () => {
    expect(classify('Robtics Club 010')).toBe('ROBOTICS_CLUB')
  })

  it('does not let a specific rule steal a title from a broader one', () => {
    // `stem` is word-bounded, so these must not read as a Kids STEM class.
    expect(classify('Building Agent Systems')).toBe('WORKSHOP')
    expect(classify('The Onchain Ecosystem Hackathon')).toBe('HACKATHON')
    // `network` is deliberately not a SOCIAL trigger: "Network School" is everywhere.
    expect(classify('Muay Thai at Network School')).toBe('MUAY_THAI')
  })
})
