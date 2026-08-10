/* ──────────────────────────────────────────────────────────────────────────
 * Structured data for the Kids Wholistic Creativity & STEM course.
 *
 * Prose-light metadata shared by the course page and the quiz. The kids course
 * lives at /courses/kids-stem and starts with Module 0.
 * ────────────────────────────────────────────────────────────────────────── */

/* Every kids-course URL hangs off this, so the route can move in one edit. */
export const KIDS_COURSE_BASE = '/courses/kids-stem'

/* ── The class list ──────────────────────────────────────────────────────── */

export interface KidsClass {
  n: number
  title: string
  summary: string
  status: 'live' | 'soon'
  /* Where the card links. Same-page anchor for class 0, its own route after. */
  href?: string
}

export const KIDS_CLASSES: KidsClass[] = [
  {
    n: 0,
    title: 'Meet the Computer: Wholistic Creativity & STEM',
    summary:
      'Breathing and movement, free drawing and expressive writing, and a first STEM lesson: what a computer actually is, explained for every age.',
    status: 'live',
    href: '#module-0',
  },
  {
    n: 1,
    title: 'What Is AI? Learning from Examples',
    summary:
      'How computers learn from lots of examples, the same way we learned what a cat is, plus the story of AI, the people who built it, and where it goes next.',
    status: 'live',
    href: `${KIDS_COURSE_BASE}/what-is-ai`,
  },
  {
    n: 2,
    title: 'What Is a Blockchain? The Notebook Nobody Can Erase',
    summary:
      'How a lot of people can agree on what is true when nobody is in charge, plus the thirty-year story behind it, and why some things belong on a wall and some belong in your notebook.',
    status: 'live',
    href: `${KIDS_COURSE_BASE}/what-is-blockchain`,
  },
  {
    n: 3,
    title: 'Algorithms: Step-by-Step Instructions',
    summary: 'We become “human robots” and learn how exact, ordered steps make things happen.',
    status: 'soon',
  },
]

/* ── Module 0: the class structure (from the Luma description) ───────────── */

export interface ClassSegment {
  minutes: number
  title: string
  detail: string
}

/** The sixty-minute class agenda. Every session runs this same shape, so the
 * children know what is coming and can settle quickly. Rendered on the course
 * overview, the enrolment page and each module page. */
export const CLASS_AGENDA: ClassSegment[] = [
  {
    minutes: 5,
    title: 'Breathing and short meditation',
    detail:
      'We arrive, settle, and put the rest of the day down. Simple breathing exercises and a short meditation to bring attention into the room.',
  },
  {
    minutes: 10,
    title: 'Stretching and movement',
    detail:
      'Yoga stretches, warrior pose, the kung fu attention pose, and a short standing workout. This wakes up the body, builds self-regulation and concentration, and releases excess nervous energy before we sit down to work.',
  },
  {
    minutes: 10,
    title: 'Assignment 1: the drawing prompt',
    detail:
      'A drawing prompt tied to the day’s STEM concept. Everybody draws their own answer to it. There is no wrong drawing, and the youngest children start wherever they are.',
  },
  {
    minutes: 10,
    title: 'Assignment 2: the writing prompt',
    detail:
      'A writing prompt that is personal, about their own life, and connects back to the same concept. Children who cannot yet write put down one letter or one word. Older children write full sentences.',
  },
  {
    minutes: 15,
    title: 'The STEM concept',
    detail:
      'One new concept, for example AI, computers or blockchain, explained three ways in the same room: a version for a three-year-old, a version for a seven-year-old, and a version for a twelve-year-old. The course page carries an infographic for each age, three deeper paragraphs, and a short history of the idea.',
  },
  {
    minutes: 10,
    title: 'Assignment 3: teach it back',
    detail:
      'One page of drawing and writing that teaches the concept to somebody their own age. A twelve-year-old fills a page that would teach another twelve-year-old. A child who cannot write yet uses a drawing and a single letter or word. Explaining it is how we know it landed.',
  },
]

/* Back-compat alias: the agenda used to be named for Module 0 before it became
 * the shape of every class. */
export const MODULE_0_SEGMENTS = CLASS_AGENDA

/* ── The three assignments and the points they earn ──────────────────────── */

export const ASSIGNMENTS_INTRO =
  'Every class has one concept and three assignments built around it: draw it, write about it in your own life, then teach it to somebody your age. The drawing and writing prompts both connect back to the same idea, so the concept gets approached from three directions in one sitting.'

export const MONTHLY_OUTCOME =
  'Three classes a week, twelve concepts a month. By the end of the month your child has twelve finished pages, each one explaining a concept in their own drawings and their own words. We then choose a few of those pages to go into the printed magazine.'

/** Complete all three assignments in a class and you earn a point. Ten points
 * buys one reward. */
export const POINTS_RULE =
  'Finish all three assignments in a class and your child earns one point. Ten points can be exchanged for any one of these.'

export interface Reward {
  cost: number
  title: string
  detail: string
}

