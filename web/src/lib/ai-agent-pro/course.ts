/* ──────────────────────────────────────────────────────────────────────────
 * Structured data for the AI Agent Pro course.
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
  Clapperboard,
  Server,
  Send,
  CloudUpload,
  type LucideIcon,
} from 'lucide-react'

/* Every course URL hangs off this, so the route can move in one edit. */
export const COURSE_BASE = '/courses/ai-agent-pro'

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
  {
    slug: 'module-3',
    n: 3,
    title: 'Media Models and Your Own Domain',
    summary:
      'Your agent gets a camera. Two skills that read the media model catalogue and price a job before running it, one photograph turned into a moving hero, a design direction taken from work you admire, and the whole site on a domain you own.',
    icon: Clapperboard,
  },
  tbdModule(4),
  {
    slug: 'module-5',
    n: 5,
    title: 'Deploy Your Agent and Sync Your Brain',
    summary:
      'Your agent moves off the laptop onto a hardened server that does not close, holding the same notes and the same skills. The vault becomes a private git repository, and a sync loop keeps both machines identical.',
    icon: Server,
  },
  {
    slug: 'module-6',
    n: 6,
    title: 'The Telegram Front Door',
    summary:
      'Your agent becomes reachable from your phone and asks permission before it acts. Deny by default, approvals you can refuse from a train platform, access tiers for a second person, and scheduled results that stay silent on quiet days.',
    icon: Send,
  },
  {
    slug: 'module-7',
    n: 7,
    title: 'Your Own Cloud Drive',
    summary:
      'Git carries five megabytes; the vault is nineteen gigabytes. Object storage takes the rest, a filter file defines the split, and a guarded two way sync keeps a laptop, a server and a bucket in step without deleting on both sides at once.',
    icon: CloudUpload,
  },
]
