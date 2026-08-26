/* ──────────────────────────────────────────────────────────────────────────
 * Data for the live AI Agent Pro program.
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
  FileText,
  Film,
  Boxes,
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
 * MODULE 0, AI Agent Pro Fundamentals for Windows 11
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

/* Install these before the session. */
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

/* ──────────────────────────────────────────────────────────────────────────
 * MODULE 3, Media Models and Your Own Domain
 * One 60-minute session: the agent gets access to image and video models,
 * turns a photograph into a moving hero, takes a design direction from work
 * the student admires, and puts the site on a domain they own.
 * ────────────────────────────────────────────────────────────────────────── */

const MODULE_3_SLUG = 'module-03-media-models-and-your-own-domain'
export const MODULE_3_MATERIALS_URL = `${COURSE_REPO_URL}/tree/main/modules/${MODULE_3_SLUG}`
export const MODULE_3_GUIDE_URL = `${COURSE_REPO_URL}/blob/main/modules/${MODULE_3_SLUG}/student-guide.md`

/* The two skills the agent writes for itself. Neither hardcodes a model name:
 * media models change monthly, so the skill is told where to look, not what to
 * use. Checked against Hermes built-ins; neither name is shadowed. */
export const MODULE_3_SKILLS: AgentSkill[] = [
  {
    command: '/media-models',
    cadence: 'Monthly, plus on demand',
    what: 'Reads the fal catalogue and writes a dated briefing: endpoint ids, exact prices with their units, input fields, resolution and duration caps, and what one five second 1080p clip costs from each pick.',
    why: 'Module 2 taught your agent what is good. This one tells it what it can actually call. A leaderboard cannot be pasted into code.',
    icon: Search,
  },
  {
    command: '/media-gen',
    cadence: 'On demand',
    what: 'Picks the family, picks the endpoint from the latest briefing, estimates the cost and shows you the number before spending it, generates two variants, converts video for the web, and logs what it actually cost.',
    why: 'The cost gate is four lines of the brief and it is the whole difference between a tool and a liability.',
    icon: Wallet,
  },
]

export const MODULE_3_AGENDA: AgendaItem[] = [
  {
    time: '0:00',
    title: 'Open with the payoff',
    detail:
      'The Module 2 site and the finished site side by side. Static hero against moving hero, preview URL against a real domain. The cost of the session, said out loud.',
  },
  {
    time: '0:03',
    title: 'macOS ground rules, reopen the project',
    detail:
      'The Mac equivalents table, ffmpeg installed, then the agent caught up on the job from HERMES.md rather than from you retyping it.',
  },
  {
    time: '0:08',
    title: 'The key and where it lives',
    detail:
      'A fal account with a spend limit. The key into .env, and .env into .gitignore first, in that order. Then git status proves it, and the agent scans the repo for credentials.',
  },
  {
    time: '0:13',
    title: 'Two skills from one brief',
    detail:
      'You describe what you want once; the agent writes both skills and runs each of them. The cost gate gets pointed at on camera.',
  },
  {
    time: '0:25',
    title: 'Read a catalogue properly',
    detail:
      'Mixed units, the wrong family, resolution and duration caps. Work out what one five second 1080p clip costs before generating it.',
  },
  {
    time: '0:31',
    title: 'The hero video',
    detail:
      'One photograph, a slow push in with a lateral drift, two variants. Then ffmpeg to a web ready mp4 and a poster frame, under 2 MB.',
  },
  {
    time: '0:38',
    title: 'Design by example',
    detail:
      'Screenshot three to five sites you admire. The agent extracts type, space, colour, hierarchy and motion into design-brief.md. Rules, not adjectives, and where the copying line sits.',
  },
  {
    time: '0:46',
    title: 'Rebuild',
    detail:
      'Apply the design brief and the hero video. Muted, playsinline, a poster frame, and reduced motion respected. Checked at 375px live.',
  },
  {
    time: '0:53',
    title: 'Domain and deploy',
    detail:
      'Buy it live, attach it, pick apex or www, check the certificate, and turn on auto renew where the class can see it.',
  },
]

