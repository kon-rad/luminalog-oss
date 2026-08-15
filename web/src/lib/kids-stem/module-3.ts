/* ──────────────────────────────────────────────────────────────────────────
 * Module 3, "What Is the Internet? Millions of Computers Passing Notes"
 *
 * The fourth class in the kids course. Class 0 answered "what is a computer"
 * (IN → THINK → OUT), class 1 answered "what happens when the THINK part learns
 * for itself" (AI), class 2 answered "how do a lot of people agree with nobody
 * in charge" (blockchain). This one asks the question sitting underneath all
 * three: how does one computer talk to another on the other side of the world?
 *
 * NOTE ON ORDER. From this class on, the concept comes LAST. The children draw
 * and write about a memory of their own before anyone says the word "internet",
 * and only then is the concept taught, landing on top of something they have
 * already felt. They close by teaching it back on one page. The prompts here
 * are therefore about experience, not about the topic, and the running order
 * reflects that.
 *
 * Each age level keeps the prompt that generated its infographic in
 * `imagePrompt` (Nano Banana Pro, 2528x1696), so the picture can be regenerated
 * without reverse-engineering it from the file. From this class on the house
 * illustration style is hand-painted Japanese anime, with Friendly (the class
 * robot) and the teacher recurring as characters.
 * ────────────────────────────────────────────────────────────────────────── */

import type { AgeExplanation, HistoryBeat, QuizMCQ } from './course'

export const MODULE_3_SLUG = 'module-3'

export const MODULE_3_TITLE = 'What Is the Internet? Millions of Computers Passing Notes'

export const MODULE_3_INTRO =
  'Class 0 asked what a computer is. Class 1 asked what happens when the thinking part learns for itself. Class 2 asked how a lot of people agree on what is true with nobody in charge. This class asks the question sitting underneath all three: how does one computer talk to another one on the other side of the world? The answer is that your message does not travel in one piece, and it does not go in a straight line.'

export const MODULE_3_HOOK =
  'It gets torn up, the bits race each other across the planet by different roads, and they get taped back together before you ever see them.'

/* ── How the class runs. The concept comes last ──────────────────────────── */

export const MODULE_3_ORDER_NOTE =
  'The concept comes last, not first. The children draw and write before anyone says the word “internet”. Neither prompt is about the topic; each is about a memory the child already has that happens to have the same shape as the concept. Then the concept is taught, and it lands on top of something they have already felt. Do not name the topic until the sharing is done, so that the moment it is named the earlier prompt clicks: “oh, that is what my drawing was.” That click is the lesson.'

export const MODULE_3_ORDER_STEPS: string[] = [
  'Draw a memory',
  'Share',
  'Write a memory',
  'Share',
  'Learn the concept',
  'Teach it back on one page',
]

export const MODULE_3_DOORS: { prompt: string; experience: string; opensOnto: string }[] = [
  {
    prompt: 'Drawing',
    experience: 'A time you reached a whole room at once.',
    opensOnto: 'One person can reach millions, instantly, from anywhere.',
  },
  {
    prompt: 'Journaling',
    experience: 'A voice on a phone from thousands of miles away.',
    opensOnto: 'Distance stops mattering. That is the whole invention.',
  },
]

/* ── The drawing prompt, before the concept is named ──────────────────────── */

export const MODULE_3_DRAWING_PROMPT =
  'Think of a time when a lot of people were all paying attention to you at once, and something you did reached every one of them at the same moment. On a stage. In front of the class. At a family party. Leading a game. Singing, dancing, telling a joke that made the whole room laugh. Draw that moment. Put yourself in it, and draw all the faces looking back at you.'

export const MODULE_3_DRAWING_BY_LEVEL: { level: string; what: string }[] = [
  {
    level: 'Littlest (2–4)',
    what: 'Draw lots of faces. Lots and lots. Then draw you. Holding the pen counts.',
  },
  {
    level: 'Middle (5–8)',
    what: 'Draw the moment and the whole crowd. Then add lines or arrows going from you out to the people, showing the thing that travelled.',
  },
  {
    level: 'Older (9–12)',
    what: 'Draw it from where you were standing, so we see what you saw. Then, in a corner of the page, draw the biggest crowd you could ever imagine reaching at once.',
  },
]

