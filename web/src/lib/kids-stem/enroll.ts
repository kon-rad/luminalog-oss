/* ──────────────────────────────────────────────────────────────────────────
 * Content for the Kids STEM enrolment page (/courses/kids-stem/enroll).
 *
 * The parent-facing proposal: schedule, what a family gets, Friendly M Helper,
 * plans and pricing, the printed magazine, privacy, and who teaches it.
 *
 * The sixty-minute class agenda is NOT duplicated here. It lives in
 * CLASS_AGENDA in ./course and is rendered from there, so the class shape
 * has one source of truth.
 * ────────────────────────────────────────────────────────────────────────── */

import { KIDS_COURSE_BASE } from './course'

export const ENROLL_URL = `${KIDS_COURSE_BASE}/enroll`

/* ── The practical facts ─────────────────────────────────────────────────── */

export const CLASS_FACTS: { label: string; value: string }[] = [
  { label: 'Days', value: 'Mondays, Wednesdays & Fridays' },
  { label: 'Time', value: '2:00 – 3:00 PM · sixty minutes' },
  { label: 'Where', value: 'Reading Room, Block D Cerulean, Forest City' },
  { label: 'Ages', value: '2 – 12 · every child works at their own level' },
]

/* ── What every enrolled family gets ─────────────────────────────────────── */

export interface IncludedItem {
  title: string
  detail: string
  /* Optional in-body link, rendered after the detail text. */
  href?: string
  linkLabel?: string
}

export const INCLUDED: IncludedItem[] = [
  {
    title: 'Notebook, pens and pencils',
    detail:
      'Provided and kept by your child. They bring it back each session, and the work compounds: each class builds on the last.',
  },
  {
    title: 'Kids and parents dashboard',
    detail:
      'The full digital course, with every lesson and prompt, plus your child’s own quiz scores and answers. You can see exactly what was covered and pick the thread up at home.',
    href: KIDS_COURSE_BASE,
    linkLabel: 'See the course',
  },
  {
    title: 'An NFT collectible for every class attended',
    detail:
      'Minted to your account on the dashboard. Twelve classes builds a complete set, an on-chain record of showing up.',
  },
  {
    title: 'Friendly M Helper',
    detail: 'Our robot assistant, in every session. More on him below.',
  },
  {
    title: 'A small group',
    detail:
      'Every child gets personalised exercises and room for their own creativity, play and pace.',
  },
]

export const NFT_NOTE =
  'Minting is opt-in and held in the parent’s account, not the child’s. There’s no cost, nothing to sell or trade, and your child never handles a wallet or any money. If you’d rather skip it entirely, say so. Everything else about the class is unchanged.'

/* ── Friendly M Helper ───────────────────────────────────────────────────── */

export const ROBOT_LEAD =
  'A real robot the children can talk to, and the most direct way to teach them what AI actually is.'

export const ROBOT_BODY: string[] = [
  'Friendly M Helper is a Reachy Mini, an open robot from Hugging Face. He sees, hears and responds. Children ask him about the day’s lesson, or about anything at all, and he answers them directly.',
  'He has a consistent personality and a memory. He remembers the children between sessions, and they get to know him over the twelve classes the way they’d get to know any other member of the group.',
  'Rather than talking about artificial intelligence and robotics in the abstract, the children learn it by interacting with it, asking, testing, being surprised, and figuring out where the edges are. It is the same principle as the rest of the class: understand it well enough to explain it.',
]

/* ── Plans ───────────────────────────────────────────────────────────────── */

export interface Tier {
  name: string
  price: number
  rate: string
  note: string
}

export const TIERS: Tier[] = [
  {
    name: 'Single Class',
    price: 60,
    rate: 'RM 60 / class',
    note: 'One session. Good for a first visit or an occasional week.',
  },
  {
    name: 'One Month',
    price: 360,
    rate: '≈ RM 28 / class',
    note: 'Every Monday, Wednesday and Friday for a calendar month. Roughly thirteen sessions.',
  },
]

export const PLAN_INTRO =
  'Two options, nothing else to work out. The class runs three times a week, so the monthly rate is where most families land: it pays for itself at six visits out of roughly thirteen.'