export const MODULE_3_STEPS: string[] = [
  'macOS ground rules, and the agent catches up from HERMES.md',
  'The fal key, stored so git never sees it',
  'Build /media-models and /media-gen from one brief',
  'Run the discovery, and read your own model briefing',
  'One photograph becomes a five second hero clip',
  'Five screenshots become a design brief of rules, not adjectives',
  'Rebuild the site with the direction and the video',
  'Buy the domain, attach it, confirm HTTPS is live',
]

export const MODULE_3_MCQ: QuizMCQ[] = [
  {
    question:
      'You have a photograph of a finished fence and you want a five second clip of it with a slow camera move. Which model family is that?',
    options: ['Text to image', 'Text to video', 'Image to video', 'Image editing'],
    answer: 2,
  },
  {
    question: 'Video models are normally priced by:',
    options: ['The file', 'The second of generated video', 'The prompt', 'The month'],
    answer: 1,
  },
  {
    question: 'Why does .env go into .gitignore before the key goes into .env?',
    options: [
      'Git refuses to create a file that is already ignored',
      'Git tracks a file from the moment it is first committed, so ignoring it afterwards does not remove it from history',
      'It makes the repository smaller',
      'Vercel reads .gitignore to find your keys',
    ],
    answer: 1,
  },
  {
    question: 'A hero video needs muted and playsinline because:',
    options: [
      'They compress the file',
      'Without both, iOS refuses to autoplay the video inline',
      'They are required for the poster image to show',
      'They stop the video looping',
    ],
    answer: 1,
  },
  {
    question: 'What happens to a domain you do not renew?',
    options: [
      'Nothing, a domain is bought once',
      'It stays yours but stops resolving',
      'It expires and eventually returns to the market for anyone to register',
      'Your host keeps it active for free',
    ],
    answer: 2,
  },
]

export const MODULE_3_OPEN_QUESTIONS: string[] = [
  'Your image to video clip got something wrong. What was it, and why is that failure predictable?',
  'Paste three rules from your design-brief.md. Why are they rules and not adjectives?',
  'What did one five second clip cost you, and how did you know before you ran it?',
  'Apex or www, which did you make canonical, and what breaks if you do neither?',
]

/* ──────────────────────────────────────────────────────────────────────────
 * MODULE 5, Deploy Your Agent and Sync Your Brain
 * The first module with a recurring cost. The vault becomes a private git
 * repository, then the agent moves onto a hardened Droplet that does not close.
 * ────────────────────────────────────────────────────────────────────────── */

const MODULE_5_SLUG = 'module-05-deploy-your-agent-and-sync-your-brain'
export const MODULE_5_MATERIALS_URL = `${COURSE_REPO_URL}/tree/main/modules/${MODULE_5_SLUG}`
export const MODULE_5_GUIDE_URL = `${COURSE_REPO_URL}/blob/main/modules/${MODULE_5_SLUG}/student-guide.md`