export const MODULE_3_DRAWING_SHARING_QUESTION =
  'How did it feel when everybody got it at the same moment? Do not answer it for them, and do not connect it to anything yet.'

/* ── The journaling prompt, before the concept is named ───────────────────── */

export const MODULE_3_JOURNALING_PROMPT =
  'Write about a time you talked to somebody very far away on the phone. Somebody in another country, maybe another continent. A grandmother, a cousin, a friend who moved away. Put us in the room with you. Where were you sitting? What could you see out of the window? What could you hear behind their voice on the other end, their kitchen, their street, their weather? What could you smell where you were? Did their voice sound exactly like them, or a little different? What did you say to each other, and what did you feel when the call stopped?'

export const MODULE_3_JOURNALING_BY_LEVEL: { level: string; what: string }[] = [
  {
    level: 'Littlest (2–4)',
    what: 'Say out loud who you talked to. A grown-up writes the name in the notebook; the child draws them.',
  },
  {
    level: 'Middle (5–8)',
    what: 'Three sentences. “I talked to ___. They were in ___. It felt like ___.”',
  },
  {
    level: 'Older (9–12)',
    what: 'The full prompt, all five senses, and the last question. Push them on one thing: did the distance disappear while you were talking, or could you feel it the whole time? Both answers are true and interesting.',
  },
]

export const MODULE_3_JOURNALING_SHARING_QUESTION =
  'How far away were they, really? Could you point at them? Still do not name the topic.'

export const MODULE_3_JOURNALING_NOTE =
  'The notebook is where you keep what a moment actually felt like. A phone call can cross ten thousand kilometres in a fifth of a second, and the only record of what it meant is the one you write.'

/* ── The three illustrated levels ─────────────────────────────────────────── */

