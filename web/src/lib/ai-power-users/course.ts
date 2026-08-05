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
  Hammer,
  Rocket,
  Users,
  Brain,
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
    title: 'Criticise in private, praise in public',
    meaning: 'Corrections go one-to-one. Recognition goes to the whole room.',
    inClass:
      'Peer evaluation uses private written notes; breakthroughs are shared aloud.',
  },
  {
    icon: Hammer,
    title: 'Create more than you consume',
    meaning: "Ship things. Don't just watch demos.",
    inClass:
      'Every session ends with something you built, not just notes you took.',
  },
  {
    icon: Rocket,
    title: 'Done over perfect',
    meaning: 'A shipped rough capstone beats a perfect plan.',
    inClass: 'The capstone is graded on a working demo, not on polish.',
  },
  {
    icon: Users,
    title: 'Participate',
    meaning: 'The class is a practice, not a lecture.',
    inClass: 'Labs, peer mini-teaches, and the feedback circle are all hands-on.',
  },
]

export interface CourseDay {
  slug: string
  day: number
  weekday: string
  title: string
  theme: string
  duration: string
  icon: LucideIcon
  objectives: string[]
  summary: string
  /* Future days whose topic is not yet announced. Rendered as "TBD" and not
   * linked from the schedule listings. */
  tbd?: boolean
}

/* Every day runs the same two time slots: a 45-minute workshop and a 45-minute
 * hands-on mentoring session, each followed by a 15-minute break. */
export interface DaySession {
  title: string
  durationMin: number
  breakMin: number
  detail: string
}

export const DAY_SESSIONS: DaySession[] = [
  {
    title: 'Workshop',
    durationMin: 45,
    breakMin: 15,
    detail: 'A live, hands-on build. Follow along and finish with something working.',
  },
  {
    title: 'Hands-On Mentoring',
    durationMin: 45,
    breakMin: 15,
    detail: 'Bring your own project and get one-on-one help putting the workshop to use.',
  },
]

/* Placeholder for a day whose topic is not yet announced. */
const tbdDay = (slug: string, day: number, weekday: string): CourseDay => ({
  slug,
  day,
  weekday,
  title: 'TBD',
  theme: 'Topic coming soon.',
  duration: '2 hours',
  icon: CalendarClock,
  objectives: [],
  summary: 'To be announced.',
  tbd: true,
})

/* One topic per day, Monday–Friday. Day 1 is live (Module 1); Days 2–5 are TBD
 * until each future module’s topic is announced. */
export const DAYS: CourseDay[] = [
  {
    slug: 'day-1',
    day: 1,
    weekday: 'Monday',
    title: 'Foundations, Models & Prompting',
    theme:
      'Understand what AI actually is, map the ecosystem, and start prompting like a power user.',
    duration: '2 hours',
    icon: Brain,
    objectives: [
      'Explain in plain language what a large language model is — and what it is not.',
      'Describe the agent loop and how an agent differs from a single chatbot reply.',
      'Name the dials that control a model: tokens, context window, temperature.',
      'Map the model ecosystem: open vs. closed, the major families, and the modalities.',
      'Rewrite a weak prompt into a strong one and author your own system prompt.',
    ],
    summary:
      'History of AI, how LLMs really work, the agent loop, the model ecosystem, and the prompt-engineering framework that separates power users from casual users.',
  },
  tbdDay('day-2', 2, 'Tuesday'),
  tbdDay('day-3', 3, 'Wednesday'),
  tbdDay('day-4', 4, 'Thursday'),
  tbdDay('day-5', 5, 'Friday'),
]

export type ExerciseKind = 'lab' | 'peer' | 'homework' | 'essay'

export interface CourseExercise {
  kind: ExerciseKind
  title: string
  due?: string
  steps: string[]
}

/* Exercises keyed by day slug. Labs and peer exercises happen in-session;
 * homework and essays are briefed for the following session. */
