/* ──────────────────────────────────────────────────────────────────────────
 * Module 4, "What Is Encryption? Hiding the Key, Not the Message"
 *
 * The fifth class in the kids course. (Vault module 5; the site numbers from 0
 * and is one behind, see the module folder in the vault.) Class 0 answered
 * "what is a computer" (IN → THINK → OUT), class 1 "what happens when the THINK
 * part learns for itself" (AI), class 2 "how do a lot of people agree with
 * nobody in charge" (blockchain), class 3 "how does one computer talk to
 * another across the world" (the internet). Class 3 ended on an uncomfortable
 * fact: every machine along the way touches your message. This class answers the
 * question that leaves behind.
 *
 * NOTE ON ORDER. The concept comes LAST. The children draw and write about a
 * memory of their own before anyone says the word "encryption", and only then is
 * the concept taught, landing on top of something they have already felt.
 *
 * NOTE ON SHAPE. This is the first module where each age gets its OWN drawing
 * and journaling prompt rather than one prompt plus a `byLevel` gloss, and the
 * first with a drawing tip. The shared `AgePrompt` and `DrawingTip` types live
 * in ./course. There is deliberately no timed running order: the class does not
 * get minute counts any more.
 *
 * Each age level keeps the prompt that generated its infographic in
 * `imagePrompt` (Nano Banana Pro, 2528x1696), so the picture can be regenerated
 * without reverse-engineering it from the file. House illustration style is
 * hand-painted Japanese anime, with Friendly (the class robot) and the teacher
 * recurring as characters.
 * ────────────────────────────────────────────────────────────────────────── */

import type { AgeExplanation, AgePrompt, DrawingTip, HistoryBeat, QuizMCQ } from './course'

export const MODULE_4_SLUG = 'module-4'

export const MODULE_4_TITLE = 'What Is Encryption? Hiding the Key, Not the Message'

export const MODULE_4_INTRO =
  'Class 3 ended on an uncomfortable fact: your message hops through twenty machines you have never met, and every one of them can look at it. This class answers the question that leaves behind. Children draw and write about their own secrets first, and only then find out that the trick grown-ups use is not hiding the message at all. It is hiding the key.'

export const MODULE_4_HOOK =
  'We stopped hiding things. We scramble the message with a secret, hand it over in plain sight, and let anybody who wants to stare at it. It is gibberish to all of them. It turns back into words in one pair of hands.'

/* ── How the class runs. The concept comes last ──────────────────────────── */

export const MODULE_4_ORDER_NOTE =
  'The concept comes last, not first. The children draw and write before anyone says the word “encryption”. Neither prompt is about the topic; each is about a memory the child already has that happens to have the same shape as the concept. Then the concept is taught, and it lands on top of something they have already felt. Do not name the topic until the sharing is done, so that the moment it is named the earlier prompt clicks: “oh, that is what my drawing was.” That click is the lesson.'

export const MODULE_4_ORDER_STEPS: string[] = [
  'Draw a memory',
  'Share',
  'Write a memory',
  'Share',
  'Learn the concept',
  'Teach it back on one page',
]

export const MODULE_4_DOORS: { prompt: string; experience: string; opensOnto: string }[] = [
  {
    prompt: 'Drawing',
    experience: 'A thing only you and one other person understood.',
    opensOnto: 'Everyone else can see it and still not read it.',
  },
  {
    prompt: 'Journaling',
    experience: 'Telling one person something, and asking them not to tell.',
    opensOnto: 'The whole value sits in who holds the key.',
  },
]

/* ── The drawing tip, about drawing, not about the concept ───────────────── */

export const MODULE_4_DRAWING_TIP: DrawingTip = {
  rule: 'Draw the big shape first. Details last.',
  why: 'Most people start with an eye, or a doorknob, and then find there is no room for the rest. Block in the whole thing lightly, then sharpen.',
  byLevel: [
    { level: 'Age 3', what: 'Draw the big round bit first. Faces after.' },
    {
      level: 'Age 7',
      what: 'Sketch the boxes and blobs where everything goes, then draw on top of them.',
    },
    {
      level: 'Age 12',
      what: 'Rough the whole composition in light lines before committing to any of it. If the big shapes are wrong, no amount of detail will save it.',
    },
  ],
}

/* ── The drawing prompts, before the concept is named ────────────────────── */