export const MODULE_5_AGENDA: AgendaItem[] = [
  {
    time: '0:00',
    title: 'Open with the payoff',
    detail:
      'Obsidian and a server terminal side by side. Brief the server, and the note appears on the laptop without touching it. Then the cost, said out loud, because it recurs.',
  },
  {
    time: '0:03',
    title: 'Measure your own vault',
    detail:
      'Four commands on your own notes. The host vault is 16 GB and the markdown inside it is 4.7 MB. Nobody designs a sync before knowing that ratio.',
  },
  {
    time: '0:08',
    title: 'Git, in the order that matters',
    detail:
      'The ignore list is written before the first commit, because git tracks a file from the moment it is committed and no amount of ignoring afterwards removes it.',
  },
  {
    time: '0:16',
    title: 'Skills move into the repo',
    detail:
      'Your own skills into .hermes/skills/, then hermes skills trust, then /skills proves they loaded as project skills. Precedence, and why the curator never touches them.',
  },
  {
    time: '0:26',
    title: 'Create and harden the Droplet',
    detail:
      'A non root user, a cloud firewall, and a second SSH session confirmed before root is locked out. UFW, fail2ban, unattended upgrades. The order is what stops you locking yourself out.',
  },
  {
    time: '0:34',
    title: 'Hermes in Docker',
    detail:
      'No published port, and a write sandbox extended to reach the vault. The three config settings that are wrong by default for a box nobody is watching.',
  },
  {
    time: '0:42',
    title: 'Clone the brain, trust the repo',
    detail:
      'A credential scoped to one repository with a mandatory expiry, created on camera. Then the confirmation brief, written to surface the write error rather than route around it.',
  },
  {
    time: '0:50',
    title: 'Close the loop',
    detail:
      'Write lanes so conflicts are prevented rather than resolved, a push script on a plain crontab, and the proof: a note written on the server, read in Obsidian on the laptop.',
  },
]

export const MODULE_5_STEPS: string[] = [
  'Measure the vault, and separate what must sync from what must not',
  'Write the ignore list before the first commit, not after',
  'Read the staged size before committing anything',
  'Push to a private GitHub repository',
  'Move your own skills in so they travel with the vault',
  'Create a Droplet and harden it in an order that cannot lock you out',
  'Run Hermes in Docker with no open port and an extended write sandbox',
  'Give the server a credential scoped to one repository',
  'Clone the brain onto it and prove the project skills load',
  'Close the loop: a push job on cron, and Obsidian pulling on the laptop',
]

export const MODULE_5_MCQ: QuizMCQ[] = [
  {
    question: 'Why must .gitignore be written before the first commit and not after?',
    options: [
      'git init refuses to run if the file is missing',
      'Git tracks a file from its first commit, so ignoring it afterwards leaves it in history and in every clone',
      'The ignore file only applies to files created after it exists',
      'GitHub rejects pushes larger than 50 MB',
    ],
    answer: 1,
  },
  {
    question: 'Your vault is 16 GB and the markdown in it is 4.7 MB. What does that tell you?',
    options: [
      'You need block storage on the server',
      'The vault is too big to sync and should stay local',
      'The part that has to sync is small, and the size problem is media and dependencies that do not need to move',
      'You should compress the vault before syncing',
    ],
    answer: 2,
  },
  {
    question: 'Where does Hermes look for project skills?',
    options: [
      'In ~/.hermes/skills/ only',
      'In <project-root>/.hermes/skills/, where the project root is the nearest ancestor containing .git',
      'In any directory listed in PATH',
      'In the directory the gateway was started from, regardless of git',
    ],
    answer: 1,
  },
  {
    question:
      'You mount your vault at /opt/brain in the official Hermes Docker image and the agent cannot write notes. Why?',
    options: [
      'The container has no network access',
      'The volume was mounted read only',
      'The image sets HERMES_WRITE_SAFE_ROOT=/opt/data, so writes outside it are blocked',
      'write_file requires an approval that never arrives',
    ],
    answer: 2,
  },
  {
    question: 'Which of these should never be synced between your laptop and your server?',
    options: [
      'Research/notes.md',
      '.hermes/skills/my-skill/SKILL.md',
      '.gitignore',
      '~/.hermes/state.db',
    ],
    answer: 3,
  },
]

export const MODULE_5_OPEN_QUESTIONS: string[] = [
  "Post your vault's total size and its markdown size. What would have gone wrong if you had synced the whole directory?",
  'You gave your server a credential so it could push to GitHub. What exactly can that credential do, and what can it not do?',
  'Why does the push job use the system crontab instead of Hermes cron?',
  'Your laptop agent and your server agent share a folder but not a mind. Name one thing that gets worse because of that, and one thing that gets safer.',
]

