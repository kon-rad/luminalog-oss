import type { Card, Deck } from '../deck'

/* The 100 questions of "Bridging Generations of Entrepreneurs".
 *
 * Half are asked by the younger founder of the established one, half the other
 * way. They are written to be answered out loud in two or three minutes by
 * someone who has never seen the question before, and to reward a specific
 * story over a general opinion. The readable companion document, with the
 * facilitation notes for running a table, lives in the workspace-root
 * docs/card-games/ folder.
 *
 * Editing a question here is a one-line commit. Rooms store indexes into this
 * array, and every recorded answer denormalizes the prompt text it was given,
 * so an edit never rewrites history.
 */

const YOUNGER_TO_ELDER: Omit<Card, 'id' | 'direction'>[] = [
  // Journey
  { theme: 'journey', prompt: 'When you were 25, what did you think your life would look like at the age you are now, and where was that picture most wrong?' },
  { theme: 'journey', prompt: 'Can you walk us to the exact moment you stopped thinking of yourself as an employee and started thinking of yourself as a founder?' },
  { theme: 'journey', prompt: 'What season of your career looked like failure from the outside and turned out to be the most valuable thing you ever did?' },
  { theme: 'journey', prompt: 'Which door that closed on you turned out to be the luckiest thing that ever happened?' },
  { theme: 'journey', prompt: 'If your career were a book with four chapters, what would you title them?' },
  { theme: 'journey', prompt: 'What did you have to give up to get where you are, and would you pay that price again?' },
  { theme: 'journey', prompt: 'Who were you before your first company, and what part of that person do you miss?' },
  { theme: 'journey', prompt: 'What is the longest stretch you went without knowing whether the business would survive, and how did you sleep during it?' },
  { theme: 'journey', prompt: 'What did you believe about success at 30 that you no longer believe at all?' },
  { theme: 'journey', prompt: 'What job were you worst at, and what did being bad at it teach you?' },

  // Decisions
  { theme: 'decisions', prompt: 'What is the hardest decision you ever made where both options were genuinely defensible, and how did you finally choose?' },
  { theme: 'decisions', prompt: 'Can you describe a time you went against every advisor in the room and were right, and a time you did the same and were wrong?' },
  { theme: 'decisions', prompt: 'What is your actual method for deciding something when the data does not settle it?' },
  { theme: 'decisions', prompt: 'When did you first turn down money, and what did that cost you?' },
  { theme: 'decisions', prompt: 'Which decision did you deliberate over the longest that turned out not to matter at all?' },
  { theme: 'decisions', prompt: 'How do you tell the difference between it being time to quit something and it being time to push through one more month?' },
  { theme: 'decisions', prompt: 'What is the biggest bet you have made where you genuinely could not see the other side of it?' },
  { theme: 'decisions', prompt: 'Which of your rules for making decisions did you inherit from someone else, and who was that person?' },

  // Craft
  { theme: 'craft', prompt: 'What part of building a company are you genuinely great at, and what part have you never gotten good at?' },
  { theme: 'craft', prompt: 'In concrete detail, what did it actually take to get your first ten customers?' },
  { theme: 'craft', prompt: 'What is the most useful thing about business you learned on the job that no course would ever have taught you?' },
  { theme: 'craft', prompt: 'If you had to teach one hour on the thing you know better than almost anyone, what would that hour be about?' },
  { theme: 'craft', prompt: 'What skill did you build deliberately, over years, that people now assume you were born with?' },
  { theme: 'craft', prompt: 'What did you personally do in the first year of your company that you would never let anyone do now?' },
  { theme: 'craft', prompt: 'What is the most overrated practice in business today, and what is the most underrated?' },
  { theme: 'craft', prompt: 'How has the way you build a product changed in the last ten years, and what has stayed exactly the same?' },

  // Mentorship
  { theme: 'mentorship', prompt: 'Who took a chance on you when you had no track record, and what do you think they saw?' },
  { theme: 'mentorship', prompt: 'What is the best piece of advice you ever received, and how long did it take you to actually understand it?' },
  { theme: 'mentorship', prompt: 'What advice did you receive that was widely respected and completely wrong for you?' },
  { theme: 'mentorship', prompt: 'Who is the person you hired who changed the company the most, and how did you find them?' },
  { theme: 'mentorship', prompt: 'What is the hardest conversation you have ever had with a co-founder or a partner?' },
  { theme: 'mentorship', prompt: 'In a first meeting, how do you tell whether you want to work with someone for the next five years?' },
  { theme: 'mentorship', prompt: 'What do you look for in a young person now that you would not have noticed twenty years ago?' },
  { theme: 'mentorship', prompt: 'Who mentors you today, and what do they give you that you cannot give yourself?' },

  // Money
  { theme: 'money', prompt: 'What is the honest story of the first money you ever raised, or the first real profit you ever made?' },
  { theme: 'money', prompt: 'What do you understand about money now that would have saved you the most pain at 25?' },
  { theme: 'money', prompt: 'When did you first feel financially safe, and did it change you the way you expected it to?' },
  { theme: 'money', prompt: 'What is the most expensive mistake you have made, in actual dollars, and was it worth what it taught you?' },
  { theme: 'money', prompt: 'How do you decide what to spend money on when the future is genuinely uncertain?' },

  // Failure
  { theme: 'failure', prompt: 'What is the failure you are still not fully over?' },
  { theme: 'failure', prompt: 'What do you carry with you from the times you have had to let people go?' },
  { theme: 'failure', prompt: 'What did you tell yourself during the worst week you have ever had in business?' },
  { theme: 'failure', prompt: 'What did you get publicly wrong that you would defend differently today?' },
  { theme: 'failure', prompt: 'When have you been genuinely humiliated in your working life, and what did it change in you?' },

  // Vision
  { theme: 'vision', prompt: 'What are you still trying to prove, and to whom?' },
  { theme: 'vision', prompt: 'What would you do with the next ten years if the money were already handled?' },
  { theme: 'vision', prompt: 'What do you want to be remembered for by people who never worked with you?' },
  { theme: 'vision', prompt: 'What is a question about your own life that you have not answered yet?' },
  { theme: 'vision', prompt: 'If you could send one sentence back to yourself on the first day of your first company, what would it say?' },
  { theme: 'vision', prompt: 'What are you learning right now that has nothing at all to do with your work?' },
]