export const MODULE_4_DRAWING_PROMPTS: AgePrompt[] = [
  {
    age: 'Age 3',
    prompt:
      'Draw the place where you keep something that is only yours. A box, a pocket, a shelf, under your pillow. Draw the thing inside it too.',
  },
  {
    age: 'Age 7',
    prompt:
      'Draw a time you and one other person knew something funny that nobody else in the room knew. A look you gave each other. A word you made up. Draw the room, the two of you, and everybody else not getting it.',
  },
  {
    age: 'Age 12',
    prompt:
      'Draw a moment when you were in a room full of people and kept something to yourself. Draw it from where you were standing, so we see what you saw. Then, in the same picture, show the thing you were holding on the inside.',
  },
]

export const MODULE_4_DRAWING_SHARING_QUESTION =
  'Who else knew? How did you decide they were the one to tell? Do not answer it for them, and do not connect it to anything yet.'

/* ── The journaling prompts, before the concept is named ─────────────────── */

export const MODULE_4_JOURNALING_PROMPTS: AgePrompt[] = [
  {
    age: 'Age 3',
    prompt: 'What is something that is only yours? Who is allowed to know about it?',
    note: 'Spoken. A grown-up writes the answer in the notebook, the child draws beside it.',
  },
  {
    age: 'Age 7',
    prompt:
      'I told ______ something and asked them not to tell. Before I said it, my stomach felt ______. After I said it, I felt ______.',
    note: 'Three sentences. Give them the stems.',
  },
  {
    age: 'Age 12',
    prompt:
      'Write about the moment you found out somebody had read or heard something of yours that was not meant for them. Put us there. What can you hear in the room? What goes hot or cold in your body? What do you say out loud, and what do you not say? Finish with one honest answer: did the words themselves change, or did only who was holding them change? If that has never happened to you, write about a time you almost told a secret and stopped yourself.',
    note: 'Five or six sentences, present tense.',
  },
]

export const MODULE_4_JOURNALING_SHARING_QUESTION =
  'How do you decide who to tell something? Still do not name the topic.'

export const MODULE_4_JOURNALING_NOTE =
  'This is the Argo thread: a machine can keep words unreadable, and it has no opinion about who deserves them. The notebook is where that judgement lives.'

/* ── The three illustrated levels ────────────────────────────────────────── */

