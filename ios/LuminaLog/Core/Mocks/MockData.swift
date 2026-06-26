import Foundation

/// Seed data for demo mode (no GoogleService-Info.plist) and for previews/tests.
enum MockData {

    static let userId = "demo-user"
    static let model = "demo-model"

    // MARK: - Date helpers

    /// `days` ago at the given hour, in the current calendar.
    private static func daysAgo(_ days: Int, hour: Int = 9, minute: Int = 30) -> Date {
        let calendar = Calendar.current
        let day = calendar.date(byAdding: .day, value: -days, to: Date()) ?? Date()
        return calendar.date(bySettingHour: hour, minute: minute, second: 0, of: day) ?? day
    }

    private static func words(_ text: String) -> Int {
        text.split(whereSeparator: { $0.isWhitespace || $0.isNewline }).count
    }

    private static func entry(
        id: String,
        type: JournalType,
        title: String,
        daysAgo days: Int,
        hour: Int = 9,
        content: String,
        media: [MediaItem] = [],
        transcriptStatus: TranscriptStatus? = nil,
        summary: String? = nil,
        insights: String? = nil,
        prompts: [String]? = nil
    ) -> JournalEntry {
        let created = daysAgo(days, hour: hour)
        return JournalEntry(
            id: id,
            userId: userId,
            type: type,
            title: title,
            createdAt: created,
            updatedAt: created,
            content: content,
            media: media,
            transcriptStatus: transcriptStatus,
            summary: summary.map { AIGeneration(text: $0, generatedAt: created, model: model) },
            insights: insights.map { AIGeneration(text: $0, generatedAt: created, model: model) },
            prompts: prompts.map { AIPrompts(items: $0, generatedAt: created, model: model) },
            vector: VectorState(status: .indexed, chunkCount: 1, indexedAt: created),
            wordCount: words(content)
        )
    }

    // MARK: - Profile

    static var profile: UserProfile {
        UserProfile(
            id: userId,
            displayName: "Demo User",
            email: "demo@luminalog.app",
            biography: "Product designer learning to slow down. I journal to notice the small things — morning light, good conversations, the gap between what I planned and what actually happened. Working on being less hard on myself.",
            createdAt: daysAgo(120),
            timezone: TimeZone.current.identifier,
            stats: UserProfile.Stats(
                streakCount: 12,
                lastEntryDate: daysAgo(0, hour: 8),
                totalWords: 24_310
            ),
            dailyPrompt: UserProfile.DailyPrompt(
                items: cannedDailyPrompts,
                date: daysAgo(0, hour: 5)
            ),
            details: UserProfile.ProfileDetails(
                goals: "Ship work I'm proud of and be kinder to myself in the process.",
                hobbies: "Film photography, long walks, baking bread.",
                age: "34",
                location: "Lisbon, Portugal",
                work: "Product designer at a small studio.",
                favoriteBooks: "Bird by Bird, Letters to a Young Poet, The Overstory.",
                languages: "English, Portuguese, a little Spanish.",
                friendsDescribe: "Calm, curious, a good listener."
            )
        )
    }

    // MARK: - Journal entries

