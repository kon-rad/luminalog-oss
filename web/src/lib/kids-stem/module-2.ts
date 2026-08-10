/* ──────────────────────────────────────────────────────────────────────────
 * Module 2, "What Is a Blockchain? The Notebook Nobody Can Erase"
 *
 * The third class in the kids course. Class 0 answered "what is a computer"
 * (IN → THINK → OUT), class 1 answered "what happens when the THINK part learns
 * for itself" (AI). This one is not really about machines at all: how do a lot
 * of people agree on what is true when nobody is in charge? Same shape as
 * course.ts and module-1.ts, prose-light data consumed by the page and quiz.
 *
 * Each age level keeps the prompt that generated its infographic in
 * `imagePrompt` (Nano Banana Pro via Together AI, 2528x1696), so the picture
 * can be regenerated or nudged without reverse-engineering it from the file.
 * ────────────────────────────────────────────────────────────────────────── */

import type { AgeExplanation, HistoryBeat, QuizMCQ } from './course'

export const MODULE_2_SLUG = 'what-is-blockchain'

export const MODULE_2_TITLE = 'What Is a Blockchain? The Notebook Nobody Can Erase'

export const MODULE_2_INTRO =
  'Class 0 asked what a computer is. Class 1 asked what happens when the thinking part learns for itself. This class asks something different, and it is not really about machines at all: how can a lot of people agree on what is true, when nobody is in charge? The answer turns out to be a notebook, one everybody has a copy of, where every page is glued to the page before it.'

export const MODULE_2_HOOK =
  'If we all keep the same notebook, and every page is glued to the one before it, then nobody can sneak in and change what happened.'

/* ── The drawing prompt ───────────────────────────────────────────────────── */

export const MODULE_2_DRAWING_PROMPT =
  'Draw your own chain. Four boxes in a row, joined by links. In each box, draw one thing that happened today, in order. Give every box its own seal: a squiggle, a stamp, a little symbol. Then copy the seal from each box into the box that comes after it. Now try to change box 2, and look at what happens to every seal after it.'

export const MODULE_2_DRAWING_BY_LEVEL: { level: string; what: string }[] = [
  {
    level: 'Littlest (2–4)',
    what: 'Draw a chain. Big links, joined together. Colour it in. Holding the pen counts.',
  },
  {
    level: 'Middle (5–8)',
    what: 'Four boxes with arrows between them, one drawing in each, and your own seal-stamp on every box.',
  },
  {
    level: 'Older (9–12)',
    what: 'Draw three friends standing around the chain, each holding an identical copy of it. Label the boxes “blocks”, the links “hashes”, and the copies “the network”.',
  },
]

/* ── The journaling prompt ────────────────────────────────────────────────── */

export const MODULE_2_JOURNALING_PROMPT =
  'Who do you trust, and how do you know? Write about one person you trust completely, and how that trust got built. Then: what is one thing you would want written down forever, so nobody could ever change it? And what is one thing you would rather nobody could see at all?'

export const MODULE_2_JOURNALING_BY_LEVEL: { level: string; what: string }[] = [
  {
    level: 'Littlest (2–4)',
    what: 'Say one person you trust out loud. A grown-up writes the name in the notebook; the child draws them.',
  },
  {
    level: 'Middle (5–8)',
    what: 'Three sentences. “I trust ___ because ___.”',
  },
  {
    level: 'Older (9–12)',
    what: 'The full prompt, including the last part, public forever vs. private forever. That distinction is the lesson, and it is why a private notebook and a public ledger are two different tools.',
  },
]

export const MODULE_2_JOURNALING_NOTE =
  'Some things belong on a wall everyone can read, and some things belong in a notebook only you can open. Knowing which is which is a skill, and it is the whole reason this class has a notebook in it.'

/* ── The three illustrated levels ─────────────────────────────────────────── */