export const INTERNET_BY_AGE: AgeExplanation[] = [
  {
    age: 'Age 3',
    headline: 'You talk here, and it comes out there',
    body: 'Watch. I say hello into this one, and it comes out of THAT one, all the way over there. The computers are holding hands. Your hello runs along and pops out at Grandma’s house.',
    image: '/courses/kids-stem/internet-explained-age-3.jpg',
    alt: 'A painted anime scene: a small child at a table by an arched window holds up a tablet showing a waving grandmother, with Friendly the class robot beside them and a glowing line of light arcing out over a sunset sea toward a tiny house on the horizon.',
    imagePrompt:
      'Hand-painted Japanese anime style, in the manner of a Studio Ghibli background painting: soft gouache and watercolour texture, visible brush grain, warm golden late-afternoon light, gentle rounded line work, a muted natural palette of teal sea, cream, warm wood brown, sage green and soft coral. Calm, spacious, unhurried. Match the art style of the attached style reference image exactly. A wide indoor scene: a small child of about three, drawn in simple friendly anime style with large soft eyes and rosy cheeks, sits at a wooden table by a big arched window, holding a chunky tablet up in both hands and beaming at it. On the tablet screen, clearly visible, the smiling face of a grandmother waving back. Beside the child on the table sits FRIENDLY, the class robot from the attached robot reference photograph, redrawn in the same anime style: a small rounded white desktop robot with a smooth egg-shaped body, a rounded head with two large dark circular eyes joined by a slim dark bar like a pair of spectacles, two thin springy antennae with tiny colourful decorations on their tips, and colourful stickers across its white body. Friendly is looking up at the tablet, delighted. Through the arched window behind them, a warm seaside city at sunset with white towers, hanging greenery, solar panels and palm trees beside a calm teal sea. Arcing across the sky outside the window, a soft glowing line of light travels from the child\'s tablet out over the sea toward a tiny warmly-lit house on the far horizon, with three or four small round glowing dots travelling along the line like fireflies. In the upper-left sky, small hand-lettered soft-cream anime title text reading exactly "HELLO GOES ZOOM!". Only that text, nothing else written anywhere. Very simple and uncluttered, one single idea, instantly readable by a three-year-old.',
  },
  {
    age: 'Age 7',
    headline: 'Chop it up → Send the pieces → Put it back',
    body: 'When you send a photo to your cousin, it does not fly there in one piece. Your computer chops it into hundreds of little pieces and numbers them. Every piece is thrown out into the world on its own, and they do not even take the same road: one might go over Europe and one under the sea. Your cousin’s computer catches all of them, sorts them by number, and tapes them back into the photo. All of that happens before you can blink. There is no single road, and nobody is in charge of the traffic, which is exactly why it is so hard to break.',
    image: '/courses/kids-stem/internet-explained-age-7.jpg',
    alt: 'A painted anime triptych titled “How the internet works”: CHOP IT UP (a child cutting a cat drawing into four numbered pieces), SEND THE PIECES (the pieces flying along three different routes over a seaside landscape, one curving around a fallen tree), and PUT IT BACK (a second child reassembling them in order with Friendly the robot cheering).',
    imagePrompt:
      'Hand-painted Japanese anime style, in the manner of a Studio Ghibli background painting: soft gouache and watercolour texture, visible brush grain, warm daylight, gentle rounded line work, a muted natural palette of teal sea, cream, warm wood brown, sage green, soft coral and butter yellow. Match the art style of the attached style reference image exactly. A wide illustration divided into three connected panels reading left to right, separated by soft painted edges rather than hard borders, with a warm coral painted arrow flowing from panel one into panel two and from panel two into panel three. PANEL ONE: a cheerful anime child of about seven at a wooden desk, carefully cutting a drawing of a cat into four pieces with scissors; the four paper pieces lie on the desk, each hand-numbered in soft ink, "1", "2", "3", "4". Beneath the panel, small hand-lettered cream title text reading exactly "CHOP IT UP". PANEL TWO: a wide painted aerial view of a warm seaside landscape at midday, teal water, green hills, small white towers and winding coastal roads; the four numbered paper pieces fly along THREE clearly different winding routes across the landscape, each leaving a soft glowing trail, one route passing a small lighthouse, one crossing the water, one over the hills; halfway along the middle route a small fallen tree blocks the road and that piece is visibly curving around it. Beneath the panel, small hand-lettered cream title text reading exactly "SEND THE PIECES". PANEL THREE: a second anime child of about seven at a desk in a different room with a different window view, joyfully fitting the four numbered pieces back together in the order 1-2-3-4 to rebuild the complete cat drawing; sitting on this desk is FRIENDLY, the class robot from the attached robot reference photograph, redrawn in the same anime style, a small rounded white desktop robot with a smooth egg-shaped body, a rounded head with two large dark circular eyes joined by a slim dark bar like spectacles, two thin springy antennae with tiny colourful decorations, and colourful stickers across its white body, raising both little arms in celebration. Beneath the panel, small hand-lettered cream title text reading exactly "PUT IT BACK". Across the very top of the whole image, larger hand-lettered soft-cream anime title text reading exactly "HOW THE INTERNET WORKS". Only the four pieces of text listed above and the numerals 1, 2, 3 and 4. Nothing else written anywhere. Calm, spacious and readable at a glance by a seven-year-old.',
  },
  {
    age: 'Age 12',
    headline: 'Packets, addresses, routers, DNS & protocols',
    body: 'Every device on the internet has a number, an IP address. When you load a page, your computer breaks the request into packets, small chunks of about 1,500 bytes, and each packet carries the from-address, the to-address, and its position in the sequence. It hands them to a router, which does one job: look at the destination and pass it to whichever neighbour is closer. Twelve or twenty routers later it arrives, and nobody planned that route, each router decided one hop at a time. The reason it all fits together is the protocol, TCP/IP, an agreed format every network on earth speaks, which is why a phone in Malaysia can talk to a server in Chile without either being told about the other. And because humans cannot remember numbers, DNS is the phone book that turns a name into an address.',
    image: '/courses/kids-stem/internet-explained-age-12.jpg',
    alt: 'A painted anime cutaway of one message’s journey: YOUR DEVICE (a teenager and the teacher at a laptop with Friendly the robot), ROUTER, ISP, SUBSEA CABLE running along the seabed, and DATA CENTRE, with paper cards showing a PACKET’s from/to/piece fields, a DNS name-to-number lookup, and a NO SINGLE ROUTE mesh with one broken link routed around.',
    imagePrompt:
      'Hand-painted Japanese anime style, in the manner of a Studio Ghibli cutaway illustration: soft gouache and watercolour texture, visible brush grain, gentle rounded line work, a muted natural palette of teal sea, cream, warm wood brown, sage green, deep navy and soft coral, with clean hand-lettered labels. Match the art style of the attached style reference image exactly. A wide left-to-right cross-section of one message\'s journey, painted as a single continuous landscape that descends from a room, out to a city, under the ocean, and into a server hall. FAR LEFT, indoors: a teenager of about twelve at a wooden desk with a laptop, beside them THE TEACHER from the attached portrait reference, redrawn in anime style, a man in his thirties with very short hair under a dark headband, a neat dark beard and moustache, blue-grey eyes and a white V-neck shirt, leaning in and pointing at the laptop screen; on the desk beside them sits FRIENDLY, the class robot from the attached robot reference photograph, redrawn in the same anime style, a small rounded white desktop robot with a smooth egg-shaped body, a rounded head with two large dark circular eyes joined by a slim dark bar like spectacles, two thin springy antennae with tiny colourful decorations, and colourful stickers on its white body. Beneath this group, a small hand-lettered navy label reading exactly "YOUR DEVICE". Moving right, a soft glowing line of light carries a stream of small square packets out of the laptop and through four painted waypoints, each with a small hand-lettered navy label beneath it: a little box with two antennae on a shelf, labelled "ROUTER"; a tall mast on a hillside above the seaside city, labelled "ISP"; then the line dives beneath a beautifully painted teal cross-section of ocean, showing a slim cable resting on the seabed among fish and soft light shafts, labelled "SUBSEA CABLE"; and finally FAR RIGHT, rising into a calm hall of tall server racks glowing softly in the dark, labelled "DATA CENTRE". Floating in the sky in the upper middle of the image, painted as a soft cream paper card with a hand-drawn border, a single label card headed "PACKET" containing four short hand-lettered lines reading exactly "FROM: 203.0.113.7", "TO: 198.51.100.24", "PIECE 3 OF 5" and "DATA: ...", with a thin dotted line connecting the card down to the glowing packet stream. In the lower left corner, a second small painted paper card headed "DNS" showing two hand-lettered lines, "argo.app" above and "198.51.100.24" below, joined by a small downward arrow. In the lower right corner, a third small painted paper card headed "NO SINGLE ROUTE" showing eight small ink dots joined into an irregular web by thin lines, with one line painted broken in coral and a bolder teal path threading around the break. Only the text listed above. Nothing else written anywhere. Calm, precise and uncluttered, rewarding a twelve-year-old who reads it closely.',
  },
]