const ELDER_TO_YOUNGER: Omit<Card, 'id' | 'direction'>[] = [
  // Tools
  { theme: 'tools', prompt: 'Which AI tool have you actually built into your daily routine, and what were you doing before it?' },
  { theme: 'tools', prompt: 'What is the last thing you built or shipped with an AI tool that would have taken you a week two years ago?' },
  { theme: 'tools', prompt: 'What software do you pay for with your own money, and why that one over the free option?' },
  { theme: 'tools', prompt: 'What piece of technology is everyone your age using that people a generation older have completely missed?' },
  { theme: 'tools', prompt: 'What can you do in an afternoon now that used to require a whole team?' },
  { theme: 'tools', prompt: 'Which tool is overhyped right now, and what are people failing to see about it?' },
  { theme: 'tools', prompt: 'When you are stuck on a genuinely hard problem, how do you use AI on it, step by step?' },
  { theme: 'tools', prompt: 'What does your setup look like, and which single part of it would you defend to the death?' },

  // Learning
  { theme: 'learning', prompt: 'How did you learn the most useful skill you have, and how long did it take?' },
  { theme: 'learning', prompt: 'What is the best free thing on the internet that taught you more than a paid course would have?' },
  { theme: 'learning', prompt: 'What course, book, or channel would you put in front of every person starting out?' },
  { theme: 'learning', prompt: 'What can you do that most people your age cannot, and how did you get it?' },
  { theme: 'learning', prompt: 'When you want to learn something new this month, what is the very first thing you do?' },
  { theme: 'learning', prompt: 'What are schools still teaching that the world has stopped needing?' },
  { theme: 'learning', prompt: 'What have you taught yourself purely because it was fun, with no career logic behind it at all?' },
  { theme: 'learning', prompt: 'How do you decide what to learn next when everything is changing this fast?' },

  // Observations
  { theme: 'observations', prompt: 'What is broken about the way business gets done that everyone older seems to have quietly accepted?' },
  { theme: 'observations', prompt: 'What is happening right now that people over forty are not taking seriously enough?' },
  { theme: 'observations', prompt: 'Which company do you genuinely admire right now, and what specifically do they get right?' },
  { theme: 'observations', prompt: 'What product do you love so much that you have recommended it to a stranger?' },
  { theme: 'observations', prompt: 'What trend is everyone excited about that you think is nonsense?' },
  { theme: 'observations', prompt: 'What has the internet taught you about people that you did not expect to learn?' },
  { theme: 'observations', prompt: 'What is the most impressive thing you have seen someone your own age build?' },
  { theme: 'observations', prompt: 'What do you think your generation will be blamed for in thirty years?' },

  // Mentorship
  { theme: 'mentorship', prompt: 'Who do you learn the most from right now, and have you ever actually met them?' },
  { theme: 'mentorship', prompt: 'What is the best advice you have received from someone at least twenty years older than you?' },
  { theme: 'mentorship', prompt: 'What do you wish older founders would ask you, instead of what they usually ask?' },
  { theme: 'mentorship', prompt: 'What kind of help do you actually need right now that is hard to ask for?' },
  { theme: 'mentorship', prompt: 'Who in your life would you most want to be mentored by, and what would you want from them?' },
  { theme: 'mentorship', prompt: 'What do older people say to you that you have learned to quietly ignore?' },

  // Money
  { theme: 'money', prompt: 'What is your honest relationship with money right now, and how is it different from your parents?' },
  { theme: 'money', prompt: 'What is the first money you ever made on your own, and what did it feel like?' },
  { theme: 'money', prompt: 'How much risk can you actually afford to take right now, and how did you work that out?' },
  { theme: 'money', prompt: 'What would you do with a year of runway if someone handed it to you tomorrow?' },
  { theme: 'money', prompt: 'What do you not understand about money that you wish someone would just explain plainly?' },

  // Decisions
  { theme: 'decisions', prompt: 'What is the biggest bet you are making with your twenties or your thirties?' },
  { theme: 'decisions', prompt: 'What did you turn down in the last year, and was it hard?' },
  { theme: 'decisions', prompt: 'What decision are you stuck on right now that this table could actually help with?' },
  { theme: 'decisions', prompt: 'What would you be doing if the people closest to you had no opinion about it?' },
  { theme: 'decisions', prompt: 'What is the most useful thing that has gone wrong for you so far?' },
  { theme: 'decisions', prompt: 'What did you try that did not work, and what did you keep from it?' },

  // Vision
  { theme: 'vision', prompt: 'What do you want your life to look like in ten years, specifically enough that you could tell whether you got there?' },
  { theme: 'vision', prompt: 'What problem would you work on for the rest of your life if you knew you could not fail?' },
  { theme: 'vision', prompt: 'What do you want to build that does not exist yet?' },
  { theme: 'vision', prompt: 'What kind of company would you want to work at that nobody has built yet?' },
  { theme: 'vision', prompt: 'What are you most hopeful about right now?' },
  { theme: 'vision', prompt: 'What are you most afraid of about the next ten years?' },
  { theme: 'vision', prompt: 'What is something you want that you have never said out loud in a professional setting?' },
  { theme: 'vision', prompt: 'If you had to start a company this month with only what you know today, what would it be?' },
  { theme: 'vision', prompt: 'What do you want to be true about you by the time you are the age of the oldest person at this table?' },
]