    static var journalEntries: [JournalEntry] {
        [
            entry(
                id: "demo-entry-01",
                type: .text,
                title: "Morning pages before the rush",
                daysAgo: 0,
                hour: 8,
                content: "Woke up before the alarm for once. Sat by the window with coffee and let myself write without an agenda. I keep noticing that the days I start slowly end up being the days I do my best work — there's something about giving the morning a little margin. Today I want to finish the onboarding flow designs and actually take a real lunch break instead of eating at my desk.",
                summary: "A slow, deliberate morning start; noticing that unhurried mornings correlate with better work days. Intentions: finish onboarding designs, take a real lunch break.",
                prompts: [
                    "What does 'margin' in your morning actually buy you later in the day?",
                    "Describe your ideal first hour of the day in detail.",
                    "When did you last take a real lunch break, and what changed?",
                    "What would you cut from your mornings if you could only keep three things?",
                    "Who in your life is good at slow mornings, and what do they do differently?"
                ]
            ),
            entry(
                id: "demo-entry-02",
                type: .voice,
                title: "Walk-and-talk after the design review",
                daysAgo: 1,
                hour: 17,
                content: "Okay so the design review went better than I expected. Priya pushed back hard on the settings screen and honestly she was right, it was trying to do too much. I felt that flash of defensiveness but I caught it this time, just let it pass, and then the conversation actually got good. Note to self: the pushback is almost never about me. Walking home now and the light on the buildings is incredible. I want to remember that work can feel like this — collaborative, a little bruising, but alive.",
                media: [MediaItem(s3Key: "demo/voice-02.m4a", kind: .audio, durationSec: 94)],
                transcriptStatus: .ready,
                insights: "You handled criticism differently this time — you noticed defensiveness arising and chose not to act on it, which turned a tense moment into a productive one. The phrase \"the pushback is almost never about me\" is a reusable anchor. There's also a pattern of processing work emotions through movement: your best reflections often happen while walking."
            ),
            entry(
                id: "demo-entry-03",
                type: .text,
                title: "Tuesday, tired",
                daysAgo: 2,
                hour: 22,
                content: "Long day. Three meetings that could have been messages. I'm noticing how much my energy depends on whether I get any maker time before noon — today I didn't, and by 4pm I was just pushing pixels around without thinking. Going to block 9 to 11 tomorrow and defend it. Dinner with Sam was the bright spot; we laughed about the camping trip disaster from last summer and it pulled me completely out of my head."
            ),
            entry(
                id: "demo-entry-04",
                type: .image,
                title: "Grandma's recipe card",
                daysAgo: 3,
                hour: 14,
                content: "Lena's honey cake. Oven at 350. Three eggs, beaten until pale. A cup of strong cooled tea. Honey — the dark kind, a full cup, warmed so it pours. Flour, four cups, sifted twice. Don't rush the folding. Bake until the kitchen smells like September. Let it rest a day before cutting — it gets better, like most things do.",
                media: [MediaItem(s3Key: "demo/recipe-04.jpg", kind: .image, width: 3024, height: 4032)],
                summary: "A photographed handwritten recipe card for Grandma Lena's honey cake, with her characteristic margin note that the cake — like most things — gets better if you let it rest."
            ),
            entry(
                id: "demo-entry-05",
                type: .text,
                title: "Saying no without an apology",
                daysAgo: 4,
                hour: 9,
                content: "Turned down the conference talk this morning. Wrote four drafts of the email before realizing the first one — two sentences, warm, no excuses — was the right one. Every time I over-explain a no, I'm really asking for permission. I don't need permission. The afternoon felt lighter than it has in weeks, which tells me everything about whether it was the right call."
            ),
            entry(
                id: "demo-entry-06",
                type: .video,
                title: "Video note from the lake",
                daysAgo: 5,
                hour: 11,
                content: "I'm at the lake, it's barely above freezing, and I just did the cold plunge thing with Marcus. I want to record this while my hands are still shaking. The thing I keep learning and forgetting is that the dread before is always worse than the thing itself. Always. I stood on that dock for ten minutes negotiating with myself, and the actual water was just... cold. That's it. Just cold, and then done, and then this ridiculous euphoria. What else am I standing on the dock about right now? The portfolio rewrite. The conversation with Dad. Noted.",
                media: [MediaItem(s3Key: "demo/lake-06.mp4", kind: .video, durationSec: 73, width: 1920, height: 1080)],
                transcriptStatus: .ready,
                insights: "The dock metaphor is doing real work here: you named two specific avoidances (the portfolio rewrite, the conversation with your dad) by noticing how anticipation outweighs reality. Past entries show the same pattern before the design review and before saying no to the conference — the buildup is consistently worse than the event."
            ),
            entry(
                id: "demo-entry-07",
                type: .text,
                title: "On rereading old entries",
                daysAgo: 6,
                hour: 21,
                content: "Spent twenty minutes rereading entries from last spring. Two things jumped out. One: the problems I was agonizing over have almost all dissolved — not solved, dissolved. Most worries just expire. Two: the entries I'm gladdest to have are never the dramatic ones, they're the boring Tuesday ones with the small details — what we ate, what the kitchen smelled like, the joke Sam made. Note for future me: record more textures, fewer verdicts."
            ),
            entry(
                id: "demo-entry-08",
                type: .voice,
                title: "Three things, barely awake",
                daysAgo: 8,
                hour: 7,
                content: "Quick one before the day starts. Three things I'm grateful for. The heater kicking on before I got up. The fact that Maya texted back last night and we're okay. And this weird quiet confidence I've had all week that I can't explain and don't want to jinx. Okay. Coffee.",
                media: [MediaItem(s3Key: "demo/gratitude-08.m4a", kind: .audio, durationSec: 31)],
                transcriptStatus: .ready
            ),
            entry(
                id: "demo-entry-09",
                type: .text,
                title: "The feedback I didn't want",
                daysAgo: 9,
                hour: 19,
                content: "Performance review today. Most of it was good, but the line that stuck was \"you hold work too long before sharing it.\" My first reaction was to build a case against it. By tonight I can admit it's true — I polish as a form of hiding. The drafts I'm most afraid to share are always the ones with the most of me in them. Experiment for the next month: share everything one day earlier than feels comfortable."
            ),
            entry(
                id: "demo-entry-10",
                type: .image,
                title: "Whiteboard after the brainstorm",
                daysAgo: 10,
                hour: 16,
                content: "NORTH STAR: people should finish setup in under five minutes. Ideas: progressive disclosure, skip everything skippable, sample data on day one, delete the tour (nobody reads the tour). Decisions: kill steps 3 and 4, merge profile into settings. Parking lot: template gallery, invite flow rethink. Owner: me. Demo Friday.",
                media: [MediaItem(s3Key: "demo/whiteboard-10.jpg", kind: .image, width: 4032, height: 3024)]
            ),
            entry(
                id: "demo-entry-11",
                type: .text,
                title: "Sunday reset",
                daysAgo: 12,
                hour: 18,
                content: "Cleaned the apartment, meal prepped, answered the three emails I'd been avoiding all week — total time, forty minutes, after a week of carrying them around. The ratio of dread to effort was at least ten to one. Lit the good candle instead of saving it. This week I want to call Grandma, finish the book that's been on the nightstand since March, and get outside every single day even if it's just around the block."
            ),
            entry(
                id: "demo-entry-12",
                type: .text,
                title: "First entry — why I'm doing this",
                daysAgo: 14,
                hour: 20,
                content: "Starting a journal again, properly this time. Not for productivity, not to optimize anything. I just keep losing whole months — they blur past and I can't tell you a single specific thing that happened. I want a record of the specific things. The rule is simple: show up most days, write honestly, don't perform for some imaginary future reader. If all this ever becomes is a list of small true moments, that's enough.",
                summary: "A recommitment to journaling with a clear intention: not self-optimization but preserving specific, honest moments against the blur of passing months. Ground rule set — show up, be honest, don't perform."
            )
        ]
    }