export const BLOCKCHAIN_BY_AGE: AgeExplanation[] = [
  {
    age: 'Age 3',
    headline: 'Everybody has the same notebook',
    body: 'You have a notebook. I have a notebook. She has a notebook. They are all the SAME. If I give you my apple, everybody writes it down. Now nobody can say it did not happen.',
    image: '/courses/kids-stem/blockchain-explained-age-3.jpg',
    alt: 'Three cheerful cartoon children holding up open notebooks, all three showing the same drawing of an apple with a green checkmark, under the words “SAME NOTEBOOK!”',
    imagePrompt:
      'A joyful kawaii sticker-style children\'s illustration on a warm butter-yellow background. Thick dark-brown outlines, soft rounded shapes, glossy highlights, every element surrounded by a clean white sticker edge, scattered white four-point sparkles. At the top, a big bubbly rounded display headline reading exactly "SAME NOTEBOOK!", chunky letters with thick dark-brown outlines and a white sticker rim, the first word in coral pink and the second word in soft mint and butter yellow. Below the headline: three adorable chibi cartoon children of different skin tones standing in a happy row, each holding an open notebook up toward the viewer with both hands, all beaming with big shiny eyes and rosy cheeks. All three open notebooks show the EXACT SAME simple drawing: one red apple with a big green checkmark beside it. Small soft dotted lines arc between the three notebooks to show they match. In the bottom-right corner, a small friendly chain of three linked rounded boxes. Very simple and uncluttered, only these elements, extremely readable for a 3-year-old. No other text anywhere.',
  },
  {
    age: 'Age 7',
    headline: 'Write it down → Link the pages → Everybody checks',
    body: 'Imagine our class keeps one notebook of who traded what, except every single person has their own copy, and every page is glued to the page before it. If someone sneaks off and changes page 2, their notebook stops matching everybody else’s, and we all see it straight away. You do not have to trust a person. You can check.',
    image: '/courses/kids-stem/blockchain-explained-age-7.jpg',
    alt: 'A three-stage cartoon infographic titled “How a blockchain works!”: WRITE IT DOWN (a notebook and pencil), LINK THE PAGES (four sealed cards joined by chain links), and EVERYBODY CHECKS (three children holding copies, two with green checkmarks and one with a red X).',
    imagePrompt:
      'A cheerful children\'s educational infographic, kawaii cartoon vector style, on a soft pastel sky-blue background with fluffy white clouds and faint white line-art doodles scattered behind (chain links, notebooks, checkmarks, padlocks, gears). At the top, a large bubbly rounded display headline reading exactly "HOW A BLOCKCHAIN WORKS!" in warm cream-coloured chunky letters with a soft blue outline and gentle drop shadow. Below it, three stages left to right, each standing on its own wide coloured cylindrical podium, with a thick curved orange cartoon arrow pointing from stage one to stage two and from stage two to stage three: 1. On a BLUE podium labelled "WRITE IT DOWN" in bubbly cream letters: a cute open notebook with a happy cartoon pencil writing a neat line of entries on the page. 2. On an ORANGE podium labelled "LINK THE PAGES" in bubbly cream letters: four small rounded page-cards in a row joined by thick chunky chain links, each card stamped with a round coloured wax seal. 3. On a GREEN podium labelled "EVERYBODY CHECKS" in bubbly cream letters: three small cheerful cartoon kids each holding up an identical little chain of cards, two kids have a big green checkmark floating above them, and the third kid\'s chain is visibly different and has a red X above it. Warm friendly palette of sky blue, butter yellow, coral, mint green and orange, thick rounded outlines. Only the labels listed above, no other text. Clean, spacious and readable at a glance by a 7-year-old.',
  },
  {
    age: 'Age 12',
    headline: 'Hashes, blocks, consensus & keys',
    body: 'A hash is a fingerprint for data: feed in a whole book and you get back a short string of characters. Change one comma and the fingerprint changes completely, and you cannot run it backwards. Take a batch of transactions, call it a block, and stamp inside it the fingerprint of the block before it. Do that over and over and you have a chain: changing anything in an old block breaks every block after it. Thousands of computers each hold the whole chain, and consensus rules decide who adds the next block. You prove a transaction is yours with a private key, a secret number that signs it, which anyone can verify without ever seeing the secret.',
    image: '/courses/kids-stem/blockchain-explained-age-12.jpg',
    alt: 'A flat-vector infographic titled “How a blockchain works”: three blocks in a row, each carrying the previous block’s hash forward (0000 → 7f2a → 9c1b → 4e8d), a THE NETWORK panel of six computers with one rejected, and a TAMPER = BROKEN panel showing an edited block snapping the links after it.',
    imagePrompt:
      'A clean editorial flat-vector infographic on a warm off-white cream background, generous white space, thin confident line work, restrained palette of deep navy, teal, coral-orange and soft grey-blue. Modern geometric sans-serif type. Top-left, a deep navy headline in capitals reading exactly "HOW A BLOCKCHAIN WORKS". Centre, occupying the upper two thirds: a horizontal chain of three rounded rectangular cards titled "BLOCK 1", "BLOCK 2" and "BLOCK 3" in navy capitals. Each card is divided into three stacked rows separated by thin hairlines: a top row reading "PREV HASH:" followed by a short code in small grey monospace, a middle row holding a small stack of three tiny grey transaction bars each with a little navy key icon, and a bottom row reading "HASH:" followed by a short code in small teal monospace. The codes MUST be exactly these, all different, so that each block\'s PREV HASH matches the previous block\'s HASH: - BLOCK 1: top row "PREV HASH: 0000..." and bottom row "HASH: 7f2a..." - BLOCK 2: top row "PREV HASH: 7f2a..." and bottom row "HASH: 9c1b..." - BLOCK 3: top row "PREV HASH: 9c1b..." and bottom row "HASH: 4e8d..." A bold navy arrow runs from the bottom HASH row of each block up into the top PREV HASH row of the next block, showing the code being carried forward. Bottom-left, a small labelled panel headed "THE NETWORK" in navy capitals: six small computer-monitor icons in two rows, five of them navy with a small green checkmark, and one shaded coral with a small red cross and the tiny label "REJECTED". Bottom-right, a small labelled panel headed "TAMPER = BROKEN" in navy capitals: the same three-block chain drawn tiny, where BLOCK 1 has a coral-orange edit mark on it and the links to blocks 2 and 3 are drawn as snapped, broken chain links in coral. Along the very bottom, centred, a single line of navy text reading exactly "Change one thing, and every block after it breaks." Only the text described above, no other labels or paragraphs. Precise, calm and uncluttered, suitable for a 12-year-old reading it closely.',
  },
]

