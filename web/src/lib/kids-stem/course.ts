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
}

export const KIDS_CLASSES: KidsClass[] = [
  {
    n: 0,
    title: 'Meet the Computer — Wholistic Creativity & STEM',
    summary:
      'Breathing and movement, free drawing and expressive writing, and a first STEM lesson: what a computer actually is, explained for every age.',
    status: 'live',
  },
  {
    n: 1,
    title: 'Algorithms — Step-by-Step Instructions',
    summary: 'We become “human robots” and learn how exact, ordered steps make things happen.',
    status: 'soon',
  },
  {
    n: 2,
    title: 'What Is AI? — Learning from Examples',
    summary: 'How computers learn from lots of examples, the same way we learned what a cat is.',
    status: 'soon',
  },
]

/* ── Module 0 — the class structure (from the Luma description) ───────────── */

export interface ClassSegment {
  minutes: number
  title: string
  detail: string
}

export const MODULE_0_SEGMENTS: ClassSegment[] = [
  {
    minutes: 5,
    title: 'Arrival exercise',
    detail: 'Breathing, mindfulness, and gentle movements to settle in.',
  },
  {
    minutes: 10,
    title: 'Movement & mind-body connection',
    detail:
      'Gentle stretches, simple yoga poses, and light exercises to wake up the body, build self-regulation and concentration, and release excess energy and tension.',
  },
  {
    minutes: 20,
    title: 'Drawing, expressive writing, lettering & creativity',
    detail:
      'Draw freely — landscapes, cars, buildings, people, stories, characters — then a gentle intro to expressive journaling: writing about your day, thoughts, feelings, ideas and learnings. For the littlest ones, holding the pen or writing one letter is a perfect start.',
  },
  {
    minutes: 20,
    title: 'STEM lesson',
    detail:
      'A topic in computer science, math, technology or engineering is explained; kids pair up and explain it in their own words, then draw or write what they understand.',
  },
  {
    minutes: 5,
    title: 'Closing',
    detail:
      'We reflect on what we did and share: what it was like, what we liked, what we learned, and what we are curious to learn next.',
  },
]

export const MODULE_0_INTRO =
  'A wholistic creativity and STEM class for kids from about 2 to 12 years old. Every child gets personalized exercises and space for creativity, play and learning. Notebooks, pens and pencils are provided — kids keep their notebook and bring it to future classes, which build on each other and compound.'

/* ── How a computer works — explained by age ─────────────────────────────── */

export interface AgeExplanation {
  age: string
  headline: string
  body: string
  image?: string
  alt?: string
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
    body: 'A computer has hardware (the parts you can touch) and software (the instructions that tell it what to do). The CPU is the brain that runs the steps, RAM is short-term memory and storage is long-term memory. Underneath, everything is tiny switches that are on (1) or off (0) — flipped billions of times a second.',
    image: '/courses/kids-stem/computer-explained-age-12.jpg',
    alt: 'A flat-vector infographic: INPUT to CPU (PROCESS) to OUTPUT, with MEMORY (RAM), STORAGE, binary 1s and 0s, and HARDWARE vs SOFTWARE labels.',
  },
]

/* The full ladder — the same idea at five depths. */
export const COMPUTER_LADDER: { age: string; idea: string }[] = [
  { age: 'Age 2', idea: 'I touch it, it responds. (cause → effect)' },
  { age: 'Age 5', idea: 'It takes things in, thinks, and shows something out.' },
  { age: 'Age 7', idea: 'It follows exact instructions, step by step — that is code.' },
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