export const ENCRYPTION_BY_AGE: AgeExplanation[] = [
  {
    age: 'Age 3',
    headline: 'A secret word that only we know',
    body: 'I am going to teach you a secret word. When I say “wobbly”, I mean biscuit. Ready? Who wants a wobbly? Now watch. I will ask the grown-up at the back. Did they know? No. They heard me perfectly, and they still did not know. Keep it physical and now: a word, a box, a key. The one concept is that everybody can hear it, and only we understand it.',
    image: '/courses/kids-stem/encryption-explained-age-3.jpg',
    alt: 'A young child at a table holding a small locked wooden box, wearing one brass key on a string, while Friendly the class robot holds the only other key.',
    imagePrompt:
      'Hand-painted Japanese anime style, in the manner of a Studio Ghibli background painting: soft gouache and watercolour texture, visible brush grain, warm morning light, gentle rounded line work, a muted natural palette of teal sea, cream, warm wood brown, sage green and soft coral. Calm, spacious, unhurried. Match the art style of the attached style reference image exactly. A wide indoor scene at a wooden table beside a big arched window. A small child of about three, drawn in simple friendly anime style with large soft eyes and rosy cheeks, holds a small wooden treasure box on the table with both hands, beaming. The box has a little brass padlock on the front and a heart painted on the lid. A small brass key hangs on a red string around the child\'s neck. Beside the child on the table sits FRIENDLY, the class robot from the attached reference photograph, redrawn in the same anime style: a small rounded white desktop robot with a smooth egg-shaped body, a rounded head with two large dark circular eyes joined by a slim dark bar like a pair of spectacles, two thin springy antennae with tiny colourful decorations on their tips, and colourful stickers across its white body. Friendly holds up a second identical brass key on a red string in one little arm, looking delighted. In the soft background, slightly out of focus, two other children walk past looking curiously at the box and clearly not knowing what is in it. Through the arched window, a warm seaside city with white towers, hanging greenery, solar panels and palm trees beside a calm teal sea. In the upper-left sky area, small hand-lettered soft-cream anime title text reading exactly "OUR KEY. NOBODY ELSE." Only that text, nothing else written anywhere. Very simple and uncluttered, one single idea, instantly readable by a three-year-old.',
  },
  {
    age: 'Age 7',
    headline: 'Lock it → Send it → Unlock it',
    body: 'You and your friend agree on a rule: every letter moves three places along the alphabet. A becomes D. HELLO becomes KHOOR. Now write your note and hand it to anybody you like. The messenger can read it out loud on the bus. It says KHOOR. Your friend has the same rule, moves every letter three places back, and gets HELLO. The messenger never had to be trustworthy at all. LOCK IT: change every letter using the rule you agreed, and that rule is called the key. SEND IT: hand it to anyone, they can hold it, copy it, keep it for a hundred years, and it still says nothing. UNLOCK IT: your friend runs the rule backwards and the words come back. You do not have to hide the message. You only have to hide the key.',
    image: '/courses/kids-stem/encryption-explained-age-7.jpg',
    alt: 'Three painted panels: a child scrambling the word HELLO into KHOOR with a paper cipher wheel, a messenger carrying the note and unable to read it, and a second child turning it back into HELLO.',
    imagePrompt:
      'Hand-painted Japanese anime style, in the manner of a Studio Ghibli background painting: soft gouache and watercolour texture, visible brush grain, warm daylight, gentle rounded line work, a muted natural palette of teal sea, cream, warm wood brown, sage green, soft coral and butter yellow. A wide illustration divided into three connected panels reading left to right, separated by soft painted edges rather than hard borders, with a warm coral painted arrow in the gap between panel one and panel two, and a second one in the gap between panel two and panel three, both pointing right. PANEL ONE: a cheerful anime child of about seven at a wooden desk by an arched window, holding a round paper cipher wheel made of two circles of card pinned together, the outer ring painted with a plain alphabet and the inner ring turned three steps around; on the wall directly behind the desk, two small painted paper notes with hand-drawn borders are pinned up one above the other, flat against the wall and squarely facing the viewer like posters, so their letters are upright and perfectly readable, the upper note reading exactly "HELLO" and the lower note reading exactly "KHOOR". No writing anywhere on the desk itself. Beneath the panel, small hand-lettered cream title text reading exactly "LOCK IT". PANEL TWO: a wide painted aerial view of a warm seaside landscape at midday, teal water, green hills, white towers and winding coastal roads; a cheerful anime messenger boy cycles along the coast road holding the paper note up beside his head with the written side turned squarely towards the viewer, its letters upright and perfectly readable, squinting sideways at it with a completely baffled expression, the note reading exactly "KHOOR". Beneath the panel, small hand-lettered cream title text reading exactly "SEND IT". PANEL THREE: a second anime child of about seven at a desk in a different room with a different window view, facing the viewer with an identical paper cipher wheel in one hand and joyfully holding up in the other a painted paper note with a hand-drawn border, turned squarely towards the viewer with its letters upright and perfectly readable, reading exactly "HELLO"; sitting on this desk is FRIENDLY, the class robot from the attached reference photograph, redrawn in the same anime style, a small rounded white desktop robot with a smooth egg-shaped body, a rounded head with two large dark circular eyes joined by a slim dark bar like spectacles, two thin springy antennae with tiny colourful decorations, and colourful stickers across its white body which are plain shapes with no writing on them at all, raising both little arms in celebration. Beneath the panel, small hand-lettered cream title text reading exactly "UNLOCK IT". Across the very top of the whole image, larger hand-lettered soft-cream anime title text reading exactly "HOW SECRET CODES WORK". Only the six pieces of text listed above. Nothing else written anywhere. Calm, spacious and readable at a glance by a seven-year-old.',
  },
  {
    age: 'Age 12',
    headline: 'Plaintext, ciphertext, keys, and the padlock you can hand to a stranger',
    body: 'The message before you scramble it is plaintext. Afterwards it is ciphertext. The thing that turns one into the other is the key. Here is the surprising rule: the method is public. Everyone on earth knows exactly how AES works, and that is deliberate, because a method thousands of people have attacked and failed to break is the only kind you should trust. Only the key is secret. Then there is a problem. To share a key with somebody, you have to send them the key, and the messenger is listening. That was unsolved for two thousand years. In 1976 two people solved it: use two matched keys instead of one. The public key locks and you can put it on a poster. The private key unlocks and never leaves your machine. That is why you can talk secretly to a shop you have never met, five seconds after finding it.',
    image: '/courses/kids-stem/encryption-explained-age-12.jpg',
    alt: 'A cutaway of one message’s journey: plaintext on a laptop, a padlock closing over it, ciphertext travelling through a router, a subsea cable and a data centre, then unlocking as plaintext on the far side.',
    imagePrompt:
      'Hand-painted Japanese anime style, in the manner of a Studio Ghibli cutaway illustration: soft gouache and watercolour texture, visible brush grain, gentle rounded line work, a muted natural palette of teal sea, cream, warm wood brown, sage green, deep navy and soft coral, with clean hand-lettered labels. A wide left-to-right cross-section of one message\'s journey, painted as a single continuous landscape that runs from a room, out through a seaside city, under the ocean, and into a room on the far side. FAR LEFT, indoors: a teenager of about twelve at a wooden desk with a laptop, beside them THE TEACHER from the attached portrait reference, redrawn in anime style, a man in his thirties with very short hair under a dark headband, a neat dark beard and moustache, blue-grey eyes and a white V-neck shirt, leaning in and pointing at the screen; on the desk sits FRIENDLY, the class robot from the attached reference photograph, redrawn in the same anime style, a small rounded white desktop robot with a smooth egg-shaped body, a rounded head with two large dark circular eyes joined by a slim dark bar like spectacles, two thin springy antennae with tiny colourful decorations, and colourful stickers on its white body. Beneath this group a small hand-lettered navy label reading exactly "YOUR DEVICE". Just above the laptop, a painted cream paper card with a hand-drawn border headed "PLAINTEXT" containing one hand-lettered line reading exactly "MEET AT SIX". Immediately to the right of the desk, a large softly glowing painted brass padlock closing over a stream of small square packets, with a small navy label beneath it reading exactly "ENCRYPT". From the padlock onward, a glowing line carries the packets through three painted waypoints, each with a small hand-lettered navy label beneath it: a little box with two antennae on a shelf, labelled "ROUTER"; a tall mast on a hillside above the seaside city, labelled "SUBSEA CABLE" where the line then dives beneath a beautifully painted teal cross-section of ocean showing a slim cable resting on the seabed among fish and soft light shafts; and a calm hall of tall server racks glowing softly in the dark, labelled "DATA CENTRE". Floating just above the middle of that stretch, a painted cream paper card with a hand-drawn border headed "CIPHERTEXT" containing one hand-lettered line in small grey monospace reading exactly "8F2A C1D9 47B0", and directly beneath that card a small coral hand-lettered line reading exactly "CARRIED, NOT READ". FAR RIGHT, indoors again: a second teenager at a desk by a different window, a matching brass padlock springing open beside them with a small navy label reading exactly "DECRYPT", and above the desk a painted cream paper card with a hand-drawn border headed "PLAINTEXT" reading exactly "MEET AT SIX"; beneath the whole group a small navy label reading exactly "THEIR DEVICE". In the lower left corner, a separate painted cream paper card with a hand-drawn border headed "KEYS", showing a small open padlock icon beside a hand-lettered line reading exactly "PUBLIC: LOCKS" and a small brass key icon beside a hand-lettered line reading exactly "PRIVATE: UNLOCKS". Only the text listed above. Nothing else written anywhere. Calm, precise and uncluttered, rewarding a twelve-year-old who reads it closely.',
  },
]