    // MARK: - Chats

    static var chats: [Chat] {
        [
            Chat(
                id: "demo-chat-01",
                userId: userId,
                kind: .text,
                title: "Processing the week",
                createdAt: daysAgo(1, hour: 20),
                lastMessageAt: daysAgo(0, hour: 7)
            ),
            Chat(
                id: "demo-chat-02",
                userId: userId,
                kind: .voice,
                title: "Evening check-in call",
                createdAt: daysAgo(3, hour: 21),
                lastMessageAt: daysAgo(3, hour: 21, minute: 18),
                vapiCallId: "demo-vapi-call-7f3a"
            ),
            Chat(
                id: "demo-chat-03",
                userId: userId,
                kind: .text,
                title: "Stuck on the portfolio",
                createdAt: daysAgo(5, hour: 13),
                lastMessageAt: daysAgo(5, hour: 13, minute: 24)
            )
        ]
    }

    static var chatMessages: [String: [ChatMessage]] {
        [
            "demo-chat-01": [
                ChatMessage(id: "m01-1", role: .user, text: "This week felt like a lot. Can you help me make sense of it?", createdAt: daysAgo(1, hour: 20, minute: 2)),
                ChatMessage(id: "m01-2", role: .assistant, text: "Of course. Looking at your recent entries, two threads stand out: you protected your energy better than usual — saying no to the conference, blocking maker time — and you handled hard feedback without armor, both in the design review and your performance review. What part of the week is still sitting with you?", createdAt: daysAgo(1, hour: 20, minute: 2)),
                ChatMessage(id: "m01-3", role: .user, text: "The performance review comment. About holding work too long.", createdAt: daysAgo(1, hour: 20, minute: 5)),
                ChatMessage(id: "m01-4", role: .assistant, text: "You wrote something striking about it: \"I polish as a form of hiding.\" That's not a flaw in your craft — it's a protective habit. Your one-day-earlier experiment is a good size: small enough to actually do, big enough to feel. How did the first share go?", createdAt: daysAgo(1, hour: 20, minute: 6)),
                ChatMessage(id: "m01-5", role: .user, text: "Honestly? Fine. Nobody even noticed it was rough.", createdAt: daysAgo(0, hour: 7, minute: 41)),
                ChatMessage(id: "m01-6", role: .assistant, text: "That matches a pattern in your journal — at the lake you called it standing on the dock: the dread before is reliably worse than the thing itself. You now have three recent data points saying so. It might be worth writing down what you'd attempt next if you trusted that pattern completely.", createdAt: daysAgo(0, hour: 7, minute: 42))
            ],
            "demo-chat-02": [
                ChatMessage(id: "m02-1", role: .user, text: "Hey, just wanted to talk through the day for a few minutes.", createdAt: daysAgo(3, hour: 21, minute: 1)),
                ChatMessage(id: "m02-2", role: .assistant, text: "I'm glad you called. You mentioned finding your grandmother's recipe card earlier today — that seemed to mean a lot. What came up for you?", createdAt: daysAgo(3, hour: 21, minute: 1)),
                ChatMessage(id: "m02-3", role: .user, text: "Yeah, her honey cake. Her handwriting got me. The note about letting it rest a day before cutting.", createdAt: daysAgo(3, hour: 21, minute: 3)),
                ChatMessage(id: "m02-4", role: .assistant, text: "\"It gets better, like most things do.\" There's a lot of her in that line. You said this week you've been rushing — sharing work before it's ready was the fear, but rest has been the theme. Maybe she was onto something about both cakes and people. Did you want to call her this week? You wrote that intention on Sunday.", createdAt: daysAgo(3, hour: 21, minute: 4)),
                ChatMessage(id: "m02-5", role: .user, text: "I did write that. Okay, I'll call her Saturday morning. Thanks for remembering.", createdAt: daysAgo(3, hour: 21, minute: 17))
            ],
            "demo-chat-03": [
                ChatMessage(id: "m03-1", role: .user, text: "I keep avoiding the portfolio rewrite. It's been on my list for a month.", createdAt: daysAgo(5, hour: 13, minute: 2)),
                ChatMessage(id: "m03-2", role: .assistant, text: "You actually named this one at the lake — it was the first thing you listed when you asked yourself \"what else am I standing on the dock about?\" What does the rewrite represent that a normal task doesn't?", createdAt: daysAgo(5, hour: 13, minute: 3)),
                ChatMessage(id: "m03-3", role: .user, text: "It's me deciding what kind of work I want to be known for, I guess. That's the scary part.", createdAt: daysAgo(5, hour: 13, minute: 9)),
                ChatMessage(id: "m03-4", role: .assistant, text: "That's a much bigger thing than \"update portfolio,\" and your avoidance makes complete sense at that size. What if the first step weren't choosing an identity but just listing the five projects you'd be proud to show anyone — no commitments, just a list? You're good at starting when the first step is honest and small, like your two-sentence no to the conference.", createdAt: daysAgo(5, hour: 13, minute: 10)),
                ChatMessage(id: "m03-5", role: .user, text: "A list I can do. Putting it in tomorrow's morning block.", createdAt: daysAgo(5, hour: 13, minute: 23))
            ]
        ]
    }