const cards: Card[] = [
  ...YOUNGER_TO_ELDER.map((c) => ({ ...c, direction: 'younger-to-elder' as const })),
  ...ELDER_TO_YOUNGER.map((c) => ({ ...c, direction: 'elder-to-younger' as const })),
].map((card, i) => ({ ...card, id: `bg-${String(i + 1).padStart(3, '0')}` }))

export const BRIDGING_GENERATIONS: Deck = {
  id: 'bridging-generations',
  slug: 'bridging-generations',
  title: 'Bridging Generations of Entrepreneurs',
  tagline: 'One hundred questions across the generation gap.',
  description:
    'A deck for a small table of three to seven founders at very different points on the road. Half the cards send a question from the younger builder to the established one, about the journey already walked, the decisions that turned out to matter, and the things no course teaches. The other half send a question the other way, about the tools, the instincts, and the hopes of someone standing at the starting line right now. Turn a card over, answer it out loud, and leave the answer behind for whoever plays next.',
  directions: {
    'younger-to-elder': {
      label: 'Younger asks established',
      blurb:
        'A founder earlier on the road asks someone further along about their journey, their decisions, their mentors, and what they would do differently.',
    },
    'elder-to-younger': {
      label: 'Established asks younger',
      blurb:
        'A founder further along asks someone earlier on the road what the world looks like from the starting line: the tools, the teachers, the things that look broken, and the dreams.',
    },
  },
  cards,
}