export const REWARDS: Reward[] = [
  {
    cost: 10,
    title: 'Five-minute private drone lesson',
    detail: 'Your child flies the drone themselves and records a short video to keep.',
  },
  {
    cost: 10,
    title: 'Five minutes on Oculus Quest 3',
    detail: 'Playtime inside a game on the headset.',
  },
  {
    cost: 10,
    title: 'Five minutes on Apple Vision Pro',
    detail: 'Playtime inside a game on the headset.',
  },
]

export const MODULE_0_INTRO =
  'A sixty-minute wholistic creativity and STEM class for kids from about 2 to 12 years old. Every child gets personalized exercises and space for creativity, play and learning. Notebooks, pens and pencils are provided, kids keep their notebook and bring it to future classes, which build on each other and compound.'

/* ── How a computer works, explained by age ─────────────────────────────── */

export interface AgeExplanation {
  age: string
  headline: string
  body: string
  image?: string
  alt?: string
  /* The image-generation prompt, kept alongside so a missing infographic can be
   * regenerated, and shown on the page while the picture does not exist yet. */
  imagePrompt?: string
}

/* One beat in a module's history timeline. */
export interface HistoryBeat {
  year: string
  title: string
  detail: string
}

/* The three illustrated levels (each has a Nano Banana visual). */
export const COMPUTER_BY_AGE: AgeExplanation[] = [
  {
    age: 'Age 3',
    headline: 'A computer answers you',
    body: 'You touch it, and it does something back. Tap the picture and the music plays. It is a friendly machine that listens to you: you do something, it does something.',
    image: '/courses/kids-stem/computer-explained-age-3.jpg',
    alt: 'A friendly cartoon computer with a happy face; a child taps the screen and stars and music notes pop out.',
  },
  {
    age: 'Age 7',
    headline: 'In → Think → Out',
    body: 'A computer is a bit like you. Your eyes and ears take things IN, your brain THINKS, and your hands or mouth do something OUT. A computer has the same three parts: a way in (keyboard, microphone), a chip that thinks, and a way out (screen, speaker).',
    image: '/courses/kids-stem/computer-explained-age-7.jpg',
    alt: 'A three-step infographic: IN (keyboard, microphone) then THINK (a computer with a glowing brain) then OUT (screen and speaker).',
  },
  {
    age: 'Age 12',
    headline: 'Hardware, software & 1s and 0s',
    body: 'A computer has hardware (the parts you can touch) and software (the instructions that tell it what to do). The CPU is the brain that runs the steps, RAM is short-term memory and storage is long-term memory. Underneath, everything is tiny switches that are on (1) or off (0), flipped billions of times a second.',
    image: '/courses/kids-stem/computer-explained-age-12.jpg',
    alt: 'A flat-vector infographic: INPUT to CPU (PROCESS) to OUTPUT, with MEMORY (RAM), STORAGE, binary 1s and 0s, and HARDWARE vs SOFTWARE labels.',
  },
]

/* The full ladder, the same idea at five depths. */
export const COMPUTER_LADDER: { age: string; idea: string }[] = [
  { age: 'Age 2', idea: 'I touch it, it responds. (cause → effect)' },
  { age: 'Age 5', idea: 'It takes things in, thinks, and shows something out.' },
  { age: 'Age 7', idea: 'It follows exact instructions, step by step. That is code.' },
  { age: 'Age 10', idea: 'Hardware plus software, and everything is 1s and 0s.' },
  { age: 'Age 13', idea: 'Billions of on/off switches running simple instructions, very fast.' },
]

/* ── Knowledge check ─────────────────────────────────────────────────────── */

export interface QuizMCQ {
  question: string
  options: string[]
  answer: number // index of the correct option
}

export const KIDS_MCQ: QuizMCQ[] = [
  {
    question: 'What are the three things a computer does?',
    options: [
      'Sleep, eat, and play',
      'Take something IN, THINK, and put something OUT',
      'Only show videos',
      'Nothing without the internet',
    ],
    answer: 1,
  },
  {
    question: 'Inside a computer, everything is made of…',
    options: ['Tiny switches that are on (1) or off (0)', 'Water', 'Magic dust', 'Paper and glue'],
    answer: 0,
  },
  {
    question: 'A list of step-by-step instructions is called…',
    options: ['A sandwich', 'A password', 'An algorithm', 'A screen'],
    answer: 2,
  },
  {
    question: "Which part is like the computer's brain?",
    options: ['The keyboard', 'The CPU (the chip)', 'The speaker', 'The mouse'],
    answer: 1,
  },
  {
    question: 'What does a microphone let a computer do?',
    options: ['See colors', 'Hear sound and take it IN', 'Get faster', 'Charge the battery'],
    answer: 1,
  },
]

export const KIDS_OPEN_QUESTIONS: string[] = [
  'In your own words, what is a computer?',
  'Draw or describe the three steps: IN → THINK → OUT. What goes in, and what comes out?',
  'What is an algorithm? Give one example from your day (like brushing your teeth).',
  'Name one thing that is made of 1s and 0s inside a computer.',
  'What is one thing you would love to teach a computer to do, and why?',
]