export const EXERCISES: Record<string, CourseExercise[]> = {
  'day-1': [
    {
      kind: 'lab',
      title: 'Same prompt, two models',
      steps: [
        'Run one identical prompt across two different assistants.',
        'Compare tone, accuracy, and format side by side.',
        'Rewrite a weak prompt using role / task / context / constraints / format.',
        'Write and test your own system prompt to give a model a persistent persona.',
      ],
    },
    {
      kind: 'peer',
      title: 'Model-family mini-teach',
      steps: [
        'In groups of 3–4, take one model family (GPT, Claude, Gemini, Llama, Mistral…).',
        "Prepare a 3-minute 'who makes it, what it's good at, open or closed' teach.",
        'Deliver it to the class at the start of Day 2.',
      ],
    },
    {
      kind: 'homework',
      title: 'Prompt makeover',
      due: 'Due Wednesday',
      steps: [
        'Take 3 prompts you have used badly.',
        'Rewrite each with the role/task/context/constraints/format framework.',
        'Document the before/after results.',
      ],
    },
    {
      kind: 'essay',
      title: 'What surprised me about how LLMs work',
      due: 'One page, due Wednesday',
      steps: [
        'Write one page: what surprised you about how LLMs actually work,',
        'and one belief you had to unlearn.',
      ],
    },
  ],
  'day-2': [
    {
      kind: 'lab',
      title: 'Multimodal + a mini RAG base',
      steps: [
        'Generate an image, then edit it with a follow-up instruction (multi-turn).',
        'Transcribe a short audio/video clip and summarise it.',
        'Translate and culturally localise a message, then verify quality.',
        'Build a mini RAG knowledge base from personal notes/PDFs and chat with it.',
      ],
    },
    {
      kind: 'peer',
      title: 'Automation design sprint',
      steps: [
        'Each group maps one real repetitive task into an agent/automation flow.',
        'Pitch the flow to the class.',
      ],
    },
    {
      kind: 'homework',
      title: 'Personal knowledge base',
      due: 'Due Friday',
      steps: [
        'Build a small knowledge base of 5–10 documents.',
        'Record 3 questions it answered that a plain chatbot could not.',
      ],
    },
    {
      kind: 'essay',
      title: 'The ethical line for synthetic media',
      due: 'One page, due Friday',
      steps: [
        'Where is the ethical line for face-swap, voice cloning, and synthetic media?',
        'What rule would you personally follow?',
      ],
    },
  ],
  'day-3': [
    {
      kind: 'lab',
      title: 'Offline model + AI security audit',
      steps: [
        'Run a model fully offline on your own laptop and chat with it — no cloud.',
        'Do a personal AI security audit: find where your keys/secrets live.',
        'Lock them down and set the privacy toggles on your accounts.',
      ],
    },
    {
      kind: 'peer',
      title: 'Capstone peer evaluation',
      steps: [
        'Score each capstone against the shared rubric (1–5 per criterion).',
        'Give one written strength and one written suggestion per project.',
        'Close with a feedback circle: one breakthrough, one struggle, one next step.',
      ],
    },
    {
      kind: 'essay',
      title: 'My personal AI playbook',
      due: 'One page, post-class',
      steps: [
        'Write the tools, habits, and privacy rules you are keeping after the class.',
      ],
    },
  ],
}

export interface RubricCriterion {
  title: string
  description: string
}

export const RUBRIC: RubricCriterion[] = [
  { title: 'Clarity of problem', description: 'Is the real-world problem clearly stated?' },
  { title: 'Right tool for the job', description: 'Were the AI capabilities well chosen for the task?' },
  { title: 'Correct / verified output', description: 'Was the output checked, not just accepted?' },
  { title: 'Privacy & safety handled', description: 'Were credentials and sensitive data handled well?' },
  { title: 'Creativity', description: 'Is the approach original or especially resourceful?' },
  { title: 'Presentation', description: 'Was the demo and write-up clear and compelling?' },
]

export interface GradingComponent {
  component: string
  weight: number
}

export const GRADING: GradingComponent[] = [
  { component: 'Daily hands-on labs (participation + completion)', weight: 20 },
  { component: 'Homework assignments (2)', weight: 15 },
  { component: 'One-page essays (3)', weight: 15 },
  { component: 'Peer-led group exercises & mini-teaches', weight: 15 },
  { component: 'Capstone project', weight: 25 },
  { component: 'Peer evaluation & feedback quality', weight: 10 },
]

export const CAPSTONE = {
  prompt:
    'Solve one real problem from your own life or work using at least three capabilities from the week.',
  capabilities: [
    'A well-engineered prompt or custom system prompt',
    'A multimodal element (image, video, audio, or speech-to-text)',
    'A RAG / personal knowledge base',
    'An agent or automation flow',
    'Multi-language support',
    'A privacy/security measure (safe key handling or a locally self-hosted model)',
  ],
  deliverable:
    "A short working demo plus a one-page write-up: what problem, which tools, what you learned, what you'd do next.",
  examples: [
    "A 'chat with my documents' research assistant",
    'A multilingual customer-reply automation',
    'A private local assistant that never touches the cloud',
    'An AI-narrated explainer video',
    'An automated weekly-report generator',
  ],
}

export const TOOLKIT: string[] = [
  'The 50-topic map as a reference guide',
  'A one-page prompt-framework cheat sheet',
  'A privacy & credentials checklist',
  'A curated best-tools-by-category list (free / online / open source)',
  'A self-hosting quick-start (Ollama & LM Studio)',
  "A 'keep learning' resource list for staying current",
]

export const OUTCOMES: string[] = [
  'Choose the right AI tool for a task instead of defaulting to one chatbot.',
  'Prompt skilfully with a repeatable framework and your own system prompts.',
  'Build a personal knowledge base your AI can answer from.',
  'Protect your data, your credentials, and your privacy.',
  'Run a private model locally, fully offline.',
  'Ship a capstone project — evaluated by your peers.',
]
