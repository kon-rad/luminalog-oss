/* ──────────────────────────────────────────────────────────────────────────
 * Module 1, "What Is AI? Learning from Examples"
 *
 * The second class in the kids course. Class 0 answered "what is a computer"
 * (IN → THINK → OUT); this one answers what happens when the THINK part learns
 * for itself. Same shape as course.ts: prose-light data consumed by the page
 * and the quiz.
 * ────────────────────────────────────────────────────────────────────────── */

import type { AgeExplanation, HistoryBeat, QuizMCQ } from './course'

export type { HistoryBeat }

export const MODULE_1_SLUG = 'module-1'

export const MODULE_1_TITLE = 'What Is AI? Learning from Examples'

export const MODULE_1_INTRO =
  'Class 0 asked what a computer is: a machine that takes something IN, thinks, and puts something OUT. This class asks the next question, what happens when the thinking part learns for itself? A normal computer follows rules we wrote. An AI learns from examples we showed it, and then it can handle things nobody ever wrote a rule for.'

export const MODULE_1_HOOK =
  'Nobody ever gave you a rulebook for what a cat is. You just saw a lot of cats. That is exactly how AI learns.'

/* ── The three illustrated levels ─────────────────────────────────────────── */

export const AI_BY_AGE: AgeExplanation[] = [
  {
    age: 'Age 3',
    headline: 'AI learns by looking',
    body: 'We show the robot lots and lots of cat pictures. Cat. Cat. Cat. And now the robot knows: it can find a cat all by itself. Show it many, and then it knows.',
    image: '/courses/kids-stem/ai-explained-age-3.jpg',
    alt: 'A friendly cartoon robot being shown a stack of cat photos, with a happy cat in its thought bubble.',
  },
  {
    age: 'Age 7',
    headline: 'Examples → Learn → Guess',
    body: 'A normal computer only does what we tell it, step by step. AI is different. We do not give it the rules. We show it thousands of examples, it finds the pattern hiding inside them, and then it can guess about things it has never seen before. And that is the key word: an AI guesses. A very good guess, but a guess. That is why it is sometimes wrong.',
    image: '/courses/kids-stem/ai-explained-age-7.jpg',
    alt: 'A three-stage infographic: EXAMPLES (a stack of picture cards), LEARN (a robot with a glowing brain), GUESS (the robot correctly identifying a new cat).',
  },
  {
    age: 'Age 12',
    headline: 'Training data, neural networks & prediction',
    body: 'Under the hood, an AI is a huge web of simple connected dots called a neural network. At the start it is completely random and useless. You feed it training data, it makes a prediction, you tell it how wrong it was, and it nudges its connections to be slightly less wrong, billions of times. Nobody programmed the rules; the rules got learned. And a chatbot is, at heart, predicting what comes next. It does not check whether what it says is true, which is why it can be confidently, fluently wrong.',
    image: '/courses/kids-stem/ai-explained-age-12.jpg',
    alt: 'A flat-vector infographic: TRAINING DATA feeding into a NEURAL NETWORK of connected nodes, producing a PREDICTION, with an ADJUST loop running backwards under the network.',
  },
]

/* The four pieces the oldest kids should be able to name. */
export const AI_PIECES: { piece: string; what: string }[] = [
  { piece: 'Training data', what: 'The examples, images, text, audio. Millions or billions of them.' },
  { piece: 'Neural network', what: 'Layers of simple connected units. Each connection has a strength.' },
  { piece: 'Training', what: 'Predict, measure the error, adjust every connection a tiny bit. Repeat.' },
  {
    piece: 'Prediction',
    what: "The trained network's best guess, usually with a confidence for each option.",
  },
]

/* The same idea at five depths. */
export const AI_LADDER: { age: string; idea: string }[] = [
  { age: 'Age 2', idea: 'We show the robot pictures, and then it knows.' },
  { age: 'Age 5', idea: 'It learns from examples, like you learned what a dog is.' },
  { age: 'Age 7', idea: 'Examples → find the pattern → guess about new things.' },
  { age: 'Age 10', idea: 'It is trained, not programmed. Its answers are guesses with a confidence.' },
  {
    age: 'Age 13',
    idea: 'Weights in a neural network, adjusted billions of times to reduce error. It predicts; it does not verify.',
  },
]

/* ── The story of AI ──────────────────────────────────────────────────────── */