/* ── The five pieces ─────────────────────────────────────────────────────── */

export const INTERNET_PIECES: { piece: string; what: string }[] = [
  {
    piece: 'Packet',
    what: 'A small numbered chunk of your message, carrying a from-address, a to-address, and its place in the sequence. Big things are sent as thousands of them.',
  },
  {
    piece: 'IP address',
    what: 'The number that identifies a device on the network. Old-style IPv4 has about 4.3 billion of them and the world ran out; IPv6 has more addresses than there are grains of sand on Earth.',
  },
  {
    piece: 'Router',
    what: 'A machine at a junction whose only job is to look at a packet’s destination and pass it one hop closer. It does not know the whole route, and it does not need to.',
  },
  {
    piece: 'DNS',
    what: 'The Domain Name System, the internet’s phone book. It turns argo.app into a number, because names are for people and numbers are for machines.',
  },
  {
    piece: 'Protocol',
    what: 'TCP/IP, the shared rulebook for how packets are addressed and reassembled. IP gets a packet there; TCP checks that all of them arrived and asks again for anything missing.',
  },
]

export const INTERNET_ENCRYPTION_NOTE =
  'Every router along the way touches your packets, and by default it can read them. HTTPS, the padlock in the address bar, scrambles the contents so the routers can still see where it is going but not what it says. Same idea as the keys from last class: you can prove and protect without trusting the people in the middle.'