/* ── The five pieces ─────────────────────────────────────────────────────── */

export const ENCRYPTION_PIECES: { piece: string; what: string }[] = [
  {
    piece: 'Plaintext and ciphertext',
    what: 'The message before and after. Same information, one of them readable.',
  },
  {
    piece: 'Key',
    what: 'The secret that scrambles and unscrambles. Kerckhoffs’s principle: the system should stay safe even if everybody knows exactly how it works. Secrecy lives in the key, never in the method.',
  },
  {
    piece: 'Symmetric encryption',
    what: 'One shared key both locks and unlocks. Very fast, and it protects nearly everything you use. The standard is AES. The catch: both sides must already have the same key.',
  },
  {
    piece: 'Public key encryption',
    what: 'Two matched keys. The public one locks and can be given to anyone. The private one unlocks and stays put. This is how strangers agree a secret in the open. RSA and Diffie-Hellman.',
  },
  {
    piece: 'End to end encryption',
    what: 'The keys exist only on the two devices at the ends. The company carrying the message cannot read it, and cannot hand over what it does not have.',
  },
]

export const ENCRYPTION_HASHING_NOTE =
  'Bonus piece, hashing is not encryption. A hash is one way, has no key, and cannot be turned back. That is the point: a website can store the hash of your password, check it matches, and never hold the password itself. Same tool as the block fingerprints in class 2. Encryption is for things you need back. Hashing is for things you only need to check.'