/* ──────────────────────────────────────────────────────────────────────────
 * MODULE 6, The Telegram Front Door
 * Costs nothing: Telegram is free and the server is already paid for. Half the
 * hour goes on who is allowed through the door, because the agent behind it can
 * run commands on a real machine.
 * ────────────────────────────────────────────────────────────────────────── */

const MODULE_6_SLUG = 'module-06-telegram-front-door'
export const MODULE_6_MATERIALS_URL = `${COURSE_REPO_URL}/tree/main/modules/${MODULE_6_SLUG}`
export const MODULE_6_GUIDE_URL = `${COURSE_REPO_URL}/blob/main/modules/${MODULE_6_SLUG}/student-guide.md`

export const MODULE_6_AGENDA: AgendaItem[] = [
  {
    time: '0:00',
    title: 'Open with the payoff',
    detail:
      'A phone mirrored on screen. The agent reads a note off the server and replies. Then it asks permission to delete something, and the prompt gets denied on camera.',
  },
  {
    time: '0:03',
    title: 'The token and your user ID',
    detail:
      'BotFather returns a token, which is a credential and gets cropped on stream. Then your numeric user ID, because a username can be changed by whoever holds the account.',
  },
  {
    time: '0:09',
    title: 'The allowlist, and deny by default',
    detail:
      'Six checks, and the bottom one is deny. With nothing configured the bot answers nobody. Ask the agent to edit .env and watch it refuse, then edit it by hand.',
  },
  {
    time: '0:16',
    title: 'Restart, and the first message',
    detail:
      'One restart, one message, and a firewall check proving no inbound port was opened. Long polling means the agent reaches out, which is the opposite of what people expect.',
  },
  {
    time: '0:26',
    title: 'The approval prompt',
    detail:
      'Approve one, deny one, then walk away from the phone and let one time out. Unanswered means denied, and that is only reassuring once you have watched it happen.',
  },
  {
    time: '0:34',
    title: 'Tiers and pairing',
    detail:
      'Admin commands split from user commands, then a volunteer paired in as a non admin, blocked from a command they do not have, and revoked.',
  },
  {
    time: '0:42',
    title: 'Scheduled results in your pocket',
    detail:
      'A morning digest that stays silent on the mornings nothing happened. A monitor that reports every healthy run is noise you will learn to ignore.',
  },
  {
    time: '0:50',
    title: 'Scripts, with no agent involved',
    detail:
      'When the text is already decided, send it. No model, no gateway, no tokens spent. Wire it into the sync job from Module 5, then break it on purpose.',
  },
]

export const MODULE_6_STEPS: string[] = [
  'Create the bot and get a token from BotFather',
  'Find your numeric user ID, not your username',
  'Add both to the server by hand, because the agent will refuse',
  'Restart, say hello, and prove no port was opened',
  'See the approval flow: approve one, deny one, let one time out',
  'Split admin from user commands, then pair someone and revoke them',
  'Route scheduled results to your phone, silent when nothing changed',
  'Message yourself from a shell script with no model involved',
]

export const MODULE_6_MCQ: QuizMCQ[] = [
  {
    question:
      'You install the gateway, add your bot token, and configure no allowlist at all. Who can talk to your bot?',
    options: [
      'Anyone who finds the bot username',
      'Anyone in your Telegram contacts',
      'Nobody. The gateway denies every user by default',
      'Only people in the same group as the bot',
    ],
    answer: 2,
  },
  {
    question: 'Adding Telegram to your server means opening which inbound port?',
    options: [
      '443, for the webhook',
      '8642, for the gateway API',
      'None. Long polling means the agent connects outward',
      '80 and 443',
    ],
    answer: 2,
  },
  {
    question: 'An approval prompt arrives on your phone and you never answer it. What happens?',
    options: [
      'It approves after the timeout so work is not blocked',
      'It is denied after the timeout',
      'It waits indefinitely until you reply',
      'It retries the command with reduced permissions',
    ],
    answer: 1,
  },
  {
    question:
      'Your morning cron job messages you every single day, including days you did nothing. What is missing?',
    options: [
      'A lower rate_limit setting',
      'The [SILENT] instruction in the job prompt',
      'TELEGRAM_HOME_CHANNEL',
      'require_mention: true',
    ],
    answer: 1,
  },
  {
    question: 'You ask your agent to add the bot token to ~/.hermes/.env and it refuses. Why?',
    options: [
      'It needs an approval you did not give',
      'The file does not exist yet',
      'Hermes hard blocks writes to any .env, with no approval prompt and no override from chat',
      'The container is running as the wrong user',
    ],
    answer: 2,
  },
]