/* The five pieces the oldest kids should be able to name. */
export const BLOCKCHAIN_PIECES: { piece: string; what: string }[] = [
  {
    piece: 'Hash',
    what: 'A one-way fingerprint of data. Same input → same fingerprint. Tiny change → completely different fingerprint.',
  },
  {
    piece: 'Block',
    what: 'A batch of transactions, plus the hash of the block before it.',
  },
  {
    piece: 'Chain',
    what: 'Blocks linked by those hashes, so tampering with the past breaks everything after it.',
  },
  {
    piece: 'Network',
    what: 'Thousands of independent computers, each holding the whole chain and checking every new block.',
  },
  {
    piece: 'Consensus',
    what: 'The rules for who adds the next block and what counts as the real chain, proof of work (spend electricity) or proof of stake (put money at risk).',
  },
]

export const BLOCKCHAIN_KEYS_NOTE =
  'Bonus piece, keys. Your private key is a secret number. Your public key (your address) comes from it and is safe to share. Signing with the private key proves you authorised something without revealing the secret. Lose the private key and the money is gone forever, no helpdesk, no reset. “Not your keys, not your coins.”'

export const BLOCKCHAIN_HONEST_PART =
  'A blockchain guarantees that the record was not changed. It does not guarantee that what was written is true, or fair, or a good idea. If someone lies to the notebook, you get a permanent, tamper-proof lie, and because it cannot be undone, a mistake or a scam is final. That is exactly why so many people lose money in crypto: the technology is honest, the people are not always.'