export const ENCRYPTION_MISCONCEPTIONS: { wrong: string; right: string }[] = [
  {
    wrong: 'The padlock in the address bar means the site is honest',
    right:
      'It means nobody in the middle can read what you send. A scam site can have a padlock too. Encryption protects the pipe, not the person at the other end.',
  },
  {
    wrong: 'Encryption hides that you said it',
    right:
      'It hides what you said, not that you said it. Who you talked to, when, how often and for how long are all still visible. That is metadata, and it tells a story on its own. The postman cannot read the letter, and he still knows you write to that address every single day.',
  },
]

export const ENCRYPTION_HONEST_PART =
  'The maths is not the weak point. You are. Properly used encryption has never been broken by guessing keys, and it never will be, because there are more possible keys than atoms in a very large number of galaxies. So it gets got around instead: a password somebody guessed, a phone left unlocked, a person tricked into handing it over, a screenshot taken at the other end. And there is a second honest part. The same encryption that protects your messages protects everybody’s messages, including people you would not want protected. Nobody has ever found a way to build a lock that opens only for the good people. That is not because nobody has tried.'

export const ENCRYPTION_LADDER: { age: string; idea: string }[] = [
  { age: 'Age 2', idea: 'A secret word that only we know.' },
  { age: 'Age 5', idea: 'A code that turns your words into funny letters, and then back again.' },
  {
    age: 'Age 7',
    idea: 'Lock the message with a rule, send it past anybody, only your friend’s rule unlocks it.',
  },
  {
    age: 'Age 10',
    idea: 'The method is public and the key is secret. There are far more keys than anyone could ever try.',
  },
  {
    age: 'Age 13',
    idea: 'Plaintext plus a key gives ciphertext. Symmetric keys are fast, public key pairs let strangers agree a secret in the open, and end to end means only the two ends ever hold it.',
  },
]

/* ── The story of encryption ─────────────────────────────────────────────── */