    // MARK: - AI canned responses

    static let cannedClipTranscript =
        "This is a quick voice memo I recorded to add a little more to this entry."

    static let cannedSummary = "This entry captures a moment of honest self-observation. You name a specific tension you've been carrying, trace where it comes from, and land on a small, concrete next step rather than a sweeping resolution — a pattern that shows up in your strongest entries."

    static let cannedInsights = "A few threads stand out. First, you process difficulty by writing toward specifics — the entries where you name exact moments are the ones where your thinking visibly shifts. Second, anticipation consistently costs you more than the event itself; you've now documented this across several situations. Third, your energy tracks closely with whether you protect unstructured time early in the day. Taken together, these suggest your best lever isn't more discipline — it's shortening the gap between dreading a thing and starting it."

    static let cannedPrompts = [
        "What's one thing you're 'standing on the dock' about right now, and what's the smallest honest first step?",
        "Describe a recent moment you'd want to remember in ten years — textures, not verdicts.",
        "Where did your energy actually go today, and where did you intend it to go?",
        "What would you share tomorrow if it only had to be one day less polished?",
        "Who deserves a call from you this week, and what would you want them to know?"
    ]

    static let cannedDailyPrompt = "Yesterday you wrote about the gap between dread and effort. What's one avoided task you could give just ten minutes to this morning?"

    /// Five area-anchored prompts for demo mode's daily-prompt carousel.
    static let cannedDailyPrompts: [DailyPromptItem] = [
        DailyPromptItem(area: "Relationships", text: "You laughed with Sam about the camping trip — who else pulls you out of your head, and when did you last tell them?"),
        DailyPromptItem(area: "Work & Purpose", text: "You've been polishing work as a form of hiding; what would you share one day earlier today if you trusted it was enough?"),
        DailyPromptItem(area: "Health & Body", text: "The cold plunge taught you the dread is worse than the water — what small thing is your body asking you to stop negotiating with this morning?"),
        DailyPromptItem(area: "Inner World", text: "You keep noticing that slow mornings make for your best days; what would you protect tomorrow's first hour for?"),
        DailyPromptItem(area: "Joy & Play", text: "Your favorite entries are the boring-Tuesday ones with small textures — what tiny moment from yesterday do you want to keep?"),
    ]

    static let cannedChatReply = "That sounds like it's been quietly weighing on you for a while. Reading back through your recent entries, I notice you tend to move forward fastest when you shrink the first step until it's almost embarrassingly small — the two-sentence email, the ten-minute Sunday reset, the list instead of the rewrite. What would the embarrassingly small version of this look like? I'd also gently point out that the last three times you dreaded something, the doing turned out lighter than the anticipating. Maybe this is another dock moment."
}