/* The same idea at five depths. */
export const BLOCKCHAIN_LADDER: { age: string; idea: string }[] = [
  { age: 'Age 2', idea: 'We all have the same notebook.' },
  { age: 'Age 5', idea: 'Everybody writes it down, so nobody can change it.' },
  {
    age: 'Age 7',
    idea: 'Pages glued to pages, everybody holds a copy, everybody checks.',
  },
  {
    age: 'Age 10',
    idea: 'Each block carries a fingerprint of the last one, so the past cannot be edited.',
  },
  {
    age: 'Age 13',
    idea: 'Hash-linked blocks, replicated across an untrusted network, ordered by a consensus rule, authorised by digital signatures.',
  },
]

/* ── The story of blockchain ──────────────────────────────────────────────── */

export const BLOCKCHAIN_HISTORY: HistoryBeat[] = [
  {
    year: '1976',
    title: 'The key idea, literally',
    detail:
      'Whitfield Diffie and Martin Hellman invent public-key cryptography: a pair of keys where one locks and the other unlocks. Suddenly two strangers can keep a secret without ever meeting. Nothing that follows is possible without this.',
  },
  {
    year: '1979',
    title: 'Merkle trees',
    detail:
      'Ralph Merkle works out how to fingerprint a huge pile of data with one small hash, so you can prove one item belongs without sending all the rest. Every blockchain still uses it.',
  },
  {
    year: '1991',
    title: 'The first blockchain, nobody called it that',
    detail:
      'Stuart Haber and W. Scott Stornetta publish “How to Time-Stamp a Digital Document”: chain each timestamp to the one before it so the order cannot be faked. Bitcoin’s whitepaper cites them. Their actual problem was ordinary, proving when a scientist wrote something down.',
  },
  {
    year: '1993',
    title: 'Making spam expensive',
    detail:
      'Cynthia Dwork and Moni Naor suggest making a computer do a little pointless work before it can send you a message. Cheap for one email, ruinous for a million.',
  },
  {
    year: '1997',
    title: 'Hashcash',
    detail: 'Adam Back builds that idea into something real. This is proof of work.',
  },
  {
    year: '1998',
    title: 'Two near-misses',
    detail:
      'Wei Dai describes b-money and Nick Szabo describes bit gold: money with no bank, kept honest by computation. Neither was ever built. Szabo had already coined the phrase “smart contracts” in 1994.',
  },
  {
    year: '2008',
    title: 'The whitepaper',
    detail:
      'On 31 October, someone calling themselves Satoshi Nakamoto posts nine pages: “Bitcoin: A Peer-to-Peer Electronic Cash System.” They took Merkle’s trees, Haber and Stornetta’s chain, Back’s proof of work and Diffie and Hellman’s keys, and made the pieces fit. Nobody knows who they are, and they have not been heard from since 2011.',
  },
  {
    year: '2009',
    title: 'The genesis block',
    detail:
      'On 3 January the first block is mined. Satoshi wrote a newspaper headline into it: “Chancellor on brink of second bailout for banks.” A timestamp and an argument in the same breath. Nine days later the first transaction goes to Hal Finney, who had downloaded the software because it sounded interesting.',
  },
  {
    year: '2010',
    title: 'The pizza',
    detail:
      'On 22 May, Laszlo Hanyecz pays 10,000 bitcoin for two pizzas, the first time it bought anything real. The point of the story is not what those pizzas cost later; it is that somebody had to be first to treat it as real.',
  },
  {
    year: '2015',
    title: 'A blockchain you can program',
    detail:
      'A nineteen-year-old, Vitalik Buterin, asks why the notebook can only hold money. Ethereum launches in July: the chain runs little programs, smart contracts, so the shared notebook can hold rules, games, art and whole organisations.',
  },
  {
    year: '2016',
    title: 'Privacy arrives',
    detail:
      'Zcash ships zero-knowledge proofs in a real currency: prove a payment is valid without revealing who, whom, or how much. A blockchain that is verifiable and private at the same time.',
  },
  {
    year: '2020–21',
    title: 'The loud years',
    detail:
      'NFTs, DeFi, enormous prices, enormous crashes, and an enormous number of scams. Worth saying out loud to the older kids: a lot of people got hurt, and the hype was neither the technology’s fault nor its friend.',
  },
  {
    year: '2022',
    title: 'The Merge',
    detail:
      'On 15 September, Ethereum switches from proof of work to proof of stake and its energy use drops by roughly 99.9% overnight. The biggest criticism of blockchains turned out to be fixable.',
  },
  {
    year: '2024',
    title: 'Into the plumbing',
    detail:
      'Regulated bitcoin funds list on ordinary stock exchanges, and banks and governments quietly start using chains for settlement. The revolutionary phase ends the way they usually do, it becomes infrastructure.',
  },
]

