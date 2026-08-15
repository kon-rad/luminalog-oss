/* ──────────────────────────────────────────────────────────────────────────
 * Slide data for the Core Skills parent presentation.
 *
 * GENERATED FROM THE POWERPOINT, which is the source of truth for everything
 * shown on a slide:
 *   Areas/argo/kids-stem/research/presentations/final-parent-presentation-v2.pptx.pptx
 *
 * `lines` are the words on the slide, with the point size they carry in the
 * deck so the visual hierarchy survives. `notes` are the spoken script from
 * parent-presentation-v2.md, shown under the slide. Slide 3 is the video slot.
 * Re-extract rather than hand-editing when the deck changes.
 * ────────────────────────────────────────────────────────────────────────── */

export interface SlideLine {
  text: string
  /** Point size in the source deck. Drives relative type scale on the web. */
  size: number
}

export interface Slide {
  n: number
  eyebrow: string
  images: string[]
  lines: SlideLine[]
  notes: string[]
}

import { KIDS_COURSE_BASE } from './course'

/** Standalone full-screen presentation route. */
export const DECK_URL = `${KIDS_COURSE_BASE}/enroll/deck`

/** Faithful render of the source PowerPoint, one JPEG per slide. */
export function slideImage(n: number): string {
  return `/courses/kids-stem/deck/slide-${String(n).padStart(2, '0')}.jpg`
}

/** Where the video slot sits on slide 3, as a fraction of the slide box. */
export const VIDEO_SLOT = { left: '46%', top: '24%', width: '48%', height: '56%' }

/** Full recording of a class, shown at DECK_VIDEO_URL. */
export const DECK_VIDEO_URL = `${KIDS_COURSE_BASE}/enroll/deck-video`
export const CLASS_VIDEO_SRC = '/courses/kids-stem/kids-stem-class.mp4'

/** Slide 3 carries the Patrick Winston clip instead of an image. */
export const VIDEO_SLIDE = 3
export const VIDEO_SRC = '/courses/kids-stem/clip-weapon.mp4'

/** 20 x 11.25 inches in the source deck. */
export const SLIDE_RATIO = 16 / 9

/* ── Links shown under the notes ──────────────────────────────────────────
 * HAND MAINTAINED. Not derived from the PowerPoint, so re-extracting SLIDES
 * leaves this alone. Keyed by slide number.
 * ──────────────────────────────────────────────────────────────────────── */

export interface SlideLink {
  label: string
  href: string
}

export const SLIDE_LINKS: Record<number, SlideLink[]> = {
  18: [{ label: 'Konrad on LinkedIn', href: 'https://linkedin.com/in/konrad-gnat' }],
  22: [{ label: 'Konrad on LinkedIn', href: 'https://linkedin.com/in/konrad-gnat' }],
}

