/* ──────────────────────────────────────────────────────────────────────────
 * Data for the live 5-day AI Power Users program.
 *
 * Modules 1 and 2 are fully built out. The program grid gives the shape of
 * the whole course; MODULE_1_* and MODULE_2_* carry the per-module detail.
 * ────────────────────────────────────────────────────────────────────────── */
import {
  Mic,
  BookOpen,
  Code2,
  Bot,
  Network,
  SquareTerminal,
  Search,
  Shuffle,
  Wallet,
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

/* ──────────────────────────────────────────────────────────────────────────
 * MODULE 2 — Agent Mastery and Vibe Coding a Pro Website
 * One 110-minute session in two parts: the agent writes three skills for
 * itself, then vibe codes a real client website from a blank folder to a
 * live URL.
 * ────────────────────────────────────────────────────────────────────────── */

const MODULE_2_SLUG = 'module-02-agent-mastery-and-vibe-coding'
export const MODULE_2_MATERIALS_URL = `${COURSE_REPO_URL}/tree/main/modules/${MODULE_2_SLUG}`
export const MODULE_2_GUIDE_URL = `${COURSE_REPO_URL}/blob/main/modules/${MODULE_2_SLUG}/student-guide.md`

export interface AgentSkill {
  command: string
  cadence: string
  what: string
  why: string
  icon: LucideIcon
}

/* The three skills the agent writes for itself from a single brief. Command
 * names are checked against Hermes built-ins — /switch is taken (alias for
 * /sessions), and /model, /profile and /usage are built in too. */
export const MODULE_2_SKILLS: AgentSkill[] = [
  {
    command: '/models-research',
    cadence: 'Weekly, plus on demand',
    what: 'Researches text, image, video, speech and music models with live pricing from public APIs and independent leaderboards, then writes a dated briefing into your notes.',
    why: 'You stop reading “best AI tools” listicles. The data is current, sourced, and yours.',
    icon: Search,
  },
  {
    command: '/model-switch',
    cadence: 'On demand',
    what: 'Moves between four profiles — private, fast, smart and coding — and stops you before you send client data to a public provider.',
    why: 'Automating a command is a shortcut. Automating a decision is a skill.',
    icon: Shuffle,
  },
  {
    command: '/spend-report',
    cadence: 'Weekly, plus on demand',
    what: 'Incremental by design: keeps a watermark and only ever processes usage since its last run. Reports by project and model, and flags spikes.',
    why: 'A well-built tool remembers what it already did and refuses to repeat itself.',
    icon: Wallet,
  },
]

export const MODULE_2_AGENDA: AgendaItem[] = [
  {
    time: '0:00',
    title: 'Open with the payoff',
    detail: 'The finished client site on a phone, and what an agency charges for it.',
  },
  {
    time: '0:04',
    title: 'Models, tokens and the cache trap',
    detail: 'What a token really costs, why your agent gets worse over a long session, and the one habit that fixes it.',
  },
  {
    time: '0:12',
    title: 'Three skills from one brief',
    detail: 'You describe what you want; the agent writes and runs all three skills itself.',
  },
  {
    time: '0:24',
    title: 'SOUL.md and HERMES.md',
    detail: 'Who your agent is, versus how this job works — and what each one costs per message.',
  },
  {
    time: '0:31',
    title: 'Wire it into your standup',
    detail: 'Weekly, not daily. When nothing is due, it says nothing at all.',
  },
  { time: '0:34', title: 'Break', detail: 'Ten minutes.' },
  {
    time: '0:44',
    title: 'Goals and the knowledge base',
    detail: 'Interview the client, then let the agent read their photos and write the alt text and a shot list.',
  },
  {
    time: '1:03',
    title: 'Layout, functionality and architecture',
    detail: 'You describe the site out loud. Then make the AI argue against its own tech recommendation.',
  },
  {
    time: '1:23',
    title: 'Build',
    detail: 'The best agentic coding model executes the plan you approved, using the real photos.',
  },
  {
    time: '1:41',
    title: 'Verify, git, deploy',
    detail: 'Evidence not assurances, then version control and a real live URL on a real phone.',
  },
]

export const MODULE_2_STEPS: string[] = [
  'Install the engineering skills — process beats prompt',
  'Set the goals — what must this achieve, and what counts as failure?',
  'Build the knowledge base — the client interview, and the agent reads their photos',
  'Design the layout and functionality — you describe, the agent writes the spec',
  'Pick the architecture — then make the AI argue against itself',
  'Approve the plan — where a non-programmer gets their power back',
  'Build it — best coding model, real photos, real copy',
  'Verify it — evidence, not assurances',
  'Git, deploy, live URL',
  'Price it — what the work is actually worth',
]

export const MODULE_2_MCQ: QuizMCQ[] = [
  {
    question: 'What is a token?',
    options: [
      'One character',
      'One word, always',
      'A chunk of text, roughly three-quarters of a word on average',
      'One sentence',
    ],
    answer: 2,
  },
  {
    question: 'Which normally costs more per token?',
    options: [
      'Input — what you send',
      'Output — what the model writes back',
      'They always cost exactly the same',
      'Neither; you are billed per message',
    ],
    answer: 1,
  },
  {
    question: 'What is the difference between a session and a task?',
    options: [
      'Nothing, they are two words for the same thing',
      'A session is one continuous conversation where context accumulates; a task is one unit of work',
      'A task is longer than a session',
      'A session is one message, a task is one reply',
    ],
    answer: 1,
  },
  {
    question: 'What does SOUL.md hold that HERMES.md does not?',
    options: [
      'Project conventions and the tech stack for one job',
      'Your API keys',
      'Who your agent is everywhere — persona, voice, base behaviour',
      'The conversation history',
    ],
    answer: 2,
  },
  {
    question: 'Why do you check for secrets before your first commit?',
    options: [
      'Git will refuse to commit a file containing a key',
      'A key pushed to a public repository is scraped within minutes',
      'It makes the repository smaller',
      'The host will not deploy without it',
    ],
    answer: 1,
  },
]

export const MODULE_2_OPEN_QUESTIONS: string[] = [
  'Why does one-task-per-session make the prompt-cache problem disappear rather than just reduce it?',
  'Paste your goals.md. How did it help you say no to something the agent suggested?',
  'Did your agent recommend a database for the site? Was it right, and why?',
  'Paste a skill brief you wrote yourself. Could a peer build the same skill from it without asking you a question?',
]