export const MODULE_6_OPEN_QUESTIONS: string[] = [
  'Your bot token appears in a screen recording you already published. Walk through what you do, in order.',
  'Someone says "just set GATEWAY_ALLOW_ALL_USERS=true, it is easier." What is your answer?',
  'Why does hermes send not need a model or a running gateway, and when would you use it instead of asking the agent?',
  'Your scheduled job runs but cannot use the skills you moved into the vault in Module 5. What is wrong, and how do you know?',
]

/* ──────────────────────────────────────────────────────────────────────────
 * MODULE 7, Your Own Cloud Drive
 * Git carries the text; object storage takes everything else. The cheapest
 * module in the course, and the one where a wrong command can delete on both
 * sides at once, which is what the guards segment is for.
 * ────────────────────────────────────────────────────────────────────────── */

const MODULE_7_SLUG = 'module-07-your-own-cloud-drive'
export const MODULE_7_MATERIALS_URL = `${COURSE_REPO_URL}/tree/main/modules/${MODULE_7_SLUG}`
export const MODULE_7_GUIDE_URL = `${COURSE_REPO_URL}/blob/main/modules/${MODULE_7_SLUG}/student-guide.md`

/* The sorting exercise the module opens with. Figures are the host's own vault,
 * measured 2026-08-26; students run the same commands on theirs. */
export interface StorageCategory {
  label: string
  size: string
  count: string
  destination: string
  note: string
  icon: LucideIcon
}

export const MODULE_7_CATEGORIES: StorageCategory[] = [
  {
    label: 'Notes, code and skills',
    size: '5.1 MB',
    count: '449 files',
    destination: 'GitHub, private',
    note: 'Needs history and merges. Git has done this for twenty years.',
    icon: FileText,
  },
  {
    label: 'Video, audio, images, PDFs',
    size: '13.37 GB',
    count: '8,323 files',
    destination: 'Backblaze B2',
    note: 'Needs durability, not history. Nothing merges an MP4.',
    icon: Film,
  },
  {
    label: 'node_modules, caches, build output',
    size: '3.25 GB',
    count: '1,005 directories',
    destination: 'Nowhere',
    note: 'Rebuildable. Reinstalling is faster than restoring, so it is not data.',
    icon: Boxes,
  },
]

export const MODULE_7_AGENDA: AgendaItem[] = [
  {
    time: '0:00',
    title: 'Open with the payoff',
    detail:
      'Ask the server agent for a video that exists only on the laptop. It fails. One command later it fetches the file out of object storage and answers.',
  },
  {
    time: '0:03',
    title: 'Measure three categories',
    detail:
      'Not two. Everyone splits a folder into small and large, then wonders why the sync is still enormous. The third category is the one filling the disk.',
  },
  {
    time: '0:08',
    title: 'Audit what git is carrying',
    detail:
      'Four commands with a pass mark each: pack size, tracked count, tracked total, and the ten largest tracked files. A committed video is a homework problem, not a live one.',
  },
  {
    time: '0:13',
    title: 'The bucket and two keys',
    detail:
      'A private bucket, then two application keys scoped to it: read and write for the laptop, read only for the server. The server has never needed to delete your archive.',
  },
  {
    time: '0:19',
    title: 'The filter file, and the first sync',
    detail:
      'One file defines the split, and it is the exact complement of .gitignore. Excluding markdown is the load bearing line. Dry run first, then resync once.',
  },
  {
    time: '0:28',
    title: 'The guard that stops a wipe',
    detail:
      'A mistyped path makes bisync read one empty side as a mass deletion. Marker files on both ends, then rename one on camera and watch the sync refuse to run.',
  },
  {
    time: '0:36',
    title: 'The server side, without a second copy',
    detail:
      'A 25 GB disk does not hold a 13 GB library that keeps growing. It fetches on demand into the git checkout, where the ignore list already covers what arrives.',
  },
  {
    time: '0:44',
    title: 'Versions, and the bill that grows quietly',
    detail:
      'Every overwrite keeps the old version and nothing ever leaves. Two commands return two different numbers, and one lifecycle rule stops the second one climbing.',
  },
  {
    time: '0:51',
    title: 'Automate it',
    detail:
      'A sync script on a schedule, silent on success. It must never answer a resync request on its own, because that is the system asking for a human.',
  },
]