export const INTERNET_MISCONCEPTIONS: { wrong: string; right: string }[] = [
  {
    wrong: 'The internet is the web',
    right:
      'The internet is the network, built from 1969 onwards. The World Wide Web is one thing running on top of it, invented twenty years later. Email, video calls and games are the internet but not the web.',
  },
  {
    wrong: 'Things live in “the cloud”',
    right:
      'The cloud is somebody else’s computer in a warehouse, reached by a cable. About 99% of the world’s international traffic travels through roughly 1.4 million kilometres of fibre-optic cable lying on the ocean floor. Ships drop anchors on them and countries lose their internet. It is a physical object.',
  },
]

export const INTERNET_HONEST_PART =
  'The internet was designed to survive damage and to be open. It was not designed to be private, and it was not designed to be safe. Every one of the problems people complain about, spam, scams, surveillance, bullying, misinformation, comes from the same open design that made it work in the first place. You cannot have one without the other, and that trade-off has never been solved by anybody.'

export const INTERNET_LADDER: { age: string; idea: string }[] = [
  { age: 'Age 2', idea: 'I talk here, and it comes out there.' },
  { age: 'Age 5', idea: 'Computers send each other messages down very long wires.' },
  {
    age: 'Age 7',
    idea: 'Your message is chopped into pieces, each piece finds its own road, and they are put back together in order.',
  },
  {
    age: 'Age 10',
    idea: 'Every device has an address, routers pass packets one hop closer, and names get looked up in a giant phone book.',
  },
  {
    age: 'Age 13',
    idea: 'Packet-switched networks joined by a common protocol (TCP/IP), addressed by IP, named by DNS, with no central authority and no guaranteed route.',
  },
]

/* ── The story of the internet ────────────────────────────────────────────── */