export const ENCRYPTION_HISTORY: HistoryBeat[] = [
  {
    year: 'c. 1900 BCE',
    title: 'The first writing made hard to read',
    detail:
      'A scribe decorating the tomb of Khnumhotep II at Beni Hasan carves unusual hieroglyphs in place of the ordinary ones. It is often called the first code. Be honest with the room: most Egyptologists think it was meant to look impressive rather than to hide anything.',
  },
  {
    year: 'c. 500 BCE',
    title: 'The first key you could hold',
    detail:
      'The Spartan scytale: a strip of leather wound round a rod. You write along the rod, unwind the strip, and the letters are nonsense. Only a rod of exactly the same thickness lines them back up. Historians still argue about whether it was really used for secrecy, but it is a lovely idea: the key is a physical object.',
  },
  {
    year: 'c. 50 BCE',
    title: 'Caesar shifts the alphabet',
    detail:
      'Julius Caesar replaces every letter with the one three places further along the alphabet. Suetonius records it. It worked, partly because most of his enemies could not read anything at all.',
  },
  {
    year: '9th century',
    title: 'Codebreaking is invented, in Baghdad',
    detail:
      'Al-Kindi writes A Manuscript on Deciphering Cryptographic Messages and describes frequency analysis: count how often each symbol appears and compare it with ordinary writing. E is common, Z is not, and the cipher gives itself away. Every simple letter-swap in the world falls to this, a thousand years before computers.',
  },
  {
    year: '1467',
    title: 'The alphabet stops standing still',
    detail:
      'Leon Battista Alberti builds a cipher disk, two rings that turn against each other, so the alphabet can change part way through a message. Frequency counting stops being easy.',
  },
  {
    year: '1553',
    title: 'The cipher that held for three hundred years',
    detail:
      'Giovan Battista Bellaso publishes a cipher that uses a keyword to shift each letter by a different amount. It ended up named after Blaise de Vigenère, who described a stronger version later. The wrong name stuck. For three centuries people called it le chiffre indéchiffrable, the unbreakable cipher.',
  },
  {
    year: '1854 & 1863',
    title: 'It breaks, and the publisher gets the credit',
    detail:
      'Charles Babbage works out how to break Vigenère and never publishes it. Nine years later a retired Prussian officer, Friedrich Kasiski, works it out independently and does publish, so the method carries his name. Kids should hear this one: the person who tells everybody is the one history remembers.',
  },
  {
    year: '1917',
    title: 'The only cipher that is provably unbreakable',
    detail:
      'Gilbert Vernam at AT&T, with Joseph Mauborgne, invents the one-time pad: a key of genuinely random letters, as long as the message, never reused. Claude Shannon proves in 1949 that it is perfectly secret, and the proof still stands. It is also nearly useless, because you have to get that enormous key to the other person somehow.',
  },
  {
    year: '1932–1945',
    title: 'Enigma',
    detail:
      'Germany’s Enigma machine had roughly 158 million million million possible settings, changed daily. Three Polish mathematicians, Marian Rejewski, Jerzy Różycki and Henryk Zygalski, broke it first, in 1932, with pure mathematics, and handed everything to Britain and France five weeks before the war began. At Bletchley Park, Alan Turing and Gordon Welchman built the Bombe to keep up. Joan Clarke was a cryptanalyst in Hut 8, given a nominal job title and less pay because she was a woman; about three quarters of Bletchley’s staff were women. Tommy Flowers, a Post Office engineer, built Colossus, the first programmable electronic digital computer, and paid for parts out of his own pocket because his superiors did not believe it would work.',
  },
  {
    year: '1949',
    title: 'Cryptography becomes a science',
    detail:
      'Claude Shannon publishes Communication Theory of Secrecy Systems. The same man who invented the bit in class 3 now gives secrecy a mathematics.',
  },
  {
    year: '1976',
    title: 'The idea that changed everything',
    detail:
      'Whitfield Diffie and Martin Hellman publish New Directions in Cryptography: two matched keys instead of one, so two strangers can agree on a shared secret while everybody is listening. Ralph Merkle was working on the same problem in parallel. The twist: James Ellis, Clifford Cocks and Malcolm Williamson at GCHQ in Britain had already found it between 1969 and 1974, but it was classified until 1997, so they got no credit for more than twenty years.',
  },
  {
    year: '1977',
    title: 'RSA makes it work',
    detail:
      'Ron Rivest, Adi Shamir and Leonard Adleman at MIT turn the idea into a working system, built on one lopsided fact: multiplying two huge prime numbers together is easy, and working backwards from the answer is not.',
  },
  {
    year: '1991',
    title: 'Encryption for ordinary people',
    detail:
      'Phil Zimmermann releases PGP free on the internet. The US government classed strong encryption as a weapon for export purposes and investigated him for three years. The case was dropped in 1996. Supporters printed the source code as a book, because a book is protected speech and a program apparently was not. This was the first crypto war, and ordinary people won it.',
  },
  {
    year: '1993–1996',
    title: 'The Clipper chip',
    detail:
      'The US government proposes a chip in every phone with a spare key held by the government. Matt Blaze publishes a flaw in the design in 1994. The proposal dies.',
  },
  {
    year: '2000–2001',
    title: 'AES, chosen in the open',
    detail:
      'After an open, worldwide, public competition, two Belgian cryptographers, Joan Daemen and Vincent Rijmen, win with a design called Rijndael. It becomes AES and it now encrypts almost everything you touch. The important part is how it was chosen: in the open, by inviting the whole world to break it first.',
  },
  {
    year: '2013',
    title: 'The default flips',
    detail:
      'Documents released by Edward Snowden show how much unencrypted traffic was being collected in bulk. Within a few years the industry turns encryption on by default nearly everywhere.',
  },
  {
    year: '2016',
    title: 'A billion people at once',
    detail:
      'WhatsApp switches on end to end encryption for over a billion users, using the Signal Protocol written by Moxie Marlinspike and Trevor Perrin. It is the most widely used encryption in history, and almost nobody using it knows it is there.',
  },
  {
    year: 'August 2024',
    title: 'Preparing for quantum computers',
    detail:
      'NIST publishes the first finished post-quantum standards: new maths designed to survive a kind of computer that does not properly exist yet. The concern is real and slightly eerie. Encrypted traffic is being stored today so it can be opened later.',
  },
]

