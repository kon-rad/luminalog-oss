/* ──────────────────────────────────────────────────────────────────────────
 * Data for the live 5-day AI Power Users program.
 *
 * Only Module 1 is fully built out. The program grid gives the shape of the
 * whole course; MODULE_1 carries the detail the module-1 page renders.
 * ────────────────────────────────────────────────────────────────────────── */
import {
  Mic,
  BookOpen,
  Code2,
  Bot,
  Network,
  SquareTerminal,
  type LucideIcon,
} from 'lucide-react'
import { LUMA_CALENDAR_URL } from '@/lib/events/luma'

/* Sessions are announced on the same Luma calendar as everything else. */
export const LUMA_URL = LUMA_CALENDAR_URL
export const YOUTUBE_URL = 'https://www.youtube.com/@myargoquest'

/* Course materials are open source. MODULE_1_MATERIALS_URL points at this
 * class's module folder (agenda, quiz, livestream script, assets); GUIDE_URL
 * is the student guide inside it — the step-by-step walkthrough. */
export const COURSE_REPO_URL = 'https://github.com/kon-rad/ai-power-users-course'
export const MODULE_1_MATERIALS_URL = `${COURSE_REPO_URL}/tree/main/modules/module-01-agent-and-second-brain`
export const GUIDE_URL = `${COURSE_REPO_URL}/blob/main/modules/module-01-agent-and-second-brain/student-guide.md`

export interface Tool {
  icon: LucideIcon
  name: string
  role: string
  free: string
  openSource: boolean
  href: string
}

export const TOOLSTACK: Tool[] = [
  {
    icon: Mic,
    name: 'Handy',
    role: 'Offline speech-to-text. Press a key, talk, and it types for you — your voice never leaves your machine.',
    free: 'Free',
    openSource: true,
    href: 'https://handy.computer',
  },
  {
    icon: BookOpen,
    name: 'Obsidian',
    role: 'Your window into your notes. Turns a folder of Markdown files into a searchable, linked knowledge base.',
    free: 'Free (personal)',
    openSource: false,
    href: 'https://obsidian.md',
  },
  {
    icon: Code2,
    name: 'VS Code',
    role: 'Inspect and edit the real files behind your agent — your notes, skills, and config — with a full code editor.',
    free: 'Free',
    openSource: true,
    href: 'https://code.visualstudio.com',
  },
  {
    icon: Bot,
    name: 'Hermes',
    role: 'The AI agent. Lives in your folder and can read, write, and act on your notes. From Nous Research.',
    free: 'Free',
    openSource: true,
    href: 'https://hermes-agent.nousresearch.com',
  },
  {
    icon: Network,
    name: 'Morpheus',
    role: 'The private, decentralized model that powers the agent — an OpenAI-compatible endpoint at api.mor.org.',
    free: 'Free to start',
    openSource: true,
    href: 'https://mor.org',
  },
  {
    icon: SquareTerminal,
    name: 'cmux',
    role: 'A terminal built for running AI agents (macOS). On Windows or Linux, your normal terminal works.',
    free: 'Free',
    openSource: true,
    href: 'https://github.com/manaflow-ai/cmux',
  },
]

export interface AgendaItem {
  time: string
  title: string
  detail: string
}

export const MODULE_1_AGENDA: AgendaItem[] = [
  {
    time: '0:00',
    title: 'Welcome & course intro',
    detail: 'The 5-day shape — one topic a day — the six values, and how peer learning works.',
  },
  {
    time: '0:05',
    title: 'The big picture',
    detail: 'What a private AI second brain is, and the five pieces that make it.',
  },
  {
    time: '0:08',
    title: 'Install the tools',
    detail: 'Kick off Handy, Obsidian, cmux, and the Hermes install — explained as they download.',
  },
  {
    time: '0:14',
    title: 'Private LLM: Morpheus',
    detail: "Create an account, generate an API key, and see what's free.",
  },
  {
    time: '0:20',
    title: 'Build the second brain',
    detail: 'Create the folder, set up the PARA structure, open it as an Obsidian vault.',
  },
  {
    time: '0:28',
    title: 'Run & connect the agent',
    detail: 'Launch Hermes inside your folder and connect it to Morpheus.',
  },
  {
    time: '0:36',
    title: 'Your first skill: daily standup',
    detail: 'Create and run a skill that reviews your projects and saves a dated standup note.',
  },
  {
    time: '0:43',
    title: "Recap & what's next",
    detail: 'Preview Module 2 and 3, homework, and the quiz.',
  },
]

export interface QuizMCQ {
  question: string
  options: string[]
  answer: number // index of the correct option
}

export const MODULE_1_MCQ: QuizMCQ[] = [
  {
    question: 'What is the main purpose of the PARA method in your second brain?',
    options: [
      'To encrypt your notes',
      'To organise everything into four buckets: Projects, Areas, Resources, Archives',
      'To back up your notes to the cloud',
      'To convert speech to text',
    ],
    answer: 1,
  },
  {
    question: 'Why do we launch the Hermes agent from inside your SecondBrain folder?',
    options: [
      'So it runs faster',
      'So its working directory is your notes, letting it read and write them',
      'Because Hermes can only be installed there',
      'So Obsidian can see the agent',
    ],
    answer: 1,
  },
  {
    question: 'What role does Morpheus play in the stack?',
    options: [
      "It's the note-taking app",
      "It's the speech-to-text engine",
      "It's the private, decentralized model that powers the agent",
      "It's the terminal you run agents in",
    ],
    answer: 2,
  },
  {
    question: 'Handy keeps your voice private because it…',
    options: [
      "Encrypts audio before uploading it to Handy's servers",
      'Runs speech-to-text completely offline on your own machine',
      "Only works when you're disconnected from the internet",
      'Deletes recordings after 24 hours',
    ],
    answer: 1,
  },
  {
    question: 'You connect Hermes to Morpheus by setting which two things?',
    options: [
      'A username and password',
      'OPENAI_BASE_URL (api.mor.org/api/v1) and OPENAI_API_KEY (your Morpheus key)',
      'Your Wi-Fi name and a phone number',
      'The Obsidian vault path and a theme',
    ],
    answer: 1,
  },
]

export const MODULE_1_OPEN_QUESTIONS: string[] = [
  "In plain language, what is a 'private AI second brain,' and how is it different from just using a chatbot on a website?",
  'Describe what each of the six tools does and how they connect: Handy, Obsidian, VS Code, Hermes, Morpheus, cmux.',
  'Explain the PARA method. Give one real example of something in your own life that would go in each of the four buckets.',
  'What is a Hermes skill? Describe, in your own words, what your daily-standup skill does step by step.',
  'Why might someone choose a private/decentralized model like Morpheus over a mainstream cloud chatbot? Give at least one benefit and one trade-off.',
]