export const INTERNET_HISTORY: HistoryBeat[] = [
  {
    year: '1858',
    title: 'The first cable across an ocean',
    detail:
      'Cyrus Field and his backers lay a telegraph cable between Ireland and Newfoundland after four failed attempts. It dies three weeks later, and it takes until 1866 to make one that lasts. The first attempt to wire the world together was a rope on the seabed, and it still is.',
  },
  {
    year: '1948',
    title: 'Information becomes measurable',
    detail:
      'Claude Shannon publishes A Mathematical Theory of Communication and invents the bit. Suddenly a picture, a voice and a sentence are the same kind of stuff, and you can work out exactly how much of it a wire can carry.',
  },
  {
    year: '1961–64',
    title: 'Three people invent packets, separately',
    detail:
      'Leonard Kleinrock works out the maths of messages queueing in a network. Paul Baran at RAND designs a network with no centre, one that keeps working after pieces are destroyed. Donald Davies in Britain has the same idea independently and gives it the name we still use: packets.',
  },
  {
    year: '1969',
    title: 'The first message, and it crashed',
    detail:
      'On 29 October, a student called Charley Kline at UCLA types “LOGIN” to a machine at the Stanford Research Institute. The system crashed after two letters. The first thing ever sent over the ancestor of the internet was “LO”.',
  },
  {
    year: '1971',
    title: 'Email, and the @ sign',
    detail:
      'Ray Tomlinson writes a program to send a note to a person on another computer, and needs a character to separate the person from the machine. He looks down at the keyboard and picks @ because nothing else was using it.',
  },
  {
    year: '1973–74',
    title: 'The invention that made it the internet',
    detail:
      'Vint Cerf and Bob Kahn publish the design for TCP/IP: not a network, but a way for different networks, run by different people with different equipment, to join into one. Everything before it was a network; this made it an inter-net.',
  },
  {
    year: '1983',
    title: 'The birthday',
    detail:
      'On 1 January, “flag day”, every machine on the ARPANET has to switch to TCP/IP at once or fall off. Engineers wore badges reading “I survived the TCP/IP transition.” If the internet has a birthday, this is it.',
  },
  {
    year: '1983–85',
    title: 'Names instead of numbers',
    detail:
      'Paul Mockapetris invents DNS, because until then Elizabeth Feinler’s team kept the entire directory of the network as a single file everyone downloaded, and it had stopped scaling. Feinler’s group also came up with .com, .edu and .gov.',
  },
  {
    year: '1985',
    title: 'Making the wires behave',
    detail:
      'Radia Perlman invents the spanning tree protocol, which stops packets circling forever in a loop. She is often called “the mother of the internet”, and she dislikes the title, because it was thousands of people, not one.',
  },
  {
    year: '1989–91',
    title: 'The Web',
    detail:
      'Tim Berners-Lee at CERN writes a proposal for linking documents together. His boss’s note on it: “Vague, but exciting.” He builds the first browser and server himself. In April 1993 CERN puts the whole thing into the public domain, free for anyone, forever. He could have been one of the richest people alive, and chose not to be.',
  },
  {
    year: '1993',
    title: 'Pictures',
    detail:
      'Marc Andreessen and Eric Bina release Mosaic, the browser that showed images inside the page instead of in a separate window. Ordinary people arrive within two years.',
  },
  {
    year: '2007',
    title: 'The internet leaves the desk',
    detail:
      'The iPhone puts it in a pocket. By around 2016, more of the world’s web traffic comes from phones than from computers, and for a large part of humanity a phone was the first internet they ever had.',
  },
  {
    year: '2020',
    title: 'The stress test',
    detail:
      'School, work, medicine and family all move onto the internet in about a fortnight. It bent, and it held. Sixty-year-old design, worst-case load, no central controller, and it did not fall over.',
  },
]

export const INTERNET_PEOPLE: { name: string; why: string }[] = [
  {
    name: 'Claude Shannon',
    why: 'Information theory, 1948. Invented the bit and made all of this measurable.',
  },
  {
    name: 'Paul Baran & Donald Davies',
    why: 'Packet switching, independently, in two countries. Davies named the packet.',
  },
  {
    name: 'Leonard Kleinrock',
    why: 'The maths of network queues; his lab sent the first message.',
  },
  {
    name: 'Vint Cerf & Bob Kahn',
    why: 'TCP/IP, 1974. The rulebook that joined all the separate networks into one.',
  },
  { name: 'Ray Tomlinson', why: 'Network email, 1971, and the @ sign.' },
  {
    name: 'Elizabeth Feinler',
    why: 'Ran the internet’s directory by hand; her group devised .com and .edu.',
  },
  {
    name: 'Paul Mockapetris',
    why: 'DNS, so people could use names instead of numbers.',
  },
  {
    name: 'Radia Perlman',
    why: 'Spanning tree protocol, which keeps packets from looping forever.',
  },
  {
    name: 'Jon Postel',
    why: 'Kept the numbers and edited the standards for decades. “Be conservative in what you send, liberal in what you accept.”',
  },
  {
    name: 'Tim Berners-Lee',
    why: 'The World Wide Web, 1989, and then gave it away for free.',
  },
]

/* ── Where the internet is now ────────────────────────────────────────────── */

export const INTERNET_CAN: string[] = [
  'Get a message anywhere in a fraction of a second, for effectively no money, to anyone who is also connected.',
  'Survive damage. Cut a cable, lose a data centre, block a route, and the packets go around. That was the original design goal and it works.',
  'Let anyone publish, with no permission, no printing press and no gatekeeper. A child in Forest City can put something where the whole world can read it.',
  'Join anything to anything. Phones, satellites, cars, sensors, watches, toys and factories all speak the same protocol.',
  'Carry everything at once, because it is all just bits: voice, video, money, games, medicine, homework.',
  'Work with no one in charge. No company, country or person owns it. It runs on agreed standards and a lot of cooperation.',
]

