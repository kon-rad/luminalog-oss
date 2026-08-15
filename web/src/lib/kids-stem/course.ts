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
    href: `${KIDS_COURSE_BASE}/module-0`,
  },
  {
    n: 1,
    title: 'What Is AI? Learning from Examples',
    summary:
      'How computers learn from lots of examples, the same way we learned what a cat is, plus the story of AI, the people who built it, and where it goes next.',
    status: 'live',
    href: `${KIDS_COURSE_BASE}/module-1`,
  },
  {
    n: 2,
    title: 'What Is a Blockchain? The Notebook Nobody Can Erase',
    summary:
      'How a lot of people can agree on what is true when nobody is in charge, plus the thirty-year story behind it, and why some things belong on a wall and some belong in your notebook.',
    status: 'live',
    href: `${KIDS_COURSE_BASE}/module-2`,
  },
  {
    n: 3,
    title: 'What Is the Internet? Millions of Computers Passing Notes',
    summary:
      'How a message is chopped into pieces that each find their own way across the world, plus the hundred-year story behind it, and why being reachable by five billion people is not the same as being known by five.',
    status: 'live',
    href: `${KIDS_COURSE_BASE}/module-3`,
  },
  {
    n: 4,
    title: 'What Is Encryption? Hiding the Key, Not the Message',
    summary:
      'How a message can be carried by thousands of strangers, read by any of them, and still be a secret, plus the four-thousand-year story behind it, and why the maths is never the weak point.',
    status: 'live',
    href: `${KIDS_COURSE_BASE}/module-4`,
  },
]

/** One line on what the course is for, shown at the top of the course index. */
export const COURSE_PURPOSE =
  'A class in the three skills that decide most of what follows: speaking, writing, and the quality of your ideas. Children practise them with pen and paper, one STEM concept at a time.'

/** The class in order, for the short agenda on the course index. */
export const AGENDA_SUMMARY: string[] = [
  'Breathwork, a short meditation, then yoga stretches and movement.',
  'A drawing prompt. Everyone shares what they drew, and we record it.',
  'A journaling prompt. Everyone shares what they wrote, and we record it.',
  'Nobody critiques. We celebrate them for creating.',
  'A STEM concept, explained for a three, seven and twelve year old.',
  'They teach it back in their own drawings and words, and we record it.',
  'Finish all three and earn a point. Ten points earns a reward.',
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
    title: 'Arrival: breathing and short meditation',
    detail:
      'We arrive, settle, and put the rest of the day down. Breathwork and a short meditation, drawn from the practices executive coaches teach to millionaires, to bring attention into the room. This is also when we talk about why speaking, writing and the quality of your ideas are worth practising at all.',
  },
  {
    minutes: 10,
    title: 'Stretching and movement',
    detail:
      'Yoga stretches, warrior pose, the kung fu attention pose, and a short standing workout. This wakes up the body, builds self-regulation and concentration, and releases excess nervous energy before we sit down to work.',
  },
  {
    minutes: 10,
    title: 'Assignment 1: free drawing',
    detail:
      'One prompt, then free drawing led entirely by their own imagination. Nothing has been taught yet and there is nothing to copy. This is an exercise in imagination, not an explanation of anything. There is no wrong drawing, and the youngest children start wherever they are.',
  },
  {
    minutes: 10,
    title: 'Assignment 2: expressive writing',
    detail:
      'An expressive writing and journaling exercise. Still not ideas, but experience: their imagination, something they remember, something they felt in their senses. Related to the day\u2019s concept, never an explanation of it. Children who cannot yet write put down one letter or one word. Older children write full sentences.',
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
      'Now they use their creativity and imagination to understand the idea, and then to communicate and express it: one page of drawing and writing that teaches the concept to somebody their own age. A twelve-year-old fills a page that would teach another twelve-year-old. A child who cannot write yet uses a drawing and a single letter or word. As they finish, each child can record a short video showing their drawings, their journaling and their explanation. Explaining it is how we know it landed.',
  },
]

/* Back-compat alias: the agenda used to be named for Module 0 before it became
 * the shape of every class. */
export const MODULE_0_SEGMENTS = CLASS_AGENDA

/* ── The three assignments and the points they earn ──────────────────────── */