export const ENCRYPTION_PEOPLE: { name: string; why: string }[] = [
  { name: 'Al-Kindi', why: 'Frequency analysis, 9th century Baghdad. Invented codebreaking.' },
  {
    name: 'Leon Battista Alberti',
    why: 'The cipher disk, 1467. The alphabet stops standing still.',
  },
  {
    name: 'Giovan Battista Bellaso',
    why: 'Wrote the keyword cipher in 1553 that got named after somebody else.',
  },
  {
    name: 'Charles Babbage & Friedrich Kasiski',
    why: 'Broke the unbreakable cipher. One published, one did not.',
  },
  {
    name: 'Gilbert Vernam & Joseph Mauborgne',
    why: 'The one-time pad, 1917. Provably unbreakable, barely usable.',
  },
  {
    name: 'Rejewski, Różycki & Zygalski',
    why: 'Broke Enigma in 1932, in Poland, and gave it away in 1939.',
  },
  {
    name: 'Alan Turing & Gordon Welchman',
    why: 'The Bombe at Bletchley Park, which kept the break alive.',
  },
  {
    name: 'Joan Clarke',
    why: 'Cryptanalyst in Hut 8, underpaid and undertitled because of her sex.',
  },
  {
    name: 'Tommy Flowers',
    why: 'Built Colossus, the first programmable electronic computer, and got no credit for decades.',
  },
  {
    name: 'Claude Shannon',
    why: 'Proved the one-time pad perfect, 1949, and made cryptography a science.',
  },
  {
    name: 'Diffie, Hellman & Merkle',
    why: 'Public key cryptography, 1976. Strangers can agree a secret in public.',
  },
  { name: 'Rivest, Shamir & Adleman', why: 'RSA, 1977. The first working public key system.' },
  {
    name: 'Phil Zimmermann',
    why: 'PGP, 1991. Put strong encryption in ordinary hands and was investigated for it.',
  },
]

/* ── Where encryption is now ─────────────────────────────────────────────── */

export const ENCRYPTION_CAN: string[] = [
  'Make content unreadable. Nobody has broken AES by trying keys, and nobody expects to. The number of possible keys is beyond anything a machine could search.',
  'Let strangers agree a secret in public. The problem that stood unsolved from Caesar to 1976 is now solved so completely that your browser does it invisibly, several times a second.',
  'Prove who sent something. A signature made with a private key can be checked by anyone with the public one. This is exactly the key pair from class 2, used the other way round.',
  'Protect things by default. Money, medicine, messages and homework, all encrypted now without anybody choosing it.',
  'Be public and checkable. The algorithms are published so the whole world can attack them. The ones still standing are the ones worth using.',
]

export const ENCRYPTION_CANNOT: string[] = [
  'It cannot protect you from yourself. A guessed password, an unlocked phone, a screenshot at the other end, or a person who talks you into handing it over. This is how it actually goes wrong, every time.',
  'It cannot hide who you talked to. Contents are hidden, patterns are not.',
  'It cannot tell you whether the other person is honest. The padlock says the pipe is safe, not that the person is.',
  'It cannot help you after you lose the key. No reset, no helpdesk. Class 2 again: not your keys, not your coins.',
  'It cannot decide who deserves privacy. The maths does not know who you are or what you are doing, and it never will.',
]

/* ── What might happen next ──────────────────────────────────────────────── */

export const ENCRYPTION_SOON: string[] = [
  'Post-quantum algorithms rolling out across browsers, phones and banks, mostly invisibly.',
  'More things encrypted by default, including backups and photo libraries.',
  'More laws demanding that companies scan messages before they are encrypted, and more fights about them.',
]

export const ENCRYPTION_LATER: string[] = [
  'Encryption that lets a computer do useful work on data it cannot read. This exists, it is called homomorphic encryption, and today it is far too slow.',
  'Personal keys used for real identity, so you can prove who you are without handing over everything about yourself. All five classes meet here.',
  'Proving a photo or a video is real by signing it at the moment it is taken, which matters more after class 1 than it used to.',
]

export const ENCRYPTION_OPEN_ARGUMENT =
  'Should companies be forced to build a way in for police? One side: serious crimes are hidden behind encryption and investigators genuinely cannot see them. The other side: a door built for one government is a door, it will eventually be found by others, and there is no known maths for a lock that only opens for the good people. Both groups have real reasons and neither is being stupid. This argument is live right now, and the people in this room will be the ones who settle it.'

export const ENCRYPTION_STAYS_HUMAN =
  'Encryption keeps a message from being read. It has no opinion about who should read it. You decide that, and you have been deciding it since long before this class, every time you chose one person to tell. Go back to what you wrote at the start: when somebody else got hold of your secret, the words had not changed at all. Only who was holding them. No machine will ever make that judgement for you. It goes in your notebook.'

/* ── The teach-back page, after the concept ──────────────────────────────── */

export const MODULE_4_TEACHBACK_PROMPT =
  'Fill one page that would teach “what is encryption” to somebody exactly your age who has never heard any of this. Drawings, words, arrows, a comic, whatever works. The test is simple: it has to work without you there to explain it.'