export const INTERNET_CANNOT: string[] = [
  'It cannot be private by itself. Encryption has to be added on top, and even then, where you went is visible even when what you said is not.',
  'It cannot forget. There is no real delete. Copies get made instantly, by people and by machines.',
  'It cannot tell you what is true. It moves bits perfectly and has no opinion about whether they are honest.',
  'It cannot beat the speed of light. Light in glass crosses the planet in about a fifth of a second, and no engineering will ever fix that.',
  'It is not everywhere. Roughly a third of humanity is still offline, mostly because of cost, electricity and where they live.',
  'It is not free of people. Scams, bullying and manipulation live on it because we do, and no protocol fixes that.',
]

/* ── What might happen next ───────────────────────────────────────────────── */

export const INTERNET_SOON: string[] = [
  'Satellites reaching the last third of the world, so where you were born stops deciding whether you get the internet.',
  'Talking to computers instead of typing at them, so being online stops requiring literacy in English.',
  'Machines outnumbering people online by a wide margin: sensors, cars, farms, household objects, all chattering.',
  'More of it encrypted by default, because the default used to be wide open and that turned out badly.',
]

export const INTERNET_LATER: string[] = [
  'AI agents doing most of the talking on the network, requesting and paying for things on our behalf. All four classes meet here: the computer runs it, the AI thinks, the internet carries it, the blockchain keeps it honest.',
  'A serious attempt at proving a human is a human, and that a video is real, which the internet was never built to do.',
  'Computers in orbit, so parts of “the cloud” are literally above the clouds.',
  'A splintering: several regional internets with walls between them, instead of one. Some people think this is already happening.',
]

export const INTERNET_OPEN_ARGUMENT =
  'Some very smart people think the open internet is the most important thing our species has built, and that we should defend it exactly as it is. Others think its openness is now its biggest danger, and that it needs identity, rules and borders to stay usable. Both groups have good reasons. The generation in this room will decide it, because the people who built it are running out of time to.'

export const INTERNET_STAYS_HUMAN =
  'The internet is a machine for making distance stop mattering. That is genuinely astonishing, and it is not the same thing as being close to someone. Go back to what you wrote at the start of class: the voice on the phone arrived perfectly, and you still felt how far away they were. Being reachable by five billion people is not the same as being known by five. The record of what that call actually felt like is not a broadcast. It goes in your notebook.'

/* ── The teach-back page, after the concept ───────────────────────────────── */

export const MODULE_3_TEACHBACK_PROMPT =
  'Fill one page that would teach “what is the internet” to somebody exactly your age who has never heard any of this. Drawings, words, arrows, a comic, whatever works for you. The test is simple: it has to work without you there to explain it.'

export const MODULE_3_TEACHBACK_BY_LEVEL: { level: string; what: string }[] = [
  {
    level: 'Littlest (2–4)',
    what: 'Two houses and a line between them. Point at it and say “it goes!” That is a complete teach-back.',
  },
  {
    level: 'Middle (5–8)',
    what: 'The three steps, CHOP IT UP → SEND THE PIECES → PUT IT BACK, drawn with the four numbered pieces taking different roads. Then block one road with a big X and draw where that piece goes instead.',
  },
  {
    level: 'Older (9–12)',
    what: 'Label the parts properly: devices, packets, routers, an IP address on each house, one cable under the ocean. Then write the one sentence you would want them to remember in a year.',
  },
]

export const MODULE_3_TEACHBACK_NOTE =
  'Teaching it back is the only honest test of whether it landed. It also mirrors what they did at the start: they drew a moment when they reached a whole room, and now they are making something designed to reach somebody who is not in the room. That is the concept, performed rather than recited.'

/* ── Running order. Draw and write come before the explanation ────────────── */