export const AI_HISTORY: HistoryBeat[] = [
  {
    year: '1843',
    title: 'Ada Lovelace has the first idea',
    detail:
      'Working on a machine that was never even built, she writes the first computer program, then asks the question everyone would argue about for the next two hundred years: could a machine ever create something new, or only do what it was told?',
  },
  {
    year: '1950',
    title: 'Alan Turing asks “can machines think?”',
    detail:
      'He decides the question is too slippery, so he replaces it with a game: if you are chatting with something and cannot tell whether it is a person or a machine, does the difference matter? We still call it the Turing Test.',
  },
  {
    year: '1956',
    title: 'The field gets its name',
    detail:
      'A summer workshop at Dartmouth College brings together John McCarthy, Marvin Minsky, Claude Shannon and others. McCarthy coins the phrase “artificial intelligence.” They think a good summer’s work might crack it. It did not.',
  },
  {
    year: '1958',
    title: 'The first machine that learns',
    detail:
      'Frank Rosenblatt builds the Perceptron, a real machine, with motors and wires, that learned to tell simple shapes apart from examples. The great-great-grandparent of everything today.',
  },
  {
    year: '1966',
    title: 'The first chatbot',
    detail:
      'Joseph Weizenbaum writes ELIZA, which imitated a therapist using simple tricks. He was disturbed by how many people poured their hearts out to it anyway, a lesson still worth having.',
  },
  {
    year: '1970s–80s',
    title: 'The AI winters',
    detail:
      'Twice, AI promised far more than it delivered, the money dried up, and the field went cold. The people who kept working through the winters are the ones who won.',
  },
  {
    year: '1986',
    title: 'Teaching a network to correct itself',
    detail:
      'Geoffrey Hinton, David Rumelhart and Ronald Williams popularize backpropagation, the method for telling every connection in a network how much of the mistake was its fault. This is the engine under all of it.',
  },
  {
    year: '1997',
    title: 'Deep Blue beats Garry Kasparov',
    detail:
      'The world chess champion loses to a machine and everyone declares the machines have arrived. They mostly had not, Deep Blue searched brute-force; it did not learn.',
  },
  {
    year: '2009',
    title: 'The data arrives',
    detail:
      'Fei-Fei Li builds ImageNet, a collection of millions of hand-labelled photographs. Her insight: the algorithms were not the bottleneck; the examples were.',
  },
  {
    year: '2012',
    title: 'The breakthrough',
    detail:
      'Using ImageNet, AlexNet, from Alex Krizhevsky, Ilya Sutskever and Geoffrey Hinton, crushes the image-recognition competition with a deep neural network. This is the moment modern AI actually starts.',
  },
  {
    year: '2016',
    title: 'AlphaGo',
    detail:
      'Demis Hassabis’s team at DeepMind beats Lee Sedol at Go, a game far too vast for brute force. In game two it plays move 37, a move no human would make, which turned out to be brilliant. Machines had started being creative.',
  },
  {
    year: '2017',
    title: 'The Transformer',
    detail:
      'A Google paper called “Attention Is All You Need” introduces the architecture behind essentially every modern chatbot.',
  },
  {
    year: '2020',
    title: 'AlphaFold',
    detail:
      'DeepMind solves protein folding, a fifty-year-old biology problem, unlocking medicine and disease research.',
  },
  {
    year: '2022',
    title: 'ChatGPT',
    detail:
      'AI stops being a research topic and becomes something anyone can talk to. A hundred million people in two months.',
  },
  {
    year: '2024',
    title: 'The Nobel Prizes',
    detail:
      'Geoffrey Hinton shares the Nobel Prize in Physics with John Hopfield; Demis Hassabis and John Jumper share the Nobel Prize in Chemistry with David Baker. The winters are over.',
  },
]

export const AI_PEOPLE: { name: string; why: string }[] = [
  { name: 'Ada Lovelace', why: 'First program, and the first question about machine creativity.' },
  { name: 'Alan Turing', why: '“Can machines think?” and the Turing Test.' },
  { name: 'John McCarthy', why: 'Named the field “artificial intelligence” in 1956.' },
  { name: 'Marvin Minsky', why: 'Co-founded the field and MIT’s AI lab.' },
  { name: 'Frank Rosenblatt', why: 'Built the Perceptron, the first learning machine.' },
  { name: 'Geoffrey Hinton', why: 'Backpropagation and deep learning. Nobel Prize, 2024.' },
  {
    name: 'Yann LeCun & Yoshua Bengio',
    why: 'Shared the 2018 Turing Award with Hinton; LeCun’s networks read handwriting decades before it was fashionable.',
  },
  { name: 'Fei-Fei Li', why: 'ImageNet, proved that examples were the missing ingredient.' },
  { name: 'Demis Hassabis', why: 'AlphaGo and AlphaFold. Nobel Prize, 2024.' },
]

/* ── Where AI is now ──────────────────────────────────────────────────────── */

export const AI_CAN: string[] = [
  'Talk, write and explain, essays, stories, translation, answering questions.',
  'Write code, which means it can build tools for itself and for us.',
  'Make things, pictures, video, music, voices, from a sentence of description.',
  'See and hear, read handwriting, describe a photo, turn speech into text. (Exactly what Argo does with your voice and your journal.)',
  'Act, not just answer: “agents” that use tools and work through a task in many steps.',
  'Do real science, predict protein shapes, forecast weather, help find new materials and medicines.',
  'Run on a laptop or a phone, privately, not only in a giant data centre.',
]

