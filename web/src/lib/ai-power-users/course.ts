/* ──────────────────────────────────────────────────────────────────────────
 * Structured data for the AI Power Users course.
 *
 * Prose-free metadata shared by the overview, values, and lesson pages.
 * Lesson *prose* lives in the page components; this module holds the lists
 * that both the overview and the lessons need to stay in sync.
 * ────────────────────────────────────────────────────────────────────────── */
import {
  Handshake,
  ScrollText,
  EyeOff,
  Rocket,
  Brain,
  SquareTerminal,
  CalendarClock,
  type LucideIcon,
} from 'lucide-react'

/* Every course URL hangs off this, so the route can move in one edit. */
export const COURSE_BASE = '/courses/ai-power-users'

export interface CourseValue {
  icon: LucideIcon
  title: string
  meaning: string
  inClass: string
}

export const VALUES: CourseValue[] = [
  {
    icon: Handshake,
    title: 'Win and help win',
    meaning: "Your success and your peers' success are the same goal.",
    inClass:
      'You are graded partly on the quality of feedback you give, not just your own work.',
  },
  {
    icon: ScrollText,
    title: 'The Four Agreements',
    meaning:
      'Be impeccable with your word. Don’t take anything personally. Don’t make assumptions. Always do your best.',
    inClass:
      'The ground rules for every feedback circle and peer critique in the room.',
  },
  {
    icon: EyeOff,
    title: 'Praise in public, criticise in private',
    meaning: 'Recognition goes to the whole room. Corrections go one-to-one.',
    inClass:
      'Peer evaluation uses private written notes; breakthroughs are shared aloud.',
  },
]

/* ── Modules ───────────────────────────────────────────────────────────────
 * The course is a series of modules, not a fixed calendar week. Each module is
 * built and announced on its own; only the ones listed here without `tbd` have
 * a page behind them. Add the next module by filling in a `tbdModule` slot. */
export interface CourseModule {
  slug: string
  n: number
  title: string
  summary: string
  icon: LucideIcon
  /* Modules whose topic is not yet announced: rendered dimmed and not linked. */
  tbd?: boolean
  /* Optional extras that sit outside the five-module spine, like Module 0. */
  optional?: boolean
}

const tbdModule = (n: number): CourseModule => ({
  slug: `module-${n}`,
  n,
  title: 'TBD',
  summary: 'To be announced.',
  icon: CalendarClock,
  tbd: true,
})

export const MODULES: CourseModule[] = [
  {
    slug: 'module-0',
    n: 0,
    title: 'Fundamentals for Windows 11',
    summary:
      'The pre-course hour for anyone who has never opened a terminal. One folder, four windows: Windows Terminal, File Explorer, Handy, Obsidian, and VS Code. No AI, no agent, no code.',
    icon: SquareTerminal,
    optional: true,
  },
  {
    slug: 'module-1',
    n: 1,
    title: 'Build Your Private AI Second Brain',
    summary:
      'Install a complete private AI stack (offline speech-to-text, Obsidian, the Hermes agent, and a private Morpheus model) and build your first agent skill.',
    icon: Brain,
  },
  {
    slug: 'module-2',
    n: 2,
    title: 'Agent Mastery and Vibe Coding a Pro Website',
    summary:
      'Your AI agent writes its own tools, then builds a real client website live, start to finish, deployed to a working URL, with model research and cost tracking along the way.',
    icon: Rocket,
  },
  tbdModule(3),
  tbdModule(4),
  tbdModule(5),
]