export const BLOCKCHAIN_PEOPLE: { name: string; why: string }[] = [
  {
    name: 'Whitfield Diffie & Martin Hellman',
    why: 'Public-key cryptography, 1976. The keys everything is built on.',
  },
  {
    name: 'Ralph Merkle',
    why: 'Merkle trees, fingerprint a mountain of data with one hash.',
  },
  {
    name: 'Stuart Haber & W. Scott Stornetta',
    why: 'Chained timestamps, 1991. The first blockchain, before the word existed.',
  },
  { name: 'Cynthia Dwork & Moni Naor', why: 'Proof of work as an idea, 1993.' },
  { name: 'Adam Back', why: 'Hashcash, 1997, proof of work made real.' },
  {
    name: 'Wei Dai & Nick Szabo',
    why: 'b-money and bit gold; Szabo also named “smart contracts”.',
  },
  {
    name: 'Satoshi Nakamoto',
    why: 'Bitcoin, 2008. Assembled the pieces. Identity still unknown.',
  },
  {
    name: 'Hal Finney',
    why: 'Ran the software on day one; received the first transaction.',
  },
  { name: 'Vitalik Buterin', why: 'Ethereum, a blockchain you can program.' },
]

/* ── Where blockchain is now ──────────────────────────────────────────────── */

export const BLOCKCHAIN_CAN: string[] = [
  'Send value to anyone, anywhere, without asking permission, useful when banks are slow, closed, or not an option where you live.',
  'Keep records nobody can quietly edit, ownership, votes, certificates, supply chains, proof a document existed on a date.',
  'Run rules that enforce themselves: a smart contract does what it says, the same way, for everybody.',
  'Let you actually own digital things, art, game items, tickets, names.',
  'Prove without revealing, zero-knowledge proofs show something is true without handing over the secret.',
  'Keep working when nobody is in charge. That is the actual invention.',
]

export const BLOCKCHAIN_CANNOT: string[] = [
  'It cannot make a lie true. It only guarantees nobody changed the record.',
  'It cannot be undone. Send it to the wrong address and it is gone. Lose your key and it is gone. There is no support line.',
  'It is not automatically private. Most chains are public, anyone can read every transaction, forever.',
  'It is not free of people. Scams and hype are everywhere in crypto, and checking the chain does not tell you who to trust.',
  'It is slow and expensive next to a normal database. If one trusted organisation can just keep the list, this is the wrong tool.',
  'Proof of work uses real electricity, far less than it used to, but real.',
]

/* ── What might happen next ───────────────────────────────────────────────── */

export const BLOCKCHAIN_SOON: string[] = [
  'Money moving between countries in seconds instead of days, for a few cents.',
  'Digital ID and school certificates you carry and prove yourself.',
  'Proving a photo or video is real and was not generated, a direct answer to the problem last class created.',
  'Zero-knowledge proofs everywhere: prove you are over 18 without showing your birthday.',
]

export const BLOCKCHAIN_LATER: string[] = [
  'Organisations run by their members and their rules rather than by a boss.',
  'Ownership of ordinary things (a house, a share, a ticket) recorded on open chains by default.',
  'AI agents that hold their own keys and pay each other for work. The two classes meet: the AI thinks, the blockchain keeps it honest.',
]