export const MODULE_4_TEACHBACK_BY_LEVEL: { level: string; what: string }[] = [
  {
    level: 'Littlest (2–4)',
    what: 'A box with a lock, and two people holding the only two keys. Point at it and say “only us.” That is a complete teach-back.',
  },
  {
    level: 'Middle (5–8)',
    what: 'The three steps, LOCK IT → SEND IT → UNLOCK IT, with a real scrambled word written in the middle panel that the reader has to work out using the wheel drawn in the corner.',
  },
  {
    level: 'Older (9–12)',
    what: 'Show the same sentence twice, as plaintext and as ciphertext, and mark clearly where the key goes in. Then draw the hard part: two strangers agreeing a secret while a messenger watches everything. Finish with the one sentence you would want them to remember in a year.',
  },
]

export const MODULE_4_TEACHBACK_NOTE =
  'It is the only honest test of whether it landed, and it mirrors the beginning. They started by drawing something only two people understood. They are finishing by making something built to be understood by somebody who is not in the room. Same idea, turned inside out.'

export const MODULE_4_GAME =
  'Unplugged game, “The Nosy Messenger.” Two children sit at opposite ends of the room. They may only pass notes through a third child, the Messenger, who reads every note out loud. Round one: impossible, and let them feel it. Round two: give the pair one minute together in a corner first. They will agree a rule, and the notes start working. They have just invented a shared key. Round three is the good one: a new child arrives who has never met either of them and may never speak to them privately, and the Messenger hears absolutely everything, including any rule anybody says out loud. Let them struggle properly. Then put a box, an open padlock and its key on the table and say nothing at all. Sooner or later somebody works out that you send the open padlock across, the stranger locks the box with it, and only you have the key that opens it. That is public key encryption, and they invented it. Round four, quietly swap the padlock for your own before it arrives and read everything that comes back. That is the man in the middle attack, and it is exactly why messaging apps show you a safety number to check.'

export const MODULE_4_MAKE_IT_REAL =
  'Click the padlock in a browser and look at the certificate. Open a messaging app’s security settings and find the safety number, the fingerprint that proves nobody swapped the keys. Then encrypt one sentence with a Caesar wheel and hand it to another table.'

/* ── Knowledge check ─────────────────────────────────────────────────────── */

export const MODULE_4_MCQ: QuizMCQ[] = [
  {
    question: 'What is encryption?',
    options: [
      'Hiding a message somewhere nobody will look',
      'Scrambling a message with a secret, so that only the person with the matching secret can read it',
      'Deleting a message after it has been read',
      'Sending a message down a private wire nobody else can touch',
    ],
    answer: 1,
  },
  {
    question: 'What is a key?',
    options: [
      'The secret that locks and unlocks the message. The method can be public, the key cannot.',
      'The name of the person you are writing to',
      'The wire the message travels down',
      'A password the website keeps for you',
    ],
    answer: 0,
  },
  {
    question: 'Somebody steals your encrypted message but not your key. What have they got?',
    options: [
      'Half of the message',
      'The message, but only for a few minutes',
      'Nonsense. They can keep it forever and it still says nothing.',
      'The message, unless you change your password quickly',
    ],
    answer: 2,
  },
  {
    question: 'Why have two keys, a public one and a private one?',
    options: [
      'In case you lose the first one',
      'One is for writing and one is for reading',
      'So the message travels twice as fast',
      'So you can hand the public one to a stranger in front of everybody. Only your private key opens what it locks, so two people who have never met can talk in secret.',
    ],
    answer: 3,
  },
  {
    question: 'Does encryption hide who you talked to?',
    options: [
      'Yes, it hides everything about the message',
      'No. It hides what you said. Who, when and for how long are still visible.',
      'Yes, as long as you use two keys instead of one',
      'Only if the other person is also using encryption',
    ],
    answer: 1,
  },
]

export const MODULE_4_OPEN_QUESTIONS: string[] = [
  'Explain to somebody at home why hiding a message and scrambling a message are not the same thing.',
  'At the start of class you drew something that only you and one other person understood. What was the key in that memory, and what would have happened if somebody else had got hold of it?',
  'You wrote about a secret getting out. Did the words change, or did only who was holding them change? What does that tell you about what encryption actually protects?',
  'Somebody says “I have nothing to hide, so I do not need encryption.” Give the best answer you can. Then give the best answer the person who disagrees with you would give.',
  'Should a government be able to ask for a way into everybody’s messages in order to catch criminals? Say what you think, and then say the strongest thing against your own view.',
]