export const ASSIGNMENTS_INTRO =
  'Every class has one concept and three assignments around it. The first two do not explain anything. They draw freely, from their own imagination, with nothing taught yet and nothing to copy. Then they journal: expressive writing about what they imagine, what they remember, and what they felt in their senses. Both are exercises in creativity, imagination and expression. They are related to the day\u2019s concept, not explanations of it. Only the third assignment asks them to explain, using that same creativity and imagination to teach the concept to somebody their own age.'

export const MONTHLY_OUTCOME =
  'Three classes a week, twelve concepts a month. By the end of the month your child has twelve finished teach-back pages, each one explaining a concept in their own drawings and their own words, alongside a month of free drawing and journaling of their own. We then choose a few of those pages to go into the printed book.'

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
    title: 'Five minutes flying a drone',
    detail: 'Your child takes the controls and flies it themselves, with me beside them.',
  },
  {
    cost: 10,
    title: 'Five minutes on Oculus Quest 3',
    detail: 'Playtime inside a game on the headset.',
  },
  {
    cost: 10,
    title: 'Five minutes on Apple Vision Pro',
    detail: 'A mixed-reality experience on the headset.',
  },
  {
    cost: 10,
    title: 'Five minutes programming the friendly AI robot',
    detail: 'Your child programs Friendly M Helper alongside me, and we record the demo they built.',
  },
]

/** Every reward is five minutes on the technology plus a short video the family
 * keeps. Rendered under the rewards grid on both the course overview and the
 * enrolment page. */
export const REWARDS_KEEPSAKE =
  'Every reward is five minutes of real hands-on time on one of these technologies, and nobody leaves with only the memory. We film it, and at the end your child gets a thirty to sixty second video of themselves using it: flying the drone, inside the headset, or the demo they programmed on the robot. Photos from the session come with it, and the drone lesson also includes the aerial footage the drone shot itself. It is theirs, to keep and to share with their friends and family. Nothing is published anywhere; it is handed to you.'

/* ── Why these skills, and where the class is going ──────────────────────── */

export const WHY_HEADING = 'Why speaking, writing and ideas'

export const WHY_BODY: string[] = [
  'At the start of every class we talk about why any of this is worth practising. The answer we keep coming back to is Balaji Srinivasan. Marc Andreessen famously described him as having the highest rate of good new ideas per minute of anyone he has ever met, and it is precisely that capacity, the ability to speak, to communicate, and to learn a concept quickly, that built everything else.',
  'On the strength of those skills he built massively successful startups, served as CTO of Coinbase, and founded the Network School, which now runs right here near Forest City and which many of us have benefited from directly. Those same skills made him a billionaire. More importantly, they let him have an immensely positive impact on the world.',
  'We are inspired by that, and in this class we cultivate the very same skills, so that we too can become just as impactful and positive a force for the world. So that these children can go out into the world, conquer it, have a positive impact on it, achieve their dreams, and actualize their potential.',
]

export const GOAL_STATEMENT =
  'The goal is that they enjoy this. That drawing, journaling, writing and learning become things they choose to practise, not things they are made to do. Along the way, they come to know the value of drawing, writing, and their uniqueness, and have learned the joy of creativity and the power of their imagination. These skills are fundamental to serve them through young adulthood and adulthood. It prepares them for a great life ahead, and it gives them what they need to actualize their potential.'

/* ── The robot, and what leaves the room with the child ──────────────────── */

export const ROBOT_SUMMARY =
  'Friendly M Helper, our AI robot assistant, is present at every meeting. He is not a demo on a shelf, he interacts directly with the children throughout the class. That gives them hands-on experience of AI and robotics at an age when almost nobody gets it, which we expect to matter enormously to them later.'

export const VIDEO_NOTE =
  'In every class, each child can optionally record a short video showcasing their drawings, their journaling and their explanation of the concept. An AI agent edits it afterwards and it comes back to the family.'

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

/* A prompt written for one specific age.
 *
 * Classes up to module 3 carried one prompt plus a `byLevel` array telling the
 * teacher how to pitch it. From module 4 on, each age gets its own prompt
 * written for that age, because a single prompt stretched across a ten-year
 * span was always really the oldest child's prompt with apologies attached.
 * `note` carries the form the answer takes, for example spoken, or three
 * sentences with stems. */
export interface AgePrompt {
  age: string
  prompt: string
  note?: string
}

/* The craft tip given before the drawing, about drawing rather than about the
 * concept. `byLevel` is the same tip pitched at each age. */
export interface DrawingTip {
  rule: string
  why: string
  byLevel: { level: string; what: string }[]
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
