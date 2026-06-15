// data.jsx — mock journal data for the LuminaLog prototype.

const USER = {
  name: 'Anna Reyes',
  first: 'Anna',
  streak: 12,
  words: 24310,
  bio: "I'm a landscape architect in Lisbon, trying to write more honestly about the small things. Recently moved here from Porto. I journal to slow down and notice. Coffee, cold-water swimming, and my dog Maple.",
  plan: 'Free',
};

const DAILY_PROMPT = 'What moment today made you pause and notice?';

// reusable long bodies
const BODY = {
  morning: "The light came in low this morning, the kind that turns the kitchen tiles gold for about four minutes before it climbs the wall and disappears. I stood with my coffee and didn't reach for my phone, which felt like a small act of rebellion. Maple was asleep with one paw over her nose. I thought about how rarely I let a moment just be a moment without trying to make it into something — a photo, a note, a plan. Today I just watched the light move.",
  swim: "First cold swim of the season at the cove. The water took my breath for the first thirty seconds and then something in my chest unclenched. There's a clarity that comes after — everything feels rinsed and sharp-edged. Walked back up the path with my towel around my shoulders feeling braver than the day had any right to make me.",
  call: "Long call with Dad. He told the story about the orange grove again, the one where his brother fell asleep in the truck bed. I've heard it a hundred times but today I noticed he laughs at a different part now. I want to remember that — that the stories we love change shape with us. We talked for an hour and neither of us mentioned the thing we usually argue about.",
  market: "Saturday market. Bought figs that were almost too soft, the woman wrapped them like they were fragile and they were. The basil smelled like the whole summer compressed into one breath. I keep thinking I should cook more but really I just want to keep buying things that smell good and standing in crowded places where everyone wants the same tomatoes.",
  doubt: "A harder day. The project review didn't go the way I'd hoped and I spent the afternoon convinced I'd chosen the wrong career, the wrong city, the wrong everything. By evening it had softened into something more manageable. Writing it down helps me see the shape of the spiral instead of living inside it.",
};

const TRANSCRIPT_VOICE = "Okay so it's late and I didn't want to type tonight. Today felt long in a good way. I walked the whole length of the river path after work and there was this older couple dancing — actually dancing — to a radio by the water. Nobody was filming them. I just stood there for a second feeling lucky to have seen it. I want to be the kind of person who still dances by the river when I'm seventy.";

const TRANSCRIPT_VIDEO = "I'm recording this from the rooftop because I wanted to remember what the city sounds like right now. There's the trams, and somebody two buildings over is practicing the same four bars of piano they've been practicing all week. I think they're finally getting it.";

const OCR_TEXT = "Sunday. Slept badly but woke up calm, which doesn't always follow. Made the bed properly for once. I've been carrying a sentence around all week that I can't place — 'the days are long but the years are short.' It keeps surfacing. Maybe that's the whole thing about keeping a journal. You're trying to make the years a little longer by making the days a little more visible.";

function entry(id, type, title, dateISO, body, extra = {}) {
  return { id, type, title, date: new Date(dateISO), body, ...extra };
}

