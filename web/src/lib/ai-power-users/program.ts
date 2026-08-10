/* ──────────────────────────────────────────────────────────────────────────
 * Data for the live AI Power Users program.
 *
 * Modules 0, 1 and 2 are fully built out. The program grid gives the shape of
 * the whole course; MODULE_0_*, MODULE_1_* and MODULE_2_* carry the per-module
 * detail.
 * ────────────────────────────────────────────────────────────────────────── */
import {
  Mic,
  BookOpen,
  Code2,
  Bot,
  Network,
  SquareTerminal,
  FolderTree,
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
 * is the student guide inside it, the step-by-step walkthrough. */
export const COURSE_REPO_URL = 'https://github.com/kon-rad/ai-power-users-course'
export const MODULE_1_MATERIALS_URL = `${COURSE_REPO_URL}/tree/main/modules/module-01-agent-and-second-brain`
export const GUIDE_URL = `${COURSE_REPO_URL}/blob/main/modules/module-01-agent-and-second-brain/student-guide.md`

/* ──────────────────────────────────────────────────────────────────────────
 * MODULE 0, AI Power User Fundamentals for Windows 11
 * The pre-course hour, for anyone who has never opened a terminal. No AI, no
 * agent, no code. One folder, four windows. Mac and Linux students can skip it.
 * ────────────────────────────────────────────────────────────────────────── */

const MODULE_0_SLUG = 'module-00-fundamentals-windows-11'
export const MODULE_0_MATERIALS_URL = `${COURSE_REPO_URL}/tree/main/modules/${MODULE_0_SLUG}`
export const MODULE_0_GUIDE_URL = `${COURSE_REPO_URL}/blob/main/modules/${MODULE_0_SLUG}/student-guide.md`
export const MODULE_0_QUIZ_URL = `${COURSE_REPO_URL}/blob/main/modules/${MODULE_0_SLUG}/quiz.md`

/* Module 0 has its own Luma event rather than the general course calendar. */
export const MODULE_0_LUMA_URL = 'https://luma.com/tzfta4dy'

/* Two of the five are already on the machine, so `href` is optional here. */
export interface FundamentalTool {
  icon: LucideIcon
  name: string
  role: string
  source: string
  href?: string
}

export const MODULE_0_TOOLSTACK: FundamentalTool[] = [
  {
    icon: SquareTerminal,
    name: 'Windows Terminal',
    role: 'Type commands instead of clicking. A click cannot be saved, repeated, or shared. A command can.',
    source: 'Ships with Windows 11',
  },
  {
    icon: FolderTree,
    name: 'File Explorer',
    role: 'The same folders, with a mouse. Turn on file name extensions and hidden items and most beginner confusion disappears.',
    source: 'Ships with Windows 11',
  },
  {
    icon: Mic,
    name: 'Handy',
    role: 'Talk instead of type, in any application, offline. A Whisper model covers 99+ languages, including Khmer.',
    source: 'Free, open source',
    href: 'https://handy.computer',
  },
  {
    icon: BookOpen,
    name: 'Obsidian',
    role: 'Read, link, and think in your notes. A vault is just a folder, so nothing is imported and nothing is locked in.',
    source: 'Free for personal use',
    href: 'https://obsidian.md',
  },
  {
    icon: Code2,
    name: 'VS Code',
    role: 'Look at what is actually in the files. Obsidian shows your thinking, VS Code shows the files underneath.',
    source: 'Free, open source',
    href: 'https://code.visualstudio.com',
  },
]

/* What you can do by the end of the hour. Straight from the module README. */
export const MODULE_0_OBJECTIVES: string[] = [
  'Say what a terminal is, where it came from, and why it outlived the mouse.',
  'Explain what open source means, and why the file format matters more than the licence.',
  'Navigate the filesystem from the command line and read any path out loud.',
  'Create folders and files from the terminal and find the same ones in File Explorer.',
  'Copy, cut, paste, switch windows, switch tabs, and open a new tab by keyboard.',
  'Rename a file and pin a folder to the File Explorer sidebar.',
  'Open a terminal in any folder from File Explorer, and File Explorer from any terminal.',
  'Set up Handy with a Whisper model, a push-to-talk key, and recover text from history.',
  'Open a folder as an Obsidian vault and organise it with PARA.',
  'Use links, backlinks, and canvas, see all file types, and install a community plugin.',
  'Open the same folder in VS Code and install an extension.',
]

/* Install these before the session. The Whisper model download is over a
 * gigabyte and will not finish on venue wifi with thirty people trying at once. */
export const MODULE_0_PREREQS: string[] = [
  'Windows 11, 8 GB RAM, and 5 GB free disk.',
  'Install Handy, Obsidian, and VS Code from their websites.',
  'Open Handy once and download a Whisper model, before you arrive.',
]

export const MODULE_0_AGENDA: AgendaItem[] = [
  {
    time: '0:00',
    title: 'One folder, four windows',
    detail:
      'The finished state first. Four windows on the same folder: change a file in one and watch it change in the others.',
  },
  {
    time: '0:03',
    title: 'Terminal history and open source',
    detail:
      'Teletype, glass terminal, emulator. Then open source in one line, and the question that matters: what happens to your files if the company dies?',
  },
  {
    time: '0:08',
    title: 'The terminal, hands on',
    detail:
      'Read the prompt. pwd, ls, cd, cls. Tab completion and the up arrow, taught hard. Then build secondBrain and the four PARA folders.',
  },
  {
    time: '0:20',
    title: 'Windows shortcuts and File Explorer',
    detail:
      'Copy, cut, paste, undo, and the terminal gotcha where Ctrl+C only copies when text is selected. Alt+Tab, Ctrl+Tab, window snapping, F2 to rename, Pin to Quick access.',
  },
  {
    time: '0:29',
    title: 'Install the three apps',
    detail:
      'Confirm Handy, Obsidian, and VS Code are installed. What installing actually does, and what PATH is, using code --version.',
  },
  {
    time: '0:33',
    title: 'Handy: model, keys, history',
    detail:
      'Pick a Whisper model, set a push-to-talk key, then dictate into the terminal, Obsidian, and a browser. The History tab gets lost text back.',
  },
  {
    time: '0:41',
    title: 'Obsidian: vault, PARA, links',
    detail:
      'Open the same folder as a vault. PARA sorted by actionability, not subject. Links, backlinks, canvas, and your first community plugin.',
  },
  {
    time: '0:51',
    title: 'VS Code: the same folder, underneath',
    detail:
      'code . from the terminal, install an extension, then Ctrl+backtick for the built-in terminal, already standing in your folder.',
  },
  {
    time: '0:55',
    title: 'Write your Module 0 note',
    detail:
      'Create 2-areas/ai-power-users/module-00.md and fill it in live, partly dictated with Handy. That note is what you take home.',
  },
]

export const MODULE_0_MCQ: QuizMCQ[] = [
  {
    question: 'You type pwd and press Enter. What happens?',
    options: [
      'It deletes the folder you are in',
      'It prints the folder you are currently standing in',
      'It creates a new folder',
      'It asks for your password',
    ],
    answer: 1,
  },
  {
    question: 'You want to dictate in Khmer with Handy. Which model do you choose?',
    options: [
      'Any model, they all support every language',
      'The smallest one, because speed is what matters',
      'A Whisper model, because Whisper supports 99+ languages including Khmer',
      'It cannot be done offline',
    ],
    answer: 2,
  },
  {
    question: 'In an Obsidian note you type [[Terminal]]. What does that do?',
    options: [
      'Nothing, it is just text in brackets',
      'It runs a terminal command',
      'It hides the word from the reader',
      'It creates a link to a note called Terminal, and creates that note if it does not exist',
    ],
    answer: 3,
  },
  {
    question:
      'You are in a terminal, standing in your secondBrain folder, and you run start . What happens?',
    options: [
      'It starts an AI agent',
      'File Explorer opens showing that same folder',
      'It restarts the terminal',
      'It starts a new file',
    ],
    answer: 1,
  },
  {
    question: 'What is an Obsidian vault?',
    options: [
      'An encrypted container that locks your notes',
      'A cloud account where your notes are stored',
      'A normal folder on your disk that Obsidian has been pointed at',
      'A paid feature for backing up notes',
    ],
    answer: 2,
  },
  {
    question: 'You have text selected in the terminal and you press Ctrl+C. What happens?',
    options: [
      'It stops the running command',
      'It copies the selected text',
      'It closes the terminal',
      'It pastes from the clipboard',
    ],
    answer: 1,
  },
]

/* The three open questions from quiz.md, plus the two practical exercises
 * rewritten so they can be answered in writing rather than checked in the room. */
export const MODULE_0_OPEN_QUESTIONS: string[] = [
  'Explain to someone who has never used one what a terminal is, and why it still exists in 2026.',
  'You dictated a good paragraph with Handy, then the window closed before you saved it. Where is that text, and how do you get it back?',
  'Give one example from your own life of something that is an Area, and a Project that lives inside it. Explain why one is which.',
  'Open your secondBrain folder in all four windows (File Explorer, Windows Terminal, Obsidian, VS Code) without touching the mouse. List the keys you pressed, in order.',
  'Pick one note in your vault. Without opening it, use the Backlinks and Outgoing links panels to say what links to it and what it links to.',
]

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
    role: 'Offline speech-to-text. Press a key, talk, and it types for you, your voice never leaves your machine.',
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
    role: 'Inspect and edit the real files behind your agent (your notes, skills, and config) with a full code editor.',
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
    role: 'The private, decentralized model that powers the agent, an OpenAI-compatible endpoint at api.mor.org.',
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
    detail: 'The shape of the course, the three values, and how peer learning works.',
  },
  {
    time: '0:05',
    title: 'The big picture',
    detail: 'What a private AI second brain is, and the five pieces that make it.',
  },
  {
    time: '0:08',
    title: 'Install the tools',
    detail: 'Kick off Handy, Obsidian, cmux, and the Hermes install, explained as they download.',
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
 * MODULE 2, Agent Mastery and Vibe Coding a Pro Website
 * One 60-minute session: the agent writes three skills for itself, then vibe
 * codes a real client website from a blank folder to a live URL.
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
 * names are checked against Hermes built-ins, /switch is taken (alias for
 * /sessions), and /model, /profile and /usage are built in too. */
export const MODULE_2_SKILLS: AgentSkill[] = [
  {
    command: '/model-research',
    cadence: 'Weekly, plus on demand',
    what: 'Researches text, image, video, speech and music models with live pricing from public APIs and independent leaderboards, then writes a dated briefing into your notes.',
    why: 'You stop reading “best AI tools” listicles. The data is current, sourced, and yours.',
    icon: Search,
  },
  {
    command: '/switch-models',
    cadence: 'On demand',
    what: 'Moves between four profiles (private, fast, smart and coding) and stops you before you send client data to a public provider.',
    why: 'Automating a command is a shortcut. Automating a decision is a skill.',
    icon: Shuffle,
  },
  {
    command: '/spend-tracker',
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
    detail: 'Who your agent is, versus how this job works, and what each one costs per message.',
  },
  {
    time: '0:31',
    title: 'Wire it into your standup',
    detail: 'Weekly, not daily. When nothing is due, it says nothing at all.',
  },
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
  'Install the engineering skills, process beats prompt',
  'Set the goals, what must this achieve, and what counts as failure?',
  'Build the knowledge base, the client interview, and the agent reads their photos',
  'Design the layout and functionality, you describe, the agent writes the spec',
  'Pick the architecture, then make the AI argue against itself',
  'Approve the plan, where a non-programmer gets their power back',
  'Build it, best coding model, real photos, real copy',
  'Verify it, evidence, not assurances',
  'Git, deploy, live URL',
  'Price it, what the work is actually worth',
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
      'Input, what you send',
      'Output, what the model writes back',
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
      'Who your agent is everywhere, persona, voice, base behaviour',
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