export const TERMS: string[] = [
  'Payment is for the month ahead, collected at the last class of the previous month.',
  'Unused sessions never expire while you’re enrolled. If I ever cancel a class, your month is extended by that class.',
  'Going travelling? Tell me before you go and I’ll pause your month. When you are back, it resumes for the same number of days you missed.',
  'Months are not refunded, but nobody loses money either.',
]

export const PAYMENT_RAILS = ['Stripe (card)', 'Wise', 'Venmo', 'Crypto (USDC)']

/* ── The magazine ────────────────────────────────────────────────────────── */

export const BOOK = {
  title: 'August 2026 Core Skills: Kids Wholistic Creativity and STEM Class',
  lead: 'Every twelve classes becomes a magazine your child keeps.',
  body: [
    'Magazine size and format, with content drawn from every session.',
    'Each class gets its own spread. On one page, the three graphics that explain the concept: one pitched for a three-year-old, one for a seven-year-old, one for a twelve-year-old. Facing it, three infographics the children made explaining the very same idea. Also included: an optional group photo and a photo scrapbook page from the class.',
  ],
  digital: {
    heading: 'The digital edition is included',
    detail:
      'Every enrolled family receives the complete magazine as a digital edition on the dashboard, included with enrolment. Nothing about the book sits behind an extra payment.',
  },
  print: {
    heading: 'The printed copy is optional: RM 100',
    detail:
      'A physical full-colour magazine. Collect it from me in person at no extra cost, or have it shipped to you for the cost of shipping. Ordered at the end of the twelve classes and printed only to order, nothing is printed unless a family asks for it.',
  },
  consent:
    'Group and scrapbook photos are included only with your written consent, and any child can be left out at your request with no effect on anything else.',
}

/* ── Privacy ─────────────────────────────────────────────────────────────── */

export const PRIVACY_INTRO =
  'Friendly M Helper hears and sees the children, and the class produces drawings, writing and quiz answers. Here is exactly what happens to all of it.'

export const PRIVACY_POINTS: { title: string; detail: string }[] = [
  {
    title: 'Everything is stored privately',
    detail:
      'Class information, images and audio recordings are kept in private storage tied to your family’s account.',
  },
  {
    title: 'Nothing is made public',
    detail:
      'No recording, photo or piece of your child’s work is published, posted, shared or used for marketing.',
  },
  {
    title: 'Photos are opt-in',
    detail:
      'Group photos and scrapbook pages require your written consent, and consent can be withdrawn at any time.',
  },
  {
    title: 'Ask me anything about it',
    detail: 'I’ll show you what’s stored for your child, and remove any of it on request.',
  },
]

/* ── Who teaches it ──────────────────────────────────────────────────────── */

export const BIO: string[] = [
  'Konrad learned how to teach from his mother, a career teacher. Before moving into engineering he taught Chemistry to students, and he holds a bachelor’s degree in Polish Studies from the University of Illinois at Chicago.',
  'He has been a software engineer for the past ten years, building at fintech SaaS companies at $50 million in revenue, and at crypto DeFi startups holding $500 million in total value locked. He has spoken at Ethereum conferences including Devconnect in Buenos Aires, and won prizes at hackathons including ETHTokyo, AGI House in Silicon Valley, ETHVietnam and ETHNYC.',
  'Today he is the founder of Argo, a private AI journaling app, teaches AI agents to a global audience, and speaks at and organises conferences and network state events.',
]

export const BIO_KICKER =
  'This class is about cultivating the core skills of drawing, writing, expressive writing, creativity, communication, these are core skills that people like Da Vinci, Marcus Aurelius, and Steve Jobs all had in common, they were able to use creativity and technology together, to push humanity forward. In this class we train these skills in ourselves, starting with mindfulness, breathing, yoga and a quick exercise, that teach self regulation and help deepen ability to concentrate. The AI robot assistant is present, to allow us to carefully introduce new teaching technologies.'

/* ── Close ───────────────────────────────────────────────────────────────── */

/* WhatsApp is the only contact route on this page. wa.me takes the number in
 * international format with no plus sign or spaces. */
export const WHATSAPP_NUMBER = '+1 708 539 1771'
export const WHATSAPP_URL = 'https://wa.me/17085391771'

export const CLOSING = `Send me a message on WhatsApp at ${WHATSAPP_NUMBER} and we’ll take it from there.`