const ENTRIES = [
  entry('e1', 'text',  'The gold four minutes',        '2026-06-13T07:24', BODY.morning, { summary: "A quiet morning observation about choosing presence over documentation — watching the light move across the kitchen instead of capturing it." }),
  entry('e2', 'voice', 'Dancing by the river',          '2026-06-12T22:10', TRANSCRIPT_VOICE, { duration: 96, summary: "An evening voice note about witnessing an older couple dancing by the river and a wish to keep that spirit into old age." }),
  entry('e3', 'image', 'Sunday, made the bed',          '2026-06-11T09:02', OCR_TEXT, { pages: 1, summary: "A handwritten Sunday entry reflecting on calm mornings and the idea that journaling makes the years feel longer by making days more visible." }),
  entry('e4', 'text',  'Figs almost too soft',          '2026-06-08T11:40', BODY.market, { summary: "A sensory Saturday-market entry about figs, basil, and the simple pleasure of being among people who want the same things." }),
  entry('e5', 'video', 'What the city sounds like',      '2026-06-07T18:33', TRANSCRIPT_VIDEO, { duration: 42, summary: "A rooftop video capturing the ambient sounds of the city — trams and a neighbor's persistent piano practice." }),
  entry('e6', 'text',  'The orange grove, again',       '2026-06-05T20:15', BODY.call, { summary: "Reflection after a long call with Dad about a familiar family story and how the stories we love change shape over time." }),
  entry('e7', 'text',  'A harder day',                   '2026-06-03T21:48', BODY.doubt, { summary: "An honest entry about a difficult project review, an afternoon of self-doubt, and how writing helped name the spiral." }),
  entry('e8', 'voice', 'First cold swim',                '2026-05-30T08:12', BODY.swim, { duration: 71, summary: "A voice note about the season's first cold-water swim and the clarity and courage that followed." }),
  entry('e9', 'text',  'Things I keep meaning to say',   '2026-05-27T23:05', "A list disguised as a paragraph. That I'm grateful for the way you make tea without being asked. That I noticed you fixed the gate. That I'm sometimes quiet not because I'm far away but because I'm completely here.", { summary: "A tender entry framed as unsaid gratitudes toward someone close." }),
  entry('e10','image', 'Notes from the train',           '2026-05-24T15:30', "Window seat, two hours north. The landscape keeps offering itself: cork oaks, a reservoir gone low and pale, a town that's just a church and a petrol station. I love trains for this — being held still while the world does the moving.", { pages: 2, summary: "Handwritten train-journey notes observing the passing Portuguese landscape and the comfort of stillness in motion." }),
  entry('e11','text',  'On not finishing things',        '2026-05-21T19:20', "Half-read books, half-learned songs, a balcony herb garden that's mostly ambition. I used to feel bad about this. Lately I think the unfinished things are just proof of how many doors I keep trying.", { summary: "A reframing of unfinished projects as evidence of curiosity rather than failure." }),
  entry('e12','text',  'Lisbon, week three',             '2026-05-18T08:55', "Starting to know which café remembers my order. The hills are still trying to kill me. I found a viewpoint with no name on any map and I'm keeping it that way.", { summary: "Early impressions of settling into a new city and the small markers of belonging." }),
];

// chat history
const CHATS = [
  { id: 'c1', kind: 'text',  title: 'On feeling behind', snippet: "It sounds like the comparison started after the review on Tuesday…", date: new Date('2026-06-12T22:40') },
  { id: 'c2', kind: 'voice', title: 'Evening voice call', snippet: 'Voice conversation · 8 min', date: new Date('2026-06-10T21:15') },
  { id: 'c3', kind: 'text',  title: 'The orange grove story', snippet: "I love that you noticed your dad laughs at a different part now…", date: new Date('2026-06-05T20:50') },
  { id: 'c4', kind: 'text',  title: 'Why cold water helps', snippet: "There's research on this, but I'm more curious what it does for you…", date: new Date('2026-05-30T09:00') },
];

const CHAT_THREAD = [
  { from: 'ai',   text: "Hi Anna. I was reading back through this week — the morning with the gold light, the harder day after the review. You've been holding a lot gently. What's sitting with you tonight?" },
  { from: 'user', text: "I think I'm just tired of feeling behind. Everyone seems further along." },
  { from: 'ai',   text: "That feeling showed up in your entry on Tuesday too — \u201cthe wrong career, the wrong city, the wrong everything.\u201d But by the time you finished writing, it had already softened. You're better at finding your way out than the feeling lets you believe." },
  { from: 'user', text: "Maybe. It doesn't feel like a skill when I'm in it." },
  { from: 'ai',   text: "It rarely does. Skills you've practiced a long time stop feeling like effort — they just feel like you. Can I ask what \u201cahead\u201d would even look like? Sometimes naming it shrinks it." },
];

Object.assign(window, { USER, DAILY_PROMPT, ENTRIES, CHATS, CHAT_THREAD });