export const BLOCKCHAIN_OPEN_ARGUMENT =
  'Some very smart people think open blockchains will end up under most of the world’s money and record-keeping. Other very smart people think it is a clever answer to a problem almost nobody has, and that a trusted database is simply better nearly every time. Both groups have good reasons, and both have been right about specific things. When adults argue this hard, the question is genuinely open, and the kids in this room get to answer it.'

export const BLOCKCHAIN_STAYS_HUMAN =
  'A blockchain is a machine for not needing to trust anybody. That is a real and beautiful invention, and it is not how you live. You will still choose friends, tell the truth, and keep promises nobody could ever check. Trust between people is the thing worth having; this technology is only for the situations where you cannot have it. And the record of your life, what you thought, what you felt, what you noticed, does not belong on a wall everybody can read. It belongs in your notebook.'

/* ── Running order for the 15-minute STEM block ───────────────────────────── */

export const MODULE_2_RUNNING_ORDER: {
  minutes: number
  title: string
  detail: string
}[] = [
  {
    minutes: 4,
    title: 'Explain',
    detail:
      'The age-3 version to the whole room with real notebooks, then the age-7 three-step version, then the age-12 layer for the older kids. Two or three story beats from the history, the newspaper headline and the pizza always land.',
  },
  {
    minutes: 2,
    title: 'Say it back',
    detail:
      'Pair up. Each child explains “why can’t you cheat in the shared notebook?” to their partner in their own words.',
  },
  {
    minutes: 6,
    title: 'Draw or write',
    detail: 'The drawing prompt and the journaling prompt, at each level. Both are above.',
  },
  {
    minutes: 3,
    title: 'Share',
    detail:
      'Two or three volunteers show their page. Ask: “What is one thing you would want written down forever?”',
  },
]

export const MODULE_2_GAME =
  'Unplugged game, “The Human Blockchain.” Every child has their notebook open. Announce a trade, “Maya gives Tom a sticker”, and everybody writes it down, numbered. Do five or six. Then quietly ask one child to change trade number 2 in their own notebook. Now read trade 2 aloud from three notebooks at once. One does not match. “Who is wrong, the one, or the many?” Then make it harder: ask how to catch a cheat without reading every page aloud. Someone will invent the seal. That is a hash, and they found it themselves.'

/* ── Knowledge check ─────────────────────────────────────────────────────── */

export const MODULE_2_MCQ: QuizMCQ[] = [
  {
    question: 'What is a blockchain?',
    options: [
      'A very fast computer chip',
      'A shared notebook everybody has a copy of, where each page is linked to the one before',
      'A robot that learns from examples',
      'A secret website',
    ],
    answer: 1,
  },
  {
    question: 'Why can’t you change something written in an old block?',
    options: [
      'The ink dries',
      'It is locked with a password',
      'Its fingerprint changes, which breaks every block after it, and everyone else’s copy disagrees',
      'Only the government can change it',
    ],
    answer: 2,
  },
  {
    question: 'A hash is…',
    options: [
      'A fingerprint for data, change one tiny thing and it comes out completely different',
      'A kind of coin',
      'The name of the first computer',
      'A password you pick yourself',
    ],
    answer: 0,
  },
  {
    question: 'Who published the Bitcoin whitepaper in 2008?',
    options: [
      'Ada Lovelace',
      'Satoshi Nakamoto, and nobody knows who that is',
      'Alan Turing',
      'Vitalik Buterin',
    ],
    answer: 1,
  },
  {
    question: 'What does a blockchain NOT promise?',
    options: [
      'That the record was not changed',
      'That everybody has the same copy',
      'That what was written is true, fair or a good idea',
      'That the blocks are in order',
    ],
    answer: 2,
  },
]

export const MODULE_2_OPEN_QUESTIONS: string[] = [
  'Explain to someone at home why nobody can cheat in the shared notebook.',
  'What is the difference between something being true and something being unchangeable? Give an example.',
  'Name one thing that should be recorded where everyone can check it forever, and one thing that should stay completely private. Why the difference?',
  'If you lost the only key to your money and nobody could help you, would you still want a system with no one in charge? Say why.',
  'Last class we learned that an AI can make things that look real. How could a blockchain help with that problem?',
]