export const MODULE_7_STEPS: string[] = [
  'Measure the three categories in your own vault',
  'Audit the repo and confirm git is still carrying text only',
  'Create a private bucket',
  'Create two keys: laptop read write, server read only',
  'Configure rclone and address the bucket by its full path',
  'Write the filter file that is the complement of your ignore list',
  'Dry run, then run the first sync once',
  'Set up the access check, then break it on purpose',
  'Give the server read only access, with no second copy of the archive',
  'Teach the agent to fetch a file it does not have',
  'Set a lifecycle rule so old versions stop billing you',
  'Put it on a schedule that stays quiet until it fails',
]

export const MODULE_7_MCQ: QuizMCQ[] = [
  {
    question:
      'Your vault is 19 GB. The markdown in it is 5 MB. Roughly 3 GB is node_modules spread across a thousand directories. Where should node_modules go?',
    options: [
      'Backblaze B2, because it is large',
      'GitHub, because it is code',
      'Nowhere. It is rebuildable, and npm install is faster than a restore',
      'A separate bucket with a shorter lifecycle rule',
    ],
    answer: 2,
  },
  {
    question:
      'Why does the rclone filter exclude *.md when markdown is the most valuable thing in the vault?',
    options: [
      'Markdown is too small to be worth uploading',
      'Because git already owns those files, and two sync systems owning one file means one can quietly overwrite the other',
      'Because object storage cannot store plain text efficiently',
      'It is a mistake, and markdown should be in both',
    ],
    answer: 1,
  },
  {
    question: 'You run rclone bisync with --resync on every scheduled run. What breaks?',
    options: [
      'Nothing, it is just slower',
      'The lock file never expires',
      'Deleted files reappear at the end of every run, because resync copies rather than syncs',
      'The filter file hash changes each time',
    ],
    answer: 2,
  },
  {
    question: 'What does --check-access actually protect you from?',
    options: [
      'An unauthorised user reaching the bucket',
      'A key with the wrong capabilities',
      'One side being empty or unmounted, which bisync would otherwise read as "every file was deleted"',
      'Two machines syncing at the same time',
    ],
    answer: 2,
  },
  {
    question:
      'You put your Backblaze account ID in the rclone account field along with a bucket restricted application key. What happens?',
    options: [
      'It works, but only for reads',
      'B2 returns 401 and the error does not explain why. The account field needs the keyID',
      'rclone falls back to the master key',
      'It works until the key expires',
    ],
    answer: 1,
  },
]

export const MODULE_7_OPEN_QUESTIONS: string[] = [
  'Your teammate says "just sync the whole vault, filters are overcomplicating it." What is your answer?',
  'Your server key is read only. Explain what that costs you and why you took the deal anyway.',
  'Your object storage bill keeps climbing even though your vault has not grown. What is happening, and what do you run?',
  'A cron job runs your sync every 30 minutes. One night it fails and asks for a resync. Why must the script not add that flag itself?',
]