export const MODULE_3_RUNNING_ORDER: {
  minutes: number
  title: string
  detail: string
}[] = [
  {
    minutes: 6,
    title: 'Draw',
    detail: 'The drawing prompt. Do not say what the class is about.',
  },
  {
    minutes: 3,
    title: 'Share the drawings',
    detail:
      'Everyone shows. Nobody critiques. Ask: how did it feel when everybody got it at the same moment?',
  },
  {
    minutes: 6,
    title: 'Write',
    detail: 'The journaling prompt. Still do not name the topic.',
  },
  {
    minutes: 3,
    title: 'Share the writing',
    detail: 'Ask: how far away were they, really? Let the room sit with the distance.',
  },
  {
    minutes: 6,
    title: 'Explain',
    detail:
      'Now name it. The age-3 version to the whole room with the string and cups, then the age-7 three-step version, then the age-12 layer. Two or three story beats, “LO” and the @ sign always land.',
  },
  {
    minutes: 8,
    title: 'Teach it back',
    detail: 'Fill a page for a peer who was not here.',
  },
  {
    minutes: 3,
    title: 'Share the teach-back pages',
    detail: 'Two or three volunteers show their page, and we record it.',
  },
]

export const MODULE_3_GAME =
  'Unplugged game, “The Human Internet.” Write a short sentence on a strip of paper, cut it into five pieces, and number each piece 1 to 5. Hand the pieces to five children at one end of the room. Their job is to get their piece to one child at the far end, but no two pieces may travel by the same route: they have to hand off through different friends. The receiver lays them out by number and reads the sentence aloud, which will be scrambled and funny if anyone got the order wrong. Then run it again with two children sitting down, “those cables are cut”, and watch the pieces route around them without anyone giving an instruction. Finally, hide one piece before it sets off. The receiver has to notice a number is missing and shout for it again. That is TCP, and they invented it themselves.'

/* ── Knowledge check ─────────────────────────────────────────────────────── */

export const MODULE_3_MCQ: QuizMCQ[] = [
  {
    question: 'What is the internet?',
    options: [
      'One very big computer that everybody shares',
      'Millions of computers passing messages to each other, where each message is chopped into numbered pieces that find their own way and get put back together',
      'A website you visit',
      'A satellite that beams pictures down to phones',
    ],
    answer: 1,
  },
  {
    question: 'What is a packet?',
    options: [
      'A small numbered piece of your message, carrying the address it came from and the address it is going to',
      'The box a computer is delivered in',
      'A password that protects your message',
      'The name of the first email ever sent',
    ],
    answer: 0,
  },
  {
    question: 'What happens if one route across the internet is broken?',
    options: [
      'The message is lost forever',
      'Everybody has to wait until it is repaired',
      'The packets go a different way, because there is no single road and nobody in charge of the traffic',
      'The internet switches itself off',
    ],
    answer: 2,
  },
  {
    question: 'What does DNS do?',
    options: [
      'It scrambles your message so nobody can read it',
      'It turns a name like argo.app into the number a machine actually uses, like a phone book',
      'It decides how fast your internet is',
      'It stores all your photos',
    ],
    answer: 1,
  },
  {
    question: 'What is the difference between the internet and the web?',
    options: [
      'They are two words for exactly the same thing',
      'The web is the cables and the internet is the websites',
      'The internet is the network, from 1969. The web is one thing running on top of it, invented in 1989. Email and video calls are internet but not web.',
      'The web is the part that works on phones',
    ],
    answer: 2,
  },
]

export const MODULE_3_OPEN_QUESTIONS: string[] = [
  'Explain to someone at home why your message does not travel in one piece.',
  'Why is a network with nobody in charge harder to break than one with a boss in the middle? Give an example.',
  'At the start of class you drew a time you reached a whole room at once. If you could reach five billion people instead, what would you want to send them?',
  'You wrote about a voice arriving from very far away. Did the distance disappear, or could you feel it? What does that tell you about what the internet can and cannot carry?',
  'A third of the world is still not online. What is one thing they cannot do that you can, and does that matter?',
]