export const SLIDES: Slide[] = [
  {
    n: 1,
    eyebrow: '',
    images: [],
    lines: [
      { text: 'Kids Wholistic Creativity and STEM', size: 32.0 },
      { text: 'FOREST CITY · AGES 2 TO 12', size: 16.0 },
    ],
    notes: [
      'I want to start with the end in mind.',
      'Our goal is to give your child armor to go out into the world.',
      'You would be court-martialed for sending a soldier into battle without a weapon. This is us building the weapon. So they can go out into the world, conquer it, have a positive impact on it, achieve their dreams, and actualize their potential.',
      'That weapon is their ability to speak, their ability to write, and their ability to create and refine their own ideas.',
    ],
  },
  {
    n: 2,
    eyebrow: 'WHERE THIS COMES FROM',
    images: [],
    lines: [
      {
        text: 'Your success in life will be largely determined by your ability to speak, your ability to write, and the quality of your ideas, in that order.',
        size: 54.0,
      },
      { text: '“', size: 116.0 },
      { text: 'Patrick Winston', size: 30.0 },
      { text: 'Director, MIT Artificial Intelligence Laboratory, 1972 to 1997.', size: 18.0 },
      { text: 'Author of the textbook the world learned AI from.', size: 18.0 },
    ],
    notes: [
      'Here is where that comes from.',
      '"Your success in life will be largely determined by your ability to speak, your ability to write, and the quality of your ideas, in that order."',
      'That is Patrick Winston. He ran the MIT Artificial Intelligence Laboratory from 1972 to 1997, and he wrote the AI textbook the world learned from.',
    ],
  },
  {
    n: 3,
    eyebrow: 'IN HIS OWN WORDS',
    images: [],
    lines: [
      { text: 'Patrick Winston', size: 60.0 },
      { text: 'Watch him make the case himself, before we go into the room.', size: 21.0 },
      { text: 'Short clip from How to Speak, MIT.', size: 24.0 },
    ],
    notes: ['Here he is, in his own words.', '[clip plays]'],
  },
  {
    n: 4,
    eyebrow: 'SOMEBODY LIVING IT RIGHT NOW',
    images: [],
    lines: [
      { text: '“The highest rate of ideas per minute of anyone I have ever met.”', size: 44.0 },
      { text: 'Balaji', size: 80.0 },
      { text: 'Srinivasan', size: 80.0 },
      { text: 'MARC ANDREESSEN', size: 17.0 },
      { text: 'CTO, Coinbase', size: 19.0 },
      {
        text: 'Those skills made him a billionaire, and let him have an immensely positive impact on the world. We cultivate the same skills in this class.',
        size: 21.0,
      },
      { text: 'Founder, Network School', size: 19.0 },
      { text: 'Founder of startups at scale', size: 19.0 },
    ],
    notes: [
      'And here is somebody living it right now.',
      'Marc Andreessen famously described Balaji Srinivasan as the highest rate of ideas per minute he has ever met.',
      'Through that ability to speak, to communicate, to learn concepts, he created massively successful startups. He was CTO of Coinbase. He founded the Network State School, which we have all benefited from.',
      'Those skills made him a billionaire. And they let him have an immensely positive impact on the world.',
      'We are inspired by that. Here in this class we cultivate those same skills, so that we too can become just as impactful and positive a force for the world.',
    ],
  },
  {
    n: 5,
    eyebrow: 'SO HOW DO YOU DEVELOP THEM',
    images: [],
    lines: [
      { text: 'PRACTICE', size: 88.0 },
      { text: '01', size: 16.0 },
      { text: 'KNOWLEDGE', size: 88.0 },
      { text: '02', size: 16.0 },
      { text: 'TALENT', size: 88.0 },
      { text: '03', size: 16.0 },
      {
        text: 'That is the formula. We have dedicated one hour to cultivating the practice, and cultivating the knowledge.',
        size: 23.0,
      },
    ],
    notes: [
      'So how do you develop those three abilities?',
      'Through practice, through knowledge, and through talent. That is the formula.',
      'So we have dedicated one hour to cultivating the practice, and cultivating the knowledge.',
    ],
  },
  {
    n: 6,
    eyebrow: 'THE HOUR · 01',
    images: [],
    lines: [
      { text: 'It starts with', size: 61.99 },
      { text: 'breathing.', size: 61.99 },
      {
        text: 'Mindfulness, yoga stretches, exercise. Practices learned from the best teachers in the world and from executive coaches to millionaires. These are the keys to self regulation and to deepening concentration.',
        size: 21.0,
      },
    ],
    notes: [
      'The hour starts with breathing. Mindfulness. Yoga stretches, and exercise.',
      'These are practices I have learned from the best teachers in the world, and from executive coaches to millionaires. They are the keys to self-regulation and to deepening concentration.',
    ],
  },
  {
    n: 7,
    eyebrow: 'THE HOUR · 02',
    images: [],
    lines: [
      { text: 'Then we draw.', size: 61.99 },
      {
        text: 'One prompt. Draw what you think a computer is. I have taught them nothing yet, so there is nothing to copy.',
        size: 21.0,
      },
      { text: 'Imagination is more important than knowledge.', size: 30.0 },
      { text: 'ALBERT EINSTEIN', size: 17.0 },
    ],
    notes: [
      'Then we draw.',
      'I give one prompt, draw a computer, draw what you think a computer is, and I have taught them nothing. Nothing to copy.',
      'Imagination first. Einstein said imagination is more important than knowledge.',
    ],
  },
  {
    n: 8,
    eyebrow: 'THE HOUR · 03',
    images: [],
    lines: [
      { text: 'Then they', size: 61.99 },
      { text: 'journal.', size: 61.99 },
      {
        text: 'Still not ideas. Experience. Something they remember. Something they felt in their senses.',
        size: 21.0,
      },
    ],
    notes: [
      'Then they journal. Still not ideas, experience. Something they remember. Something they felt in their senses.',
    ],
  },
  {
    n: 9,
    eyebrow: 'THE HOUR · 04',
    images: [],
    lines: [
      { text: 'Then I teach the concept.', size: 66.0 },
      {
        text: 'What a computer actually is. What AI is. What a blockchain is. Explained three ways in the same room.',
        size: 21.0,
      },
      { text: 'AGE 3', size: 16.0 },
      { text: 'AGE 7', size: 16.0 },
      { text: 'AGE 12', size: 16.0 },
    ],
    notes: [
      'Then I teach the concept. What a computer actually is. What AI is. What a blockchain is.',
      'Explained three ways in the same room, for a three-year-old, a seven-year-old, and a twelve-year-old.',
    ],
  },
  {
    n: 10,
    eyebrow: 'THE HOUR · 05',
    images: [],
    lines: [
      { text: 'Then they', size: 61.99 },
      { text: 'teach it back.', size: 61.99 },
      {
        text: 'The last assignment. Fill a page with drawings and words that would teach that concept to somebody their own age.',
        size: 21.0,
      },
    ],
    notes: [
      'Then their last assignment. Fill a page with drawings and words that would teach that concept to somebody their own age.',
    ],
  },
  {
    n: 11,
    eyebrow: 'ONE MORE HELPER IN THE ROOM',
    images: [],
    lines: [
      { text: 'Friendly', size: 61.99 },
      { text: 'M Helper.', size: 61.99 },
      {
        text: 'Our AI robot assistant, present at every meeting. He sees, he hears, he responds, and he interacts directly with the kids. Hands on AI and robotics experience that will have a massive impact.',
        size: 21.0,
      },
    ],
    notes: [
      'There is one more helper in the room.',
      'Friendly M Helper. Our AI robot assistant, present at every meeting.',
      'He sees, he hears, and he responds, and he interacts directly with the kids.',
      'This teaches them hands-on AI and robotics experience. That will have a massive impact.',
    ],
  },
  {
    n: 12,
    eyebrow: 'EVERY MEETING',
    images: [],
    lines: [
      { text: 'They record it.', size: 61.99 },
      {
        text: 'A short video showcasing their drawings, their journaling, and their explanation of the concept. Optional, always. An AI agent robot edits it, and it comes back to them.',
        size: 21.0,
      },
    ],
    notes: [
      'And in every meeting they can record a short video.',
      'Showcasing their drawings, their journaling, and their explanation of the concept. Optional, always.',
      'An AI agent robot edits it, and it comes back to them.',
    ],
  },
  {
    n: 13,
    eyebrow: 'AFTER EVERY ASSIGNMENT',
    images: [],
    lines: [
      { text: 'Everybody', size: 61.99 },
      { text: 'presents.', size: 61.99 },
      {
        text: 'After the drawing, after the journaling, after the teaching, we go around the table and every child presents their work.',
        size: 21.0,
      },
      { text: 'Nobody critiques. We celebrate.', size: 30.0 },
      { text: 'WE NOTICE WHAT THEY ARE CURIOUS ABOUT, AND WE APPRECIATE THEM FOR CREATING.', size: 17.0 },
    ],
    notes: [
      'And after each one, after the drawing, after the journaling, after the teaching, we go around the table and every child presents their work.',
      'Nobody critiques. We celebrate. We point out what was interesting in what they communicated, we notice what they are curious about, and we appreciate them for creating.',
    ],
  },
  {
    n: 14,
    eyebrow: 'REWARDS',
    images: [],
    lines: [
      { text: 'Ten points earns one reward. They choose it.', size: 60.0 },
      { text: 'The drone', size: 34.0 },
      { text: 'Meta Quest 3', size: 34.0 },
      { text: 'Apple Vision Pro', size: 34.0 },
      { text: 'Our AI robot', size: 34.0 },
      { text: 'Five minutes flying it', size: 18.0 },
      { text: 'Five minutes in the headset', size: 18.0 },
      { text: 'Five minutes in the headset', size: 18.0 },
      { text: 'Five minutes programming it, with me', size: 18.0 },
      {
        text: 'Real hands on time on one of these technologies. At the end they get a thirty to sixty second video of themselves using it, or the recording of the demo they programmed, to share with friends and family.',
        size: 19.0,
      },
    ],
    notes: [
      'Finish the work and they earn points. Ten points earns one reward, and they choose it.',
      'Five minutes flying a drone. Five minutes in a Quest 3. Five minutes in an Apple Vision Pro. Or five minutes programming our friendly AI robot, with me.',
      'Five minutes of real hands-on time on one of these technologies. And at the end, they get a thirty to sixty second video of themselves using it, or the recording of the demo they programmed, to share with their friends and their family.',
    ],
  },
  {
    n: 15,
    eyebrow: 'THEY KEEP IT',
    images: [],
    lines: [
      { text: 'The notebook', size: 61.99 },
      { text: 'becomes a book.', size: 61.99 },
      {
        text: 'Their best pages become a book, physical or digital, theirs to keep. And enrolment includes a subscription to the Argo private AI journal. One for your child, and one for you.',
        size: 21.0,
      },
    ],
    notes: [
      'They keep the notebook. Their best pages become a book, a physical copy or a digital copy, theirs to keep.',
      'And enrolment includes a subscription to the Argo private AI journal. An AI-powered journal for your child, and one for you.',
    ],
  },
  {
    n: 16,
    eyebrow: 'THE SUBSCRIPTION CARRIES MORE',
    images: [],
    lines: [
      { text: 'A lifetime membership, minted.', size: 61.99 },
      { text: 'MEMBERSHIP NFT', size: 16.0 },
      { text: 'ARGONAUTS COMMUNITY CHAT', size: 16.0 },
      { text: 'Lifetime membership of the Argo high alignment community and network state.', size: 20.0 },
      {
        text: 'Open while you are subscribed. Global travellers, global creative technologists, innovators.',
        size: 20.0,
      },
      {
        text: 'We are warriors, in this sense. Our weapon is our ability to speak, to write, and to generate quality ideas.',
        size: 32.0,
      },
      {
        text: 'PRACTISED IN THIS KIDS CLASS, IN THE AI POWER USERS CLASS, AND IN THE ARGO JOURNAL.',
        size: 17.0,
      },
    ],
    notes: [
      'That subscription carries something more.',
      "It mints an NFT, a lifetime membership of the Argo high-alignment community and network state. And while you're subscribed, it opens the community Telegram, where you connect and coordinate with the other Argonauts. Global travellers, global creative technologists, innovators.",
      'Here is what holds that community together. We are warriors, in this sense: our weapon is our ability to speak, to write, and to generate and develop ideas.',
      "That is what we practise in this kids' class. It is what we practise in the AI Power Users class. And it is what we practise in the Argo journal.",
    ],
  },
  {
    n: 17,
    eyebrow: 'THE PORTAL',
    images: [],
    lines: [
      { text: 'Everything runs', size: 61.99 },
      { text: 'through one place.', size: 61.99 },
      {
        text: 'The subscription lives in the web portal. You start it and you manage it there. And you can opt in to a personalised report on your child’s activity and progress, generated by Friendly.',
        size: 21.0,
      },
    ],
    notes: [
      'Everything runs through the web portal.',
      'That is where the subscription lives. You start it and you manage it there.',
      "And you can opt in to a personalised report on your child's activity and progress, generated by Friendly.",
    ],
  },
  {
    n: 18,
    eyebrow: 'A WORD ABOUT ME',
    images: [],
    lines: [
      { text: 'Konrad Gnat', size: 72.0 },
      {
        text: 'Learned how to teach from my mother, a career teacher. Taught Chemistry to students before moving into engineering.',
        size: 19.0,
      },
      { text: 'BA in Polish Studies, University of Illinois at Chicago.', size: 19.0 },
      {
        text: 'Ten years a software engineer. Fintech SaaS at USD 50 million revenue. Crypto DeFi at USD 500 million total value locked.',
        size: 19.0,
      },
      {
        text: 'Spoke at Devconnect Buenos Aires. Prizes at ETHTokyo, AGI House Silicon Valley, ETHVietnam, ETHNYC.',
        size: 19.0,
      },
      {
        text: 'Founder of Argo, a private AI journaling app. I teach AI agents to a global audience and organise network state events.',
        size: 19.0,
      },
    ],
    notes: [
      'A word about me.',
      "I learned how to teach from my mother, a career teacher. Before moving into engineering I taught Chemistry to students, and I hold a bachelor's degree in Polish Studies from the University of Illinois at Chicago.",
      'I have been a software engineer for the past ten years, building at fintech SaaS companies at fifty million dollars in revenue, and at crypto DeFi startups holding five hundred million dollars in total value locked. I have spoken at Ethereum conferences including Devconnect in Buenos Aires, and won prizes at hackathons including ETHTokyo, AGI House in Silicon Valley, ETHVietnam and ETHNYC.',
      'Today I am the founder of Argo, a private AI journaling app. I teach AI agents to a global audience, and I speak at and organise conferences and network state events.',
    ],
  },
  {
    n: 19,
    eyebrow: 'ENROLMENT',
    images: [],
    lines: [
      { text: 'RM 60', size: 152.0 },
      { text: 'RM 400', size: 152.0 },
      { text: 'A SINGLE CLASS', size: 20.0 },
      { text: 'A MONTH', size: 20.0 },
      { text: 'Malaysian ringgit. One hour, three times a week.', size: 23.0 },
    ],
    notes: ['Sixty ringgit for a single class. Four hundred ringgit a month.'],
  },
  {
    n: 20,
    eyebrow: 'WHAT I WANT OUT OF THIS',
    images: [],
    lines: [
      { text: 'That they actualize', size: 60.0 },
      { text: 'their potential.', size: 60.0 },
      { text: 'That they enjoy it.', size: 20.0 },
      {
        text: 'That they practise drawing, journaling, writing and learning because they want to.',
        size: 20.0,
      },
      {
        text: 'That they come to know their skill sets, the value of their imagination and their uniqueness.',
        size: 20.0,
      },
      { text: 'Skills that serve them all through young adulthood and adulthood.', size: 20.0 },
    ],
    notes: [
      'Here is what I want out of this.',
      'That they enjoy it. That they practise drawing, journaling, writing and learning because they want to.',
      'That they come to know their skill sets, the value of their worth, and their abilities, through these fundamental skills.',
      'Skills that will serve them all through their young adulthood and their adulthood, and prepare them for a great life ahead of them.',
      'So that they actualize their potential.',
    ],
  },
  {
    n: 21,
    eyebrow: 'THE INTENTION',
    images: [],
    lines: [
      {
        text: 'To enable millions of kids to empower themselves through skills of speaking, writing and quality ideas.',
        size: 60.0,
      },
      { text: 'Join us!', size: 60.0 },
      {
        text: 'The best holistic creativity and STEM education class for children in the world.',
        size: 32.0,
      },
    ],
    notes: [
      'And here is the intention.',
      'The goal is to make this a worldwide movement, the best holistic creativity and STEM education class for children in the world.',
    ],
  },
  {
    n: 22,
    eyebrow: '',
    images: [],
    lines: [
      { text: 'One hour, three times a week.', size: 32.0 },
      { text: 'BUILDING THE WEAPON THEY WILL USE FOR THE REST OF THEIR LIVES.', size: 16.0 },
    ],
    notes: ['One hour, three times a week. Building the weapon they will use for the rest of their lives.'],
  },
]