export const AI_CANNOT: string[] = [
  'It does not know if it is right. It predicts; it does not check. It can be fluently, confidently wrong.',
  'It has no body and no common sense about the physical world. A four-year-old is still better at picking up an unfamiliar object.',
  'It learns our mistakes too. Biased examples in, biased guesses out.',
  'It eats enormous amounts of data and electricity.',
  'It cannot be responsible. A person is always accountable for what it does.',
]

/* ── What might happen next ───────────────────────────────────────────────── */

export const AI_SOON: string[] = [
  'AI tutors that know exactly what you personally find hard.',
  'Talking to your computer becomes normal; typing becomes optional.',
  'AI in every phone, running privately on the device.',
  'Robots that finally work in messy real places, homes, farms, hospitals.',
  'Much faster medicine and materials discovery.',
]

export const AI_LATER: string[] = [
  'Cars and vehicles that mostly drive themselves.',
  'AI as a genuine research partner, proving new mathematics, proposing new experiments.',
  'Most jobs change shape rather than disappear, and new jobs appear that we cannot name yet.',
]

export const AI_OPEN_ARGUMENT =
  'Some very smart people think AI as generally capable as a human is five to ten years away. Other very smart people think it is fifty years away, or that we are missing something fundamental and it needs a whole new idea. Both groups have good reasons. When the experts disagree this much, it means we are genuinely at a frontier, and the kids in this room are the ones who will find out.'

export const AI_STAYS_HUMAN =
  'AI is trained on what has already been written and drawn. It is superb at the average of everything humans have ever made. What it cannot do is be you, have your day, your feelings, your particular way of seeing a thing nobody else noticed. That is what your notebook is for. The more AI can do, the more valuable it becomes to know who you are and what you actually think.'

/* ── Running order for the 15-minute STEM block ───────────────────────────── */

export const MODULE_1_RUNNING_ORDER: { minutes: number; title: string; detail: string }[] = [
  {
    minutes: 4,
    title: 'Explain',
    detail:
      'The age-3 version to the whole room with the cat cards, then the age-7 three-step version, then the age-12 layer for the older kids. Two or three story beats from the history.',
  },
  {
    minutes: 2,
    title: 'Say it back',
    detail: 'Pair up. Each child explains “how does AI learn?” to their partner in their own words.',
  },
  {
    minutes: 6,
    title: 'Draw or write',
    detail:
      'Littlest (2–4): draw a robot and a cat. Middle (5–8): three boxes, EXAMPLES → LEARN → GUESS, and what you would teach an AI to recognize. Older (9–12): draw the network of dots and lines, then write about the difference between being programmed and being trained.',
  },
  {
    minutes: 3,
    title: 'Share',
    detail: 'Two or three volunteers show their page. Ask: “What would you teach an AI to do?”',
  },
]

export const MODULE_1_GAME =
  'Unplugged game, “Cat / Not Cat.” Hold up picture cards one at a time, announcing “cat” or “not cat.” After six or seven, stop announcing and let the kids call it out. They are now the trained model. Then slip in something tricky, a tiger, or a cat-shaped cushion, and let them get it wrong. “That is exactly how AI makes mistakes, and now you know why.”'

/* ── Knowledge check ─────────────────────────────────────────────────────── */

export const MODULE_1_MCQ: QuizMCQ[] = [
  {
    question: 'What does an AI learn from?',
    options: [
      'A rulebook someone wrote for it',
      'Lots and lots of examples',
      'The internet cable',
      'Its batteries',
    ],
    answer: 1,
  },
  {
    question: 'What are the three steps of how AI learns?',
    options: ['Examples → Learn → Guess', 'On → Off → On', 'Read → Sleep → Wake', 'Draw → Colour → Share'],
    answer: 0,
  },
  {
    question: 'Who asked “can machines think?” and invented the Turing Test?',
    options: ['Ada Lovelace', 'Fei-Fei Li', 'Alan Turing', 'Marvin Minsky'],
    answer: 2,
  },
  {
    question: 'Why is an AI sometimes confidently wrong?',
    options: [
      'It gets tired',
      'It predicts what sounds right, but does not check whether it is true',
      'It runs out of memory',
      'Someone unplugged it',
    ],
    answer: 1,
  },
  {
    question: 'The web of simple connected dots inside an AI is called a…',
    options: ['Neural network', 'Spider web', 'Keyboard', 'Hard drive'],
    answer: 0,
  },
]

export const MODULE_1_OPEN_QUESTIONS: string[] = [
  'Explain to someone at home what AI is, using the cat example.',
  'What is the difference between a computer being programmed and an AI being trained?',
  'What is one thing AI is better at than people? What is one thing people are better at?',
  'If you could train an AI on anything at all, what would you show it, and what would you want it to learn?',
  'What is something only you can do, that no AI could ever be trained to do?',
]
