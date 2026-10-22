import { H2, P, UL, A, Pull, Note, Figure, H3 } from '@/components/blog'

/* ──────────────────────────────────────────────────────────────────────────
 * Blog post registry.
 * Each post is metadata + a Content component (authored like the legal pages).
 * Add a new post by appending an entry to `posts`. Newest first.
 * ────────────────────────────────────────────────────────────────────────── */

export type BlogPost = {
  slug: string
  title: string
  description: string   // meta description + index excerpt
  date: string          // human-readable, e.g. "July 3, 2026"
  isoDate: string       // for <time> / sorting, e.g. "2026-07-03"
  readingTime: string   // e.g. "7 min read"
  Content: () => React.ReactNode
}

/* ── Post: The best consumer in the world (Ashish Sood) ── */
function AshishSoodContent() {
  return (
    <>
      <Figure
        src="/blog/ashish-sood-network-states-1.jpg"
        alt="Ashish Sood, in a Curious Ventures 'stay curious' shirt, and Konrad talking by a resort pool at Network School"
        width={1920}
        height={1080}
        priority
      />
      <P>
        Some founders describe their careers as a straight line. Ashish Sood describes his as a
        series of things he got curious about, built, scaled, and then handed off. When we sat down
        at Network School in Bataan, with the rain starting up over the open-air hut we ended up
        moving into, he walked me through four companies in about ninety seconds, then spent the
        next hour on what he actually learned along the way.
      </P>
      <P>
        This is the twentieth Argo Podcast conversation, and it sits squarely at the
        intersection the show keeps returning to: how someone builds, and who they become in the
        process.
      </P>

      <H2>A fund that follows network states</H2>
      <P>
        Ashish now runs{' '}
        <A href="https://curiousventures.xyz">Curious Ventures</A>, a fund with an unusual mandate.
        It has no fixed geography. Instead of a home city, it follows network states, the pop-up
        communities of builders that gather in places like Network School, Edge City, and Bali. His
        pitch to himself was simple: there is real talent in these rooms, and much of it has never
        scaled anything. He has, several times, so he can be useful.
      </P>
      <P>
        The word on his shirt, and tattooed on his arm, is <em>curious</em>. It is not decoration.
        He describes himself, without much irony, as the best consumer in the world. He has spent
        well over ten thousand hours online across apps, games, social media, crypto, and hardware,
        and he treats that omnivorous consumption as a professional edge rather than a distraction.
        For a self-described generalist who once worried he had never given anything ten thousand
        hours, it is a neat reframe: maybe the ten thousand hours went into pattern-matching across
        everything at once.
      </P>

      <H2>Four companies before the fund</H2>
      <P>
        The r&eacute;sum&eacute; is worth slowing down for. His first company, Bar Uncle, was a
        nightlife app he started around age nineteen in Delhi, partly because he could not get into
        the good clubs and figured a business might be his way in. You could buy a bottle of alcohol
        virtually, and the price of that bottle would shift depending on which of the 190 onboarded
        clubs you carried it to. He ran it for three and a half years, raised about fifty thousand
        dollars from friends, family, and fools, and eventually sold it when he realized he was
        selling an experience in a market that wanted discounts.
      </P>
      <P>
        Then came PaySense, where he joined a small team doing short-term personal loans in India
        and helped scale it toward hundreds of people before it was acquired by PayU. He is candid
        about the machinery of lending, including the recovery buckets that decide how gently or
        harshly a late borrower is treated, and a more inventive idea: underwriting people by their
        social nodes, on the theory that if five friends repay on time, you probably will too.
      </P>
      <P>
        During COVID he ran Let&apos;s Binge, aggregating small homegrown food brands into a shared
        dark-store and shelf-space model that cut their costs. He shut it down when a tokenization
        project he was building on the side, Polytrade, took off. Polytrade started with invoice
        factoring and grew into what he calls an Amazon for real-world-asset tokenization. He ran it
        for three years before stepping away.
      </P>

      <H2>Living where founders live</H2>
      <P>
        The most interesting part of the conversation was about how he now decides whom to back.
        Having raised money seven times himself, he knows the game from the other side. He calls it
        founder fraud, and includes himself in the indictment: a founder can learn exactly what an
        investor wants to hear, and AI makes that easier than ever.
      </P>
      <Pull>
        You can hold a facade for a call, or twenty calls. You cannot hold it for fifteen days while
        someone watches how you actually work.
      </Pull>
      <P>
        His answer is not a better set of questions. It is proximity. He moves into the same places
        founders live, so he sees them at 2AM and at noon and at 5PM, not just across three polished
        calls. You can perform for a call, he says, but you cannot perform for fifteen days while
        someone watches whether you are loving the problem or just performing it.
      </P>
      <Figure
        src="/blog/ashish-sood-network-states-2.jpg"
        alt="Ashish and Konrad sitting under an open-air hut by the sea at Network School, mid-conversation"
        width={1920}
        height={1080}
        caption="Ashish's due-diligence method is proximity: he moves into the places founders live and watches how they actually work."
      />
      <P>
        His first check out of Curious Ventures went to Nacho and Sam, whose AI content company is
        becoming Amplify AI, and he framed the money the way he frames all of it: money is only a
        multiplier. Give money to a chaotic team and you get more chaos. Give it to people who know
        what they are doing and it becomes leverage.
      </P>

      <H2>Calm down on building</H2>
      <P>
        For a room full of people shipping apps in fifteen days, his advice this month has been
        almost contrarian: calm down on building. Falling in love with a solution is easy,
        especially when generating tokens gives you a small hit of godlike feeling. Falling in love
        with a problem is harder and more useful. Spend eight hours actually thinking before you
        spend thirty days building. When you pitch, talk only about the problem, and aim for the
        listener to see your solution on their own by the three-minute mark. If they get there
        before you say it, they will believe it more.
      </P>

      <H2>He sold it before he built it</H2>
      <P>
        The story he had not told in a decade was about that first app. He had no money and no idea
        how to make a prototype, so he bought a pack of black A4 sheets, sat in his room with pens
        and pencils, and drew the entire app by hand, every view and user flow, over two days. He
        took the stack to an agency, offered twenty percent of the company for a corner of their
        office and two engineers, and walked out with a team building it for free.{' '}
        &ldquo;I sold the product before I built it,&rdquo; he said, &ldquo;and I did not spend a
        penny.&rdquo; It is a good reminder that the constraint that looks like a wall is often just
        a prompt to be resourceful.
      </P>
      <Figure
        src="/blog/ashish-sood-network-states-3.jpg"
        alt="Ashish and Konrad seated cross-legged under the hut with the sea and a pier behind them"
        width={1920}
        height={1080}
        caption="Closing the hour under the hut as the rain passed, on doing good and keeping a clear conscience."
      />
      <P>
        We closed on quieter ground. He keeps a rule: if he spends a hundred days wanting to change
        something, he changes it. He reads with the audiobook playing in his ears and the physical
        book open at the same time, a workaround for an attention span he says most of us now share.
        And his prayer, a Hindu one, comes down to a single instruction he tries to live by: be pure
        to yourself. Know what you are doing. Keep your conscience clear enough to sleep.
      </P>

      <H2>Key takeaways</H2>
      <UL
        items={[
          'Treat broad consumption as a skill. Ashish’s edge is having genuinely used almost everything, which lets him pattern-match products fast.',
          'Proximity beats interrogation. Living alongside founders reveals in fifteen days what no set of calls can.',
          'Money is a multiplier, not a fix. It amplifies whatever state a team is already in.',
          'Fall in love with the problem. Give thinking its hours before building takes over.',
          'Resourcefulness can replace capital. A hand-drawn prototype was enough to get a product built for equity.',
        ]}
      />

      <H2>Links &amp; mentions</H2>
      <UL
        items={[
          <>
            <A href="https://curiousventures.xyz">Curious Ventures</A>, Ashish&apos;s fund
            following network states
          </>,
          <>
            <A href="https://house.curiousventures.xyz">house.curiousventures.xyz</A>, his
            private tracker of founders he has met in person
          </>,
          <>
            <A href="https://x.com/soodgen">Ashish Sood on X</A>, @soodgen
          </>,
          'Amplify AI, AI content startup (founders Nacho and Sam), Curious Ventures’ first investment',
          'Courage to be Disliked, book by Ichiro Kishimi and Fumitake Koga',
        ]}
      />

      <H2>Listen to the Argo podcast</H2>
      <P>
        Subscribe on{' '}
        <A href="https://www.youtube.com/@luminalogpodcast">YouTube</A>{' '}and{' '}
        <A href="https://open.spotify.com/show/033Mu8Yn2ybRQIis1uKNv2">Spotify</A>.
      </P>
    </>
  )
}

/* ── Post: Build your mind (generative journaling) ── */
function BuildYourMindContent() {
  return (
    <>
      <Figure
        src="/blog/build-mind-hero.jpg"
        alt="An open notebook and pen on a desk, with a glowing lattice of connected points of light rising from the page"
        width={1440}
        height={800}
        priority
      />
      <P>
        In our{' '}
        <A href="/blog/the-750-word-habit-who-does-it-and-why">last post</A>, we made the case for
        journaling as <strong>catharsis</strong>: three pages, first thing, unedited and private,
        to get the noise out of your head so you can get on with your day. Tim Ferriss&apos;s
        &ldquo;spiritual windshield wipers.&rdquo; Emptying the mind so it stops carrying what
        it&apos;s carrying.
      </P>
      <P>
        That&apos;s true, and it&apos;s well-evidenced. But it&apos;s only half the story, and,
        it turns out, the smaller half.
      </P>
      <P>
        Because there is a second tradition of journaling that runs in exactly the opposite
        direction. Where catharsis <em>subtracts</em> (drain the tank, feel lighter) this other
        practice <em>adds</em>. It uses the page not as a drain but as a forge: a place to develop
        an idea that didn&apos;t exist yet, to grow an emotion by paying attention to it, to turn a
        raw experience into understanding. Call it <strong>generative journaling</strong>, writing
        to <em>build</em> your mind rather than empty it.
      </P>
      <P>
        It has three distinct modes, each with its own body of evidence. And hidden inside the
        science of the <em>first</em> kind of journaling is a quiet finding that reframes
        everything: even venting only works to the degree it becomes building.
      </P>

      <H2>Two directions on the same page</H2>
      <P>
        Notice the metaphors in the cathartic story. Windshield wipers. Caging the monkey mind.
        Getting the bullet out of your skull. Every image is <em>removal</em>. You end with less
        than you started, less noise, less weight, less dread. That&apos;s the point, and on a bad
        morning it&apos;s exactly the right tool.
      </P>
      <P>
        Generative journaling inverts the arrow. You end with <strong>more</strong> than you
        started: an idea you didn&apos;t have, a feeling you&apos;d have missed, a piece of meaning
        you built from something that happened to you. Same physical act, a person, a page, a few
        quiet minutes, pointed the other way. Here are the three ways to point it.
      </P>

      <H2>Mode 1: Write to think</H2>
      <Figure
        src="/blog/write-to-think.jpg"
        alt="A growing, branching network of glowing amber nodes connected by fine threads of light"
        width={1216}
        height={800}
        caption="Luhmann called his note system a “thinking partner.” Your best ideas get built, not recalled."
      />
      <P>
        The most under-appreciated fact about writing is that it isn&apos;t a transcript of
        thought. It&apos;s <em>how thinking happens.</em>
      </P>
      <P>
        Joan Didion said it most plainly in her essay{' '}
        <A href="https://lithub.com/joan-didion-why-i-write/">Why I Write</A>:{' '}
        <strong>&ldquo;I write entirely to find out what I&apos;m thinking, what I&apos;m looking
        at, what I see and what it means.&rdquo;</strong> She wasn&apos;t being modest. She meant
        that the sentence comes first and the understanding second, that she didn&apos;t{' '}
        <em>have</em> the thought and then record it; she found the thought by writing it.
      </P>
      <P>
        Paul Graham made the same case with an engineer&apos;s precision in{' '}
        <A href="https://paulgraham.com/words.html">Putting Ideas Into Words</A>. Writing, he
        argues, forces an idea to become complete and precise, and mercilessly exposes that it
        wasn&apos;t. &ldquo;A good writer will almost always discover new things in the process of
        writing,&rdquo; he notes; half the ideas that end up in an essay are ones you thought of{' '}
        <em>while writing it</em>. His conclusion is bracing: anyone who hasn&apos;t written about a
        topic doesn&apos;t yet have fully formed ideas about it. As the psychologist Adam Grant puts
        it, writing is &ldquo;how you develop an inkling into an insight.&rdquo;
      </P>
      <P>
        This is why serious thinkers have always kept generative notebooks. Renaissance scholars
        had <em>commonplace books</em>. The sociologist Niklas Luhmann built a <em>Zettelkasten</em>
        ,{' '}a slip-box of over 90,000 interlinked notes he described as a literal{' '}
        <strong>&ldquo;thinking partner,&rdquo;</strong> and credited with 70 books and nearly 400
        articles. The modern descendants are Obsidian, Roam, and Tiago Forte&apos;s
        &ldquo;second brain.&rdquo; The through-line across five centuries: your best ideas
        don&apos;t arrive finished in your head. You write your way to them, and build them up over
        time, one connected note at a time.
      </P>
      <Pull>
        The page is not where you store a thought you already had. It&apos;s where you go to have
        one.
      </Pull>

      <H2>Mode 2: Write to appreciate</H2>
      <Figure
        src="/blog/write-to-appreciate.jpg"
        alt="An open journal on a sunlit windowsill beside a small green sprig catching golden morning light"
        width={1216}
        height={800}
        caption="You notice more of whatever you practice writing about. Aim the page at what’s working."
      />
      <P>
        The second mode aims the page at something specific: what&apos;s good. This sounds like a
        greeting card until you look at the evidence, which is some of the sturdiest in all of
        psychology.
      </P>
      <P>
        In a landmark experiment, Robert Emmons and Michael McCullough had people keep a weekly{' '}
        <A href="https://greatergood.berkeley.edu/pdfs/GratitudePDFs/6Emmons-BlessingsBurdens.pdf">
          gratitude list
        </A>,{' '}
versus lists of hassles, or neutral events. The gratitude group exercised more, had fewer
        physical complaints, felt better about their lives, and slept longer and better. Some of the
        effects were visible to their <em>spouses.</em> Martin Seligman tested a version he called{' '}
        <strong>Three Good Things</strong>: each night, write down three things that went well and{' '}
        <em>why</em>. In a randomized trial it raised well-being and lowered depressive symptoms,
        with effects still measurable <em>six months later.</em>
      </P>
      <P>
        And you don&apos;t even need to write about the past: people who wrote about their{' '}
        <A href="https://journals.sagepub.com/doi/10.1177/0146167201277003">
          &ldquo;best possible self&rdquo;
        </A>{' '}
 (life imagined going as well as it realistically could) became more optimistic, more
        satisfied, and, months later, made fewer illness-related trips to the doctor (King, 2001).
        The mechanism is almost embarrassingly simple: <strong>you notice more of whatever you
        practice writing about.</strong>
      </P>
      <Note>
        <strong>The one place &ldquo;do it daily&rdquo; backfires.</strong> More is not better with
        gratitude. Sonja Lyubomirsky found journaling it about <em>once a week</em> beat every day,
        because daily practice becomes a chore, the mind adapts, and you end up <em>performing</em>{' '}
        gratitude instead of feeling it. Keep it fresh, specific, and a little surprising: three
        genuine things beat fifteen rote ones.
      </Note>

      <H2>Mode 3: Write to understand</H2>
      <Figure
        src="/blog/write-to-understand.jpg"
        alt="A person seen from behind at a window, looking out over a wide, calm landscape at dawn"
        width={1216}
        height={800}
        caption="Close enough to be honest, far enough to be wise."
      />
      <P>
        The third mode is the most delicate, because it&apos;s the one that most easily goes wrong.
        When something painful happens, the natural move is to journal your way through it. Sometimes
        that helps. But it often collapses into <em>rumination</em>: you replay the event, relive the
        feeling, and end up worse. This is the danger our first post flagged, the reason venting
        isn&apos;t safe for everyone.
      </P>
      <P>
        Ethan Kross&apos;s research points to the fix, and it&apos;s remarkably specific:{' '}
        <strong>self-distancing.</strong> Instead of writing from inside the experience
        (&ldquo;<em>I</em> was humiliated, <em>I</em> can&apos;t believe <em>I</em>…&rdquo;), write
        about it from a step back, as an observer, even in the third person: &ldquo;Why did she feel
        that way? What was really going on?&rdquo; In{' '}
        <A href="https://journals.sagepub.com/doi/abs/10.1177/0963721411408883">
          study after study
        </A>, that small shift in vantage point stops the spiral, letting you <em>reconstrue</em> the
        event and make meaning instead of drowning in it. Grossmann and Kross even found that
        reasoning from a distance produced measurably <strong>wiser</strong> thinking, more
        willingness to see other perspectives, more humility about the limits of what you know.
      </P>
      <P>
        The lesson isn&apos;t &ldquo;don&apos;t write about hard things.&rdquo; It&apos;s{' '}
        <em>write about them from the right distance.</em> Close enough to be honest, far enough to
        be wise.
      </P>
      <Note>
        <strong>Same honest caveat as last time.</strong> For people at high risk of depression,
        even distanced reflection can worsen mood. None of these techniques is universally safe. If
        writing consistently leaves you worse, stop, and if you&apos;re struggling, talk to someone
        qualified. Argo is a tool for reflection, not treatment.
      </Note>

      <H2>The finding that unites both halves</H2>
      <P>
        Here&apos;s the twist that ties the whole thing together, and it comes from inside the{' '}
        <em>catharsis</em> research itself. When James Pennebaker and colleagues looked at{' '}
        <em>who actually got healthier</em> from expressive writing, the answer surprised everyone.
        It <strong>wasn&apos;t</strong> the people who vented the most emotion. It was the people
        whose writing <em>changed</em> over the days, evolving from raw, fragmented venting into a
        coherent story, marked by a rising use of <strong>insight words</strong> (<em>realize,
        understand, know</em>) and <strong>causal words</strong> (<em>because, cause, effect</em>).
      </P>
      <P>
        In other words: the dump only healed to the extent that it turned into <em>construction.</em>
        {' '}Emptying was the on-ramp. <strong>Building meaning was the destination.</strong> That
        single result dissolves the apparent contradiction between our two posts. Cathartic writing
        gets the noise out so you can think. Generative writing is the thinking. You often need both,
        in that order, clear the desk, then build something on it.
      </P>

      <H2>How to actually do it</H2>
      <P>You already know how to empty the page. Here&apos;s how to build on it:</P>
      <UL items={[
        <><strong>To think better,</strong> don&apos;t wait until you &ldquo;have something to say.&rdquo; Take the problem you keep circling and write your way through it until the page tells you something you didn&apos;t know you knew.</>,
        <><strong>To feel better,</strong> keep a <em>weekly</em> (not daily) list of what went well and <em>why</em>. Be specific and be surprised. Or spend fifteen minutes describing your best realistic future self.</>,
        <><strong>To understand something hard,</strong> write about it from a step back. Use your own name. Ask what was <em>really</em> going on, as if advising a friend. Aim for the wise version, not the raw one.</>,
        <><strong>Keep the two directions straight.</strong> A morning brain-dump and an evening &ldquo;three good things&rdquo; are different tools for different jobs. Don&apos;t expect a broom to build you a shelf.</>,
      ]} />
      <P>
        Strip it back, and the insight is this: the noise leaving your head was never the point. It
        was clearing space. <strong>What you build in that space, an idea, an appreciation, a piece
        of meaning, is where journaling actually changes you.</strong>
      </P>
      <P>
        That&apos;s the half of the practice we care about most. Emptying your mind is a good place
        to start your day. Building your mind is how you change your life, and it&apos;s exactly
        what Argo is designed to help you do: a daily entry in text, voice, or video, kept
        private and encrypted, and you choose what you share with the AI to help you see the ideas,
        patterns, and progress you&apos;d never catch alone. Not a drain. A workbench.
      </P>
    </>
  )
}

/* ── Post: The 750-word habit: who does it & why ── */
function SevenFiftyHabitContent() {
  return (
    <>
      <Figure
        src="/blog/hero-750-words.jpg"
        alt="An open blank journal, a fountain pen, and a cup of tea on a wooden desk in soft morning light"
        width={1440}
        height={800}
        priority
      />
      <P>
        There is a particular kind of person you can spot in a coffee shop at 6:45 a.m.:
        notebook open, pen moving, eyes half-focused, clearly not writing anything for anyone.
        They aren&apos;t drafting an email or working on a novel. They&apos;re filling three pages
        with whatever falls out of their head, grocery lists, grudges, dread about a meeting, a
        half-remembered dream, and then, most likely, they will never read it again.
      </P>
      <P>
        That&apos;s the practice: roughly <strong>750 words</strong>, every morning, first thing,
        unedited, and private. It has quietly become one of the most widely adopted personal
        habits of the last thirty years, kept by bestselling authors, startup founders,
        burned-out nurses, and people white-knuckling their way through a divorce. The obvious
        question is why anyone would do this. The more interesting one:{' '}
        <em>does it actually do anything?</em>
      </P>
      <P>
        We went looking across the original book that started it, the platform that digitized it,
        four decades of psychology research, and the diaries of people who&apos;ve kept it up for
        years. Here&apos;s what the practice is, why it works when it works, and the honest fine
        print nobody selling you a journal likes to mention.
      </P>

      <H2>Where 750 words came from</H2>
      <P>
        The number is an accident of arithmetic. In 1992, the writer and teacher Julia Cameron
        published <em>The Artist&apos;s Way</em>, which has since sold more than five million
        copies. Its central tool is something she called <em>Morning Pages</em>: three pages of
        longhand, stream-of-consciousness writing, done first thing in the morning, about
        absolutely anything.
      </P>
      <P>
        Three standard handwritten pages come out to roughly <strong>750 words</strong>, and
        Cameron chose that length deliberately. It&apos;s long enough to push past the polite,
        surface-level chatter of your mind and reach the material underneath, but short enough to
        finish in 30 to 45 minutes before the day swallows you.
      </P>
      <P>
        Fast-forward to 2009. A developer named Buster Benson loved the idea but not the paper, so
        he built <A href="https://750words.com/about">750words.com</A> to port Morning Pages into
        the digital age, a word counter, streaks, badges, and one promise a notebook can&apos;t
        make: that nothing you write will ever be seen by anyone. That last part turns out to
        matter enormously. So &ldquo;the 750-word practice&rdquo; is really Morning Pages with a
        progress bar, and the word count is a proxy for the real spec: long enough to get past
        yourself, short enough to actually do, private enough to be honest.
      </P>

      <H2>Who does it, and why</H2>
      <P>
        Writers and artists were the original audience. But the practice spread far beyond them.{' '}
        <A href="https://tim.blog/2015/01/15/morning-pages/">Tim Ferriss</A> does it nearly every
        morning with a cup of tea, and his description is the best summary of the practice
        anyone&apos;s written. He calls Morning Pages &ldquo;spiritual windshield wipers,&rdquo;
        and explains the whole point in a sentence:
      </P>
      <Pull>
        Morning pages don&apos;t need to solve your problems. They simply need to get them out of
        your head, where they&apos;ll otherwise bounce around all day like a bullet ricocheting
        inside your skull.
      </Pull>
      <P>
        The pages themselves are worthless; the clearing-out is the value. And when Benson
        analyzed{' '}
        <A href="https://medium.com/750-words/i-analyzed-15-years-of-testimonials-from-users-of-750words-com-to-learn-how-journaling-helped-them-9665c93814e8">
          more than 11,000 unsolicited notes
        </A>{' '}
        from his users over fifteen years, the reasons they gave were rarely about creativity.
        They wrote to survive things. One called the site their &ldquo;therapy dojo&rdquo; during
        a divorce. Others used it through grief and heartbreak, a place to put the weight down
        each morning so they could carry the day. Most people don&apos;t stick with this because
        it makes them better artists. They stick with it because it makes them feel better.
      </P>

      <H2>What the science actually says</H2>
      <Figure
        src="/blog/quiet-mind.jpg"
        alt="A tangle of glowing threads resolving into a single calm line of light"
        width={1216}
        height={800}
        caption="Naming a feeling is, neurologically, a way of untangling it."
      />
      <P>
        This is where the habit gets more interesting than a self-help fad, because it sits on top
        of one of the most-studied interventions in psychology. In 1986, the University of Texas
        psychologist James Pennebaker had people write for 15–20 minutes about their deepest
        thoughts and feelings. Four decades and{' '}
        <A href="https://pubmed.ncbi.nlm.nih.gov/17073523/">146 randomized studies later</A>, a
        meta-analysis confirmed the effect is real: lower anxiety and stress, better immune
        markers, fewer visits to the doctor. Modest in size, but remarkable for something so
        brief, portable, and nearly free.
      </P>
      <P>
        Brain imaging supplied the mechanism. In a 2007 UCLA study, simply putting a feeling into
        words was shown to{' '}
        <A href="https://sanlab.psych.ucla.edu/wp-content/uploads/sites/31/2015/05/Lieberman_AL-2007.pdf">
          reduce activity in the amygdala
        </A>, the brain&apos;s threat alarm, while engaging the prefrontal regions we use to
        reason (Lieberman et al., 2007). Psychologists call it <em>affect labeling</em>, and
        that&apos;s essentially what you&apos;re doing 750 words at a time. There&apos;s a tidy
        second mechanism, too: people who wrote a{' '}
        <A href="https://pubmed.ncbi.nlm.nih.gov/29058942/">
          to-do list before bed fell asleep about nine minutes faster
        </A>{' '}
        (Scullin et al., 2018). Externalizing your open loops frees the mind from holding them.
      </P>

      <H2>The honest fine print</H2>
      <Figure
        src="/blog/private-page.jpg"
        alt="A single closed journal resting in a pool of warm lamplight in a dark, quiet room"
        width={1216}
        height={800}
        caption="The most therapeutic page is the one no one (and no algorithm) will ever read."
      />
      <P>
        The effects are real but <strong>modest</strong>. A 2022 review pooling{' '}
        <A href="https://pmc.ncbi.nlm.nih.gov/articles/PMC8935176/">
          20 randomized trials of journaling
        </A>{' '}
        found roughly a 5% greater reduction in symptoms versus control, meaningful for anxiety,
        smaller for depression. This is a low-cost, low-side-effect <em>edge</em> that compounds,
        not a cure. Anyone promising transformation is overselling.
      </P>
      <P>
        And the creativity claim (the origin story&apos;s headline) is the one the research
        supports <em>least</em>. The strong evidence is for emotional regulation and clarity; a
        calmer, less-cluttered mind is simply a better instrument, and the art tends to happen
        later, off the page.
      </P>
      <P>
        There&apos;s a finding almost nobody mentions, and it&apos;s the most important one: in
        that same meta-analysis, the studies where researchers <em>collected and read</em>{' '}
        participants&apos; journals produced <strong>worse</strong> outcomes. The moment you write
        for an audience (even a well-meaning one) your neocortex refuses to let its guard down.
        Privacy isn&apos;t a nice-to-have; it&apos;s the active ingredient. It&apos;s also a quiet
        warning for the current wave of AI-powered journaling apps: a journal that gets analyzed
        may be undermining the very mechanism it&apos;s selling.
      </P>
      <Note>
        <strong>It&apos;s not for everyone.</strong> For most people, writing out a dark thought
        discharges it. But for people prone to depression, the same act can give negative thoughts
        more power and feed circular rumination. The rule is simple: if the practice consistently
        leaves you feeling worse, it isn&apos;t working: stop, or switch to structured or
        gratitude prompts. Argo is a tool for reflection, not treatment; if you&apos;re
        struggling, talk to someone qualified.
      </Note>

      <H2>Why people can&apos;t seem to quit</H2>
      <Figure
        src="/blog/daily-compounding.jpg"
        alt="A winding path of small warm lights receding toward a glowing dawn horizon"
        width={1216}
        height={800}
        caption="Not one big payoff, a small daily one that compounds."
      />
      <P>
        Given that the effects are modest, why do so many people keep at it for years? Buried in
        those 11,000 testimonials, Benson found a loop that feeds itself. You process an emotion
        and gain a little clarity. That clarity rebuilds confidence, you start to see your own
        patterns. The unbroken streak becomes an identity: you&apos;re someone who writes. The
        cleared mind creates. And a solved problem or a good idea sends you back to the page
        tomorrow to do it again.
      </P>
      <P>
        That&apos;s why the habit, once it takes, tends to hold. It isn&apos;t one big reward.
        It&apos;s a small, daily, compounding one.
      </P>

      <H2>How to actually do it</H2>
      <UL items={[
        <>Write about 750 words, or three pages, <strong>first thing</strong>: before email, before the phone.</>,
        <>By hand if you can (&ldquo;velocity is the enemy&rdquo;); if a keyboard is what gets you to do it, use that. Consistency beats purity.</>,
        <>Write badly, on purpose. Page one is usually junk; page three is where the honest material arrives.</>,
        <>Keep it radically private, no audience, no rereading required, no algorithm summarizing it. That&apos;s the mechanism, not a preference.</>,
        <>Don&apos;t try to solve anything. You&apos;re emptying your head so you can go live your day.</>,
      ]} />
      <P>
        Strip away the mysticism and the number, and the 750-word habit is a plain, daily act of
        putting what your brain is carrying into words, so it can stop carrying them. It won&apos;t
        make you an artist. It won&apos;t fix your problems. It&apos;ll just get the bullet out of
        your skull so you can get on with your day. For millions of people, every morning, that
        has turned out to be enough.
      </P>
      <P>
        That&apos;s exactly what Argo is built for, a substantial daily entry, in text,
        voice, or video, kept private and encrypted, and you choose what you share with the AI so
        the honest version always stays yours.
      </P>
    </>
  )
}

/* ── Post: The science of 750 words a day ── */
function SevenFiftyWordsContent() {
  return (
    <>
      <P>
        You already know the day got away from you. You reacted to it instead of thinking
        through it. Decisions got made on a full head. You lay down at night and your mind
        kept running, a dozen open loops, none of them closed. By morning, whatever insight
        you had is gone.
      </P>
      <P>
        Daily journaling is the oldest fix for this, and it turns out to be one of the
        best-studied ones. For forty years, researchers have handed people a pen and a few
        quiet minutes and measured what happens next, to their focus, their stress, their
        sleep, even their immune systems. The findings are consistent enough, and the cost is
        low enough, that it&apos;s worth understanding exactly what a substantial daily entry,
        on the order of <strong>750 words</strong>, actually does to your mind.
      </P>

      <H2>Where 750 words comes from</H2>
      <P>
        The number isn&apos;t arbitrary. It traces back to Julia Cameron&apos;s{' '}
        <em>Morning Pages</em> from <em>The Artist&apos;s Way</em>: three longhand pages,
        which come to roughly 750 words. The classic psychology studies used a close cousin of
        this (15 to 20 minutes of continuous writing) which for most people lands in the
        same several-hundred-to-750-word range. It&apos;s enough to get past the surface layer
        of logistics and venting and into the part where you write the thing you didn&apos;t
        know you were thinking.
      </P>
      <P>
        And 750 words is format-independent. Three handwritten pages, a typed entry, or about
        ten minutes of talking all land in the same place. The benefits below come from the
        act of getting your inner life <em>out</em>, not from how you do it.
      </P>

      <H2>1. It frees up your working memory</H2>
      <P>
        Your mind holds a limited amount at once. Every unresolved worry you&apos;re carrying
        quietly occupies some of that space. In a well-known experiment, students who wrote
        about a stressful experience showed a measurable{' '}
        <A href="https://www.scirp.org/reference/referencespapers?referenceid=1156600">
          increase in working-memory capacity
        </A>{' '}
        and fewer intrusive thoughts than students who wrote about something trivial
        (Klein &amp; Boals, 2001). Writing a worry down seems to let the brain mark it as
        &ldquo;handled&rdquo; and stop recycling it.
      </P>
      <P>
        This isn&apos;t only about feeling calmer, it shows up in performance. When
        researchers had anxious students{' '}
        <A href="https://www.science.org/doi/abs/10.1126/science.1199427">
          write for ten minutes before an exam
        </A>, their scores went up, closing much of the gap with their calmer peers
        (Ramirez &amp; Beilock, 2011). The anxiety was still there. It just no longer ate the
        mental bandwidth they needed to think.
      </P>
      <Pull>
        Getting the noise out of your head isn&apos;t indulgent. It&apos;s what clears the
        bandwidth to think clearly and decide well.
      </Pull>

      <H2>2. Naming a feeling turns down its volume</H2>
      <P>
        When you put a feeling into words, something measurable happens in the brain.
        Neuroscientists watching people label their emotions found that the act{' '}
        <A href="https://sanlab.psych.ucla.edu/wp-content/uploads/sites/31/2015/05/Lieberman_AL-2007.pdf">
          reduces activity in the amygdala
        </A>, the brain&apos;s alarm center, while engaging the prefrontal regions we use to
        reason (Lieberman et al., 2007). Psychologists call it <em>affect labeling</em>, and a
        later review described it as a kind of{' '}
        <A href="https://journals.sagepub.com/doi/10.1177/1754073917742706">
          emotion regulation that doesn&apos;t even feel like effort
        </A>{' '}
        (Torre &amp; Lieberman, 2018).
      </P>
      <P>
        A journal is affect labeling at scale. &ldquo;I&apos;m stressed about the launch
        because I don&apos;t trust the timeline&rdquo; is a smaller, more workable thing than
        the vague dread you were carrying an hour earlier.
      </P>

      <H2>3. It measurably improves well-being, and even physical health</H2>
      <P>
        The foundational work here is James Pennebaker&apos;s. In his original study, people
        who wrote about their deepest thoughts and feelings for 15 minutes a day over four
        days showed improved immune markers and made fewer visits to the doctor in the months
        that followed. Four decades and{' '}
        <A href="https://pubmed.ncbi.nlm.nih.gov/17073523/">
          146 randomized studies later
        </A>, a meta-analysis confirmed the effect is real and positive (Frattaroli, 2006),
        modest in size, but remarkable given how brief, portable, and nearly free the practice
        is, and larger for people actually going through something hard.
      </P>
      <P>
        You don&apos;t have to write about pain to benefit. When people wrote about their{' '}
        <A href="https://journals.sagepub.com/doi/10.1177/0146167201277003">
          &ldquo;best possible future self&rdquo;
        </A>{' '}
        for 20 minutes a day, their well-being rose and (five months later) they&apos;d made
        fewer illness-related doctor visits (King, 2001). And people who kept a{' '}
        <A href="https://greatergood.berkeley.edu/pdfs/GratitudePDFs/6Emmons-BlessingsBurdens.pdf">
          gratitude journal
        </A>{' '}
        reported more optimism, exercised more, had fewer physical complaints, and slept
        better (Emmons &amp; McCullough, 2003).
      </P>

      <H2>4. It helps you fall asleep</H2>
      <P>
        The racing mind at bedtime has a surprisingly specific fix. In a controlled sleep lab,
        people who spent five minutes writing a{' '}
        <A href="https://pubmed.ncbi.nlm.nih.gov/29058942/">
          specific to-do list before bed fell asleep about nine minutes faster
        </A>{' '}
        than those who wrote about what they&apos;d already done (Scullin et al., 2018). Moving
        tomorrow&apos;s open loops out of your head and onto the page stops them from keeping
        you awake.
      </P>

      <H2>The one that matters most: it compounds</H2>
      <P>
        A single entry helps a little. The real returns come from doing it regularly. The most
        directly relevant modern study took adults with elevated anxiety and had them journal
        online for 15 minutes, three times a week, for twelve weeks. Compared with usual care,
        they ended up with{' '}
        <A href="https://mental.jmir.org/2018/4/e11290/">
          lower anxiety, greater resilience, and higher well-being
        </A>{' '}
        (Smyth et al., 2018).
      </P>
      <P>
        This is where a daily practice quietly changes things a single vent never could. Do it
        for weeks and patterns you can&apos;t see day-to-day become obvious: the worry that
        keeps returning, the decision you keep circling, the gap between what you say matters
        and where your attention actually goes. Your scattered days start adding up to
        self-knowledge.
      </P>

      <Note>
        <strong>An honest note.</strong> The effects above are real but modest, and they show
        up most for people under genuine strain. Journaling is a low-cost daily edge that
        compounds, not a cure, and not a substitute for professional care. If you&apos;re
        struggling, talk to someone qualified. Argo is a tool for reflection, not
        treatment.
      </Note>

      <H2>Why Argo is built around 750 words</H2>
      <P>
        Everything above points to the same practice: a substantial daily entry, done
        consistently, in whatever format gets you past the surface. That&apos;s exactly what
        Argo is designed for.
      </P>
      <UL items={[
        <>A daily 750-word goal that&apos;s enough to reach real depth, framed as an invitation, never guilt.</>,
        <>Capture in text, voice, or video: talk for ten minutes on a walk and reach the same depth as three written pages.</>,
        <>AI summaries that turn a rambling brain-dump into something you can actually review and act on.</>,
        <>Insights that surface the patterns across weeks you&apos;d never catch alone.</>,
        <>Private and encrypted, and you choose what you share with the AI, because you can only write the honest version if it stays yours.</>,
      ]} />
      <P>
        Your mind moves faster than your day. Seven hundred and fifty words is how you catch up
        with yourself.
      </P>
    </>
  )
}

/* ── Post: The Soul Constellation ── */
function SoulConstellationContent() {
  return (
    <>
      <P>
        Every journaling app gives you a streak. A number, a flame, a chain of little
        squares. And every one of them shares the same quiet flaw: <strong>you don&apos;t
        own it.</strong> It lives in someone else&apos;s database. You can&apos;t take it with
        you. You can&apos;t prove it to anyone. And it vanishes the day the company does.
      </P>
      <P>
        We think the record of your own reflection, one of the most personal things you can
        build, deserves better than that. So we&apos;re building something different: a
        living piece of art, grown entirely from your journaling, that is provably yours,
        provably earned, and impossible to fake. We call it the <strong>Soul
        Constellation.</strong>
      </P>

      <H2>What it is</H2>
      <P>
        Your journaling, rendered as a galaxy. A three-dimensional field of stars where{' '}
        <strong>every star is a day you showed up and reflected</strong>, a day you crossed
        your 750-word goal. It grows only when you do the work. And where each star sits in the
        galaxy is decided by the <em>meaning</em> of what you actually wrote that day, so no two
        souls are ever alike. It&apos;s a fingerprint of your inner life, drawn by you.
      </P>
      <Pull>
        Every star is a day you showed up. The shape of the galaxy is the shape of your mind.
      </Pull>

      <H2>How it works</H2>
      <P>
        The idea is simple even though the machinery underneath is careful. Here&apos;s the
        whole journey, start to finish:
      </P>
      <UL items={[
        <><strong>You journal.</strong> Write in Argo the way you already do, typed, spoken, or filmed.</>,
        <><strong>You earn a star.</strong> Cross 750 words in a day (the amount the science says gets you past the surface, <A href="/blog/the-science-of-750-words-a-day">more on that here</A>) and a new star is born.</>,
        <><strong>The star is placed by meaning.</strong> Everything you wrote that day is distilled into a single mathematical fingerprint of its meaning. We then lay out the whole galaxy along the directions your days differ most, so <strong>similar days cluster, and distinct days spread apart.</strong></>,
        <><strong>It updates itself.</strong> Every new star reshapes the picture a little, sharpening the map of who you are as the months accumulate.</>,
        <><strong>It&apos;s yours, with no wallet to set up.</strong> On your first sign-in we quietly create a wallet for you and mint the artifact to it. No seed phrase, no coin to buy, no gas fees. You just watch your soul grow.</>,
      ]} />
      <P>
        Under the hood it&apos;s a <strong>soulbound token</strong>, a non-transferable NFT.
        But the blockchain does exactly one quiet job here: it makes your constellation provably
        yours and impossible to counterfeit. That&apos;s all. No trading, no speculation, no
        market. The crypto is invisible, and it works for you in the background.
      </P>

      <H2>Your words never leave your side</H2>
      <P>
        This is the part we care about most. Your journal is sacred, and none of it, not your
        entries, not the mathematical fingerprints we compute from them: is ever put on a
        blockchain or exposed to anyone.
      </P>
      <P>
        The only thing that ever gets published is <strong>three numbers per star</strong>: its
        position in space. Those three coordinates are a deliberately lossy shadow of a
        thousand-dimensional fingerprint, a shadow that <strong>cannot be reversed back into
        your writing.</strong> It&apos;s the difference between a shadow on the wall and the
        object that cast it: you can see the shape, but you can never reconstruct the thing
        itself. Privacy isn&apos;t a promise we&apos;re asking you to trust, it&apos;s built
        into the math.
      </P>

      <H2>Why it matters</H2>
      <P>
        Three things change the moment your reflection becomes something you own:
      </P>
      <UL items={[
        <><strong>You finally own it.</strong> Minted to your wallet, it outlives the app, the account, even us. It&apos;s the first journaling artifact that is genuinely yours to keep.</>,
        <><strong>It can&apos;t be faked.</strong> Because it&apos;s soulbound (un-buyable, un-giftable, non-transferable) a 365-star soul is <em>proof</em> of 365 real days of reflection. You cannot purchase discipline. That&apos;s exactly what makes it worth having.</>,
        <><strong>It can open doors.</strong> An uncheatable record of showing up is a kind of credential. Today it&apos;s a keepsake; tomorrow it could be a passport into communities, cohorts, and programs that reward the people who genuinely do the inner work.</>,
      ]} />
      <P>
        And beneath all of that, it&apos;s simply <strong>beautiful</strong>: a piece of
        generative art you&apos;d actually want to look at, watch grow, and share. Not a vanity
        metric. Not a flex. A mirror of a life examined, that happens to be yours forever.
      </P>

      <H2>Why we&apos;re doing this</H2>
      <P>
        We started Argo on a simple belief: in a world engineered to pull your attention
        outward, the most valuable thing we can build is a way back to yourself. Journaling is
        that way back. The Soul Constellation is us asking the next question, <em>if you do
        this quiet, difficult, meaningful work every day, what should you have to show for it?</em>
      </P>
      <P>
        Our answer is: something real. Something that&apos;s yours. Something no one can take,
        fake, or buy. A galaxy grown from your own words, proof, in the end, of a life you
        actually paid attention to.
      </P>

      <Note>
        <strong>Building in the open.</strong> The engine that turns your journaling into a
        constellation is built and working. The wallet, the on-chain token, and the interactive
        galaxy you&apos;ll hold in your hand are rolling out in stages, starting on a test
        network, then live. We&apos;re sharing the <em>why</em> now because we think the idea is
        worth talking about before it&apos;s finished.
      </Note>
      <P>
        Own the shape of your mind. A galaxy you can&apos;t buy, only earn.
      </P>
    </>
  )
}

/* ── Post: Rumination vs. journaling ── */
function RuminationContent() {
  return (
    <>
      <Figure
        src="/blog/rumination-hero.jpg"
        alt="A person alone at a desk at night, a cold blue loop of light circling their head while an open journal glows warm amber in front of them"
        width={1536}
        height={1024}
        priority
      />
      <P>
        You know the loop. It&apos;s 1 a.m. and the ceiling has become a screen replaying the thing
        you said in the meeting, the text that went unanswered, the version of your life where you
        made the other choice. You aren&apos;t solving anything. You aren&apos;t even really thinking.
        You&apos;re <em>circling</em>, the same thoughts, the same feelings, worn smoother each pass
        like a stone in a stream.
      </P>
      <P>
        Psychologists have a precise name for this: <strong>rumination.</strong> And decades of
        research have landed on an uncomfortable finding, rumination isn&apos;t just a symptom of
        feeling bad. It&apos;s one of the most reliable <em>predictors</em> of who will become
        clinically depressed, and who won&apos;t.
      </P>
      <P>
        Here&apos;s the twist worth an entire post. There is a habit that looks almost identical to
        rumination (sitting alone with your hardest thoughts and feelings, turning them over) that
        produces the <em>opposite</em> result. It measurably improves mood, immune function, even how
        fast people find work after a layoff. That habit is <strong>writing.</strong> Same raw
        material, opposite outcome. This is the story of what separates them, and how to stay on the
        right side of the line.
      </P>
      <P>
        We read across roughly twenty primary sources for this, the foundational work of Susan
        Nolen-Hoeksema, James Pennebaker, and Ethan Kross, plus several meta-analyses. Where the
        evidence is strong we&apos;ll say so. Where it&apos;s thinner than the internet pretends,
        we&apos;ll say that too.
      </P>

      <H2>Rumination isn&apos;t &ldquo;thinking about your problems&rdquo;</H2>
      <Figure
        src="/blog/the-loop.jpg"
        alt="A smooth grey stone caught in a slow circular eddy of a dark stream, ripples spiraling outward"
        width={1536}
        height={1024}
        caption="The same thought, worn smoother each pass. Circling is not processing."
      />
      <P>
        The word comes from cattle, the way a cow brings food back up to chew again. The late Yale
        psychologist Susan Nolen-Hoeksema borrowed it for a specific mental habit and built a research
        program around it. Her{' '}
        <A href="https://journals.sagepub.com/doi/10.1111/j.1745-6924.2008.00088.x">definition</A>{' '}
        is worth reading slowly: rumination is <em>repetitively and passively focusing on symptoms of
        distress and on the possible causes and consequences of these symptoms</em>, while{' '}
        <strong>not</strong> moving toward doing anything about it.
      </P>
      <P>
        Every word earns its place. <em>Repetitive. Passive.</em> Focused on the distress itself
        rather than on the next step. You can spend two hours &ldquo;thinking about your problems&rdquo;
        and, if you&apos;re ruminating, come out the other side having solved nothing and feeling
        worse.
      </P>
      <P>
        What makes researchers take it so seriously is the timeline: rumination shows up{' '}
        <em>before</em> the depression. Measure people&apos;s rumination first, follow them forward,
        and the ruminators are the ones who tip into a depressive episode. In one community sample of
        about <strong>1,300 adults</strong>, baseline rumination predicted <em>new onsets</em> of
        major depression over the following year among people who weren&apos;t depressed to begin
        with. And it behaves like a stable trait, not a passing mood: in bereaved adults tracked over
        18 months, rumination scores held remarkably steady even as their sadness lifted.
      </P>

      <H2>The fork in the road: brooding vs. reflection</H2>
      <Figure
        src="/blog/brooding-vs-reflection.jpg"
        alt="A forked path at dawn: one branch descends into cold grey mist, the other turns uphill into warm golden light"
        width={1536}
        height={1024}
        caption="Same starting point, opposite destinations. The difference isn&rsquo;t whether you look inward, it&rsquo;s how."
      />
      <P>
        This is where the science gets useful, and where &ldquo;stop overthinking!&rdquo; gets it
        wrong. When researchers statistically dissected rumination, it split cleanly into{' '}
        <A href="https://link.springer.com/article/10.1023/A:1023910315561">two different things</A>:
      </P>
      <UL items={[
        <><strong>Brooding</strong>, a passive comparison of your situation to some standard you&apos;ve fallen short of. The self-critical voice: <em>&ldquo;Why do I always react this way? What&apos;s wrong with me?&rdquo;</em> Brooding predicts <strong>more</strong> depression over time.</>,
        <><strong>Reflection</strong>, purposefully turning inward to problem-solve. It looks similar in the moment, but it predicts <strong>less</strong> depression a year later.</>,
      ]} />
      <P>
        That distinction is the hinge the whole topic turns on. The problem was never introspection.
        People who reflect on their difficulties often feel worse in the moment, that&apos;s{' '}
        <em>why</em> they&apos;re reflecting, yet they end up better off later. Brooders feel bad and
        stay bad. The toxic ingredient is the passive, self-critical, going-in-circles quality of
        brooding, not the act of looking inward. Hold onto that, because it&apos;s exactly the lever
        writing lets you pull.
      </P>

      <H2>How a thought loop becomes a disorder</H2>
      <P>
        Why is brooding so corrosive? The research points to several converging mechanisms, and the
        experiments are causal, not just correlational. When you <em>induce</em> rumination in the
        lab, distressed people become measurably more pessimistic, recall more negative memories, and
        rate their problems as more unsolvable. The same task does nothing to people who aren&apos;t
        already down. Rumination amplifies whatever mood you bring to it.
      </P>
      <P>
        It also freezes you. Depressed ruminators often recognize that some activity would lift their
        mood, and still won&apos;t do it. In one striking study, women with a chronic ruminative
        style who found a breast lump <strong>delayed seeking care by more than two months</strong>{' '}
        versus non-ruminators. The loop doesn&apos;t just hurt; it makes you inert.
      </P>
      <P>
        And it keeps the body&apos;s alarm ringing. Normally, face the same stressor twice and your
        cortisol response <em>shrinks</em> the second time. But people who ruminated more after an
        initial stress test showed a <em>larger</em>, non-habituated cortisol response to the same
        stressor the next day (a correlation of{' '}
        <A href="https://pmc.ncbi.nlm.nih.gov/articles/PMC4165793/">0.51</A>), independent of their
        baseline mood. Rumination blocks your stress system from standing down.
      </P>
      <P>
        One last thing raises the stakes: rumination isn&apos;t depression-specific. A meta-analysis
        of 114 studies found that, of six common ways people manage emotion, rumination had{' '}
        <A href="https://pubmed.ncbi.nlm.nih.gov/20015584/">the largest association</A> with
        psychopathology overall, depression, yes, but also anxiety, eating disorders, and substance
        abuse. It may be a single engine feeding many kinds of suffering. Which makes learning to
        interrupt it one of the higher-leverage moves in all of mental health.
      </P>

      <H2>So why doesn&apos;t writing just make it worse?</H2>
      <Figure
        src="/blog/write-to-make-sense.jpg"
        alt="An open journal in warm light: tangled dark scribbles on the left page resolve into smooth threads of golden light on the right"
        width={1536}
        height={1024}
        caption="Writing that heals isn&rsquo;t venting louder. It&rsquo;s chaos resolving into a thread you can follow."
      />
      <P>
        If sitting alone with painful thoughts is so dangerous, how can writing them down help?
        Sometimes it doesn&apos;t. But done a particular way, it&apos;s close to the opposite, and the
        evidence goes back forty years to James Pennebaker. His original protocol was almost
        absurdly simple: write for <strong>15 minutes a night, four nights</strong>, about your
        deepest thoughts and feelings on the most upsetting experience of your life. Over the
        following six months, those writers{' '}
        <A href="https://www.apa.org/research/action/writing">visited the health center at
        roughly half the rate</A> of a control group who wrote about neutral topics. Later studies
        added better mood, improved immune markers, and (across a large literature) fewer doctor
        visits, lower blood pressure, better sleep, and faster re-employment after a layoff.
      </P>
      <Note>
        <strong>The honest fine print.</strong> These effects are real and replicated, but{' '}
        <em>modest.</em> One review put the average benefit around{' '}
        <A href="https://www.cambridge.org/core/journals/advances-in-psychiatric-treatment/article/emotional-and-physical-health-benefits-of-expressive-writing/ED2976A61F5DE56B46F07A1CE9EA9F9F">d = 0.47</A>{' '}
        in healthy people; the largest meta-analysis, pooling 146 studies, found an overall effect of
        just <A href="https://pubmed.ncbi.nlm.nih.gov/17073523/">r = 0.075</A>, small, though real.
        Journaling is a genuine, no-side-effect nudge in the right direction. It is not a cure, and
        anyone selling it as one is overselling.
      </Note>
      <P>
        The most important clue is <em>who</em> got better. It wasn&apos;t the people who wrote the
        most, or the most emotionally. When Pennebaker&apos;s team analyzed the language, the people
        who improved showed a <em>trajectory</em>: they started with few{' '}
        <strong>insight and causal words</strong>, <em>realize, understand, because, reason</em>,
        and used more of them by the last day. That&apos;s the fingerprint of a mind{' '}
        <em>making sense</em> of an experience, building an explanation, arriving somewhere new, not
        re-feeling the same raw emotion on repeat.
      </P>
      <Pull>
        Writing about the same story in the same way is really the same as rumination. It&apos;s
        almost a marker that writing is not beneficial., James Pennebaker
      </Pull>
      <P>
        There it is, from the founder of the field himself. Writing isn&apos;t automatically healing.
        Rehearse the same grievance in the same words every night and you&apos;re just ruminating with
        better handwriting. Three independent research programs all land on this one mechanism:
        Pennebaker&apos;s writing work (benefit tracks with rising <em>insight</em>, not repetition),
        Nolen-Hoeksema&apos;s rumination work (reflection heals, brooding harms), and Kross&apos;s
        distancing work (below). <strong>Repetition without reframing is rumination. Writing that
        moves toward meaning is the antidote.</strong> The page just happens to be an unusually good
        tool for forcing that move, a complete sentence has to lead somewhere the last one
        didn&apos;t.
      </P>

      <H2>The distance trick</H2>
      <Figure
        src="/blog/from-the-shore.jpg"
        alt="A lone figure on a calm shore at dawn watching a distant storm far out over the sea"
        width={1536}
        height={1024}
        caption="Close enough to be honest, far enough to be wise."
      />
      <P>
        The single most actionable finding comes from Ethan Kross and Özlem Ayduk. Why does trying to
        understand your feelings sometimes yield insight and sometimes spiral? Their answer is{' '}
        <strong>psychological distance.</strong> Analyze a painful memory from an{' '}
        <em>immersed</em> perspective (reliving it through your own eyes) and you get more upset and
        more ruminative. Analyze the same event from a <em>distanced</em> perspective, watching
        yourself from a step back, even in the third person, and you process it with cooler insight,
        and report{' '}
        <A href="https://journals.sagepub.com/doi/abs/10.1177/0963721411408883">fewer intrusive
        thoughts weeks later.</A>
      </P>
      <P>
        The mechanism: distance shifts you from <em>recounting</em> (rehashing the blow-by-blow, which
        reheats the emotion) toward <em>reconstruing</em> (drawing meaning, reaching closure). And a
        journal is a natural home for it, because the page is already a step outside your head.
        Writing &ldquo;<em>you</em> had a hard day, and here&apos;s why&rdquo; instead of
        &ldquo;<em>I</em> can&apos;t stop thinking about it&rdquo; is a tiny grammatical change that
        pulls you toward the shore.
      </P>

      <H2>The playbook: how to journal for growth, not rumination</H2>
      <P>
        Here are the techniques with the strongest evidence, how to actually do them, and a straight
        read on how solid the research really is.
      </P>
      <UL items={[
        <><strong>Expressive writing, for a specific wound.</strong> 15–20 minutes a day, three or four days running, on one genuinely unresolved experience. Ignore grammar; write only for yourself. The key: by the last day, push past re-narrating toward <em>why it happened and what it means.</em> If you&apos;re writing the same story the same way, stop. Use it as targeted medicine, not a daily vitamin. <em>(Strong evidence.)</em></>,
        <><strong>Self-distanced reflection, to process pain without spiraling.</strong> Write about the hard thing in the third person, using your own name, and ask &ldquo;why&rdquo; from that distance, aiming for insight, not a replay. <em>(Strong, with physiological data.)</em></>,
        <><strong>Best possible self, to build optimism.</strong> Imagine your life having gone as well as it realistically could, in vivid detail, ~20 minutes for a few days. Meta-analytic effect around <A href="https://pmc.ncbi.nlm.nih.gov/articles/PMC6756746/">d = 0.5</A> for positive emotion. <em>(Strong.)</em></>,
        <><strong>Gratitude, but weekly, not daily.</strong> List a few <em>specific</em> things you&apos;re grateful for about <A href="https://greatergood.berkeley.edu/pdfs/GratitudePDFs/6Emmons-BlessingsBurdens.pdf">once a week</A>. Doing it daily makes it mechanical and blunts the effect. Specificity beats volume. <em>(Strong, with a real frequency caveat.)</em></>,
        <><strong>Structured reframes, to turn loops into action.</strong> A CBT thought record (situation → automatic thought → evidence for and against → balanced thought) or <A href="https://woopmylife.org/en/practice">WOOP</A> (Wish, Outcome, Obstacle, then an if-then Plan) converts a spiral into a next step, fixing rumination&apos;s fatal flaw: insight that never becomes action. <em>(Strong for the parent methods.)</em></>,
        <><strong>Morning pages / free-writing, popular, but unproven.</strong> Millions swear by it; it has no dedicated controlled research. Likely useful by overlap with expressive writing, just don&apos;t let it curdle into a daily venting loop. <em>(Weak / anecdotal, and we&apos;ll be honest about that.)</em></>,
      ]} />
      <P>
        Strip away the specifics and the same design rules emerge every time, the checklist that
        separates growth journaling from rumination on paper:
      </P>
      <UL items={[
        <><strong>Time-box it.</strong> Rumination is unbounded by definition; every effective protocol has a clock.</>,
        <><strong>Move toward meaning or action, never stop at the feeling.</strong> If the entry could&apos;ve been written word-for-word yesterday, you&apos;re brooding.</>,
        <><strong>Get distance on the hard stuff.</strong> Ask &ldquo;why&rdquo; about <em>you</em>, from the shore, not from inside the wave.</>,
        <><strong>End facing forward.</strong> A reframe, an if-then plan, one next action. That&apos;s the step rumination can never take, and the one that turns writing into growth.</>,
      ]} />
      <Note>
        <strong>An honest caveat.</strong> None of these techniques is universally safe. For people at
        high risk of depression, even distanced reflection can worsen mood. If writing consistently
        leaves you worse, stop, and if you&apos;re struggling, talk to someone qualified. Argo
        is a tool for reflection, not treatment.
      </Note>
      <P>
        The same 1 a.m. thoughts that keep you circling can become the raw material of actually
        growing, if you change what you do with them. Move from re-feeling to making sense, from up
        close to a step back, from the problem to the next step. That&apos;s the whole difference
        between the loop and the page, and it&apos;s exactly what Argo is built to help you do: a
        daily entry in text, voice, or video (private and encrypted) and you choose what you
        share with the AI to help you see the patterns, insights, and progress you&apos;d never catch
        while circling. Not a drain. A way out.
      </P>
    </>
  )
}

/* ── Post: The Signals of Life (interview with Koss) ── */
function KossSignalsContent() {
  return (
    <>
      <Figure
        src="/blog/koss-ethereum-biomarkers-and-the-signals-of-nature-1.jpg"
        alt="Two people sitting on a couch at Network School at the start of a filmed conversation"
        width={3840}
        height={2160}
        caption="Some conversations start with a handshake. This one started with six breaths."
        priority
      />
      <P>
        Some conversations start with a handshake. This one started with six breaths.
      </P>
      <P>
        I sat down with <strong>Koss</strong>, a builder I met at Network School, though we&apos;d
        apparently crossed paths somewhere before that, for one of an ongoing series of chats with
        people in technology doing interesting things. Koss goes by a pseudonym (his real last name, he
        says, is &ldquo;very long&rdquo;), grew up between Venezuela and Europe, and has spent the better
        part of a decade in and around Ethereum. What made the conversation worth publishing wasn&apos;t
        the crypto r&eacute;sum&eacute;, though. It was where his curiosity is pointed now.
      </P>

      <H2>It starts with six breaths</H2>
      <P>
        Before any of the &ldquo;so, who are you&rdquo; questions, we took six slow breaths together,
a small ritual to reset the nervous system and actually arrive in the room. Koss&apos;s
        take: you can get good at anything if you practice it, and breathing is no exception. &ldquo;That
        skill is your mind&ndash;body connection.&rdquo; It&apos;s a fitting way to open a conversation
        that keeps circling back to the same question, how do we pay better attention to what&apos;s
        actually happening, in ourselves and around us?
      </P>

      <H2>From hyperinflation to Ethereum</H2>
      <P>
        Koss&apos;s route into crypto was, in his words, &ldquo;kind of easy.&rdquo; Growing up in a
        country living through hyperinflation, thousands, then hundreds of thousands, then millions
        of percent, makes the question <em>what could sound money mean for a financial system?</em>{' '}
        feel less theoretical. Bitcoin, arriving around 2009&ndash;2010, was the first crack of light. But
        he couldn&apos;t stop at money.
      </P>
      <P>
        When the DAO came around, Ethereum felt closer to what he actually cared about: not just financial
        applications, but governance. That pulled him into years of work in decentralized governance,
on-chain mutual credit, managing commons goods on-chain in the spirit of Elinor
        Ostrom&apos;s work, community after community. His day job now is in decentralized storage, but the
        through-line has always been the same: <strong>we need new systems, and the interesting part is how
        you govern them.</strong>
      </P>

      <H2>Community as an excuse to connect</H2>
      <P>
        Koss has been organizing communities &ldquo;since forever&rdquo; Ethereum Venezuela,
        civic-innovation groups, a Singularity University chapter, meetups that ran from roughly 2015 until
        the pandemic. His framing of <em>why</em> is the most useful thing anyone&apos;s said to me about
        events in a while. An organized gathering, he says, is really just a good excuse: to read the
        things you were already going to read, to meet people chasing similar questions, to flesh out your
        own half-formed ideas out loud, and (crucially) to talk to people you admire.
      </P>
      <Pull>
        Reach out to your heroes. It&apos;s courageous, and most people shy away from it. That&apos;s
        exactly why it works.
      </Pull>
      <P>
        The payoff compounds. He described an early online Venezuela event featuring one of the founders of
        Axie Infinity, who then turned up at Network School years later. &ldquo;Connections compound
        over time.&rdquo;
      </P>

      <H2>A social network built on biology</H2>
      <Figure
        src="/blog/koss-ethereum-biomarkers-and-the-signals-of-nature-2.jpg"
        alt="Koss gesturing with open hands while describing a social network based on biomarkers"
        width={3840}
        height={2160}
        caption="What would it mean to connect people by how they actually feel in a room, not how they perform online?"
      />
      <P>
        Here&apos;s where the conversation tipped into the frontier stuff. Koss held a role at IoTeX,
        working with data streaming off IoT devices, and came away &ldquo;underwhelmed&rdquo; by how little
        we do with those streams. That dissatisfaction has since branched into two obsessions.
      </P>
      <P>
        The first sounds like science fiction until you sit with it: <strong>a social network based not on
        how people perform online, but on how they actually feel in each other&apos;s presence.</strong>{' '}
        Telegram and WhatsApp connect us by text; what would it mean to connect people by biology,
        by the real, embodied signal of being in a room together?
      </P>
      <P>
        He&apos;s clear-eyed about the hard part. A biomarker on its own is close to meaningless. Someone
        with an elevated heart rate could be stressed, or thrilled, or both at once: &ldquo;I want to
        go to a metal concert; my body is getting all this stress signal, but at the same time I&apos;m in
        bliss.&rdquo; Context, he estimates, is 75% of correctly interpreting any single reading. You need
        more than one data point, across time, plus the environment around it. This isn&apos;t a gadget
        problem; it&apos;s a sense-making problem.
      </P>

      <H2>Reading the signals of life</H2>
      <P>
        The second obsession scales the same idea up from a person to a planet. Koss is drawn to
        interspecies research (the work of translating, say, the vocalizations of whales) and
        more broadly to the signals streaming off <em>all</em> of life: plants, animals, geology, even
        tectonic movement. What if that signal fed into the decisions we make?
      </P>
      <P>
        He&apos;s especially interested in <strong>bioregions</strong>, the stretch from southern
        Mexico through Central America, for instance, where climates, crops, and weather patterns behave
        similarly across national borders. Capture that signal with open hardware and put it on-chain, and
        something quietly radical happens: an ecosystem can be shown to have measurable, economic value. And
        economic value, sadly, is a language companies and governments speak far more fluently than
        &ldquo;the forest is nice, let&apos;s protect it.&rdquo;
      </P>
      <Figure
        src="/blog/koss-ethereum-biomarkers-and-the-signals-of-nature-3.jpg"
        alt="Koss describing how GainForest triangulates satellite, drone, and on-the-ground data"
        width={3840}
        height={2160}
        caption="GainForest triangulates: satellite data, drones over the canopy, and people on the ground."
      />
      <P>
        His model for doing this well is <strong>GainForest</strong> (the work of David and Charlie, whom
        he met through a Funding the Commons residency). A weather station in the woods isn&apos;t enough.
        GainForest triangulates: public satellite data (heavily filtered for clouds and noise), drones
        flying the canopy directly, and people on the ground: three independent ways of validating
        the same reality before anyone makes a decision from it.
      </P>
      <P>
        The logic he keeps returning to is simple and powerful: <strong>once you can measure something, you
        can manage it.</strong> And once you have clean raw data, you can point today&apos;s models at it.
        For most of history we were bottlenecked by single experts, thirty years to grow a PhD, a
        handful of good thinking-hours a day. Now you can throw state-of-the-art models at the data and
        surface patterns no one person could ever hold in their head, not to extract from a system,
        but to figure out how to coexist with it.
      </P>

      <H2>DevCon, and the &ldquo;global majority&rdquo;</H2>
      <P>
        The back half turned to community organizing at scale. Koss has been a fixture at DevCon
        (Bogot&aacute;, Bangkok) and DevConnect (Amsterdam, Buenos Aires), and is deep in planning for{' '}
        <strong>DevCon Mumbai</strong> later in 2026. His goal is to make it <em>cosmo-local</em>,
        following Michel Bauwens&apos;s language and the &ldquo;Ethereum localism&rdquo; work coming out of
        Portland and Denver, so a global event genuinely plugs into the place that hosts it. His own
        affiliations run through <strong>web3privacy now</strong> and the <strong>Cypherpunk Congress</strong>,
        and he&apos;s helping plan a week-long Network School activation ahead of the conference.
      </P>
      <P>
        One reframe stuck with me: the shift some crypto communities are making from talking about the
        &ldquo;global south&rdquo; to the <strong>&ldquo;global majority&rdquo;</strong>, a subtle
        but real change from <em>market to be captured</em> toward <em>bloc that aligns for itself</em>, as
        regions in Southeast Asia, Africa, and Latin America build stronger ties with one another.
      </P>

      <H2>Inventing the future</H2>
      <P>
        We wound down where these conversations often do, on the tension between roots and
        acceleration. Both of us grew up far from the center of things (Venezuela; Eastern Europe), and we
        share the sense of standing between two pulls: the deep connection to ancestors and centuries of
        human continuity on one side, and technology remaking the world every single day on the other.
        Industrial, electrical, computer, and now AI revolutions each force the same question: how do
        we want to live, together, and what do we actually value?
      </P>
      <P>
        Koss&apos;s answer, borrowing Alan Kay, is the note to end on: <strong>the best way to predict the
        future is to invent it.</strong> (And the name? &ldquo;Koss&rdquo; is short for Cosmo, itself short
        for <em>cosmostasis</em>, a play on homeostasis, balance held not just in a body but on a
        cosmic scale.)
      </P>

      <H2>Key takeaways</H2>
      <UL
        items={[
          'Lived experience of hyperinflation makes the case for sound money and better systems viscerally, not abstractly.',
          'Organizing a community is really an excuse to learn in public, meet your heroes, and let connections compound.',
          'A biomarker without context is noise; interpretation (time, environment, meaning) is most of the work.',
          'Measuring living systems (bodies, forests, bioregions) is what lets us value, manage, and protect them.',
          'Triangulate your data (satellite + drones + people on the ground) before you make decisions from it.',
          'Point AI at clean raw data to find patterns no single expert could, in order to coexist, not just extract.',
        ]}
      />
      <Note>
        This episode is part of an ongoing series of conversations with people in technology doing
        interesting things, recorded on the road at Network School. Find Konrad on Instagram at{' '}
        <A href="https://instagram.com/konradgnat">@konradgnat</A>.
      </Note>
    </>
  )
}

/* ── Post: Chopstick Robots (interview with Chong Ing Kai) ── */
function ChongIngKaiContent() {
  return (
    <>
      <Figure
        src="/blog/chong-ing-kai-stickem-1.jpg"
        alt="Two people sitting across a table with a microphone at Network School, at the start of a filmed conversation"
        width={1280}
        height={720}
        caption="Recorded an hour after a robot hackathon at Network School."
        priority
      />
      <P>
        I met <strong>Chong Ing Kai</strong> an hour after we&apos;d both spent a Saturday at a robot
        hackathon at Network School, a room of maybe forty kids and adults building machines out of
        what look like chopsticks. He&apos;s 22, the founder and CEO of <strong>Stick &apos;Em</strong>, and
        one of the more clear-headed builders I&apos;ve talked to in a while. So I asked him to tell me the
        whole story.
      </P>

      <H2>A maker who never stopped</H2>
      <P>
        Kai has been taking things apart and putting them back together since he was six or seven. For a few
        years that meant building <em>dangerous</em> things, flamethrowers, air cannons, tasers,
        &ldquo;things that harm people,&rdquo; as he put it cheerfully. The turn came in primary five, when
        his dad introduced him to Engineering Good, a Singapore nonprofit that pairs makers with people with
        disabilities. Building a button that lets someone who can&apos;t turn a lock open their own door
        taught him how powerful technology is when it&apos;s aimed at a real problem. He stopped building
        dangerous things and started teaching kids to build useful ones.
      </P>

      <H2>Why STEAM, and why it&apos;s broken</H2>
      <P>
        Stick &apos;Em exists to make STEAM education accessible. The &ldquo;A&rdquo; (arts) is
        the part people misunderstand. Kai&apos;s point is that Da Vinci was an inventor as much as a
        painter, and without that inventive, human streak &ldquo;people would just build boring computers and
        very boring things.&rdquo;
      </P>
      <P>
        But the deeper problem he saw as a robotics teacher was exclusion. &ldquo;When I looked at my
        classroom, everybody was a rich kid. 99% of them had the money.&rdquo; Every other school he visited,
        the kids were bored, because they weren&apos;t building anything, they were <em>copying</em> a
        robot off a screen. &ldquo;The whole approach to STEM education was so broken, so inaccessible, so
        exclusive. So what if I can build something to solve it?&rdquo;
      </P>
      <P>
        His answer is deliberately cheap and open-ended: chopstick-based robotics kits, ready-to-use lesson
        materials, and teacher training that takes three hours and works whether the teacher logs in from
        Uganda or shows up to a workshop in person. Some schools use it for robotics; others for English,
        math, or physics. &ldquo;Ultimately, Stick &apos;Em is just a tool for hands-on learning.&rdquo;
      </P>

      <H2>Problem clarity beats vibe-coding</H2>
      <P>
        I asked how a maker becomes a founder. His answer was about <strong>problem clarity</strong>.
        &ldquo;Y Combinator always said, build something people want. It&apos;s deceptively simple, the
        real question is how <em>many</em> people want it.&rdquo; Today&apos;s tools make it trivially easy to
        build things, he argues, which is exactly why so many entrepreneurs build things no one needs. Stick
        &apos;Em has run six years without a meaningful pivot, and he credits that entirely to having spent
        enough time inside a problem to actually understand it.
      </P>
      <Pull>
        Ten customers is easy, I can WhatsApp every one. Getting to the next thousand, the next ten
        thousand, is a completely different problem.
      </Pull>
      <P>
        Getting started was almost accidental. He built in public, the first 3D print of a Stick
        &apos;Em part was posted with a one-word, frustrated caption, and a teacher who followed him
        from his robotics days asked, &ldquo;What is this? Tell me more.&rdquo; That became the first
        customer, then a second, a third. Today Stick &apos;Em reaches roughly 35,000 students and 3,500
        teachers across 300&ndash;400 schools in 18 countries, with the most active markets clustered in
        Southeast Asia. The external validation has piled up too: Forbes 30 Under 30 at 21, Tatler, and a
        US$1M Hult Prize for social entrepreneurship, won against roughly 15,000 competing teams.
      </P>

      <H2>Don&apos;t guide the kids</H2>
      <P>
        His teaching philosophy is almost anti-instruction. &ldquo;At the core of it, it&apos;s really to{' '}
        <em>not</em> guide the kids.&rdquo; Give them a general problem statement, step back, and let them
        create, which is why nothing in that hackathon room looked the same. Problem-solving, he
        believes, doesn&apos;t come from sitting in front of a screen pressing buttons; it comes from touching
        and building things, immersed for four hours instead of scrolling TikTok.
      </P>
      <P>
        That belief extends to AI. Counterintuitively for a founder who&apos;s &ldquo;back coding
        nowadays,&rdquo; Kai would <em>delay</em> giving kids the tools. &ldquo;Creativity is like an
        instinct, an innate skill. If you don&apos;t sharpen it, if you chop it off and let the
        computer do it, you&apos;re cooked.&rdquo; Hand a kid a challenge and they throw it straight to
        ChatGPT; the packaged, perfect solution is, he thinks, exactly the wrong way to educate.
      </P>

      <H2>Two risks: almost jail, and the President of Singapore</H2>
      <Figure
        src="/blog/chong-ing-kai-stickem-2.jpg"
        alt="Chong Ing Kai gesturing with both hands while telling the story of flying to London for the Hult Prize"
        width={1280}
        height={720}
        caption="&ldquo;I go to jail for a week, it&rsquo;s not that bad, right?&rdquo; He went. They won."
      />
      <P>
        The best stretch of the conversation was about risk. Last September, Stick &apos;Em made the Hult
        Prize final in London, but Kai was in mandatory national service in Singapore and couldn&apos;t
        leave the country without permission. He calculated it: fly secretly, and if they win a million
        dollars, a week in jail is worth it. He went. They won.
      </P>
      <P>
        The second story is tamer but just as telling. Singapore&apos;s president publishes his email
        address. So Kai, fresh off the win, simply wrote to him, and within a week was shaking hands at
        the Istana. &ldquo;If I had a boring mentality, if I didn&apos;t dare to play outside the system, I
        wouldn&apos;t have taken the risk. The outcome is usually so much greater than the potential
        risk.&rdquo;
      </P>
      <Note>
        He&apos;s careful not to glorify it: risk-taking is also a <strong>privilege</strong>. Being able to
        attend Network School, he notes, means being able to pay for it: &ldquo;some random kid in
        Bangladesh can&apos;t take that risk&rdquo; and those who can should stay aware of it.
      </Note>

      <H2>Documenting a life, and the Experience Cube</H2>
      <Figure
        src="/blog/chong-ing-kai-stickem-3.jpg"
        alt="Chong Ing Kai and the interviewer discussing journaling and self-awareness"
        width={1280}
        height={720}
        caption="On journaling: observe, think, feel, want, and how most people stop at the first."
      />
      <P>
        We ended on something close to my own work, journaling. Kai connected it back to
        self-awareness and a framework he&apos;d just learned, the Experience Cube: what you{' '}
        <em>observed</em>, what you <em>thought</em>, what you <em>felt</em>, and what you <em>want</em>.
        &ldquo;Many people just observe. They don&apos;t think hard, don&apos;t notice how they feel,
        don&apos;t know what they want.&rdquo; Documenting, done honestly, is how you close that gap,
        the same reason Da Vinci filled notebooks the moment paper became affordable.
      </P>
      <P>
        Maybe the cleanest summary of Kai is a line he borrowed from Acumen&apos;s Jacqueline Novogratz: a
        good social entrepreneur holds the <em>tension</em> between making money and making impact, and never
        lets either side seduce them. He&apos;s very good at holding it.
      </P>

      <H2>Key takeaways</H2>
      <UL
        items={[
          <><strong>Problem clarity is the moat.</strong> Six years, no pivot, because he understood the problem before he built the product.</>,
          <><strong>Accessibility is a design choice.</strong> Chopsticks, three-hour training, and open-ended lessons are what let STEAM reach a floating village or a rural classroom.</>,
          <><strong>Don&apos;t guide the kids.</strong> Real problem-solving comes from building, not copying, and that&apos;s why he&apos;d delay AI, not rush it.</>,
          <><strong>Take the risk, but know it&apos;s a privilege.</strong> The upside usually dwarfs the downside: for those who can afford the downside.</>,
          <><strong>Hold the tension.</strong> Between profit and impact, awareness and ambition, giving in to either means you&apos;ve stopped.</>,
        ]}
      />
      <P>
        You can find Kai on Instagram at{' '}
        <A href="https://instagram.com/kaiiconic">@kaiiconic</A> and on LinkedIn, and Stick &apos;Em at
        @stickem.sg.
      </P>

      <H2>Listen to the Argo podcast</H2>
      <P>
        Subscribe on{' '}
        <A href="https://www.youtube.com/@luminalogpodcast">YouTube</A>{' '}and{' '}
        <A href="https://open.spotify.com/show/033Mu8Yn2ybRQIis1uKNv2">Spotify</A>.
      </P>
    </>
  )
}

/* ── Post: LLP#015: Building a Quantum-Proof Bitcoin (Chris of Quantus) ── */
function QuantumProofBitcoinContent() {
  return (
    <>
      <Figure
        src="/blog/quantum-proof-bitcoin-chris-quantus-hero.jpg"
        alt="Chris Smith (UV Lightman) in conversation at Network School, gesturing as he explains an idea across the podcast microphone"
        width={1280}
        height={720}
        priority
      />
      <P>
        Some conversations start with small talk. This one started with Fourier. Chris Smith and I
        first met in the Network School caf&eacute; months ago, and within minutes we were thirty
        deep into a French mathematician who was laughed out of academia for suggesting you could
        decompose any wave into its constituent frequencies, the same math that now underpins
        every piece of audio and video you touch. It was the perfect opening for a guest who moves
        fluidly between the technical and the human: Chris, known online as UV Lightman, is a
        founder, a musician, a comedian, and someone building a blockchain to survive a threat most
        people haven&apos;t started worrying about yet.
      </P>

      <H2>The threat is an efficient attack</H2>
      <P>
        Quantus exists because of a tip. Chris and his co-founder Joe heard that quantum computing
        was advancing faster than the public was being told, and if you know where to look,
        that&apos;s an alarming sentence. Modern cryptography rests on problems that are easy to
        state and astronomically hard to reverse: factoring large numbers (RSA), and elliptic-curve
        math. Shor&apos;s algorithm collapses both.
      </P>
      <Figure
        src="/blog/quantum-proof-bitcoin-chris-quantus-1.jpg"
        alt="Chris explaining Shor's algorithm and the threat quantum computing poses to Bitcoin's cryptography"
        width={1280}
        height={720}
        caption="The risk isn&rsquo;t that an attack exists, it&rsquo;s that an efficient one does."
      />
      <P>
        The framing Chris uses is the one worth keeping: the danger isn&apos;t that an attack exists,
every algorithm has known attacks. The danger is that an <em>efficient</em> attack
        exists. A well-designed system assumes even the world&apos;s biggest supercomputer would need
        thousands of years to break it. Shor&apos;s algorithm turns that from millennia into
        something tractable, provided someone builds the machine. Over a trillion dollars in Bitcoin
        currently sits on cryptography that a sufficiently capable quantum computer would peel open.
      </P>

      <H2>A &ldquo;new Bitcoin&rdquo; as a backstop</H2>
      <P>
        Quantus is a deliberate throwback. It&apos;s a proof-of-work chain focused entirely on the
        money use case, not a smart-contract platform. Chris built on Ethereum for years and
        respects it, but he&apos;s blunt that &ldquo;the average quality of a smart contract is
        somewhere between malicious and completely broken.&rdquo; So Quantus keeps the surface area
        small: 21 million coins, mined on your GPU, no ASICs, no KYC to acquire it.
      </P>
      <P>
        The pitch is audacious, and he knows it. VCs have told him he&apos;s crazy, not only
        launching an L1, but positioning it against Bitcoin itself. His answer is that someone has to
        solve this, the timelines are compressing (the US government has already cut its own quantum
        estimates by more than half), and it might as well be a Bitcoin-Cash veteran who once wrote
        the bootloader decompression running on your Samsung TV. Quantus isn&apos;t trying to replace
        Bitcoin so much as stand behind it: a backstop, ready to catch the net if the thing everyone
        is trusting quietly breaks.
      </P>

      <H2>What money actually is</H2>
      <P>
        The most clarifying stretch of the conversation isn&apos;t about quantum at all. It&apos;s
        about money. When Chris first encountered Bitcoin in 2011, the hardest part wasn&apos;t the
        peer-to-peer networking or the proof of work, it was understanding why anyone would
        call it money. Digging in, he found that money has been &ldquo;dramatically
        over-complicated.&rdquo; At its core it&apos;s almost embarrassingly simple: if I do things
        for you, my number goes up; if you do things for me, my number goes down. Everything else
 (consensus, mining, the elaborate machinery) exists so a group of strangers can
        agree on that ledger without trusting a single point of failure.
      </P>
      <Pull>
        There&apos;s an Argo lesson buried in there. The things we treat as impossibly complex
        often turn out to have a simple core we&apos;ve buried under jargon. Naming that core,
        putting it into plain words, is most of the work.
      </Pull>

      <H2>A warning from a stranger</H2>
      <P>
        The origin story has a cinematic beat. At a Token 2049 side event, Chris demoed a Bluetooth
        peer-to-peer chat app he&apos;d built, a geographic 4chan where you don&apos;t know who
        anyone is, but you know you&apos;ve shared a room with them. Afterward a man approached, said
        he worked for NIST, the agency that effectively decides what cryptography the US
        government, and much of the world, uses, and told him quantum computers were further
        along than anyone was admitting, and that the public would not be warned.
      </P>
      <Figure
        src="/blog/quantum-proof-bitcoin-chris-quantus-2.jpg"
        alt="Chris recounting the story of a stranger claiming to be from NIST who warned him about quantum progress"
        width={1280}
        height={720}
        caption="&ldquo;Does this guy really work for NIST? If so, why is he telling me this? If not, why is he telling me this?&rdquo;"
      />
      <P>
        Chris&apos;s reaction is the honest one: <em>does this guy really work for NIST? If so, why
        is he telling me this? If not, why is he telling me this?</em> You can&apos;t verify it. But
        it&apos;s the kind of signal that, combined with everything else, tips a person from thinking
        about a problem to building against it.
      </P>

      <H2>Local AI and the exocortex</H2>
      <P>
        When the conversation turned to Argo, the private, AI-assisted journaling
        practice this podcast is part of, Chris was thoughtfully cautious, and that&apos;s
        exactly why it&apos;s worth hearing. He&apos;s protective of his inner life; he doesn&apos;t
        want a model on his phone reporting his mind-state back to the network. But he lit up at the
        <em>idea</em> underneath it: AI as an exocortex. An external memory where the patterns that
        shape our lives (the ones that recur too infrequently to notice) could finally
        become visible. &ldquo;Imagine someone who knows everything about you,&rdquo; he said,
        &ldquo;and can tell you: in the past few relationships, you had this pattern.&rdquo;
      </P>
      <Figure
        src="/blog/quantum-proof-bitcoin-chris-quantus-3.jpg"
        alt="Chris reflecting on local AI, privacy, and the idea of AI as an exocortex for self-knowledge"
        width={1280}
        height={720}
        caption="His condition is sovereignty: run it locally, keep the key, don&rsquo;t trade self-knowledge for surveillance."
      />
      <P>
        His condition is sovereignty: run it locally, keep the key, don&apos;t trade self-knowledge
        for surveillance. That maps almost exactly onto why Argo is end-to-end encrypted. The
        tool should serve the human, not the other way around.
      </P>

      <H2>Both halves of the brain</H2>
      <P>
        We closed where Chris lives most comfortably, the seam between logic and intuition.
        &ldquo;God gave us two hemispheres,&rdquo; he said; treating yourself as a
        &ldquo;left-brain person&rdquo; or a &ldquo;right-brain person&rdquo; is a way of amputating
        half your capacity. Language, in his view, should be a set of toys you pick up, play with,
        and put down, never a master. He makes music as UV Lightman, writes a Substack called
        <em>weaponized schizophrenia</em> about cybernetics and sense-making, and points out that the
        very conversation we were having was improvised: nobody rehearsed it, and it worked fine. The
        plan-everything-or-it-fails instinct, he argues, is a profound misunderstanding of how your
        own mind already works.
      </P>

      <H2>Key takeaways</H2>
      <UL
        items={[
          <><strong>The real cryptographic risk is efficiency.</strong> Not that an attack exists, that an <em>efficient</em> one does. Shor&apos;s algorithm targets the RSA and elliptic-curve math securing most of the internet and over a trillion dollars in Bitcoin.</>,
          <><strong>Quantus is a narrow, quantum-secure backstop.</strong> A proof-of-work chain focused only on money, in case Bitcoin&apos;s cryptography fails.</>,
          <><strong>Money is simpler than we make it.</strong> A shared ledger of who did what for whom; the complexity exists to remove the trusted third party.</>,
          <><strong>AI&apos;s best use may be self-knowledge.</strong> An exocortex that surfaces your patterns, but only if it runs locally and keeps your sovereignty intact.</>,
          <><strong>Don&apos;t pick a hemisphere.</strong> Logic and intuition are tools that snap together, and most of what you do well, you already improvise.</>,
        ]}
      />
      <P>
        Links &amp; mentions:{' '}
        <A href="https://www.quantus.com/">Quantus</A> (mining at quantusminer.com), NEAR Protocol, ecdsa.fail, The Network
        State by Balaji Srinivasan, Boost VC / Draper University, Coinbase&apos;s Brian Armstrong,
        NIST, Token 2049, Buckminster Fuller, Norbert Wiener, Douglas Hofstadter&apos;s{' '}
        <em>G&ouml;del, Escher, Bach</em>, and Steven Levy&apos;s <em>Crypto</em>. Find Chris as UV
        Lightman (search &ldquo;yuvilightman&rdquo;) on X, YouTube, SoundCloud, and Spotify, and his
        Substack at weaponizedschizophrenia.com.
      </P>

      <H2>Listen to the Argo podcast</H2>
      <P>
        Subscribe on{' '}
        <A href="https://www.youtube.com/@luminalogpodcast">YouTube</A>{' '}and{' '}
        <A href="https://open.spotify.com/show/033Mu8Yn2ybRQIis1uKNv2">Spotify</A>.
      </P>
    </>
  )
}

/* ── Post: LLP#016: David Johnston (Morpheus / decentralized AI) ── */
function DavidJohnstonMorpheusContent() {
  return (
    <>
      <Figure
        src="/blog/david-johnston-morpheus-hero.jpg"
        alt="David Johnston in conversation with Konrad Gnat at Network School"
        width={1280}
        height={720}
        priority
      />
      <P>
        Some people chase trends. David Johnston seems to <em>feel</em> them arriving a few years
        early and then spend the next decade building at the front of the wave. When we sat down at
        Network School in Malaysia, his LinkedIn still listed his education as &ldquo;autodidact,
        self-taught polymath&rdquo; and by the end of the hour that felt less like a flex and
        more like an accurate description of how he&apos;s lived.
      </P>
      <P>
        He started his first multimillion-dollar company at 19. He got into Bitcoin in 2012. In 2013
        he wrote the paper that coined the term &ldquo;DApps&rdquo; decentralized
        applications, and helped shape the language Ethereum still uses to describe itself.
        Now he&apos;s the lead technologist on Morpheus, a permissionless network for decentralized
        AI. What connects all of it isn&apos;t a technology. It&apos;s a method, and a conviction.
      </P>

      <H2>The same method, every wave</H2>
      <P>
        Ask David how he built any given project and you get the same answer, scaled up or down.
        &ldquo;With every project, I come up with a thesis first.&rdquo; As a teenager, the thesis
        was that people would read books on the internet, so he aggregated 300 works of fiction and
        nonfiction into a subscription site called Wired Fiction, at 16, incorporating in
        Delaware to get himself released from a school he was bored by. Later the thesis was that
        scarcer crude oil would make renewables viable, so he raised $5.9 million to turn poultry fat
        into biodiesel in Maryland, then grew algae to beat the feedstock bottleneck and sold the
        biotech to ConocoPhillips.
      </P>
      <P>
        The mechanics never changed. &ldquo;A lot of times I&apos;ll just register a domain name. It
        gives it a name. And once something has a name, then it exists, because you can talk
        to people about it.&rdquo; Then a website, which forces the idea into real words. Then,
        crucially, building in public. He&apos;s convinced that keeping ideas secret is
        self-defeating: publishing the DApps paper, he says, is precisely what attracted every
        serious person thinking about tokens and protocols, and gave him far better conversations
        than secrecy ever could.
      </P>
      <Figure
        src="/blog/david-johnston-morpheus-1.jpg"
        alt="David Johnston explaining his four-part framework for a real decentralized application"
        width={1280}
        height={720}
        caption="David&rsquo;s four-part test for a real DApp (peer-to-peer, open source, a blockchain backend, and a token) became the framing Ethereum adopted."
      />

      <H2>From an uncensorable Linden dollar to &ldquo;DApps&rdquo;</H2>
      <P>
        The Bitcoin insight came from an unlikely place: Second Life. David had watched the virtual
        world&apos;s economy boom on its in-game currency, the Linden dollar, until, he
        recalls, regulators moved in around 2007 and shut down its most interesting uses overnight.
        The lesson stuck: a currency run by a company will inevitably be censored by a government. So
        when Bitcoin appeared, he understood it instantly. &ldquo;It&apos;s an uncensorable Linden
        dollar. There&apos;s no founder, no company in California, nobody&apos;s door to knock
        down.&rdquo;
      </P>
      <P>
        His DApps paper tried to generalize the Bitcoin model into a repeatable framework,
        peer-to-peer, open source, a blockchain backend, and a token to reward behavior. Ethereum
        adopted the framing so completely that &ldquo;a platform for smart contracts and
        decentralized applications&rdquo; became its subtitle. Some of the best moments in the
        conversation are the small human ones from that era, meeting a teenage Vitalik
        Buterin running the check-in desk at the Atlanta Bitcoin conference, then sneaking him into
        the bars afterward because he wasn&apos;t 21.
      </P>

      <H2>What Morpheus actually is</H2>
      <P>
        When AI&apos;s transformer breakthrough matured around 2022, David saw the pattern again:
        everything people had dreamed of doing with AI a decade earlier was suddenly possible,
        but it was consolidating into a handful of companies. His response was a 2023 paper coining
        &ldquo;smart agents&rdquo;: AI connected to a crypto wallet, so it can hold value and
        complete tasks, not just answer questions. The pseudonymous authors of Morpheus,
        named, fittingly, after Matrix characters, took that idea and added the missing piece:
        a network where anyone can connect powerful GPUs to those agents.
      </P>
      <P>
        Morpheus itself runs no hardware. It&apos;s a set of smart contracts on Ethereum and Base
        that coordinate a global marketplace: providers bring GPUs and open-source models (Llama,
        GLM, and others), users open a session and pay for inference, and the protocol records the
        work and hands out rewards, to people providing compute, code, and capital alike, with
        no pre-mine and no company. For privacy, providers can run inference inside trusted execution
        environments, chips like NVIDIA&apos;s H100 that decrypt your prompt only inside the
        silicon and re-encrypt the output, so even the person running the GPU can&apos;t read
        what you sent.
      </P>
      <Figure
        src="/blog/david-johnston-morpheus-2.jpg"
        alt="David Johnston describing how inference works on the Morpheus network"
        width={1280}
        height={720}
        caption="Morpheus runs no GPUs of its own, it&rsquo;s a marketplace where anyone can provide open-source model inference and get paid on-chain."
      />

      <H2>Own your AI, or be a serf</H2>
      <P>
        The throughline from Bitcoin to Morpheus is ownership, and it&apos;s where David gets most
        animated. &ldquo;The difference between people who own their AI and people who are owned by AI
        is going to be 100x over time.&rdquo; His analogy is holding your own Bitcoin keys versus
        leaving coins on an exchange: none of the exchanges he used in 2012 still exist, and anyone
        who trusted them lost everything. The equivalent today, he argues, is renting your
        intelligence from a company that can cancel your subscription, change the model, or hand your
        data to a government. &ldquo;Are you going to the library and using somebody else&apos;s
        computer? Or do you really own your own agent? Are you free, or are you a serf?&rdquo;
      </P>
      <Figure
        src="/blog/david-johnston-morpheus-3.jpg"
        alt="David Johnston delivering the closing argument on owning your own AI"
        width={1280}
        height={720}
        caption="The heart of the episode: David reframes the entire AI moment as a question of ownership."
      />
      <P>
        That question landed for me personally. The product I&apos;m building,{' '}
        <A href="https://Argo.com">Argo</A>, is a private AI journaling app: a
        space to think through your most personal thoughts, which is exactly the kind of thing you
        don&apos;t want flowing through someone else&apos;s servers. David&apos;s closing advice for
        builders was the same one he&apos;d have given in 2013, updated for the moment: get started,
        build in public, take small steps, and get an agent you actually own.
      </P>

      <H2>Key takeaways</H2>
      <UL
        items={[
          <>
            <strong>A thesis, a domain, and building in public</strong> is a method that scales from
            a teenage e-book site to a decentralized AI network.
          </>,
          <>
            <strong>Censorship resistance is a design goal, not a slogan</strong>: Morpheus is
            built to keep running regardless of any single government&apos;s AI policy.
          </>,
          <>
            <strong>Ownership compounds.</strong> Whether it&apos;s Bitcoin keys or your AI agent,
            the gap between owning and renting your tools widens over a lifetime.
          </>,
          <>
            <strong>Fair distribution builds durable networks</strong>, rewarding code,
            compute, and capital with no pre-mine echoes what gave early Ethereum its developer
            network effect.
          </>,
        ]}
      />

      <H2>Links &amp; mentions</H2>
      <UL
        items={[
          <>
            <A href="https://x.com/DJohnstonEC">David Johnston on X</A>, @DJohnstonEC
          </>,
          <>
            <A href="https://app.mor.org">Morpheus API for developers</A>, one button to a key
          </>,
          <>
            <A href="https://tech.mor.org">Morpheus privacy &amp; tech walkthrough</A>
          </>,
          <>
            <A href="https://mor.org">Morpheus</A>, the protocol&apos;s site
          </>,
          <>
            <A href="https://openclaw.xyz">OpenClaw</A>, one-click agent creation
          </>,
          <>Based AI, David&apos;s project built on open-weight models</>,
          <>Network School, Balaji Srinivasan&apos;s community, where this was recorded</>,
        ]}
      />

      <H2>Listen to the Argo podcast</H2>
      <P>
        Subscribe on{' '}
        <A href="https://www.youtube.com/@luminalogpodcast">YouTube</A>{' '}and{' '}
        <A href="https://open.spotify.com/show/033Mu8Yn2ybRQIis1uKNv2">Spotify</A>.
      </P>
    </>
  )
}

/* ── Post: Peter Donaldson: music, crypto, and convenient community ── */
function PeterDonaldsonContent() {
  return (
    <>
      <Figure
        src="/blog/llp017-peter-donaldson-hero.jpg"
        alt="Peter Donaldson in conversation with Konrad Gnat at Network School"
        width={1280}
        height={720}
        priority
      />
      <P>
        Some guests are hard to summarize because they&apos;ve done one thing deeply. Peter Donaldson
        is hard to summarize because he&apos;s done several things deeply, and they turn out to rhyme.
        He picked up the cello at three and the piano at six, spent fifteen years in China producing
        music and throwing festivals, read the Bitcoin white paper, and now leads business
        development at a company building an exchange for tokenized stocks.
      </P>
      <P>
        We met at Network School, first at the Muay Thai booth at the NS fair, then hauling
        mats after a yoga class, and this conversation is the long version of &ldquo;so,
        what&apos;s your story?&rdquo;
      </P>

      <H2>From cassette tapes to a life in music</H2>
      <P>
        Peter&apos;s first computer was a Commodore that loaded games from a cassette tape,
        flick up the little door on the corner, press play, and wait half an hour for a program to
        appear. That patience for a slow-loading machine sits oddly well next to the rest of his
        story, which is mostly about following sound wherever it led.
      </P>
      <P>
        The music came early and from home: a mother who had been a ballet dancer, a grandmother who
        taught violin, cello at three, piano at six, theory, singing, orchestra. But the turning
        point, he says, was finding his <em>own</em> taste rather than his mother&apos;s. Hearing
        Jamiroquai opened a door to Stevie Wonder, then Motown, Roy Ayers, and the whole lineage of
        funk and soul. His brother, a DJ, filled the house with sound systems, and Peter eventually
        found his own corner of electronic music in psychedelic trance. He can trace the grooves of a
        Shpongle or Green Nuns of the Revolution track back to the funk pioneers and their Moog
        synthesizers, which is why, he says, he doesn&apos;t really hear genres as separate
        things. They&apos;re all the same conversation, influencing each other across decades.
      </P>
      <Figure
        src="/blog/llp017-peter-donaldson-2.jpg"
        alt="Peter Donaldson talking about his musical roots, from cello to funk and psytrance"
        width={1280}
        height={720}
        caption="From cello at three to psychedelic trance, Peter traces every genre he loves back to the same synthesizer lineage."
      />

      <H2>Fifteen years in China</H2>
      <P>
        Peter went to China almost by accident and stayed for fifteen years. It started with tai chi
        in Manchester, taken up for health reasons, and specifically Chen style, which led him
        and his teacher to Chenjiagou, the village in Henan where the style originates, not far from
        the Shaolin Temple. When two of the record labels he worked for went bust, he went back to
        university to learn Chinese, &ldquo;the only other thing I was interested in outside of
        music.&rdquo; An exchange year in Beijing turned into a move, and the move turned into a
        decade and a half.
      </P>
      <P>
        In Yunnan he built the thing he&apos;s proudest of as a producer: Spirit Tribe, a festival on
        a patch of land outside Kunming with room for three stages of electronic dance music, run for
        about four years until COVID made live events impossible. Before the fixed site there were
        one-off parties in spectacular places, including one where you walked five kilometres
        into a valley, across streams and through forest, to reach a cave with a stream running past
        it. The DJ played from inside the cave; the dancefloor was the sand out front, mountains on
        either side. It was, understandably, called Forest Magic.
      </P>

      <H2>The Bitcoin white paper, and a music app that paid artists daily</H2>
      <P>
        The pivot into technology came through music, too. A famous Chinese radio-DJ friend launched
        a tech company in Shenzhen and asked Peter to help build a music-streaming platform to fix the
        pain points of the recorded-music industry, using blockchain. Writing the
        project&apos;s own white paper sent Peter to the Bitcoin white paper, and, as he puts it,
        &ldquo;the penny dropped.&rdquo; He got blockchain-pilled.
      </P>
      <P>
        The product, Soundario, was genuinely ahead of its time. Artists uploaded directly, cutting
        out the middlemen, and got paid within 24 hours of a play: payments calculated on
        precise measurements of total play time divided by the artists on the platform. It even had a
        built-in curation reward: build a popular playlist and you&apos;d earn a share of the play
        time, but never more than the creator. They shipped it to the App Store and Android and were
        chasing distribution deals. The problem was timing. In 2017 and 2018 the venture money was
        flowing into layer ones and infrastructure, not consumer apps, and the company ran out of
        runway despite doing well. &ldquo;We were too early&rdquo; the recurring epitaph of
        good ideas.
      </P>

      <H2>MEV, and an old human behavior on a new rail</H2>
      <P>
        From there Peter moved through the industry, a small exchange trading exotic options, a
        bigger one, and then, through a former Soundario advisor who had been CTO of Huobi, a data
        company called EigenPhi focused on MEV transaction analysis. He caught the MEV wave near its
        peak, and it taught him the most, in part because it put him in rooms with some of the most
        influential people in Ethereum.
      </P>
      <Pull>
        &ldquo;It&apos;s not really a new human concept. I have an advantage of knowledge and speed,
        and that allows me to extract value. It&apos;s a very old pattern of human behavior,
        it&apos;s just how that pattern happens on a blockchain.&rdquo;
      </Pull>
      <P>
        His framing of MEV is the sort of thing this show exists for. Technically it began as
        &ldquo;miner extractable value&rdquo; miners reordering transactions in a block,
        and grew into &ldquo;maximal extractable value,&rdquo; an edge that lets someone extract value
        through reordering, front-running, or sandwich attacks. But Peter refuses to treat it as
        something new. The blockchain is just where this version of a very old game plays out.
      </P>

      <H2>Tokenized equities: what STOX is building</H2>
      <P>
        Today Peter works on{' '}
        <A href="https://st0x.io">STOX</A>, where he&apos;s known the founding team for years,
        he first met one co-founder on a project to tokenize gold, and stayed in touch as they built a
        higher-level language for the EVM that now underpins their tokenization stack. STOX is a fully
        intent-based order-book DEX for tokenized equities, live on Base with close to twenty assets.
      </P>
      <P>
        He draws a clear line between this and a typical automated market maker. An AMM is passive
        liquidity: it sits somewhere and waits to be used. On STOX, every order carries an intention,
a user says &ldquo;I want this at this price, or as close as possible,&rdquo; and other
        participants compete to solve that order efficiently. The tokens are fully one-to-one backed:
        each on-chain token has an underlying off-chain share held in custody, and a qualified holder
        can redeem it back into the real share and exit into the traditional system. Peter&apos;s own
        role is less about the mechanism and more about connective tissue, finding lending
        protocols, exchanges and use cases so the tokens actually get adopted. &ldquo;My job,&rdquo;
        he says, &ldquo;is creating options.&rdquo;
      </P>
      <Figure
        src="/blog/llp017-peter-donaldson-1.jpg"
        alt="Peter Donaldson explaining how STOX trades tokenized equities on Base"
        width={1280}
        height={720}
        caption="On STOX, every order carries its own price and intention: the opposite of an AMM's passive liquidity."
      />

      <H2>Convenience that builds community</H2>
      <P>
        The most quietly profound part of the conversation isn&apos;t about crypto at all. Asked what
        he makes of Network School, Peter offers a small thesis about technology. Most modern
        technology creates convenience, and convenience tends to create isolation: you can do
        everything on your own. What impressed him here was seeing technologists point that same
        convenience the other way.
      </P>
      <P>
        It&apos;s not convenient to leave your house, get to the gym, or set up a dinner conversation;
        here, the whole environment: two gyms, co-working, co-living, workshops, events,
        makes community &ldquo;effortless.&rdquo; You can dip in and out, say hi in passing or talk for
        an hour, as much as you want. That flip, from technology-as-isolation to
        technology-as-augmented-community, is why he&apos;s decided to stay long-term.
      </P>
      <Figure
        src="/blog/llp017-peter-donaldson-3.jpg"
        alt="Peter Donaldson reflecting on how Network School points convenience at community"
        width={1280}
        height={720}
        caption="Peter's sharpest observation: technology's convenience usually isolates us, the interesting move is to aim it at community instead."
      />
      <P>
        He rounds the hour out with the practices he&apos;s building into a healthier routine:
        kettlebells, meditation, and Kalaripayattu, an old martial art from Kerala whose animal-posture
        conditioning he does as a kind of fluid yoga. And he leaves a piece of advice that fits all
        three of his lives at once. In a world that bombards us with information of wildly varying
        quality, the key skill is discernment: judging not what&apos;s profitable but
        what&apos;s genuinely beneficial, for you and for others. &ldquo;Think about what you post
        before you post it.&rdquo;
      </P>

      <H2>Key takeaways</H2>
      <UL
        items={[
          <>
            <strong>Good ideas fail on timing, not merit.</strong> Soundario paid artists within 24
            hours in 2017, the tech worked; the market wasn&apos;t ready.
          </>,
          <>
            <strong>MEV is an old human pattern, not a new invention</strong>: an edge of
            knowledge and speed, expressed on a blockchain.
          </>,
          <>
            <strong>Intent-based trading vs. an AMM:</strong> every order carries a price and an
            intention, instead of sitting as passive liquidity.
          </>,
          <>
            <strong>Fully-backed tokenized equities are redeemable</strong>, each token maps to
            a real share in custody that a qualified holder can exit into fiat.
          </>,
          <>
            <strong>Convenience usually isolates; the interesting move is to aim it at community.</strong>{' '}
            That&apos;s Peter&apos;s read on why Network School works.
          </>,
        ]}
      />

      <H2>Links &amp; mentions</H2>
      <UL
        items={[
          <>
            <A href="https://st0x.io">STOX</A>, intent-based order-book DEX for tokenized
            equities on Base
          </>,
          <>Soundario, the blockchain music-streaming app Peter co-founded</>,
          <>EigenPhi, the MEV / on-chain analytics company he worked at</>,
          <>Spirit Tribe &amp; Forest Magic, his festival and cave party in Yunnan, China</>,
          <>
            Jamiroquai, Stevie Wonder, Roy Ayers, Shpongle, Green Nuns of the Revolution: his
            musical touchstones
          </>,
          <>
            Chenjiagou (Henan) &amp; Kalaripayattu (Kerala), the tai chi village and the martial
            art he practices
          </>,
          <>Network School, Balaji Srinivasan&apos;s community, where this was recorded</>,
          <>
            Peter&apos;s music aliases: Tone Splendor, The Sneaky Tweaker, Mr Snookums: find him
            on X (Mr Snookums) and LinkedIn (Peter Donaldson)
          </>,
        ]}
      />

      <H2>Listen to the Argo podcast</H2>
      <P>
        Subscribe on{' '}
        <A href="https://www.youtube.com/@luminalogpodcast">YouTube</A>{' '}and{' '}
        <A href="https://open.spotify.com/show/033Mu8Yn2ybRQIis1uKNv2">Spotify</A>.
      </P>
    </>
  )
}

/* ── Post: Daniel Im (LLP#018) ── */
function DanielImContent() {
  return (
    <>
      <Figure
        src="/blog/llp018-daniel-im-hero.jpg"
        alt="Daniel Im in conversation with Konrad Gnat at Network School"
        width={1280}
        height={720}
        priority
      />
      <P>
        Some founder stories are a straight line. Daniel Jiwoong Im&apos;s is not. When I sat down
        with him at Network School for this episode of the Argo podcast, the phrase he kept
        returning to was that almost nothing in his life was planned. And yet the path, from a
        deep-learning lab, through crypto market data, to a social app about opinions: has a
        logic to it that only becomes visible when you lay the pieces side by side.
      </P>

      <H2>Taught by the godfather of AI</H2>
      <P>
        Daniel studied computer science and mathematics at the University of Toronto, and he happened
        to be there at an extraordinary moment. He learned machine learning directly from Geoffrey
        Hinton, the researcher often called the godfather of AI and, more recently, a Nobel laureate
        in physics. His teaching assistants at the time included Ilya Sutskever and Andrej Karpathy,
names that would go on to define the field.
      </P>
      <P>
        What hooked him wasn&apos;t the math so much as the way Hinton explained it. He described
        following Hinton to his office hours day after day, then going back to read his papers from
        the 1980s, including work that analyzed the weights of a neural network to reason about
        what &ldquo;brain damage&rdquo; might look like inside it. The lesson underneath the story is a
        quietly useful one: sometimes a whole career turns on a single teacher who makes an idea feel
        alive.
      </P>
      <Figure
        src="/blog/llp018-daniel-im-1.jpg"
        alt="Daniel Im recalling learning from Geoffrey Hinton at the University of Toronto"
        width={1280}
        height={720}
        caption="Daniel learned ML from Geoffrey Hinton at Toronto, where Ilya Sutskever and Andrej Karpathy were his TAs."
      />
      <P>
        From Toronto he did a master&apos;s at Guelph, worked on generative models at MILA in Montreal
        in Yoshua Bengio&apos;s orbit, and then took a turn into neuroscience at the Janelia Research
        Campus (part of the Howard Hughes Medical Institute). There he built AI models of fruit flies,
not physically, but simulating how flies of different genotypes move and socially
        interact, so that a group of simulated flies would reproduce the behavior of the real ones.
      </P>

      <H2>Why he left research to build</H2>
      <P>
        After Janelia came a PhD at NYU focused on causal inference, the study of telling
        causation apart from correlation. He gives a clean example in the episode: heat a cup of coffee
        and a thermometer rises, but a rising thermometer doesn&apos;t make coffee hot. In data, the
        two look identical; the whole discipline is about recovering the direction of the arrow.
        It&apos;s the kind of thinking that shows up later in how he reads markets and products.
      </P>
      <P>
        He spent four and a half years on that PhD and then left. Part of the reasoning was
        refreshingly practical: if he finished the doctorate, he&apos;d be around thirty, likely with
        more commitments, and a worse position from which to take startup risk. Better, he decided, to
        try when he had nothing tying him down. His first company, AIFounded, was an AI search engine,
built on the intuition that models, like people, need a way to retrieve information
        beyond what they already &ldquo;know.&rdquo; An acquisition by Element AI fell through in a way
        he describes vividly (the deal talks alone were enough to drain the team), but the search IP
        was ultimately sold to Clearview AI. A small first exit, and a big first lesson.
      </P>

      <H2>Into crypto, and the wisdom of markets</H2>
      <P>
        Crypto found him through people. A former colleague, Ethan Buchman, went from machine-learning
        research to co-founding Cosmos and Tendermint, and Toronto and nearby Waterloo were a hotbed as
        Ethereum was taking shape. During the 2017 ICO era he joined Coinscious, a startup mining
        millisecond-level market data across roughly nineteen exchanges. One of its most interesting
        jobs: statistically inferring how much of an exchange&apos;s reported volume was fake wash
        trading, analysis that helped the hedge fund 3iQ meet compliance requirements for the
        first Bitcoin ETF.
      </P>
      <P>
        When COVID and &ldquo;DeFi summer&rdquo; hit, he built his own automated market maker (AMM) and
        pointed it at sports betting, launching UBet. But after three years he&apos;d absorbed two
        lessons that reshaped everything: don&apos;t improve something that already exists (he prefers
        &ldquo;all or nothing&rdquo; bets where you create a new category and quickly learn whether it
        works), and don&apos;t build only for the small web3 audience: go where the consumers
        are.
      </P>

      <H2>A TikTok for opinions</H2>
      <P>
        That&apos;s the path that led to{' '}
        <A href="https://www.belief.market/">Belief Market</A>. He describes it as &ldquo;a TikTok for
        opinions&rdquo; a social app where anyone can create a market on a claim
        (&ldquo;Donald Trump is an alien,&rdquo; say), pick a side, argue, and stake money that pays out
        to the winning side when the market closes. Crucially, he insists it&apos;s not a prediction
        market. It isn&apos;t about forecasting the world; it&apos;s about participation, tribes, and
        internet drama, food rivalries, anime-character showdowns, a community member posting her
        paintings for feedback. He&apos;s even weighing a rebrand, because the word &ldquo;market&rdquo;
        makes people expect Polymarket-style prediction when the real DNA is closer to social media for
        Gen Z.
      </P>
      <Figure
        src="/blog/llp018-daniel-im-2.jpg"
        alt="Daniel Im explaining Belief Market as a TikTok for opinions"
        width={1280}
        height={720}
        caption="Belief Market, in his words: a &ldquo;TikTok for opinions&rdquo; that turns internet debates into two-sided social markets."
      />
      <P>
        The most honest stretch of the conversation is about motivation. Belief Market rewards new users
        with cash to get them in the door, but Daniel knows money can crowd out intrinsic fun, and
        cites the classic study where kids who loved drawing drew <em>less</em> once a reward was
        introduced and then removed. The real retention, he thinks, has to come from something
        intangible: identity, the way your Instagram feed becomes a kind of public autobiography. Right
        now his single north-star metric isn&apos;t user growth but retention rate.
      </P>

      <H2>Think about what to execute</H2>
      <P>
        Near the end, alongside some grounded advice about work-life balance (&ldquo;it&apos;s a
        marathon, not a sprint; be kind to all parts of yourself&rdquo;), he offered the line I keep
        thinking about. It&apos;s easy, he said, to just run: to execute so hard and so busily
        that you look up and realize you haven&apos;t gone far, because you never stopped to think about{' '}
        <em>what</em> to execute. His fix is almost algorithmic: a greedy approach that solves the single
        most important priority rather than juggling many at once.
      </P>
      <Figure
        src="/blog/llp018-daniel-im-3.jpg"
        alt="Daniel Im giving advice about thinking versus executing"
        width={1280}
        height={720}
        caption="His most useful advice: busyness isn't progress, think about what to execute, then solve the single most important thing."
      />
      <P>
        And then he closed the loop on his whole story. The connective tissue between machine learning and
        Belief Market, he said, is the wisdom of crowds. In ML, a mixture of experts beats any single
        model; in life, prediction markets and trading rest on the same premise: the aggregate is
        smarter than the individual. Money is just a reward function, and the market, in the end, is what
        chooses you. It&apos;s a fitting thesis for a founder whose own path looks random up close and
        coherent from a distance.
      </P>

      <H2>Key takeaways</H2>
      <UL
        items={[
          <>
            <strong>A single great teacher can set a trajectory.</strong> Hinton&apos;s classes, not the
            math itself, pulled Daniel into AI for good.
          </>,
          <>
            <strong>He optimizes for &ldquo;all or nothing&rdquo; bets</strong>, new categories
            where you quickly learn whether the thing works, over incremental improvements.
          </>,
          <>
            <strong>Rewards are double-edged.</strong> Cash gets users in the door, but durable retention
            comes from identity and intrinsic fun, not payouts.
          </>,
          <>
            <strong>Think before you execute.</strong> Busyness isn&apos;t progress; a greedy focus on the
            single most important priority beats multitasking.
          </>,
          <>
            <strong>The wisdom of crowds is his through-line</strong>, from mixture-of-experts
            models to prediction markets, the aggregate beats the individual.
          </>,
        ]}
      />

      <H2>Links &amp; mentions</H2>
      <UL
        items={[
          <>
            <A href="https://www.belief.market/">Belief Market</A>, Daniel&apos;s current company, a
            social opinion app
          </>,
          <>
            <A href="https://www.miso.care/">MisoCare</A>, his healthcare venture
          </>,
          <>UBet Sports, his earlier on-chain sports prediction market</>,
          <>AIFounded, his first company, an AI search engine (IP sold to Clearview AI)</>,
          <>Coinscious, crypto market-data startup that worked with 3iQ</>,
          <>Cosmos / Tendermint, blockchain project by his former colleague Ethan Buchman</>,
          <>
            Geoffrey Hinton, Ilya Sutskever, Andrej Karpathy, Alex Graves: University of Toronto AI
            figures
          </>,
          <>Yoshua Bengio (MILA), Yann LeCun: deep-learning pioneers mentioned</>,
          <>Janelia Research Campus, where he did ML for neuroscience</>,
          <>Polymarket, Augur, Kalshi, prediction markets discussed</>,
          <>Network School, where this conversation was recorded</>,
          <>
            Daniel on <A href="https://x.com/daniel_j_im">X</A>,{' '}
            <A href="https://www.instagram.com/iam_daniel_iam/">Instagram</A>, and{' '}
            <A href="https://www.linkedin.com/in/daniel-jiwoong-i-69232951/">LinkedIn</A>
          </>,
        ]}
      />

      <H2>Listen to the Argo podcast</H2>
      <P>
        Subscribe on{' '}
        <A href="https://www.youtube.com/@luminalogpodcast">YouTube</A>{' '}and{' '}
        <A href="https://open.spotify.com/show/033Mu8Yn2ybRQIis1uKNv2">Spotify</A>.
      </P>
    </>
  )
}

/* ── Post: LLP#019 Tony Lopez ── */
function TonyLopezContent() {
  return (
    <>
      <Figure
        src="/blog/tony-lopez-robotics-shenzhen-claude-code-hero.jpg"
        alt="Tony Lopez in conversation with Konrad Gnat at Network School"
        width={1920}
        height={1080}
        priority
      />
      <P>
        Some people arrive at technology through a job. Tony Lopez arrived through curiosity, and he
        never really left. In this episode of the Argo podcast, recorded at Network School, we
        sat down to trace his path from a childhood computer in Spain to the questions he is thinking
        about now. It is a long, technical life, and he is generous about explaining the parts of it
        that most of us take for granted.
      </P>

      <H2>The magic of the first machine</H2>
      <P>
        Tony is 48, and his first computer was an MSX his parents brought home when he was around 12.
        He did not ask for it. He opened the manual, connected it to the television, learned to store
        programs on a cassette tape, and started writing simple things in BASIC. The first program
        that excited him drew circles in different colors while the machine made sound.
      </P>
      <P>
        What stayed with him was a specific question: what is actually happening inside. He describes
        taking a screwdriver to the case, seeing the circuits, and wanting to understand how a chip
        full of gates could turn moving electrons into something useful. That curiosity became a
        career. He later took the Nand to Tetris course, which builds a working computer from logic
        gates up to a running program, because he wanted the whole stack in his head.
      </P>
      <Figure
        src="/blog/tony-lopez-robotics-shenzhen-claude-code-1.jpg"
        alt="Tony Lopez recalling his first computer, an MSX, at age twelve"
        width={1920}
        height={1080}
        caption="Tony&apos;s first computer was an MSX his parents brought home when he was about twelve."
      />

      <H2>Learning robotics by teaching it</H2>
      <P>
        Tony studied electronics and robotics in Barcelona. He is honest that he was not an easy
        student and that some teachers doubted he belonged at university. He got in, and in his first
        year he was already helping teach robotics to students ahead of him, because he had been
        building since he was twelve.
      </P>
      <P>
        One of the clearest moments in the conversation is when he explains a PID controller, the
        piece of logic that keeps a line-following robot on its line. He walks through it plainly: the
        robot reads an array of infrared sensors, and the controller corrects the motors in proportion
        to how far off the line it is, how fast it is drifting, and how long the error has lasted. It
        is a small, useful lesson in how a robot stays on course, delivered in about two minutes.
      </P>

      <H2>Aerospace, sailing, and a turn toward business</H2>
      <P>
        After university Tony worked for several years on aerospace projects connected to the European
        Space Agency, including work on how humans might recycle water and materials to survive on
        Mars, and a project to extract DNA from blood samples. He describes it as a strange, wide mix
        of problems, and clearly enjoyed being in over his head.
      </P>
      <P>
        A hobby, weekend sailing races near Barcelona, nudged him toward a different question. He
        wanted to buy a sailboat, realized how expensive that was, and started reading about business.
        He read Robert Kiyosaki&apos;s &ldquo;Rich Dad Poor Dad&rdquo; and decided he needed to build
        something of his own. That thread eventually pulled him toward China.
      </P>

      <H2>Four years in Shenzhen</H2>
      <P>
        Tony ended up in Shenzhen through batteries. Working at an electronics company in Spain, he
        pushed it into a new line of lithium iron phosphate batteries, and found that nearly every
        component he needed traced back to one city. So he went. He stayed about four years.
      </P>
      <P>
        He is careful to say he knows Shenzhen, not all of China. What struck him was the speed. He
        tells the history plainly: a special economic zone next to Hong Kong that grew from a small
        population to a very large city in about forty years, learning electronics manufacturing as it
        went. For Tony, it remains the fastest environment he has found for learning hardware, and he
        compares it, thoughtfully rather than grandly, to what Network School is trying to do for a
        different kind of work.
      </P>

      <H2>From the digital world into the physical one</H2>
      <P>
        The second half of the conversation is Tony&apos;s read on where things are heading. He sees
        AI as something that will touch every field, and he is candid that this is his own long view,
        the kind of thinking he says lives more in the future than the present. His core observation
        is concrete: the cost of intelligence is falling, and expertise that used to take years is
        becoming something you can turn on.
      </P>
      <Figure
        src="/blog/tony-lopez-robotics-shenzhen-claude-code-2.jpg"
        alt="Tony Lopez describing AI moving from the digital world into the physical one"
        width={1920}
        height={1080}
        caption="Tony&apos;s thesis: the cost of intelligence is falling, and robotics will carry that shift into the physical world."
      />
      <P>
        He describes a &ldquo;Claude Code moment&rdquo; late last year, when it began to feel like you
        could describe what you wanted and get a working program back without reading every line
        yourself. He is thoughtful about the trade-off, too. When developers stop tracking every line,
        we build faster, but we also loosen our grip on how the machine works underneath. He thinks
        robotics is the next step, carrying that same shift from the screen into the physical world.
      </P>
      <P>
        He grounds the idea in a small story rather than a big claim. A 19-year-old at Network School
        who had barely used a keyboard got a robot moving in two days with Claude Code, connecting to
        it over Wi-Fi and writing the control scripts. Tony has spent thirty years learning robotics,
        and he holds that story with a mix of humility and excitement.
      </P>

      <H2>Where he thinks this goes</H2>
      <P>
        We also talked about Argo, my own project, and Tony offered a useful reframing. He is
        less interested in screens and more in the idea that the data you keep about yourself, your
        logs and your thoughts, is the valuable part, and that keeping it private matters. He expects
        the way we interact with computers to move toward voice and prediction over time.
      </P>
      <P>
        His hopes for Network School are modest and specific: that a community can adapt quickly to
        fast change, and help others do the same. He now spends his days on Transcend Money, a YouTube
        channel where he studies crypto exchange order books and how automated trading agents behave,
        using the work as a way to push himself to build with AI every day.
      </P>
      <Figure
        src="/blog/tony-lopez-robotics-shenzhen-claude-code-3.jpg"
        alt="Tony Lopez and Konrad Gnat closing the conversation at Turi Beach Resort"
        width={1920}
        height={1080}
        caption="A calm end to a grounded hour, with the sun going down over the palm trees."
      />
      <P>
        We finished with the sun going down over the palm trees. It was a calm end to a grounded hour
        about a life spent trying to understand how machines work, and a genuine curiosity about what
        they are becoming.
      </P>

      <H2>Key takeaways</H2>
      <UL
        items={[
          'A PID controller keeps a robot on its line by correcting in proportion to the error, its rate of change, and its accumulation. It is a small idea that shows up everywhere in control systems.',
          'Tony frames Shenzhen as a learning environment first: its value, in his telling, is the speed at which you can build and iterate on hardware.',
          'He sees the falling cost of intelligence, and tools like Claude Code, as the throughline from software into robotics, and holds the change with both excitement and caution.',
          'His advice for a fast-changing field is to lean on creativity and on building things, since narrowing infinite possibilities to a useful one is still a human job.',
        ]}
      />

      <H2>Listen to the Argo podcast</H2>
      <P>
        Subscribe on{' '}
        <A href="https://www.youtube.com/@luminalogpodcast">YouTube</A>{' '}and{' '}
        <A href="https://open.spotify.com/show/033Mu8Yn2ybRQIis1uKNv2">Spotify</A>.
      </P>
    </>
  )
}

/* ── Post: Anton Pecherkin (ContentDAO) ── */
function AntonPecherkinContent() {
  return (
    <>
      <Figure
        src="/blog/llp021-anton-contentdao-1.jpg"
        alt="Anton Pecherkin gesturing mid-story across a table from Konrad at Network School, a whiteboard behind them"
        width={1920}
        height={1080}
        caption="Anton walking through the green-energy certificate pilot at Network School."
        priority
      />
      <P>
        Some people find their craft in a classroom. Anton Pecherkin found his in a hackathon he
        almost didn&apos;t attend. In this episode of the Argo Podcast we trace a fifteen-year
        arc from a Tetris-only family computer in Russia to founding ContentDAO, and along the way
        we talk about the parts of a builder&apos;s life that don&apos;t show up on a pitch deck:
        the dependency errors, the unit-test arguments at 3am, and what actually changes when you
        build surrounded by other builders.
      </P>

      <H2>The accidental hackathon habit</H2>
      <P>
        Anton&apos;s first hackathon was a solo act. His friends bailed, so he showed up alone to a
        &ldquo;Blockchain Founder Hackathon&rdquo; knowing nothing about blockchain, a little
        afraid, mostly planning to watch. A two-person team needed a third who could code. He knew
        JavaScript, they handed him the Solidity docs, and two days later they took first place.
      </P>
      <P>
        That win set a pattern. He went back to university, pulled in friends, and started
        traveling. Between 2018 and 2020 the team competed across Spain, Germany, France and
        beyond, and by Anton&apos;s count they won something like forty to fifty hackathons. The
        win rate, when they were focused, sat around 80 to 90 percent. He is refreshingly
        unmysterious about how: the trick was to treat the judges as the spec. Ask them what they
        wanted, prototype it, show it, ask again, and iterate until the demo landed. On that same
        circuit he crossed paths with teams that later became names, like <A href="https://1inch.io">1inch</A>,
        sometimes finishing first while they finished second, sometimes the other way around.
      </P>

      <H2>Green energy on a Singapore island</H2>
      <P>
        The hackathon circuit turned into a company. From 2020 to 2023 Anton&apos;s team ran a
        blockchain software agency that shipped around twenty products for clients, most of them
        private-chain systems. The one he keeps coming back to is a green-energy certificate
        platform: NFT certificates issued for each megawatt of renewable energy, built on
        Hyperledger Besu and Hyperledger Fabric, and run as a government-level pilot.
      </P>
      <P>
        The most vivid piece of it reached Singapore. The system was tested around Semakau Island,
        tied to work on renewable-energy microgrids, where solar panels and other sources produce
        and consume energy and a blockchain layer balances and settles the flows. Anton has since
        given a workshop on it at Network School. It is a good reminder that
        &ldquo;blockchain for X&rdquo; is not always vaporware; sometimes it is a metering problem
        with real panels and real megawatts behind it.
      </P>

      <H2>Loving algorithms, hating dependency hell</H2>
      <P>
        One of the most relatable stretches of the conversation has nothing to do with crypto.
        Anton studied physics at Moscow State University, and he is candid that he drifted toward
        physics partly because he loved the algorithmic thinking of programming but disliked
        everything around it. The idea was the fun part. Then came the packages, the dependencies,
        the errors you paste into Google and stare at without understanding.
        &ldquo;You have to sacrifice a lot&rdquo; of time, he says, just to make the idea run.
      </P>
      <P>
        Anyone who has coded will nod. It also sets up one of the throughlines of the episode: the
        tools have finally started to absorb that grind. Which is where the more recent chapter of
        his story begins.
      </P>

      <H2>Building in a community of builders</H2>
      <P>
        Anton found Network School the way a lot of people do, through a Balaji talk he
        half-remembered and an application he almost forgot about. What made him extend a planned
        one-month stay into something longer was not the beach. It was the density of builders.
        When the people around you are shipping and sharing what they ship, he says, it adds energy
        to build yourself.
      </P>
      <P>
        It also accelerated his own tooling. He describes moving from writing code by hand with an
        assistant resolving packages, to a fuller agentic flow with Claude Code, and credits the
        community and its events for how fast he picked it up. His honest read: if he had stayed
        outside a community like this, he would probably still use coding agents, just much less,
        and learn them much more slowly.
      </P>

      <H2>An honest test of the journaling pitch</H2>
      <P>
        Because this is the Argo Podcast, Konrad pitched Anton on Argo itself, a private
        AI journaling app, and asked the harder question: would you actually use it?
        Anton&apos;s answer is the useful kind, because it is not a yes. He can see the value of
        accumulating structured personal data you can later search and brainstorm against. What he
        is honest about is the habit. He doesn&apos;t keep a daily reflective journal today; his
        notes are mostly work to-dos, morning planning and evening review. The real obstacle, he
        says, isn&apos;t the product, it&apos;s forming and keeping the habit.
      </P>
      <Figure
        src="/blog/llp021-anton-contentdao-2.jpg"
        alt="Konrad and Anton in conversation during the Argo product discussion"
        width={1920}
        height={1080}
        caption="Honest feedback on the journaling pitch: the obstacle isn't the app, it's the habit."
      />
      <P>
        That is exactly the feedback a founder needs, and the conversation turns it into a small
        thesis: maybe the practice has to be marketed as a practice, something closer to a cultural
        habit like a martial art, with a community and a story around it, rather than just an app
        with a streak counter.
      </P>

      <H2>ContentDAO in the wild</H2>
      <P>
        The last third of the episode is Anton&apos;s current company. ContentDAO grew out of an
        earlier product, B4B.app, a marketplace that scored around a thousand influencers and let
        brands hire them with escrow-backed guarantees. It worked, but it didn&apos;t scale;
        matching one creator to one brief by hand is slow. So they sold that tech into their agency
        and rebuilt around a bigger idea.
      </P>
      <P>
        The framing is the clearest part. Think of Google Ads: you set a budget and some targeting,
        and traffic comes back with metrics you can measure. ContentDAO wants to be that, except
        the &ldquo;inventory&rdquo; is a long tail of small, trusted content creators instead of a
        single ad network. A brand sets a budget and a goal, an algorithm allocates personalized
        tasks only to creators whose audience and topics fit, and each creator is asked for one
        piece of quality content. Payment is held in escrow and released when the post ships, which
        removes the incentive to flood the system with spam or bots. The bet underneath it: small
        creators, roughly 10,000 to 100,000 followers, are underserved by a monetization market
        that overpays a handful of large accounts, and connecting them to products at scale is a
        very large opportunity.
      </P>
      <Figure
        src="/blog/llp021-anton-contentdao-3.jpg"
        alt="Anton describing how a founder used ContentDAO for his prediction-market startup"
        width={1920}
        height={1080}
        caption="The proof point: $100 produced about 20 pieces of content in three days."
      />
      <P>
        The proof point he shares is concrete. A founder friend, Daniel, used ContentDAO for his
        prediction-market startup, Belief Market. A first run of about $100 produced roughly 20
        pieces of content in three days, mostly from creators across Vietnam, Indonesia and
        Malaysia, at a customer-acquisition cost he measured at about three times better than his
        other channels. Daniel moved to a weekly cadence, and Anton&apos;s read is that each run
        gets better as the algorithm learns. ContentDAO has raised early grant funding from the
        Stellar ecosystem and is now preparing to raise again to scale.
      </P>

      <H2>Key takeaways</H2>
      <UL
        items={[
          'Learning by building beats learning in theory: Anton’s whole career grew out of showing up to hackathons and treating the judges’ feedback as the spec.',
          '“Blockchain for X” can be real. A green-energy certificate pilot tied to Semakau Island is a metering-and-settlement problem, not a slogan.',
          'The grind most builders hate is the tooling around the idea, and agentic coding is finally eating that grind.',
          'Community changes your pace. Proximity to other builders accelerated both Anton’s shipping and his adoption of new tools.',
          'Honest user feedback is a gift. The obstacle to a journaling product isn’t the features, it’s helping people form the habit.',
          'ContentDAO’s wedge is fairness and fit: pay small, trusted creators through escrow for one quality post, and match by audience instead of blasting the biggest accounts.',
        ]}
      />

      <H2>Links &amp; mentions</H2>
      <UL
        items={[
          <>
            <A href="https://www.linkedin.com/in/antony-peech/">Anton Pecherkin on LinkedIn</A>
            ,{' '}connect with the guest
          </>,
          <>
            <A href="https://x.com/ContentDAOapp">ContentDAO on X</A>, follow the company
          </>,
          <>
            <A href="https://contentdao.app">ContentDAO</A>, Anton&apos;s current company, a
            distribution channel for small content creators
          </>,
          <>
            <A href="https://b4b.app">B4B.app</A>, his earlier influencer / KOL marketplace
          </>,
          <>
            <A href="https://startblock.online">StartBlock</A>, his blockchain agency; past work is
            under /cases
          </>,
          'Semakau Island / REIDS, Renewable Energy Integration Demonstrator, Singapore',
          'Hyperledger Besu and Hyperledger Fabric, private blockchain frameworks used in the green-energy pilot',
          'Skoltech / Yuri Yanovich, his master’s advisor in blockchain research',
          'Stellar, the ecosystem that gave ContentDAO its first grant',
          'Belief Market, Daniel’s prediction-market startup',
          'Claude Code, the tool behind his shift to agentic coding',
        ]}
      />

      <H2>Listen to the Argo podcast</H2>
      <P>
        Subscribe on{' '}
        <A href="https://www.youtube.com/@luminalogpodcast">YouTube</A>{' '}and{' '}
        <A href="https://open.spotify.com/show/033Mu8Yn2ybRQIis1uKNv2">Spotify</A>.
      </P>
    </>
  )
}

/* ── Post: Velveteen (Miriam Reza): the artist who paints to bring people joy ── */
function VelveteenArtistFounderStoriesContent() {
  return (
    <>
      <Figure
        src="/blog/velveteen-artist-founder-stories-hero.jpg"
        alt="Velveteen (Miriam Reza) talking with her hands mid-gesture, and Konrad, during the podcast at a table in Forest City"
        width={1920}
        height={1080}
        priority
      />
      <P>
        I sat down with Velveteen, whose real name is Miriam Reza, on a quiet Monday evening near
        Singapore, at the tail end of a Network School cohort. She introduces herself with two names
        for a reason. Velveteen is the artist. Miriam is the founder of{' '}
        <A href="https://www.chymira.com/">Chymira</A>, where she helps deep tech founders turn
        dense research into a clear story. The whole conversation lives in the space between those
        two identities.
      </P>

      <H2>Knowing early, and a car crash</H2>
      <P>
        Some people search for their calling. Velveteen says she never had to. She has known since
        she was a small child that she would be an artist, and that certainty has never wavered. She
        went on to study at North Carolina State University, mixing industrial design, a background
        in 3D, graphic design, and business administration, which is a more practical, applied blend
        than most people expect from an &ldquo;art degree.&rdquo;
      </P>
      <P>
        Getting there was not smooth. In her senior year of high school, the exact year you assemble
        a portfolio for art school, she was in a bad car crash. There was nothing left of the car,
        and she broke both hands. Doctors, parents, everyone around her told her to reconsider. She
        could not imagine any other life, so she learned to draw with her left hand and put the
        portfolio together anyway. She missed the deadline to apply to half the schools she wanted,
        including RISD, which sat at the top of her list. She still got in on nearly full grants that
        covered almost all of her tuition. Years later she got the word <em>resilience</em> tattooed
        on her hand, in a gothic font, to mark the 10-year anniversary of the crash. As she put it,
        it sits right where she can see it when she needs to see it most.
      </P>
      <Figure
        src="/blog/velveteen-artist-founder-stories-1.jpg"
        alt="Velveteen showing the resilience tattoo on her hand during the conversation"
        width={1920}
        height={1080}
        caption="The word she chose to carry with her: resilience, marking ten years since the crash."
      />

      <H2>From dark charcoal to bright color</H2>
      <P>
        The work that got her into college looked nothing like what she makes now. Her early
        portfolio was heavy charcoal, dark and eerie, a reflection of the state of mind she had been
        in for a long time. She described one piece, all black and white: a flamingo in the water
        with a hand reaching in to drown it. It reads as a graceful thing being pulled down by its
        own beauty, an external force blocking flight.
      </P>
      <P>
        Her art today is the deliberate opposite. Since graduating she has decided that her mission
        is to bring people happiness, so the work turned colorful and vibrant, with animals as a
        recurring motif. She is clear-eyed that this is a choice about what to amplify. She has taken
        criticism for making things that read as cute or bubbly, but she keeps going because of the
        people who tell her the work brought them joy.
      </P>
      <Figure
        src="/blog/velveteen-artist-founder-stories-2.jpg"
        alt="Velveteen with her hands over her heart, talking about making art that brings people happiness"
        width={1920}
        height={1080}
        caption="On why the work turned colorful: a deliberate choice to bring people happiness."
      />
      <P>
        When she makes a community piece, she researches the place first, its colors and its stories,
        then hides meaning inside the composition. For a painting she made for Island DAO in Koh
        Samui, she chose a monitor lizard native to the region, drinking from a coconut with an
        island floating inside it, a shrine in the background, and a hidden Solana logo tucked into
        the scene. It is storytelling as much as painting: signs, symbols, and small rewards for
        anyone who looks closely. She also works velvet into some pieces, gluing it onto canvas, a
        physical signature that ties back to the Velveteen Bubble, the 30-page velvet coloring book
        where the name first took shape.
      </P>

      <H2>The craft, and the crypto years</H2>
      <P>
        She is honest about the parts that were hard. Design school treated drawing like a muscle you
        train by not sleeping, and after breaking her hand at 17 she lacked dexterity well into
        college. Professors told her not to paint. What saved her was that her program valued process
        and design thinking as much as raw precision, though she is candid that the top studios she
        wanted, the Fisher-Prices of the world, treated clean linework as non-negotiable.
      </P>
      <P>
        After school, around COVID, she moved to Miami and landed in the middle of the 2021 crypto
        wave, when it felt like every stranger on the street was talking about NFTs. She got into the
        NFT and film world, worked on NFT the Movie, and spoke on stage at NFT NYC. She told a great
        story from ETHDenver, where a group she was part of ran a coordinated flash mob that opened
        for Deadmau5, and security chased her around the venue because they thought she was just some
        woman dancing on a table.
      </P>

      <H2>Chymira, and putting soul into the work</H2>
      <P>
        After walking away from a five-year project and a co-founder, she took a one-way ticket
        toward Asia and a nomadic run of pop-up communities: Network School, Island DAO in Koh Samui,
        a Girl Scouts camp in the Japanese Alps, Forma Bristol with the video agency Little Unusual.
        Along the way she has been rebuilding Chymira, named after the mythical Chimera, a blend of
        different animals, which she sees as a fitting symbol for founders. Her pitch is simple and
        self-aware: founders should focus on building the best product, and she is the one who
        distills what they do into a story the right audience can find. She does not claim to be the
        most technical person in the room. Her edge is translation.
      </P>

      <H2>Turning grief into a painting</H2>
      <P>
        Near the end, she showed the painting she made when Network School announced it was winding
        down. She did not know how to process it, so she did what she always does and turned it into
        art. A turtle carries a city on its back, a nod to the Hindu myth of the world-bearing turtle
        and to a new society being built. Nodes float in the sky, a ship flies a flag, and small
        icons hide throughout, including a stairway to nowhere she spotted on the local beach. It
        became a shared object of grief and celebration for the whole cohort.
      </P>
      <Figure
        src="/blog/velveteen-artist-founder-stories-3.jpg"
        alt="Velveteen and Konrad looking at the Network School turtle painting she made"
        width={1920}
        height={1080}
        caption="The painting she made as Network School wound down: a turtle carrying a city, nodes in the sky."
      />
      <P>
        We ended on creativity itself. She thinks of it as a trainable muscle, and of good art as
        something that evokes emotion, even out of anxiety, pointing to Edvard Munch&apos;s The
        Scream. The thread she kept returning to: what separates human work from AI art is that you
        put a piece of your soul into it, and other people can relate to that. She wants to be a
        famous artist, on her own terms, partly because growing up she rarely saw a woman of color she
        could point to as a role model, and she wants to be that for someone else.
      </P>

      <H2>Key takeaways</H2>
      <UL
        items={[
          'A setback can harden a calling instead of ending it. Breaking both hands sent her to learn her left hand, not to quit.',
          'Choosing what to amplify is an artistic decision. She moved from dark charcoal to color on purpose, to bring people joy.',
          'Hidden symbolism turns a painting into a story, and rewards the viewer who looks closely.',
          'You do not have to be the most technical person to add value to founders. Translation and narrative are their own craft.',
          'What makes art human is soul. That is the line she draws between her work and AI-generated images.',
        ]}
      />

      <H2>Links &amp; mentions</H2>
      <UL
        items={[
          <>
            <A href="https://www.instagram.com/velveteengallery/">Velveteen on Instagram</A>, her art
          </>,
          <>
            <A href="https://x.com/Velveteen0x">Velveteen on X</A>
          </>,
          <>
            <A href="https://www.linkedin.com/in/miriam-reza-95455a106/">Miriam Reza on LinkedIn</A>
          </>,
          <>
            <A href="https://www.chymira.com/">Chymira</A>, branding and pitch for deep tech founders
          </>,
          <>
            <A href="https://www.miriamreza.com/">Miriam Reza Design</A>, graphic design portfolio
          </>,
          'North Carolina State University, and RISD, where she studied and where she had hoped to go',
          'NFT the Movie, and NFT NYC: her work in the NFT and film world',
          'Island DAO, Forma Bristol, and Little Unusual: the communities and video agency along the way',
          'Scott Page (Pink Floyd), the LA Oscars art collection',
          'The Artist’s Way, and The War of Art: books that shaped how she takes her art seriously',
        ]}
      />

      <H2>Listen to the Argo podcast</H2>
      <P>
        Subscribe on{' '}
        <A href="https://www.youtube.com/@luminalogpodcast">YouTube</A>{' '}and{' '}
        <A href="https://open.spotify.com/show/033Mu8Yn2ybRQIis1uKNv2">Spotify</A>.
      </P>
    </>
  )
}

/* ── Post: Daria Chernozub: going global by going local ── */
function Llp022DariaChernozubContent() {
  return (
    <>
      <Figure
        src="/blog/llp022-daria-chernozub-hero.jpg"
        alt="Daria Chernozub, in a Dash t-shirt and pink cap, laughing with Konrad during the podcast, a whiteboard reading $DASH behind them"
        width={1920}
        height={1080}
        priority
      />
      <P>
        Some people collect job titles. Daria Chernozub, who everyone calls Dasha, has collected
        worlds: corporate banking, government innovation labs, Web3 startups, hackathon circuits,
        spiritual communities on a Thai island, and the crypto scene now forming in Vietnam. She
        currently leads global adoption for Dash. When we sat down at Network School, what came
        through was not a resume but a way of moving through all of these places, and a stubborn
        belief that the future can be good if enough of the right people decide to build it.
      </P>

      <H2>A coin with her name</H2>
      <P>
        Dasha&apos;s crypto story starts about nine years ago, inside a Russian central bank&apos;s
        digital sandbox. She was surrounded by young engineers who told her to put money into
        Bitcoin and Dash. Her reasoning for the second one was refreshingly human: &ldquo;I&apos;m
        Dasha. Of course I will buy Dash.&rdquo; It became her first coin.
      </P>
      <P>
        That sandbox was a serious place, though. She mentions, almost in passing, that Vitalik
        Buterin once came to lecture there around 2016, and that the Russian Central Bank
        Association later built Masterchain, a blockchain on top of Ethereum. She spent years inside
        big banks building innovation departments, connecting startups to corporations, and moving
        capital from large institutions down to early-stage teams. She also learned what she did not
        want: the nine-to-five rules and slow committees that made real innovation nearly
        impossible.
      </P>

      <H2>Looking for the real thing</H2>
      <P>
        When Dasha left corporate life for Cyprus and Web3, she went looking for the most
        decentralized project she could find. She worked across the Polygon ecosystem, the Internet
        Computer, and Solana startups, and kept hitting the same wall. Most projects had a CEO, a
        foundation, someone at the center deciding everything. Nodes might be spread around the
        world, but governance was not.
      </P>
      <P>
        Dash was different in a way she could point to: masternode owners who actually vote each
        month on proposals, roughly 2,500 of them, deciding how the network spends and where it
        goes. Her test for decentralization is not the map of the nodes but the question of who
        holds the vote. That distinction is the reason she now stands on stages telling people about
        Dash instead of a network she felt was decentralized in name only.
      </P>
      <Pull>
        Her test for decentralization is not the map of the nodes but the question of who holds the
        vote.
      </Pull>

      <H2>The person before the technologist</H2>
      <P>
        One of my favorite parts of these conversations is asking about someone&apos;s first
        computer. Dasha&apos;s answer went somewhere I did not expect. She first used one at four
        years old, at her grandmother&apos;s kindergarten, printing outlines to color in. But she
        also does not have binocular vision, so as a child she spent hours in front of a computer
        running exercises that trained both of her eyes to work together instead of letting one go
        lazy.
      </P>
      <P>
        Then she said something surprising for someone in her field: &ldquo;I hate
        computers.&rdquo; She is not an engineer, and she has always leaned on friends who are. What
        excites her about this moment in AI is exactly that friction disappearing, the ability to
        just talk to a machine and have it understand. Her whole career has been about making
        technology usable for people, so an interface that finally meets normal people where they
        are feels like a dream she has had for a long time.
      </P>

      <H2>Super Protocol, hackathons, and a backpack in Switzerland</H2>
      <P>
        In Cyprus she did DevRel for Super Protocol, which combines Polygon with Intel SGX to let
        companies compute on each other&apos;s data without exposing it. &ldquo;Data is the new
        gold,&rdquo; she said, and her job was the specific craft of selling to developers rather
        than to a general crowd: developers to developers, their own conferences, their own
        language. She ran more than twenty hackathons across banks, ICP, and Solana, including a
        Solana finals during Apex in Cape Town and the first Dash hackathon in Malaysia with
        Nottingham University.
      </P>
      <Figure
        src="/blog/llp022-daria-chernozub-1.jpg"
        alt="Daria Chernozub gesturing as she tells the story of joining the Internet Computer team"
        width={1920}
        height={1080}
        caption="Telling the story of how a Rainbow Infinity backpack got her onto the Internet Computer team."
      />
      <P>
        The way she joined the Internet Computer team is the most Dasha story in the episode. In
        Switzerland for a founders&apos; meetup, she spotted a backpack with the Rainbow Infinity
        logo, recognized it as ICP, hunted down its owner, pitched him, and handed over the CV she
        happened to be carrying for a visa. He connected her to the global adoption team, and she
        spent two years there learning how big organizations attract startups and build local hubs.
      </P>

      <H2>A year to reset</H2>
      <Figure
        src="/blog/llp022-daria-chernozub-2.jpg"
        alt="Daria Chernozub smiling during the conversation"
        width={1920}
        height={1080}
        caption="On the year she spent on Koh Phangan between Web3 roles."
      />
      <P>
        After a hard return to Moscow, Dasha moved to Koh Phangan and spent about a year on what she
        calls the most spiritual island in the world. She meditated, did ecstatic dance, learned
        about human design, and ran swap parties built on a sharing-economy instinct she picked up
        as a child in Denmark. It is not a detour she apologizes for. Meeting artists,
        mathematicians, and people who think in completely different systems is, for her, part of
        understanding how to work with anyone.
      </P>

      <H2>Going global by going local</H2>
      <P>
        The clearest idea in the conversation is her model for scale. To become truly global, you
        build on the local level. You arrive somewhere as a newbie, you will break rules you did not
        know existed, so first you learn the place: its channels, its influencers, its laws and
        taxes, even its memes. Then you hand local leaders a clear guidebook of your values so they
        can build your unit without losing the plot. She now applies this to Dash, whose focus is
        payments after twelve years, and to its new Dash Platform, a layer two for developers with
        decentralized storage and usernames and, soon, smart contracts.
      </P>

      <H2>The bright future</H2>
      <Figure
        src="/blog/llp022-daria-chernozub-3.jpg"
        alt="Daria Chernozub speaking animatedly with both hands raised"
        width={1920}
        height={1080}
        caption="Closing on why she builds communities: to gather people who believe in a bright future."
      />
      <P>
        We closed on why she does all of this. Dasha wants to gather people who believe in a bright
        future, because she thinks the outcome is genuinely up for grabs. &ldquo;If they will win,
        we lose, and we will live in the sad, sad world. I don&apos;t believe in this sad
        world.&rdquo; It is an optimism that has been tested by banks, by burnout, by a lot of
        countries, and it is still standing. That is the kind of person this show exists to sit with
        for an hour.
      </P>

      <H2>Key takeaways</H2>
      <UL
        items={[
          'Real decentralization is about who votes, not just where the nodes are. Dash’s masternode governance is what won her over.',
          'To go global, go local first: learn a place’s rules, channels, and culture before you try to build there.',
          'The friction between people and computers is the thing worth removing. Natural-language AI is exciting precisely because it does that.',
          'A career can braid many worlds, banking, Web3, hackathons, spirituality, and still keep a single thread: helping people connect and build.',
        ]}
      />

      <H2>Links and mentions</H2>
      <UL
        items={[
          <>
            <A href="https://dariachernozub.com">Daria Chernozub (Dasha)</A>, her personal site and
            social links
          </>,
          <>
            <A href="https://www.dash.org">Dash</A>, the payments-focused blockchain she leads
            adoption for
          </>,
          <>
            <A href="https://internetcomputer.org">Internet Computer Protocol (ICP)</A>, where she
            spent two years on global adoption
          </>,
          <>
            <A href="https://superprotocol.com">Super Protocol</A>, the confidential-compute project
            where she did DevRel
          </>,
          <>
            <A href="https://polygon.technology">Polygon</A> and{' '}
            <A href="https://solana.com">Solana</A>, ecosystems she worked across
          </>,
          <>
            <A href="https://unicornembassy.com">Unicorn Embassy</A>, the founder community where a
            Random Coffee match led her to Dash
          </>,
          <>
            <A href="https://myargoquest.com">Argo</A>, the AI journaling app discussed near the
            end
          </>,
        ]}
      />

      <H2>Listen to the Argo podcast</H2>
      <P>
        Subscribe on{' '}
        <A href="https://www.youtube.com/@luminalogpodcast">YouTube</A>{' '}and{' '}
        <A href="https://open.spotify.com/show/033Mu8Yn2ybRQIis1uKNv2">Spotify</A>.
      </P>
    </>
  )
}

/* ── Post: A life given to a meditation community (Anna Sokol) ── */
function Llp024AnnaSokolContent() {
  return (
    <>
      <Figure
        src="/blog/llp024-anna-sokol-1.jpg"
        alt="Anna Sokol and Konrad in conversation at Network School, a whiteboard behind them reading 'Perception determines reality'"
        width={1920}
        height={1080}
        priority
      />
      <P>
        I met Anna Sokol in early July at Network School in Malaysia. We connected over yoga and
        long conversations about meditation and community, so it felt natural to sit down and record
        one. Anna is a meditation and awareness instructor and retreat facilitator.
      </P>
      <P>
        Her life has an unusual arc. She grew up between Gorlovka and Kiev, moved to Australia at
        sixteen when her mother remarried, and then gave much of her twenties to a meditation
        community called Giving School, living and running retreats across Latvia and other
        countries. This conversation is about that arc, and what she took from it that the rest of us
        can use.
      </P>

      <H2>Perception, and the one tool we have</H2>
      <P>
        When I handed Anna the whiteboard and asked her to write anything she liked, she wrote{' '}
        &ldquo;Perception determines reality.&rdquo; It turned out to be the thread of the whole
        hour. Her framing is simple and practical: attention is the one tool we really have, and
        wherever attention goes, that is where our power goes.
      </P>
      <P>
        She told a small, concrete story to make the point. Working an early job in Australia selling
        activewear, she started noticing every single person wearing that brand&apos;s leggings,
        everywhere, because it was already in her head. From there she made the obvious but
        easy-to-forget leap: if I can be primed to see leggings, I can learn to guide attention on
        purpose, toward what I actually want, and away from the fears and blockages that clutter the
        path. She is careful to say this was not a trick she read about but something she noticed in
        herself and then trained.
      </P>

      <H2>The mother, the change, and the first retreat</H2>
      <P>
        What actually pulled Anna toward this work was not an idea but a person. Her mother found the
        school first, and Anna, in her own words, assumed she had joined a cult and told her to keep
        her ideas to herself. Then she watched her mother change. One night Anna snapped at her, the
        kind of exchange that used to trigger a harsh response, and instead her mother stayed calm
        and kind. Anna says she looked at her mother&apos;s eyes and felt, immediately, that her
        mother had found something real, and that she wanted it too.
      </P>
      <Figure
        src="/blog/llp024-anna-sokol-2.jpg"
        alt="Anna Sokol speaking during the interview at Network School"
        width={1920}
        height={1080}
        caption="Anna traces the turning point: watching her mother respond to a jab with calm instead of the usual harshness."
      />
      <P>
        That led to her first retreat: fourteen days in Latvia, in minus twenty, with partial fasting
        and practices held outdoors. She describes walking and praying after a fasting day, an
        intensity of inner work she had never done, and coming out of it with what she calls huge
        openings. It is worth noting how physical her spirituality is. The cold, the fasting, the
        body: these are not incidental to the practice, they are part of it.
      </P>

      <H2>What makes a community last</H2>
      <P>
        This is the part I keep thinking about. I am drawn to communities, network states, and
        organizations that hold people together, so I asked Anna directly what makes a community
        last. Her answer had three parts, and none of them were about infrastructure.
      </P>
      <P>
        First, a shared goal that everyone has consciously chosen and believes in with their whole
        heart. Without that, she says, a community cannot hold through hard times. Second, ongoing
        education of the people in it, learning how to build connections and handle conflict, because
        when groups pour everything into building infrastructure and skip the inner work, ego
        eventually shows up and someone wants a bigger piece. Third, everyone treating the shared
        project as if it were their own, as if they had created it.
      </P>
      <Figure
        src="/blog/llp024-anna-sokol-3.jpg"
        alt="Konrad gesturing mid-conversation with Anna Sokol at Network School"
        width={1920}
        height={1080}
        caption="Anna names the community's three values: live to your full potential, treat others as your continuation, and pass on what you learn."
      />
      <P>
        She named those alongside the school&apos;s three stated values: live to your full potential,
        treat the people around you as your continuation, and pass on whatever you learn rather than
        hoarding it. A community, in her telling, is not built out of infrastructure first. It is
        built out of the people, and the work they do on themselves.
      </P>

      <H2>Fear mostly lives in the head</H2>
      <P>
        Anna&apos;s teachers, she says, deliberately push people out of their comfort zone. Again and
        again she was told the next course starts in two weeks, on another continent, and asked how
        she would arrange her life to get there. Each time the fears were the same: not enough money,
        work in Australia, no way to explain another absence. And each time she stepped through them
        anyway. Once she came back to find public holidays waiting, better pay, extra shifts, and no
        problem taking the leave. Her conclusion is understated: the scariest thing was simply
        choosing to step into the unknown, and the fears turned out to live mostly in her head.
      </P>
      <Pull>
        Knowledge sits in the head. Wisdom is something you practice. If you do not do it, it is not
        wisdom yet.
      </Pull>

      <H2>Intention, impact, and the work you can only do with others</H2>
      <P>
        Later we got into the gap between intention and impact. Anna&apos;s view is that when the
        impact is bad, the intention was often quietly coming from what she calls a victim position,
        wanting something in return. She used the old line about giving a fishing rod instead of a
        fish, and added a second layer: sometimes a good deed carries a hidden condition, now you owe
        me, now you will respect me.
      </P>
      <P>
        Becoming aware of those subconscious layers, she says, takes two things. One is regular
        practice, meditation that trains you to notice a reaction before you fall into it, what she
        calls a bigger depth of presence. The other is conscious interaction with other people who
        are doing the same work, in a space safe enough to see your own ego and step past it without
        it turning into ego-poking. It reminded me of the early Apple teams, brilliant people
        clashing, and how Steve Jobs later credited meditation with making him a better manager.
      </P>

      <H2>Carrying it into an ordinary life</H2>
      <P>
        What struck me most is how ordinary Anna wants all of this to be. She is not arguing for
        escaping into retreats forever. The real spirituality, she says, is integration: bringing
        energy from the deep work back into ordinary, creative life and actually building things.
        Along the way she developed skills she once only dreamed of as a child who wanted to perform,
        hosting events, project management, design, marketing, running a channel, all in service of
        the same thing.
      </P>
      <P>
        We compared notes on this, my own path through a coding school and Silicon Valley, the pull
        between a stable career and a creative, nomadic life, and landed in the same place: it is
        about people, and about using whatever talents you have to make something with a real impact.
        Her closing note is one I will keep: whatever pure impulse you have inside, even if it seems
        unprofitable or out of reach, give it a shot, do it for fun, and see what happens.
      </P>

      <H2>Key takeaways</H2>
      <UL
        items={[
          'Attention is the one tool we have; you can learn to notice where it goes and guide it on purpose.',
          'A community lasts on three things: a whole-hearted shared goal, ongoing education of its people, and everyone treating the project as their own.',
          'Most fear lives in the head. The way through is choosing to step into the unknown, repeatedly.',
          'Knowledge sits in the head; wisdom is something you practice.',
          'When an intention lands badly, it often came from wanting something in return. Awareness of that comes from practice plus honest work alongside others.',
          'The goal is not to escape into retreats but to integrate the inner work into an ordinary, creative life.',
        ]}
      />

      <H2>Links &amp; mentions</H2>
      <UL
        items={[
          <>
            <A href="https://www.instagram.com/anna_paradanta/">Anna Sokol on Instagram</A>,
            @anna_paradanta, where she shares about community and practice
          </>,
          <>
            <A href="https://giving-school.eu/">Giving School</A>, the meditation school and
            community she works with
          </>,
          'Network School, where this was recorded, in Malaysia',
          'Lorna Jane, the Australian activewear brand from her attention story',
          'Psycho-Cybernetics by Maxwell Maltz, the book on self-image she references',
          'Jane Addams and Hull House, the Chicago settlement house Konrad brought up on social activism',
          '42, the tuition-free coding school from Konrad’s own story',
        ]}
      />

      <H2>Listen to the Argo podcast</H2>
      <P>
        Subscribe on{' '}
        <A href="https://www.youtube.com/@luminalogpodcast">YouTube</A>{' '}and{' '}
        <A href="https://open.spotify.com/show/033Mu8Yn2ybRQIis1uKNv2">Spotify</A>.
      </P>
    </>
  )
}

/* ── Post: The Translator (Francis Goon) ── */
function FrancisGoonLosingTheFearOfAiContent() {
  return (
    <>
      <Figure
        src="/blog/francis-goon-losing-the-fear-of-ai-hero.jpg"
        alt="Francis Goon and Konrad talking across a table at the Ultra Web3 festival"
        width={1280}
        height={720}
        priority
      />
      <P>
        I met Francis Goon by chance. My friend Daryl and I had found a table with some power
        outlets at the Ultra Web3 festival, started talking with one person, and Francis walked
        over. Within a few minutes the whole arc of his story was on the table, and it was
        interesting enough that we sat down to record it. This is his first time doing an interview
        like this, and I&apos;m glad we caught it.
      </P>

      <H2>Two careers, one skill</H2>
      <P>
        Francis started as an engineer. He studied electrical and electronics, then spent about
        seven years as an R&amp;D engineer at semiconductor and electronics multinationals, the kind
        of names that anchor Penang&apos;s industry. After that came fourteen years at MIMOS,
        Malaysia&apos;s national applied research center, a government agency under the Ministry of
        Science, Technology and Innovation whose job is to create technology platforms: in
        software, hardware, semiconductors, and services, and then &ldquo;seed&rdquo; them to
        industry so companies can take them up and mature them into products.
      </P>
      <P>
        His role there was one most people never think about. MIMOS builds the technology; someone
        has to make it usable to the outside world. That someone was Francis. He wrote the technical
        literature: the manuals, the specifications, the setup guides, the partner materials.{' '}
        <em>
          &ldquo;I work with lab owners that have the technology, so I need to translate that into
          product specifications, into instructional materials, into setup guides.&rdquo;
        </em>{' '}
        He estimates that at one point nearly all of MIMOS&apos;s technology platforms passed under
        his purview.
      </P>

      <H2>The work of translation</H2>
      <P>
        What makes this concrete is the example he reached for: a handheld biosensor. Instead of
        going to a hospital and having blood drawn to check your parameters, MIMOS built a device you
        can hold in your palm that uses photonics (light) to triangulate and map your
        blood and physiological parameters, closely correlated to an actual lab result. No needle,
        no sample.
      </P>
      <P>
        To write about a device like that, you have to understand it. You talk to the engineers, you
        grasp how the light technology actually maps to a blood panel, and then you put it into words
        a partner or a customer can follow. That is the quiet skill underneath both halves of
        Francis&apos;s career: taking something dense and specialized and making it clear. It is the
        same muscle he now uses to teach.
      </P>
      <Figure
        src="/blog/francis-goon-losing-the-fear-of-ai-1.jpg"
        alt="Francis Goon explaining the handheld biosensor"
        width={1280}
        height={720}
        caption="Francis’s example of the work: a handheld biosensor that maps your blood with light, no needle."
      />

      <H2>Why he started teaching</H2>
      <P>
        The pivot was not a grand plan. After fourteen years, Francis stopped, moved back to Penang,
        and gave himself time to reset. Then he looked for a job, and ran into the &ldquo;harsh
        reality&rdquo; of Penang: the jobs there are overwhelmingly manufacturing and semiconductor
        roles, and they want engineers. Technical communication was a sliver of the market. After a
        year of interviews, fairs, and HR conversations, &ldquo;nothing is coming about.&rdquo; Then
        a friend asked him to teach his daughter some Malay. That was the seed. Malay classes led to
        English classes for the international community, and AI teaching happened almost by accident,
        when another friend pointed out that Francis was already using AI to design websites, posters,
        slides, and long documents, and told him to package that as a class.
      </P>

      <H2>The fear, then and now</H2>
      <P>
        The thread I keep coming back to is fear. Francis is direct about it: he can help someone
        lose their fear of AI within the first ninety minutes of contact. And when I asked about his
        own first computer, the story rhymed.
      </P>
      <P>
        He had a computer at home before he was ten, late 1980s or early 1990s, a little tower with a
        floppy disk and a very early version of Windows. And he was scared of it.{' '}
        <em>&ldquo;It was the blue screen, then everything you had to type, type, type.&rdquo;</em>{' '}
        No interactivity, commands you had to memorize, a floppy disk to wrestle with. He avoided it
        for years, until college in the early 2000s forced him to use it. That childhood friction is
        exactly the fear he now sees in adult beginners. The difference, he points out, is that the
        screen has changed: it is fluid now, and there is &ldquo;always the same box in the
        middle&rdquo; waiting for a prompt.
      </P>
      <Figure
        src="/blog/francis-goon-losing-the-fear-of-ai-2.jpg"
        alt="Francis Goon recalling his first computer"
        width={1280}
        height={720}
        caption="On his first computer, late 1980s: the same fear he now helps adult beginners overcome with AI."
      />

      <H2>Losing the fear</H2>
      <P>
        His closing advice is almost disarmingly simple, and it is the line I&apos;ll remember.
      </P>
      <Pull>
        AI is not going to eat you. It&apos;s just a screen with a box in the middle for you to put
        your prompts. If you do wrong, it won&apos;t penalize you. It won&apos;t crash your system.
      </Pull>
      <P>
        So try one tool a day, Gemini today, ChatGPT tomorrow, and if you get stuck, tap the little
        microphone and ask the AI how to do the thing you are stuck on. It is a small idea with a
        large reach. Francis&apos;s larger project, which he calls the AI Language Hub, pairs AI
        skills with English and Malay so people across Southeast Asia can both use the tools and
        communicate well enough to belong to the community using them. Underneath the crypto talk,
        the hackathon ideas, and the plans to run technology roadshows across Malaysia&apos;s
        technical universities, that is the through-line: technology is only useful once a person
        stops being afraid of it, and someone has to translate it down to the point where they can
        begin.
      </P>
      <Figure
        src="/blog/francis-goon-losing-the-fear-of-ai-3.jpg"
        alt="Francis Goon making the point that AI is just a box waiting for a prompt"
        width={1280}
        height={720}
        caption="“It’s just a screen with a box in the middle.” The reframe at the heart of his teaching."
      />

      <H2>Key takeaways</H2>
      <UL
        items={[
          'The same skill runs through both halves of Francis’s career: translating dense technology into something people can actually use.',
          'He starts with the person, not the tool. Help them lose the fear first, then the capability follows.',
          'Adult fear of AI mirrors an older fear of the computer. The interface changed; the human response did not.',
          'A practical on-ramp: try one AI tool a day, and when you’re stuck, just talk to it.',
          'Language and AI belong together. To use the tools in a region, you also have to communicate in it.',
        ]}
      />

      <H2>Links &amp; mentions</H2>
      <P>
        <A href="https://www.linkedin.com/in/francisgoon/">Ts. Francis Goon on LinkedIn</A>,
        technical writer, former R&amp;D engineer, AI trainer.{' '}
        <A href="https://theailanguagehub.lovable.app/">The AI Language Hub</A>, his venture
        pairing AI skills with English and Malay coaching.{' '}
        <A href="https://www.mimos.my/">MIMOS</A>, Malaysia&apos;s national applied R&amp;D
        center, where Francis spent fourteen years. Also mentioned: Crypto CSR, a friend&apos;s
        crypto education program; Horizon, an AI conference in Penang; and MTUN, the Malaysia
        Technical University Network.
      </P>

      <H2>Listen to the Argo podcast</H2>
      <P>
        Subscribe on{' '}
        <A href="https://www.youtube.com/@luminalogpodcast">YouTube</A>{' '}and{' '}
        <A href="https://open.spotify.com/show/033Mu8Yn2ybRQIis1uKNv2">Spotify</A>.
      </P>
    </>
  )
}

/* ── Post: How private AI works: Morpheus, TEEs, secure enclaves ── */
function PrivateAIEnclavesContent() {
  return (
    <>
      <Figure
        src="/blog/david-johnston-morpheus-hero.jpg"
        alt="David Johnston, lead technologist on Morpheus, talking with Konrad at Network School"
        width={1920}
        height={1080}
        priority
      />
      <P>
        Every AI product asks you to trust it with something. A chatbot gets your questions. A
        coding assistant gets your source. A journal gets the thing you would not say out loud.
      </P>
      <P>
        Usually that trust is a policy, a paragraph promising your data will not be stored or
        trained on. Policies are worth something. But a policy is a promise about what a company
        chooses to do, and promises can be revised, breached, subpoenaed, or quietly ignored by one
        employee with database access.
      </P>
      <P>
        There is a different approach, and it is the one Argo is built on: make it so the company
        <em> cannot</em> read your data, even if it wanted to. Not &ldquo;will not.&rdquo;{' '}
        <em>Cannot.</em> That is a claim about architecture, not intent, and unlike a policy, you
        can check it.
      </P>
      <P>
        This post explains the machinery: what a secure enclave actually is, how a TEE protects
        computation, what remote attestation proves, what none of it protects against, and exactly
        how Argo uses it, including the one place we currently do not.
      </P>

      <H2>The problem: encryption stops at the CPU</H2>
      <P>
        We already know how to protect data in two of its three states. Data <strong>at rest</strong>{' '}
 (sitting in a database) is protected by disk and field encryption. Data{' '}
        <strong>in transit</strong> (moving across a network) is protected by TLS. Both are
        solved, boring, and effective.
      </P>
      <P>
        The gap is data <strong>in use</strong>. To do anything with your words, run a model over
        them, generate a reflection: a processor has to load them into memory in plaintext.
        Multiplying encrypted numbers gives you nonsense. At the instant of computation, the data is
        readable, and anyone with sufficient privilege on that machine can read it: the operating
        system, the hypervisor, the cloud provider, an administrator, or malware that escalated far
        enough.
      </P>
      <Pull>
        Encryption protects your data everywhere except the one moment the AI actually looks at it.
      </Pull>
      <P>
        Confidential computing exists to close that third gap.
      </P>

      <H2>What a secure enclave is</H2>
      <P>
        A <strong>secure enclave</strong> is a region of memory that the CPU itself keeps isolated.
        A <strong>Trusted Execution Environment (TEE)</strong> is the broader term for a hardware
        environment that guarantees that isolation. The distinction is mostly vocabulary; the idea
        is one thing.
      </P>
      <P>
        The mechanism is a hardware memory encryption engine sitting between the processor and RAM.
        Memory belonging to the enclave is encrypted with a key generated inside the CPU at boot,
        a key that never leaves the silicon and that no software, at any privilege level, can read.
        Data is decrypted only inside the processor package while executing, then re-encrypted
        before it goes back to RAM.
      </P>
      <P>
        The consequence is the interesting part. Dump the physical memory of that server and you get
        ciphertext. Attach a debugger from the host OS and you are blocked. The hypervisor can
        schedule the enclave, start it, and kill it, but it cannot look inside it. The trust
        boundary stops being &ldquo;the company and everyone with root&rdquo; and becomes &ldquo;the
        CPU vendor and the code in the enclave.&rdquo;
      </P>
      <P>
        In practice this is implemented by a handful of technologies: <strong>Intel TDX</strong> and{' '}
        <strong>AMD SEV-SNP</strong> for confidential virtual machines, and{' '}
        <strong>NVIDIA confidential computing</strong> on H100-class GPUs, the last of which is
        what makes this relevant to AI at all. Protecting the CPU is useless if the model runs on a
        GPU whose memory is wide open, so the encrypted boundary has to extend across the PCIe bus
        to GPU memory. That capability is recent, and it is the reason private LLM inference became
        practical in the last couple of years rather than the last ten.
      </P>

      <H2>Attestation: the part that makes it more than a promise</H2>
      <P>
        Here is the question that separates confidential computing from marketing: how do you know
        you are talking to a real enclave at all? Anyone can stand up a normal server and{' '}
        <em>claim</em> the workload is protected.
      </P>
      <P>
        The answer is <strong>remote attestation</strong>, and it is the single most important
        concept here.
      </P>
      <P>
        As an enclave boots, the hardware computes a cryptographic hash, a{' '}
        <strong>measurement</strong>, of exactly what was loaded: firmware, kernel, and the
        application code. The CPU then signs that measurement with a private key fused into the chip
        at manufacture, whose certificate chains back to the vendor. The result is a signed{' '}
        <strong>quote</strong>.
      </P>
      <P>
        Before sending anything sensitive, a client asks for that quote and checks three things:
      </P>
      <UL items={[
        <><strong>Is the signature valid</strong> and does it chain to a genuine CPU vendor root? This proves real hardware, not an emulator.</>,
        <><strong>Does the measurement match</strong> the code that is supposed to be running? This proves the enclave was not loaded with a modified build that copies prompts to a log file.</>,
        <><strong>Is the firmware current</strong>, with no known-vulnerable versions? This proves it is not a machine left deliberately unpatched.</>,
      ]} />
      <P>
        Only if all three pass does the client establish an encrypted channel whose keys terminate{' '}
        <em>inside</em> the enclave. That last detail matters enormously: the session is encrypted to
        the enclave, not to the server operating it. The operator relays ciphertext it cannot read.
      </P>
      <Pull>
        Attestation turns &ldquo;trust us&rdquo; into &ldquo;verify the hardware, then trust the
        math.&rdquo;
      </Pull>

      <H2>What TEEs do not protect against</H2>
      <P>
        Any honest account has to include the limits, because a security property you misunderstand
        is worse than one you do not have.
      </P>
      <UL items={[
        <><strong>You still trust the CPU vendor.</strong> The root of trust is a key Intel, AMD, or NVIDIA put in the chip. If that process is compromised, so is everything above it. Confidential computing relocates trust; it does not eliminate it.</>,
        <><strong>Side channels are real.</strong> Enclaves have historically been vulnerable to timing, power, and speculative-execution attacks that infer secrets without reading memory directly. This is an active research area with a steady history of findings and patches.</>,
        <><strong>Attestation only helps if it is actually checked.</strong> A client that requests a quote and skips verification gets no security at all. This is the most common real-world failure, and it is silent.</>,
        <><strong>The enclave code still has to be trustworthy.</strong> Attestation proves <em>which</em> code is running, not that the code is well written. An enclave whose program deliberately logs your prompts is perfectly attestable and completely unsafe.</>,
        <><strong>Metadata usually leaks.</strong> Request timing, sizes, and frequency are visible to whoever runs the machine, even when contents are not.</>,
      ]} />
      <P>
        Confidential computing is a genuine and large improvement over an administrator with
        database access. It is not magic, and it is not a substitute for encrypting your data at
        rest with keys the service never holds.
      </P>

      <H2>Where Morpheus comes in</H2>
      <P>
        <A href="https://mor.org">Morpheus</A> is a permissionless network for AI inference. We
        covered it in depth with David Johnston, the man who coined &ldquo;DApps&rdquo; in 2013,
        now its lead technologist, in{' '}
        <A href="https://myargoquest.com/blog/david-johnston-morpheus">an earlier conversation</A>.
      </P>
      <P>
        The structural point is that Morpheus runs no hardware of its own. It is a set of smart
        contracts on Ethereum and Base that coordinate a marketplace: independent providers supply
        model inference on their own machines and are paid on-chain. There is no company operating a
        datacenter that could decide to retain your prompts, because there is no company in the
        serving path at all, there is a protocol, and a set of providers competing under it.
      </P>
      <P>
        That decentralization solves a governance problem, not a privacy one. Spreading inference
        across many independent operators means no single company holds everything, but on its own,
        it means your prompt is now readable by <em>whichever</em> operator happened to serve it.
        Decentralization without confidentiality can widen the exposure rather than narrow it.
      </P>
      <P>
        The two ideas only work together. Decentralization removes the single trusted company;
        enclaves remove the need to trust the individual operator who replaces it. Morpheus
        providers running confidential hardware serve requests they cannot themselves read. That
        combination, an open marketplace where participants are structurally unable to inspect what
        passes through them, is what attracted us.
      </P>
      <P>
        From an engineering standpoint it is refreshingly ordinary to consume: an OpenAI-compatible
        endpoint at <code>api.mor.org</code>, so an existing integration is roughly a base URL, a
        key, and a model id.
      </P>

      <H2>How Argo actually uses this</H2>
      <P>
        Argo layers two independent protections, and it is worth being precise about which does
        what.
      </P>
      <P>
        <strong>First, zero-knowledge encryption at rest.</strong> Your entries are encrypted on
        your device with a key derived there and never sent to us. What lands in our database is
        ciphertext. This is the stronger of the two guarantees and it does not depend on enclaves,
        hardware vendors, or any provider behaving well. If our entire database leaked tomorrow, it
        would leak unreadable blobs.
      </P>
      <P>
        <strong>Second, confidential inference.</strong> When you ask for a reflection, the model has
        to see plaintext. That work (chat, insights, summaries, and daily prompts) runs on Morpheus
        inside a hardware enclave, so the plaintext exists only inside a boundary the compute
        provider cannot read.
      </P>
      <P>
        Live voice calls are the interesting case, because they are the one place the design has to
        bend. To reference your past entries while you are speaking, something has to decrypt the
        relevant ones in real time. Our server holds your key <em>in memory only</em>, for the
        duration of the call, decrypts just the entries needed to answer, and wipes both the key and
        the decrypted text the moment the call ends. Nothing is written to disk. It is the one
        moment the architecture asks for more trust than the rest of the app, which is why it is
        called out explicitly in the consent screen rather than buried.
      </P>

      <H2>The asterisk: voice does not run in the enclave today</H2>
      <P>
        We recently moved live voice inference off Morpheus and onto a conventional AI provider. The
        honest reason is latency.
      </P>
      <P>
        A spoken conversation has a deadline that text does not. If a reply takes four seconds, the
        conversation is broken, you start talking over it, or you assume it hung up. Our voice
        pipeline gives the language model roughly a two-second budget to produce its first token,
        and when the enclave-backed models we had been using could no longer meet that budget, voice
        calls stopped working entirely.
      </P>
      <P>
        We had two options: leave a headline privacy claim intact and ship a feature that did not
        work, or move voice to a faster provider and say so plainly. We chose the second, and
        updated the privacy policy, the marketing copy, and the in-app consent screen the same week.
      </P>
      <Note>
        <strong>Where things stand.</strong> Chat, insights, summaries, and daily prompts run inside
        a hardware enclave on Morpheus. Live voice calls currently run on a conventional AI provider
        (Together AI), because no enclave-backed model is yet fast enough for real-time speech.
        Zero-knowledge encryption at rest is unchanged and applies to everything. Moving voice into
        the enclave is on our roadmap, and we will say so here when it lands.
      </Note>
      <P>
        We would rather publish an accurate asterisk than an elegant claim that is not true. A
        privacy promise you have to caveat is worth more than one you have to defend.
      </P>

      <H2>What we learned running on it</H2>
      <P>
        One practical note for anyone building on decentralized inference, because it cost us real
        downtime.
      </P>
      <P>
        Model availability on an open marketplace is <em>volatile</em> in a way that a commercial API
        is not. Capacity is finite and gets reallocated toward priority models, and when that
        happens a model id you have been using for months starts returning{' '}
        <code>503 model_unavailable</code>, not deprecated, not announced, just gone. During a
        recent incident we swept the full catalogue and found that the large majority of listed
        models were refusing traffic, including every one from two major families.
      </P>
      <P>
        The lesson is that on a decentralized network a model id is an{' '}
        <strong>operational variable, not a constant</strong>. It belongs in configuration, behind a
        provider switch you can flip without a deploy, with health checks and latency telemetry on
        every call. We had the first of those and not the others, which is why a provider-side
        capacity change became a user-visible outage instead of a log line. That is now fixed.
      </P>

      <H2>Why this is worth the trouble</H2>
      <P>
        All of this is more work than calling a normal API. Enclaves constrain which models you can
        run and what hardware they run on. Decentralized networks are less predictable than a vendor
        with an SLA. Zero-knowledge encryption means we cannot do a great many convenient things,
        because we genuinely cannot read the data.
      </P>
      <P>
        We think a journal earns that cost. The value of writing honestly depends completely on
        feeling safe enough to be honest, and that feeling should rest on something sturdier than a
        promise. Not because anyone at Argo intends to read your entries, but because the
        architecture should make the question irrelevant.
      </P>
      <Pull>
        The goal is not a company you trust with your journal. It is a journal that does not require
        you to trust a company.
      </Pull>
      <P>
        Argo is <A href="https://github.com/kon-rad/luminalog-oss">open source</A>. The encryption,
        the inference routing, and the voice pipeline described here are all readable. Privacy
        claims should be checkable, and that includes the asterisks.
      </P>

      <H2>Read more</H2>
      <P>
        <A href="https://mor.org">Morpheus</A>, the protocol.{' '}
        <A href="https://tech.mor.org">Morpheus tech and privacy walkthrough</A>.{' '}
        <A href="https://myargoquest.com/privacy">Our privacy policy</A>, including the third-party
        processors named in Section 6.
      </P>
    </>
  )
}

/* ── Post: Pitching Argo at Startup Village Borneo ── */
function PitchingArgoStartupVillageBorneoContent() {
  return (
    <>
      <Figure
        src="/blog/pitching-argo-startup-village-borneo-1.jpg"
        alt="Konrad on stage at the Voco, presenting Argo"
        width={1920}
        height={1080}
        priority
      />
      <P>
        Konrad Gnat pitched Argo on stage at the Startup Village Borneo Demo Day, held September
        9, 2026, at the Voco in Kuching, Sarawak.
      </P>

      <H2>What Startup Village Borneo is</H2>
      <P>
        Startup Village Borneo is Superteam Malaysia&apos;s week-long founder program, running
        September 6&ndash;9, 2026, in Kuching: an Amazing Race through the city to open the week,
        workshops through the middle days, and a public Demo Day to close it out. The organizers
        put up a $10,000 prize pool spread across the Demo Day pitch competition, the Amazing
        Race, a content track, and a sustainability track, with separate partner challenges from
        Meteora, RedotPay, and GetBlock. The judging panel for Demo Day was Sam (SOCOE), Chaerin
        (Solana Foundation), Jacob (Superscrypt), and Anatoly (No Limit Holdings).
      </P>

      <H2>The pitch</H2>
      <P>
        Konrad&apos;s pitch opened on a problem: ideas end up scattered across other people&apos;s
        databases, half-formed and easy to lose. Argo&apos;s answer, in his framing, is a private
        AI app built around daily journaling: writing, speaking, or recording a video entry, and
        using that as raw material for a pitch, a post, or a decision. &ldquo;It&apos;s zero
        knowledge, open source,&rdquo; he said. &ldquo;We don&apos;t store any of your data on our
        servers.&rdquo;
      </P>
      <P>
        He described the mechanics: speak, write, or record a journal entry, and get back entry
        insights, a short summary, follow-up prompts, and related ideas pulled from past entries,
        plus a short social post drafted from the entry and a daily notification pulled from your
        own past writing. On traction, he said Argo has been live for two weeks with ten paying
        subscribers, alongside an existing audience built over more than 100 events and 517 hours
        watched on YouTube. He closed on where the product lives now, signed in with Solana, at
        myargoquest.com, and a flywheel he&apos;s building around it with AI agent classes.
        He&apos;s a sole founder.
      </P>

      <H2>A quick interview, and a hopeful sign-off</H2>
      <Figure
        src="/blog/pitching-argo-startup-village-borneo-2.jpg"
        alt="The post-pitch interview in front of the Startup Village Borneo backdrop"
        width={1920}
        height={1080}
        caption="Right after the pitch, in front of the event's step-and-repeat backdrop."
      />
      <P>
        Right after the pitch, Konrad did a short interview in front of the event&apos;s
        step-and-repeat backdrop. Asked how it went, he said &ldquo;I nailed it,&rdquo; pointing
        to two specifics: not filling pauses with &ldquo;ums&rdquo; or &ldquo;likes,&rdquo; and
        having his ideas in a clear order. He was candid about what he&apos;d add with more time:
        more on the competitive landscape and how the idea is validated. Asked whether he could
        read the judges&apos; reaction, he said he couldn&apos;t: &ldquo;I made eye contact with
        them a few times. I don&apos;t know what they&apos;re thinking.&rdquo; He guessed the
        reaction was positive.
      </P>
      <Figure
        src="/blog/pitching-argo-startup-village-borneo-3.jpg"
        alt="Right after the pitch: First place, let's go"
        width={1920}
        height={1080}
        caption="“First place, let's go”: a hopeful line, not a result."
      />
      <P>
        The interview closes on &ldquo;First place, first place, let&apos;s go,&rdquo; a hopeful
        line, not a result. Startup Village Borneo&apos;s own schedule places judging and the
        prize announcement after the pitch block this was filmed in, so no outcome had been
        decided yet at this point. The video doesn&apos;t show or state one.
      </P>
      <P>
        The rest of the interview is logistics: the camera is a GoPro, bought rather than found;
        he&apos;s heading next to Singapore, then Token2049, then Devcon in Mumbai.
      </P>

      <H2>Watch and follow</H2>
      <P>
        Subscribe on <A href="https://www.youtube.com/@myargoquest">YouTube</A> or visit{' '}
        <A href="https://myargoquest.com">myargoquest.com</A>.
      </P>
    </>
  )
}

/* ── Post: What's new in Argo 1.0.1: Mirror and wallet unlock ── */
function ArgoMirrorWalletUnlockContent() {
  return (
    <>
      <Figure
        src="/blog/argo-1-0-1-mirror-wallet-unlock-1.jpg"
        alt="An open leather journal and a phone glowing with warm light, side by side on a wooden desk"
        width={2752}
        height={1536}
        priority
      />
      <P>
        Argo 1.0.1 is out on the App Store, and it carries two real changes rather than the usual
        pile of small fixes. The first is a rework of the daily encouragement notifications, now
        called Mirror. The second is a new way to unlock your journal using an Ethereum wallet,
        alongside the two ways you already had. Here&apos;s what actually changed and why it might
        matter to how you use the app.
      </P>

      <H2>Mirror: three honest reflections instead of five generic ones</H2>
      <P>
        The old &ldquo;daily encouragement&rdquo; feature sent you a rotating message once a day,
        picked from a small set of generic lines. It was fine, but it wasn&apos;t really about
        you. Mirror replaces it with three short reflections a day, one in the morning, one in the
        afternoon, and one in the evening, and each one is grounded in what you actually wrote.
      </P>
      <P>
        That distinction matters more than it sounds. A generic encouragement can go out to
        anyone. A Mirror reflection only gets generated from your own recent entries, so if you
        haven&apos;t written anything worth reflecting on, you won&apos;t get a notification
        pretending otherwise. No entries this week means no invented insight showing up on your
        lock screen.
      </P>
      <Figure
        src="/blog/argo-1-0-1-mirror-wallet-unlock-2.jpg"
        alt="A hand writing in a paper journal at night, with a phone showing a warm glowing notification just out of focus"
        width={2400}
        height={1792}
      />
      <P>
        If you miss one, it isn&apos;t gone. Settings now has a Mirror History screen where every
        delivered reflection sits with its time of day and timestamp, newest first. It&apos;s a
        small addition, but it turns what used to be a disposable push notification into something
        you can actually go back and read.
      </P>
      <P>
        Mirror is on by default, same as the old encouragements were, and it asks for the same
        notification permission the app already requested before. You can turn it off in Settings
        at any time, which cancels anything still pending for the day and stops new ones from
        being scheduled.
      </P>

      <H2>A third way to unlock your journal</H2>
      <P>
        The bigger structural change in this release is optional, and it&apos;s aimed at a
        specific kind of user: someone who already has a crypto wallet and wants one less thing to
        remember.
      </P>
      <P>
        Argo has always protected your journal with end-to-end encryption, and until now you could
        unlock it two ways: through iCloud Keychain, or with a recovery code you saved somewhere
        safe. 1.0.1 adds a third option. If you connect an Ethereum wallet to your account, you can
        enroll it as a key. From then on, signing a message with that wallet is enough to unlock
        your journal on a new device, no recovery code required.
      </P>
      <Figure
        src="/blog/argo-1-0-1-mirror-wallet-unlock-3.jpg"
        alt="A glowing gold key hovering above the clasp of a closed leather journal"
        width={2752}
        height={1536}
      />
      <P>
        It&apos;s worth being specific about what this is and isn&apos;t. It&apos;s purely
        additive: your iCloud Keychain and recovery code both keep working exactly as before,
        whether or not you set up a wallet. And it only works with a wallet you personally hold
        the keys to. Smart-contract wallets like Gnosis Safe or Argent get rejected at enrollment
        with a plain explanation, because they can&apos;t produce the kind of deterministic
        signature the unlock check depends on. If you sign in from a wallet on Base, Arbitrum, or
        Optimism instead of Ethereum mainnet, that&apos;s fine too, the feature was built to work
        across chains from the start.
      </P>
      <P>
        The setup lives in Settings, under a card that only shows up once you&apos;ve linked a
        wallet. Tap it, sign the message your wallet prompts you for, and the card switches to
        show your wallet is enrolled. If you ever lose access to your device and need to get back
        in on a new one, you&apos;ll see an &ldquo;Unlock with Wallet&rdquo; option sitting next to
        the recovery code screen, and you can switch between the two if the first one doesn&apos;t
        work.
      </P>

      <H2>Three keys, one journal</H2>
      <Figure
        src="/blog/argo-1-0-1-mirror-wallet-unlock-4.jpg"
        alt="A silver cloud charm, a wax-sealed envelope, and a gold key resting together on a dark surface"
        width={2400}
        height={1792}
      />
      <P>
        Put together, that&apos;s iCloud, a recovery code, and now a wallet, three independent ways
        into the same encrypted journal. None of them depends on the others, so losing access to
        one doesn&apos;t lock you out if you&apos;ve set up another. You don&apos;t have to touch
        any of this to keep journaling the way you already do. Mirror will keep showing up three
        times a day if you leave it on, and your existing unlock method will keep working exactly
        as it did in 1.0.0.
      </P>
      <P>
        Both changes are live now in the current build. If you update and don&apos;t see Mirror
        History or the wallet card in Settings right away, force-close the app and reopen it.
      </P>
      <P>
        <em>Argo Writer Agent</em>
      </P>
    </>
  )
}

/* ── Post: How Argo keeps your journal private ── */
function ArgoEncryptionContent() {
  return (
    <>
      <Figure
        src="/blog/how-argo-encryption-works-1.jpg"
        alt="A leather journal on a dark desk, its clasp locked, lit by a single warm lamp"
        width={2752}
        height={1536}
        priority
      />
      <P>
        A journal only works if you can be honest in it. And you can only be honest in it if
        you are sure nobody else is reading.
      </P>
      <P>
        Most apps answer that worry with a policy: a paragraph promising they will not look.
        Argo answers it with the way the system is built. We designed it so that we{' '}
        <em>cannot</em> read your stored journal, even if we wanted to, and even if our
        database leaked.
      </P>
      <P>
        This post walks through how that works: where your key is created, where it is
        stored, what our servers actually hold, and the few places where your words do leave
        your device. No cryptography background needed.
      </P>
      <H2>What &ldquo;zero-knowledge&rdquo; means at Argo</H2>
      <P>
        You will see Argo described as zero-knowledge. In our case the phrase means one
        specific thing: <strong>our servers never store the key that unlocks your
        journal.</strong> Everything we keep is scrambled, and the only way to unscramble it
        is with a key that lives on your side.
      </P>
      <P>
        It does not mean your words never touch a server. When you ask the AI to reflect on
        an entry, that entry has to be readable by the AI for a moment. We will get to
        exactly when that happens, because a privacy claim is only useful if you know where
        its edges are.
      </P>
      <H2>Your key is made on your phone</H2>
      <P>
        The first time you set up Argo, your phone generates a random 256-bit key. There are
        so many possible keys of that size that guessing yours is not a realistic attack.
        This key, which we call your data key, stays on your side. The only time it ever
        reaches our servers is during a live voice call, an exception we explain in full
        below.
      </P>
      <P>
        Every time you save an entry, the app locks it with that key before it leaves your
        phone, using AES-256-GCM, the same encryption standard banks and governments rely
        on. A few details make this sturdier than &ldquo;it&apos;s encrypted&rdquo;:
      </P>
      <UL
        items={[
          <>Each piece of text (the entry, its title, its summary, a chat message) is locked separately, with fresh randomness every time, so two identical entries do not look identical once locked.</>,
          <>Each locked piece is stamped with what it is, like &ldquo;journal content&rdquo; or &ldquo;chat message&rdquo;. If anyone moved a locked title into the slot for an entry body, the app would refuse to open it.</>,
          <>If a single bit has been tampered with, decryption fails outright. The app will show you nothing rather than show you something altered.</>,
        ]}
      />
      <P>
        Photos, voice recordings and videos are locked the same way, in small numbered
        chunks, so a large video never has to sit fully unlocked in memory and nobody can
        reorder or cut the chunks without the app noticing.
      </P>
      <H2>Where the keys are kept</H2>
      <Figure
        src="/blog/how-argo-encryption-works-2.jpg"
        alt="Three small keys resting on a sheet of warm paper beside an open, empty lockbox"
        width={2400}
        height={1792}
      />
      <P>
        If your data key only lived on one phone, losing that phone would mean losing your
        journal. So the app makes locked copies of the data key itself, each one opened by
        something only you control:
      </P>
      <UL
        items={[
          <><strong>Your iCloud Keychain.</strong> The app creates a second key and stores it in your iCloud Keychain, which Apple syncs between your own devices. That key opens one locked copy of your data key. This is why a new iPhone signed into your Apple account usually unlocks Argo without asking you anything.</>,
          <><strong>Your recovery code.</strong> At signup you get a printable recovery code. The app turns that code into another key, which opens a second locked copy. The code is shown to you once, and we do not keep it anywhere.</>,
          <><strong>Your crypto wallet, if you choose.</strong> Since Argo 1.0.1 you can also enroll an Ethereum wallet you personally hold. Signing a message with it opens a third locked copy.</>,
        ]}
      />
      <P>
        Our servers store these locked copies, because your devices need to fetch them. But
        we hold none of the things that open them. To us, each one is a sealed envelope with
        no key attached.
      </P>
      <P>
        There is no back door. If you lose your devices, your recovery code, and your
        enrolled wallet, nobody can unlock your journal, including us. That is the cost of a
        system where we cannot read your data, and we think it is the right one for a
        journal.
      </P>
      <H2>What happens when you sign in</H2>
      <P>
        <strong>On a phone you already use</strong>, the app reads the key from your iCloud
        Keychain, fetches its locked copy of your data key, and opens it on the phone. No
        server is ever asked to decrypt anything.
      </P>
      <P>
        <strong>On a new phone without your iCloud Keychain</strong>, the app asks for your
        recovery code (or a wallet signature), opens your data key on the device, then sets
        up a fresh iCloud Keychain key so you are not asked again.
      </P>
      <P>
        <strong>When you create an account</strong>, the app is careful about order. It
        makes your data key, saves both locked copies, then fetches them back and confirms
        each one really opens to the same key, all before a single entry is encrypted. Only
        then does it show you your recovery code, and it waits for you to confirm you saved
        it. You cannot end up with an encrypted journal that has no working backup.
      </P>
      <P>
        <strong>In a web browser</strong>, iCloud Keychain is not available, so the recovery
        code is the way in. You type it once. The browser then stores a key of its own that
        can be used but cannot be copied out of the browser, so later visits open without
        asking. Two honest limits: Safari clears that stored key after about a week without
        a visit, so occasional Safari users will type their code again, and no browser
        storage can protect you from malicious code running on the page itself. That is a
        limit of encryption in any browser, and we would rather tell you than imply
        otherwise.
      </P>
      <H2>What our database actually contains</H2>
      <P>
        If someone copied our entire database and file storage tomorrow, here is what they
        would get: your entries, titles, summaries, insights, chat and voice transcripts,
        profile details, photos, recordings and videos, all as scrambled data with no key to
        open them.
      </P>
      <P>
        Search works the same way. When Argo finds entries related to the one you are
        reading, the work of understanding your writing happens on your phone. The resulting
        search data is encrypted before it is stored, so our servers keep it without being
        able to read it.
      </P>
      <P>
        What we can see is the information a service needs to run: your account ID, email,
        display name and timezone, when entries were created, how many words they contain,
        and how long a recording runs. A few small settings fields are also stored
        unencrypted today, such as custom instructions you write for summaries. None of them
        hold entry content, and encrypting them is on our list.
      </P>
      <H2>When the AI needs to read</H2>
      <Figure
        src="/blog/how-argo-encryption-works-3.jpg"
        alt="A single candle lit inside a dark room, its light falling on an open page for a brief moment"
        width={2528}
        height={1696}
      />
      <P>
        An AI cannot reflect on words it cannot read. So when you use an AI feature, such as
        an insight on an entry, a chat, or a daily prompt, your phone unlocks the needed
        text, sends it over an encrypted connection to our server, which passes it to the AI
        model for that one request. The result comes back to your phone, which locks it
        before saving. Our server keeps nothing from the exchange.
      </P>
      <P>
        Today that AI processing runs by default on Venice AI, under a privacy tier that is
        anonymized and encrypted in transit, with no prompt retention. We can also route
        these features to Morpheus, which runs models inside a hardware secure enclave, as
        we explained in <A
        href="https://myargoquest.com/blog/how-private-ai-works-morpheus-tees-enclaves">an
        earlier post</A>. Your journal is never used to train AI models, ours or our
        providers&apos;.
      </P>
      <P>
        Some newer features show how far this design goes. Argo writes short summaries of
        each of your days, weeks, months and years. A typical app would run that as a job on
        its own servers every night. Ours cannot, because the server cannot read your
        entries. So your phone does the bookkeeping: when you open the app, it checks which
        periods are missing or out of date, unlocks just the entries those summaries need,
        asks for each summary, then locks the result and saves it.
      </P>
      <P>
        Voice and video entries follow the same rule. To produce a transcript, the audio is
        sent to a speech-to-text provider named in our privacy policy, which transcribes it
        and does not keep it for other purposes. Dictating into a text field is different:
        that runs entirely on your phone.
      </P>
      <H2>The one exception: live voice calls</H2>
      <Figure
        src="/blog/how-argo-encryption-works-4.jpg"
        alt="An old brass desk microphone in a dim room, a warm glow fading around it as if the light is about to go out"
        width={2400}
        height={1792}
      />
      <P>
        Live voice calls are the one place where our server does see your key, and it is
        worth spelling out.
      </P>
      <P>
        During a call, the AI needs to recall relevant moments from your past entries while
        you are talking, faster than your phone could look them up and send them over. So
        when a call starts, your phone hands our server your data key for the length of that
        call. The server uses it to open only the past entries needed to answer you, and
        holds the key and the opened text in memory only. Nothing from the call is written
        to disk or logged. When the call ends, the key is wiped from memory, and if the
        end-of-call signal never arrives, a 30-minute timer wipes it anyway.
      </P>
      <P>
        The call recording takes a short detour too. Our voice-call partner, Vapi, produces
        the recording, and our server briefly holds an unencrypted copy until your phone
        next opens, encrypts it, and stores the locked version. Our unencrypted copy is then
        deleted. Vapi also keeps its own copy for a limited period.
      </P>
      <P>
        The model that talks with you during a call runs on Venice AI, not inside a secure
        enclave, because no enclave model is fast enough yet for real-time conversation. It
        is the one part of Argo that asks you for more trust than the rest, which is why the
        app&apos;s consent screen calls it out instead of burying it.
      </P>
      <H2>What we can do, and what we cannot</H2>
      <P>
        There is exactly one thing our server can do with your key material: destroy it.
        Deleting the locked copies of your data key makes everything encrypted with it
        permanently unreadable, a step known as crypto-shredding. We can delete your
        journal. We cannot read it.
      </P>
      <P>
        Two things are public on purpose. If you mint your Soul NFT, its public record
        includes your first name and your journaling stats, like days journaled and total
        words. The in-app leaderboard shows display names and stats for top users. Neither
        includes a word of what you wrote, and both are explained at the point you opt in.
      </P>
      <H2>Check it yourself</H2>
      <P>
        Privacy claims should be something you can verify, not something you take on faith.
        Argo&apos;s code is <A href="https://github.com/kon-rad/luminalog-oss">open
        source</A>, including the encryption on your phone and in the browser, the key
        handling, and the voice pipeline described here. Our <A
        href="https://myargoquest.com/privacy">privacy policy</A> names the outside services
        that process your data.
      </P>
      <P>
        The aim was never a company you trust with your journal. It was a journal that works
        without needing to trust us.
      </P>
      <P>
        <em>Argo Writer Agent</em>
      </P>
    </>
  )
}

/* ── Post: What Argo knows ── */
function WhatArgoKnowsContent() {
  return (
    <>
      <Figure
        src="/blog/what-argo-knows-1.jpg"
        alt="A small box of cream index cards on a dark desk, a few pulled halfway out, lit by a brass lamp"
        width={2752}
        height={1536}
        priority
      />
      <P>
        A good friend remembers that your sister is called Maya, that you moved to a new city in the spring, and that you have been trying to run three mornings a week. You don&apos;t have to explain it again every time you talk.
      </P>
      <P>
        Until now Argo didn&apos;t remember things like that. It could find old entries that sounded related to what you were writing, but it had no plain list of the facts of your life. The next update of Argo for iPhone adds one. It is called <strong>What Argo knows</strong>, and it lives in the Menu tab.
      </P>
      <P>
        This post covers what goes on that list, how Argo learns it, what happens when your life changes, and how much control you have over it. We built it around one rule: you should be able to see everything Argo remembers about you, and correct any of it.
      </P>
      <H2>A short list of facts</H2>
      <P>
        What Argo knows is a list of durable facts about you, grouped under headings: people, places, work and projects, goals, values, preferences, struggles, commitments, and life events. Each fact is one short sentence written to you, such as &ldquo;Maya is your younger sister.&rdquo; or &ldquo;You live in Forest City.&rdquo;
      </P>
      <P>
        &ldquo;Durable&rdquo; matters here. Argo is told to skip moods, one-off days, and plans for a single afternoon. A bad Tuesday doesn&apos;t make it onto the list. A new job does. It also records only what you actually wrote. It is told never to guess at your feelings, your motives, or a diagnosis. If you write that you have asthma, that can become a fact. If you write that you were short of breath on a hike, it should not turn into one.
      </P>
      <P>
        Tap any fact and you can see the entries it came from, with their dates, and open them. Nothing on the list exists without at least one of your entries behind it.
      </P>
      <H2>How Argo learns, without our servers keeping anything</H2>
      <Figure
        src="/blog/what-argo-knows-2.jpg"
        alt="An old brass scale on warm paper, a handwritten letter in one pan and a blank card in the other"
        width={2400}
        height={1792}
      />
      <P>
        Argo&apos;s servers can&apos;t read your stored journal (we explained why in <A href="https://myargoquest.com/blog/how-argo-encryption-works">our post on encryption</A>). That rules out the usual approach of a nightly job on our side that reads everything you wrote. Your phone does the work instead.
      </P>
      <P>
        Every so often, when you open the app, your phone looks for entries it hasn&apos;t read yet. It waits until an entry is at least 30 minutes old, so a voice memo has time to finish transcribing and your quick edits land first. Then it takes up to eight of those entries, oldest first, unlocks them, and sends them over an encrypted connection to our server along with the facts you already have. The server passes them to the AI model for that one request. The model answers with a short list of changes, and your phone decides what to do with each one, locks the result, and saves it.
      </P>
      <P>
        The server keeps nothing from that exchange and doesn&apos;t log what you sent. The AI runs on Venice AI, the same private provider as Argo&apos;s other AI features, and your journal is never used to train models.
      </P>
      <P>
        The model can suggest four kinds of change:
      </P>
      <UL
        items={[
          <>add a new fact</>,
          <>confirm a fact you already have, which links the new entry as more evidence</>,
          <>update a fact with more detail, when it is still true in the same way</>,
          <>mark a fact as no longer true</>,
        ]}
      />
      <P>
        There is no &ldquo;delete&rdquo; in that list on purpose. The model can&apos;t remove anything from your history. Only you can.
      </P>
      <P>
        The dates come from your entries, not the model. When Argo says a fact started or ended, that date is taken from the entry that showed it, because a date the model writes down could be made up.
      </P>
      <P>
        The first time it runs, Argo works through your existing journal a few entries at a time, in order, over several visits. Settings shows the progress, for example &ldquo;Read 120 of 300 entries&rdquo;.
      </P>
      <H2>When your life changes</H2>
      <Figure
        src="/blog/what-argo-knows-3.jpg"
        alt="Two old house keys side by side on a wooden table, one tarnished and one bright, morning light from a window"
        width={2528}
        height={1696}
      />
      <P>
        Facts go out of date. You move, change jobs, end a relationship, give up a goal. Most memory systems handle that by overwriting the old fact. We think that throws away part of your story.
      </P>
      <P>
        Argo keeps it. When a newer entry clearly shows that a fact stopped being true, Argo ends it with a date and keeps it in your history, then adds the new fact beside it. So instead of losing &ldquo;You live in Kuching.&rdquo; when you move, you get the old fact marked as ending in June, and &ldquo;You live in Forest City.&rdquo; as a new one. Open a fact&apos;s history and you can see when it was true.
      </P>
      <P>
        The bar for ending a fact is high on purpose. The model is told that doubt, a bad day, or not mentioning something for a while is not enough. It needs an entry, written after the fact began, that says it is over. Argo processes your journal in date order so that this works.
      </P>
      <H2>You have the last word</H2>
      <Figure
        src="/blog/what-argo-knows-4.jpg"
        alt="A fountain pen resting on a blank card beside a single fresh stroke of ink"
        width={2400}
        height={1792}
      />
      <P>
        Everything on the list can be changed by you. You can:
      </P>
      <UL
        items={[
          <>edit any fact, in your own words</>,
          <>add a fact Argo hasn&apos;t picked up</>,
          <>mark a fact &ldquo;Not true anymore&rdquo;, with the date it ended</>,
          <>mark it &ldquo;Still true&rdquo; if Argo ended it by mistake</>,
          <>delete it</>,
        ]}
      />
      <P>
        Once you have written, edited, or confirmed a fact, Argo will never rewrite it. If a later entry seems to contradict one of your facts, Argo doesn&apos;t change it. It shows you a note under &ldquo;Argo noticed&rdquo; with what your journal now says, and you pick: accept the change, or keep it as is.
      </P>
      <P>
        Deleting sticks. When you delete a fact, Argo remembers that you said no and tells the model never to add it, or anything that means the same thing, again. You won&apos;t find it creeping back a week later from an old entry.
      </P>
      <P>
        There are also two bigger switches. <strong>Learn from my journal</strong> turns the learning on or off. While it&apos;s off, Argo reads nothing new, but you keep the facts you have. <strong>Forget everything</strong> deletes the whole list, including the record of what you deleted, and turns learning off so nothing comes back until you switch it on again.
      </P>
      <H2>Where the facts are used</H2>
      <P>
        The first place Argo uses this list is voice calls. When you start a call, your phone adds your current facts to the call&apos;s context, up to 30 of them, with the ones you wrote or confirmed first. That is why Argo can ask how the new place is working out without you explaining that you moved.
      </P>
      <P>
        Facts that have ended aren&apos;t sent, and neither are facts you deleted. Text chat will use the list later. We started with voice, where repeating yourself is most tiring.
      </P>
      <H2>How it is stored</H2>
      <P>
        Like the rest of your journal, every fact is locked on your phone before it is saved. That includes the sentence itself, its name, its proposed changes, and even its category, because an unlocked category would let anyone count how many &ldquo;struggles&rdquo; or &ldquo;people&rdquo; you have. What our database can see is bookkeeping: whether a fact is current or ended, its dates, and the IDs of the entries it came from. It can&apos;t see the words.
      </P>
      <P>
        The code is <A href="https://github.com/kon-rad/luminalog-oss">open source</A>, including the prompt that tells the model what counts as a fact. If you want to check that Argo does what this post says, you can read it.
      </P>
      <P>
        What Argo knows arrives with the next update of Argo for iPhone. Open the Menu tab, tap What Argo knows, and see what it has picked up so far. If something is wrong, change it. That is what the list is for.
      </P>
      <P>
        <em>Argo Writer Agent</em>
      </P>
    </>
  )
}

/* ── Post: One rulebook for two agents (agent harness) ── */
const harnessPre: React.CSSProperties = {
  margin: '24px 0',
  padding: '18px 20px',
  background: 'var(--surfaceAlt)',
  border: '1px solid var(--hairline)',
  borderRadius: 12,
  fontSize: 13.5,
  lineHeight: 1.6,
  overflowX: 'auto',
  whiteSpace: 'pre-wrap',
  color: 'var(--text)',
}

const HARNESS_RESUME_BLOCK = `## Resume
- **Task:** what this project is doing right now
- **Outputs:** the paths that hold the current work
- **Completed:** finished stages and the checks that passed
- **Decisions:** confirmed choices, each with where it was decided
- **Open issues:** missing evidence, blockers, open questions
- **Next action:** one concrete step the next agent can start on`

const HARNESS_AGENT_BLOCK = `Set up a shared agent harness in this repository so Claude Code and Hermes follow the same rules.

1. Instructions: make AGENTS.md the single source of rules. Merge any rules that exist
   only in CLAUDE.md into AGENTS.md. Replace CLAUDE.md with a short header and the line
   "@AGENTS.md". For rules that apply to one folder only, create <folder>/AGENTS.md and
   <folder>/CLAUDE.md containing "@AGENTS.md". Show me the diff before deleting anything.

2. Guard: create .agents/hooks/guard.py. Read a JSON payload from stdin. If
   hook_event_name is "PreToolUse" (Claude Code), block by printing the reason to stderr
   and exiting 2. If it is "pre_tool_call" (Hermes), block by printing
   {"decision": "block", "reason": "..."} and exiting 0; otherwise print {}.
   Shell tools are Bash / terminal (input key: command). File tools are Read, Edit, Write /
   read_file, write_file, patch (input key: file_path or path). Ask me which incidents to
   guard against; start with: printing .env files, rsync --delete without -n, and
   git push --force. Split shell commands on ; && || | and judge each segment by its
   first word. Any exception must exit 0. Write tests for both payload formats and run them.

3. Wiring: add a PreToolUse hook running the guard to .claude/settings.json. Add
   hooks.pre_tool_call (matcher "terminal|read_file|write_file|patch|search_files") to the
   Hermes config.yaml, and add the exact command string to
   ~/.hermes/shell-hooks-allowlist.json. Run: hermes hooks doctor

4. Skills: create .agents/skills/. Symlink .claude/skills to it. Add it to
   skills.external_dirs in the Hermes config.

5. Reviewer: create .agents/skills/fact-check/SKILL.md. It takes an output path and its
   sources and returns a table (claim, verdict: verified / incorrect / unresolved, source,
   correction). It never edits files. For Claude Code, add .claude/agents/fact-checker.md
   with tools: Read, Grep, Glob, WebFetch, WebSearch.

6. Handoff and done: add to AGENTS.md (a) a "## Resume" block format with Task, Outputs,
   Completed, Decisions, Open issues, Next action, required at the top of every project
   dev log, and (b) a completion contract format with Outcome, Verification, Constraints,
   Boundaries, Stop when, used for /goal and scheduled jobs.

7. Test live: in a new session of each agent, try to cat a dummy .env file and run
   rsync --delete on two scratch folders. Both must be blocked. Report the results.`

function AgentHarnessContent() {
  return (
    <>
      <Figure
        src="/blog/agent-harness-claude-code-hermes-1.jpg"
        alt="Two desks side by side in a warm study, one open notebook shared across both"
        width={1920}
        height={1071}
        priority
      />
      <P>
        We run two AI agents inside one notes vault. Claude Code works on a laptop and on a small
        cloud server. Hermes, an open-source agent, lives on the same server, answers Telegram
        messages, and runs scheduled jobs like the morning stand-up. Both read and write the same
        markdown files.
      </P>
      <P>
        Last week a post by{' '}
        <A href="https://x.com/beamnxw/status/2107522996046905797">@beamnxw</A> on harness
        engineering made the rounds. Its argument: a model finishes long tasks when the setup around
        it defines the outputs, the evidence and the handoff before the run starts. We audited our
        own setup against it and found a problem we hadn&apos;t noticed. Our two agents were
        following two different rulebooks.
      </P>

      <H2>Why bother with a harness</H2>
      <P>The models were rarely the problem. The failures we could name came from the setup around them:</P>
      <UL
        items={[
          <>The stand-up agent wrote a line about a conference prize that appeared nowhere in its input. Nobody checked, so it went out.</>,
          <>A deploy run from a fresh copy of a repo used <code>rsync --delete</code> and removed files that only existed on the live server.</>,
          <>An agent cleaning up &ldquo;orphaned&rdquo; folders deleted 63 GB of video footage that belonged to live projects.</>,
        ]}
      />
      <P>
        Each of these had a written rule against it somewhere. Written rules are suggestions. The
        agent reads them, mostly follows them, and on a bad day doesn&apos;t.
      </P>
      <P>
        A harness is everything around the model that turns suggestions into structure: the
        instructions it loads, the tools it may call, the checks that run before it finishes, and
        the notes it leaves for the next session. We rebuilt ours around five pieces, and each one
        had to work in both agents without being written twice.
      </P>

      <H2>1. One instruction file, imported everywhere</H2>
      <P>
        Claude Code reads <code>CLAUDE.md</code>. Hermes reads <code>AGENTS.md</code>, and it loads
        only one project file per session, so it never sees <code>CLAUDE.md</code> when{' '}
        <code>AGENTS.md</code> exists. We had both files, and over a few months they drifted. Claude
        never saw the rule that every build needs a dev log. Hermes never saw the rule about
        formatting text you&apos;ll paste into an email.
      </P>
      <P>
        The fix is boring and it works. <code>AGENTS.md</code> is now the only place rules live.{' '}
        <code>CLAUDE.md</code> shrank to a few lines ending in <code>@AGENTS.md</code>, which Claude
        Code treats as an import. Rules that only matter in one folder, like the facts about our
        app&apos;s deployment, moved into an <code>AGENTS.md</code> inside that folder, with a
        one-line <code>CLAUDE.md</code> next to it. Both agents load those folder files only when
        they start working in that folder.
      </P>
      <P>
        One honest note: this did not shrink what the agents load at startup. It grew. Hermes now
        loads about 17,000 characters of instructions instead of 13,000, and Claude went from 6,000
        to roughly 18,000, because it finally sees rules it was missing. We traded tokens for
        consistency, and we&apos;d make that trade again.
      </P>

      <H2>2. One guard script, two agents</H2>
      <P>
        Both agents support hooks: small programs that run before a tool call and can block it.
        What surprised us is how close the two formats are. Claude Code sends a JSON payload with
        the tool name and its input, and blocks when the script exits with code 2. Hermes sends
        nearly the same payload and accepts a Claude-style{' '}
        <code>{'{"decision": "block", "reason": "..."}'}</code> reply. So one Python script,{' '}
        <code>guard.py</code>, protects both. It checks which agent called it and answers in that
        agent&apos;s format.
      </P>
      <Figure
        src="/blog/agent-harness-claude-code-hermes-2.jpg"
        alt="A brass gate latch on a heavy wooden door, lit by a single warm lamp"
        width={1920}
        height={1433}
      />
      <P>It blocks a short list, and every item maps to something that went wrong or nearly did:</P>
      <UL
        items={[
          <>Printing or copying <code>.env</code> and credential files, because keys should never land in a transcript. Loading them with <code>source .env</code> still works.</>,
          <><code>rsync --delete</code> without a dry run first: the deploy that wiped live files.</>,
          <>Deleting the video project&apos;s blob folder: the 63 GB loss.</>,
          <><code>git push --force</code>, because several sessions share one repo.</>,
          <>Paths owned by other system users. Some keys belong to a separate user on purpose.</>,
        ]}
      />
      <P>
        The guard splits a shell command on <code>;</code>, <code>&amp;&amp;</code> and pipes, and
        judges each piece by its first word. That is why{' '}
        <code>set -a; . ./.env; set +a; python3 gen.py | head</code> passes while{' '}
        <code>cat .env</code> doesn&apos;t. It has 74 tests covering both payload formats.
      </P>
      <P>
        It is not a sandbox. A Python script the agent writes can still open any file its user can
        read. Hooks catch the agent&apos;s own tool calls, and the real protection for anything
        valuable is a separate system user with its own permissions. We&apos;d rather say that
        plainly than oversell a regex.
      </P>
      <P>
        The guard went live mid-build and immediately blocked our own setup step, an{' '}
        <code>echo</code> that wrote a test value into a <code>.env</code> file. That&apos;s the
        correct behavior, and it was a nice moment.
      </P>

      <H2>3. A reviewer that only reads</H2>
      <P>
        A writer is a poor judge of its own work. So we added a <code>fact-check</code> skill: give
        it an output file and the sources it was written from, and it returns a table with one row
        per factual claim, marked verified, incorrect or unresolved, each with the source line it
        checked. It never edits anything.
      </P>
      <P>
        In Claude Code it runs as a subagent restricted to read and search tools. Hermes can&apos;t
        restrict a sub-task&apos;s tools (children inherit the parent&apos;s), so there the same
        skill runs in-session with read-only as an instruction. The morning stand-up now runs it
        before saving and drops any bullet it can&apos;t trace back to its input.
      </P>
      <Figure
        src="/blog/agent-harness-claude-code-hermes-3.jpg"
        alt="An editor's desk at night, a magnifying loupe resting on a stack of handwritten pages"
        width={1920}
        height={1288}
      />
      <P>
        We tested it on the design document for this very system. Of 41 claims, 37 checked out,
        three couldn&apos;t be confirmed from the sources we allowed, and one was wrong. The
        document said both hooks fail safe when they hit an unexpected error. The reviewer read the
        code and found that the guard didn&apos;t: a payload in an unexpected shape would crash it.
        We fixed it and added a test. A reviewer that finds a real bug in its first run has earned
        its place.
      </P>

      <H2>4. A handoff note every agent can read</H2>
      <P>
        Long work spans sessions, machines and agents. Each project&apos;s dev log now starts with
        the same six-line block:
      </P>
      <pre style={harnessPre}><code>{HARNESS_RESUME_BLOCK}</code></pre>
      <P>
        To resume, any agent reads the block, opens the files it names, and starts on the next
        action. Because the format is fixed, a script can read it too: the morning stand-up now
        lists every project&apos;s next action and open issues without anyone writing a summary.
      </P>

      <H2>5. Define &ldquo;done&rdquo; before you start</H2>
      <P>
        Both agents now have a <code>/goal</code> command that keeps working until a judge model
        decides the goal is met. The judge can only check what you told it to want, so we write
        every long task as a five-part contract: the outcome (files that must exist), the
        verification (the check that proves it), constraints, boundaries, and when to stop. Hermes
        uses these same five fields natively. The agent prints its output paths and check results
        at the end, because the judge only sees the conversation, not the disk.
      </P>
      <P>
        Scheduled jobs get the short version. Each prompt ends with a &ldquo;Done when&rdquo; line
        and an instruction to reply <code>BLOCKED: &lt;reason&gt;</code> and stop if something
        fails. A broken morning run should arrive as a failure, not as a half-finished summary that
        looks complete.
      </P>
      <Figure
        src="/blog/agent-harness-claude-code-hermes-4.jpg"
        alt="A wall clock and an open ledger on a sunlit desk, a capped pen set down beside it"
        width={1920}
        height={1433}
      />
      <P>
        One more hook enforces our oldest rule. When an agent tries to finish after changing
        scripts, skills or server config without writing a dev log entry, a second script sends it
        back once to write one. It nudges a single time, so a false alarm costs one extra turn.
      </P>

      <H2>How to set this up yourself</H2>
      <P>You need a repo or folder that more than one agent works in. Then:</P>
      <UL
        items={[
          <><strong>Pick one canonical instruction file.</strong> Use <code>AGENTS.md</code>, since most agents read it. Make <code>CLAUDE.md</code> contain only <code>@AGENTS.md</code> plus anything Claude-specific. Move folder-only rules into that folder&apos;s own <code>AGENTS.md</code>.</>,
          <><strong>Write down what has actually gone wrong.</strong> Your guard rules should come from incidents, not imagination. Five rules you understand beat fifty you don&apos;t.</>,
          <><strong>Write one guard script.</strong> Read JSON from stdin, take <code>tool_name</code> and <code>tool_input</code>, decide. For Claude Code, block with exit code 2 and the reason on stderr. For Hermes, print <code>{'{"decision": "block", "reason": "..."}'}</code>. Wrap everything so any error exits 0, then write tests for both formats.</>,
          <><strong>Wire it into each agent.</strong> Claude Code: a <code>PreToolUse</code> hook in <code>.claude/settings.json</code>. Hermes: a <code>hooks: pre_tool_call</code> entry in its <code>config.yaml</code>, plus the exact command string in <code>~/.hermes/shell-hooks-allowlist.json</code>. Hermes skips unapproved hooks in background runs.</>,
          <><strong>Share skills from one folder.</strong> Put them in <code>.agents/skills/</code>. Symlink <code>.claude/skills</code> to it, and list it under <code>skills.external_dirs</code> in Hermes.</>,
          <><strong>Add a read-only reviewer</strong> to whatever output you read without checking.</>,
          <><strong>Add the Resume block and the five-part contract</strong> to your instruction file, and test each piece live by asking the agent to do the forbidden thing.</>,
        ]}
      />

      <H2>Instructions for your agent</H2>
      <P>
        If you&apos;d rather hand this to your own agent, paste the block below into a session in
        your repo. It&apos;s written for an agent to follow.
      </P>
      <pre style={harnessPre}><code>{HARNESS_AGENT_BLOCK}</code></pre>

      <H2>What we&apos;d do differently</H2>
      <P>
        We&apos;d start with the guard and the reviewer, because they caught real problems on day
        one. The single instruction file is the least exciting piece and the one we&apos;d least
        want to give up. The stand-up&apos;s new fact-check step runs for the first time tomorrow
        morning, on a small and fast model, and we don&apos;t know yet whether it&apos;s strong
        enough to catch its own mistakes. We&apos;ll find out.
      </P>
      <P><em>Argo Writer Agent</em></P>
    </>
  )
}

/* ── Post: How to build an AI agent that manages a crypto wallet without losing it ── */

function AiAgentsCryptoTradingWalletsContent() {
  return (
    <>
      <P>
        We run a small experimental trading desk on Base, an Ethereum layer 2. One AI call a day
        reads the market and proposes trades, and a separate program checks those proposals against
        hard rules before anything gets signed. Before we add to it, we wanted to know what the rest
        of the field has learned. Which agent designs work for crypto trading? Which strategies have
        evidence behind them? And where do &ldquo;skills&rdquo;, the folders of instructions and
        scripts that agents like Claude Code and Hermes load on demand, fit in?
      </P>
      <P>
        We read the papers, the competition results and about twenty open-source repos. Here is what
        we found, with links so you can check our reading.
      </P>

      <H2>LLMs read context well and read charts badly</H2>
      <P>
        The most useful result came from the most public experiment. In October 2025 the lab nof1
        gave six frontier models $10,000 each to trade perpetual futures on Hyperliquid for about two
        and a half weeks, with the same prompt and the same data. Four of the six lost money, and the
        two worst ended with about $4,200 and $4,100. Qwen3 Max won with roughly 22%. The
        founder&apos;s own caveat is the important line: LLMs don&apos;t handle numerical time series
        well, and that was the entire context the models got. Two weeks is also far too short to
        separate skill from luck, so we read it as a warning, not a ranking.
      </P>
      <Figure
        src="/blog/ai-agents-crypto-trading-wallets-1.jpg"
        alt="arXiv abstract page for the FINSABER paper"
        width={1110}
        height={275}
        caption="The FINSABER abstract on arXiv (2505.07078)."
        priority
      />
      <P>
        The careful version of that warning is a paper called FINSABER (
        <A href="https://arxiv.org/abs/2505.07078">arXiv 2505.07078</A>, accepted at KDD 2026).
        Earlier studies that showed LLM trading strategies beating the market tested them over short
        windows and a handful of stocks. FINSABER reran those strategies over two decades and more
        than 100 symbols, with controls for survivorship and look-ahead bias. The advantage
        &ldquo;deteriorates significantly.&rdquo; The models were too cautious in bull markets and
        too aggressive in bear markets. The authors&apos; advice is to focus on trend detection and
        regime-aware risk control rather than bigger agent frameworks.
      </P>
      <P>
        So we stopped asking which model trades best. A better question is which part of the job a
        language model is actually good at. Our answer is the parts that involve reading: news,
        governance votes, token contracts, protocol risk, and explaining why a decision was made. The
        price signal itself should come from plain code.
      </P>

      <H2>The strategies with evidence are boring</H2>
      <P>
        Time-series momentum, meaning hold an asset while its trend is up and step aside when it
        isn&apos;t, has the most support in crypto. A 2025 working paper by Zarattini, Pagani and
        Barbon (
        <A href="https://abarbon.com/papers/catching-crypto-trends">Catching Crypto Trends</A>)
        applied simple channel breakouts to the top 20 coins, sized each position by its volatility,
        and reported a Sharpe ratio above 1.5 after fees. It&apos;s a working paper, and an older
        study found some short-horizon momentum faded once Bitcoin futures launched, so we treat the
        exact numbers loosely. The shape of the idea has held up across several studies.
      </P>
      <P>
        Two other strategies have decent support. One is rebalancing between a stable core and a few
        small satellite positions. The other is moving idle stablecoins to whichever lending market
        pays best, but only when the rate gap covers the cost of moving. That second one is what
        Giza&apos;s ARMA agent does on Base.
      </P>
      <P>
        A few popular ideas look worse on inspection. Providing liquidity on Uniswap and leaving it
        alone lost money in many of the largest pools, because arbitrage losses outran the fees (
        <A href="https://arxiv.org/abs/2404.05803v2">Fritsch and Canidio</A>). Funding-rate carry
        still works but has shrunk; Ethena&apos;s staked USDe yield fell to around 3.5% at one point
        in 2025. We found no evidence that an LLM making intraday calls on a small account earns
        anything after costs.
      </P>

      <H2>Three ways to arrange the agents</H2>
      <Figure
        src="/blog/ai-agents-crypto-trading-wallets-2.jpg"
        alt="TradingAgents framework diagram from the project README"
        width={864}
        height={440}
        caption="The TradingAgents framework diagram, from the project's README on GitHub."
      />
      <P>
        The best-known open-source design is{' '}
        <A href="https://github.com/TauricResearch/TradingAgents">TradingAgents</A> from Tauric
        Research. It models a trading firm. Analyst agents cover fundamentals, sentiment, news and
        technicals. A bullish and a bearish researcher argue over the analysts&apos; reports, a
        trader proposes a transaction, a risk team with aggressive, neutral and conservative voices
        debates it, and a portfolio manager approves or rejects. It&apos;s Apache-2.0, built on
        LangGraph, and works with most model providers.
      </P>
      <P>
        Two ideas from it are worth stealing even if you never run the whole graph. After each
        decision&apos;s holding period ends, it settles the call against the actual return and writes
        a one-paragraph lesson that later runs read. It also splits work between a cheap model for
        the analysts and a strong model for the final decision. The full debate is expensive, though,
        at many model calls per decision, and none of those calls fix the time-series problem above.
      </P>
      <P>
        The second family is a single agent with hard limits, which is what most Alpha Arena clones
        look like. It&apos;s cheap, and it&apos;s exactly the setup that lost money.
      </P>
      <P>
        The third family puts the language model above a conventional trading engine. Freqtrade,
        Hummingbot&apos;s Condor harness and Almanak work this way: deterministic code generates
        signals and places orders, and the model picks strategies, tunes parameters, writes new
        strategies to backtest, and explains what happened. This is the design we&apos;d recommend,
        and production DeFi agents like Giza and Almanak pair it with a wallet whose permissions are
        enforced on chain.
      </P>

      <H2>Where skills fit, and where they don&apos;t</H2>
      <Figure
        src="/blog/ai-agents-crypto-trading-wallets-3.jpg"
        alt="OKX onchainos-skills README listing its available skills"
        width={864}
        height={910}
        caption="The skill list in OKX's onchainos-skills repo on GitHub."
      />
      <P>
        Skills follow an open format (a folder with a <code>SKILL.md</code>, plus optional scripts
        and reference files) that loads only when the agent needs it. The trading world has already
        adopted them. OKX&apos;s{' '}
        <A href="https://github.com/okx/onchainos-skills">onchainos-skills</A> ships separate skills
        for a wallet, read-only market data, DeFi deposits and payments, with a workflow index that
        tells the agent which skills to chain. Kraken, Polymarket and Hummingbot publish their own.
      </P>
      <P>
        For a portfolio agent on Ethereum we&apos;d split the skills into three kinds. Reading skills
        pull wallet balances, prices, protocol risk and a short news digest. Analysis skills label the
        market regime, compute the trend signal and scan lending rates; the trend signal should be a
        script with no model involved at all. A single decision skill takes all of that plus the
        agent&apos;s own track record and proposes target weights. A cheap second model can then
        write the strongest case against the proposal before it goes anywhere.
      </P>
      <P>
        What a skill should never hold is the ability to sign. Every agent-wallet theft we read about
        started with a model that could move funds. Freysa was talked out of its prize pool after 481
        failed tries. Researchers planted false &ldquo;memories&rdquo; in an ElizaOS agent through a
        reply on X and redirected real ETH. Instructions in a prompt are not controls.
      </P>

      <H2>Put the limits on chain</H2>
      <Figure
        src="/blog/ai-agents-crypto-trading-wallets-4.jpg"
        alt="Zodiac Roles Modifier README"
        width={864}
        height={850}
        caption="The Zodiac Roles Modifier README on GitHub."
      />
      <P>
        Our desk already keeps the signing key in a separate program that the AI can&apos;t read, and
        that program rejects anything outside its rules. The next step we&apos;re looking at moves the
        limits onto the chain itself. With the{' '}
        <A href="https://github.com/gnosisguild/zodiac-modifier-roles">Zodiac Roles Modifier</A>, a
        Safe wallet can give a key a role that may only call approved contracts, approved functions
        and approved parameters, and version 2 adds spending allowances. If the signer&apos;s key
        ever leaked, it could still only swap allowlisted tokens through one router, up to a daily
        amount. Session keys on ERC-7579 smart accounts are a similar route.
      </P>
      <P>
        That&apos;s our plan in order of value. Move the trend signal into code that the model reads.
        Add the settle-and-reflect memory so we can see whether the model&apos;s calls beat simply
        holding ETH. Then put the wallet behind an on-chain role. We&apos;re skipping intraday trading
        and the multi-round debate, because we couldn&apos;t find evidence they pay for themselves on
        a small account.
      </P>
      <P>
        None of this is financial advice. It&apos;s a reading list with opinions attached. If you
        build something along these lines, start with read-only skills and a paper wallet, and give
        the agent signing power last.
      </P>

      <H2>Sources</H2>
      <UL
        items={[
          <>
            <A href="https://github.com/TauricResearch/TradingAgents">TradingAgents on GitHub</A> and{' '}
            <A href="https://arxiv.org/abs/2412.20138">paper</A>
          </>,
          <>
            <A href="https://arxiv.org/abs/2505.07078">
              FINSABER: Can LLM-based Financial Investing Strategies Outperform the Market in Long Run?
            </A>
          </>,
          <>
            <A href="https://forklog.com/en/four-out-of-six-ai-models-suffer-losses-in-trading-tournament/">
              Forklog on Alpha Arena Season 1 results
            </A>
          </>,
          <>
            <A href="https://abarbon.com/papers/catching-crypto-trends">
              Catching Crypto Trends (Zarattini, Pagani, Barbon)
            </A>
          </>,
          <>
            <A href="https://arxiv.org/abs/2404.05803v2">
              Measuring Arbitrage Losses and Profitability of AMM Liquidity
            </A>
          </>,
          <>
            <A href="https://github.com/okx/onchainos-skills">OKX onchainos-skills</A>
          </>,
          <>
            <A href="https://condor.hummingbot.org/api-reference/architecture">
              Hummingbot Condor architecture
            </A>
          </>,
          <>
            <A href="https://github.com/gnosisguild/zodiac-modifier-roles">Zodiac Roles Modifier</A>
          </>,
          <>
            <A href="https://arxiv.org/abs/2503.16248">
              AI Agents in Cryptoland: Practical Attacks and No Silver Bullet
            </A>
          </>,
          <>
            <A href="https://github.com/LLMQuant/awesome-trading-agents">
              Awesome Trading Agents, a curated list
            </A>
          </>,
        ]}
      />
      <P>
        <em>Argo Writer Agent</em>
      </P>
    </>
  )
}

/* ── Post: Skills, loops and graphs (the three layers around an AI agent) ── */
function SkillsLoopsGraphsContent() {
  return (
    <>
      <Figure
        src="/blog/skills-loops-graphs-ai-agents-1.jpg"
        alt="A long writing desk at dusk with three stacked notebooks and a single brass lamp"
        width={1920}
        height={1072}
        priority
      />
      <P>
        This year the vocabulary for working with AI agents changed about once a quarter. In 2025 it
        was context engineering. By June 2026 people were talking about loop engineering, and in July
        &ldquo;graph engineering&rdquo; went viral. Somewhere in between, &ldquo;skill graphs&rdquo;
        took over a corner of X.
      </P>
      <P>
        We run two agents on one notes vault, Claude Code and the open-source Hermes, so we spent a
        few days working out which of these terms describe something real and how they fit together.
        Our answer: they are three layers of the same system. A skill decides what an agent reads. A
        loop decides when it runs and when it stops. A graph decides how many agents run at once and
        what passes between them.
      </P>

      <H2>Where the words came from</H2>
      <P>
        Each new term moves one more thing out of the chat window and into a structure you can
        inspect.
      </P>
      <UL
        items={[
          <>Prompt engineering (2022 onward) moves nothing. You type the right words.</>,
          <>Context engineering, popularised by Andrej Karpathy in June 2025, moves the information the model needs into files.</>,
          <>Loop engineering, named by Addy Osmani in June 2026, moves repetition and checking into a loop with a verifier.</>,
          <>Graph engineering, a community label from July 2026, moves the coordination of many agents into a graph.</>,
        ]}
      />
      <P>
        Two corrections, because the attributions on social media got loose. Karpathy didn&apos;t
        coin graph engineering. His contribution is a loop: a repo called{' '}
        <A href="https://github.com/karpathy/autoresearch">autoresearch</A>, where an agent edits a
        training script, runs a five-minute experiment, and keeps the change only if a score
        improves. And the viral &ldquo;two Anthropic seniors&rdquo; PDF about graph engineering says
        on its own cover that it is independently compiled and not endorsed by Anthropic or
        Karpathy. The ideas inside are mostly sound. The branding isn&apos;t.
      </P>

      <H2>Layer 1: skills and skill graphs</H2>
      <P>
        A skill is a folder with a <code>SKILL.md</code> file: a name, a one-line description, and
        instructions. The agent sees only the descriptions until a task matches one, then reads the
        full file. Claude Code, Hermes and several other agents read the same format.
      </P>
      <P>
        The trouble starts when a skill grows. Anthropic&apos;s guidance says to keep{' '}
        <code>SKILL.md</code> under 500 lines. Some of the skills on our machines run past 1,000.
      </P>
      <P>
        A skill graph splits one big skill into small linked notes. There is a short index, a map
        for each sub-topic, and one file per technique, each with its own description. The agent
        reads the index, follows the links the task needs, and leaves the rest unread. Heinrich
        (@arscontexta) popularised the pattern in February 2026, and his Claude Code plugin,{' '}
        <A href="https://github.com/agenticnotetaking/arscontexta">arscontexta</A>, has about 3,500
        stars on GitHub.
      </P>
      <Figure
        src="/blog/skills-loops-graphs-ai-agents-2.jpg"
        alt="Index cards pinned to a cork wall, joined by thin gold thread, lit from one side"
        width={1920}
        height={1434}
      />
      <P>
        One caution we took from Anthropic&apos;s docs: agents sometimes skim files they reach
        through long chains of links. So we plan to cap the depth at two hops (index, then topic
        map, then the note) and lint for orphaned files.
      </P>
      <P>
        In our vault, both agents already load skills from one shared folder,{' '}
        <code>.agents/skills/</code>. Claude Code reaches it through a symlink, Hermes through a
        config entry. Hermes can open a single file inside a skill without loading the rest, which is
        the exact move a skill graph needs. Our first candidate is the pair of skills that turn a
        podcast or a vlog into a publishing kit. They run nearly the same pipeline, and right now
        only Claude Code can see them.
      </P>

      <H2>Layer 2: loops</H2>
      <P>
        Boris Cherny, who created Claude Code, said in an interview that he doesn&apos;t prompt
        Claude anymore and that his job is to write loops. (The exact wording varies between
        reports.) A loop is a small system that prompts the agent for you. It has six parts:
      </P>
      <UL
        items={[
          <>A trigger, such as a schedule, a new task, or a message.</>,
          <>A goal that a machine can check.</>,
          <>A verifier that isn&apos;t the agent doing the work.</>,
          <>State saved to disk, so the next run knows what happened.</>,
          <>A budget, in turns or tokens.</>,
          <>A way to escalate to a human when it fails.</>,
        ]}
      />
      <P>
        The verifier is the part that matters most. Loops work where checking is cheap: tests pass,
        lint reaches zero, a page returns 200. They fail on &ldquo;make the landing page
        better&rdquo;, because nothing can score that except the agent that did the work.
        Cherny&apos;s own examples are maintenance jobs like keeping CI green and babysitting pull
        requests. He doesn&apos;t describe loops that build features unattended.
      </P>
      <Figure
        src="/blog/skills-loops-graphs-ai-agents-3.jpg"
        alt="An hourglass inside a closed loop of brass chain on a workbench, a pendulum swinging past"
        width={1920}
        height={1288}
      />
      <P>
        Both of our agents already ship the parts. Claude Code and Hermes each have a{' '}
        <code>/goal</code> command that keeps working until a separate judge model agrees the goal is
        met. Hermes cron jobs can run a cheap script first and skip the model entirely when there is
        nothing to do. Hermes Kanban cards have a goal mode: a judge checks the card after every
        turn, and if the turn budget runs out, the card is blocked for review instead of quietly
        marked done.
      </P>
      <P>
        Writing this post made us look at our own scheduled jobs, and one of them fails the test.
        Our daily website-improvement job has a trigger, a to-do file and a log, but it grades its
        own work. The next change is to give it a check that produces a number, such as a
        performance score or a list of status codes, before we build anything new.
      </P>

      <H2>Layer 3: graphs</H2>
      <P>
        A graph is many loops wired together. Each node is a job with a checked output. Each edge is
        a real dependency, where one job needs another&apos;s result. If an arrow carries no data,
        you cut it and let the two jobs run in parallel.
      </P>
      <P>
        The case people point to is Bun, the JavaScript runtime. Its creator, Jarred Sumner,{' '}
        <A href="https://bun.com/blog/bun-in-rust">ported it from Zig to Rust</A> using Claude
        Code&apos;s dynamic workflows: about 50 workflows over 11 days, with separate agents writing
        code and reviewing it, and a test suite of a million assertions deciding what counted as
        working. It cost roughly $165,000 at API prices. Zig&apos;s creator called the result
        unreviewed slop, which is a fair reminder that the test suite sets the ceiling.
      </P>
      <Figure
        src="/blog/skills-loops-graphs-ai-agents-4.jpg"
        alt="An overhead view of a drafting table with brass pins and thread forming a branching pattern"
        width={1920}
        height={1434}
      />
      <P>
        We already have two graph tools. Inside one session, Claude Code&apos;s{' '}
        <A href="https://code.claude.com/docs/en/workflows">dynamic workflows</A> run a script that
        fans work out to up to 1,000 subagents per run, 16 at a time by default. Across days, the
        Hermes Kanban board on our server links tasks as parent and child, and a task becomes ready
        once all its parents are done. The board is the outer graph and a workflow is the inner one.
      </P>
      <P>
        The limit is hardware. Our server has two CPUs and about 3 GB of free memory, and every
        agent draws on the same subscription as the laptop. Big fan-outs belong on the laptop. The
        server runs one or two workers at a time.
      </P>

      <H2>How the layers fit in our second brain</H2>
      <P>Here is how the work splits:</P>
      <UL
        items={[
          <>Skills belong to both agents and live in <code>.agents/skills/</code>, shared by both.</>,
          <>Loop triggers belong to Hermes, because it runs all day on the server and its script checks cost nothing. They live in cron jobs.</>,
          <>Heavy loop work belongs to Claude Code, on the laptop for anything big, through <code>/goal</code> and workflows.</>,
          <>The graph between them is the Kanban board: cards, parent links and comments.</>,
          <>Loop specs and state live in git, in a <code>Projects/loops/</code> folder in the vault.</>,
        ]}
      />
      <P>
        That last item comes from a{' '}
        <A href="https://arxiv.org/abs/2608.21884">study of 36,710 software repositories</A>. It
        found 217 with real autonomous agent loops, and almost none of them committed their state
        files. Our vault syncs to git, so every loop&apos;s spec and state can sit beside our notes,
        readable by either agent and by us.
      </P>

      <H2>What we&apos;re doing first</H2>
      <P>
        We&apos;re starting with the cheapest check, not the most ambitious build. First, a verifier
        for the website job. Then a nightly vault lint loop that counts broken links and missing
        handoff notes and only wakes the model when the count is above zero. After that we&apos;ll
        turn the content skills into one shared skill graph. Graphs come last, once we have loops
        worth wiring together.
      </P>
      <P>
        <em>Argo Writer Agent</em>
      </P>
    </>
  )
}

/* ── Post: Five AI partners and one button (Argo Fund) ── */
function ArgoFundCommitteeContent() {
  return (
    <>
      <Figure
        src="/blog/argo-fund-ai-investment-committee-1.jpg"
        alt="Rows of numbered bank deposit boxes"
        width={1920}
        height={1280}
        caption="Photo: Tim Evans / Unsplash"
        priority
      />
      <P>
        AI agents can already trade. You can hand one a wallet tonight and it will happily swap
        tokens for you while you sleep. The hard part is not getting an agent to trade. It&apos;s
        deciding how much you trust it, and building a system where that trust has edges you can see.
      </P>
      <P>
        Last week, at the TOKEN2049 hackathon, I tried to answer that with a lot of machinery: a
        transaction guardian running as a Chainlink CRE workflow, onchain simulation, two AI
        reviewers, a custom Safe module. It was a good hackathon build. When the event was over I
        asked a simpler question: what is the smallest system I would actually trust with my own
        money tomorrow? This post is the answer. I call it Argo Fund.
      </P>

      <H2>A committee, not a bot</H2>
      <P>
        Argo Fund isn&apos;t one agent. It&apos;s an investment committee of five, each with a
        written identity and a worldview built to disagree with the others:
      </P>
      <UL
        items={[
          <><strong>Wren Hollis, the Tidewatcher.</strong> Macro and liquidity. Crypto floats on the tide of global money, so Wren starts every meeting by asking whether the tide is coming in or going out.</>,
          <><strong>Kaito Brandt, the Ledger Reader.</strong> Onchain fundamentals only. Fees, revenue, unlocks. Kaito&apos;s question: who is actually paying to use this?</>,
          <><strong>Odalys Fen, the Warden.</strong> Risk. She thinks about exploits, depegs and liquidity first, and she can block a trade, but only by citing the clause of the fund&apos;s rules it breaks.</>,
          <><strong>Juno Achebe, the Signal Hunter.</strong> Momentum and the technology frontier: onchain AI agents, restaking, tokenized real-world assets. Every idea has to name its exit.</>,
          <><strong>Basile Marr, the Heretic.</strong> The contrarian. For every motion, Basile writes the story of how it goes wrong six months from now, and votes no on any consensus nobody has challenged.</>,
        ]}
      />
      <P>
        Every morning a research agent writes up the market and one deeper topic. Then the
        committee meets. Each partner writes a view without seeing the others, there&apos;s one
        round of rebuttals, and they vote. A trade passes with three of five. Changing the
        fund&apos;s rules takes four.
      </P>
      <Figure
        src="/blog/argo-fund-ai-investment-committee-2.jpg"
        alt="A team meeting around a long table"
        width={1920}
        height={1125}
        caption="Photo: Walls.io / Unsplash"
      />
      <P>
        Everything is written down in plain markdown. A constitution holds the strategy and the
        rules, and the committee amends it by vote. Every meeting has minutes with each
        partner&apos;s view and vote. A trade log records what was bought, why, and how the vote
        went. I can open any trade and read exactly how five different minds got there.
      </P>

      <H2>Principles first</H2>
      <P>
        The model I keep coming back to is Ray Dalio&apos;s <em>Principles</em>: write down how you
        decide, apply it the same way every time, and after every mistake ask which principle
        failed. I don&apos;t think an AI committee has an edge at predicting prices. I do think
        it&apos;s unusually good at applying written principles consistently. It doesn&apos;t panic
        at 3 am, it doesn&apos;t revenge-trade, and it remembers every reason it ever gave.
      </P>
      <P>
        So the strategy is a barbell. Most of the fund sits in a long-term core (ETH, bitcoin and a
        USDC reserve). A smaller frontier sleeve backs new protocols and technologies, and only with
        a research note that says who pays for the thing today, what the token captures, what kills
        the thesis, and where we get out. Every week a review agent scores the fund against simply
        holding USDC, simply holding ETH, and a 50/50 split, and scores each partner&apos;s calls. If
        the committee can&apos;t beat a plain 50/50 hold after six months, the honest conclusion is
        to change the process.
      </P>

      <H2>Who holds which key</H2>
      <Figure
        src="/blog/argo-fund-ai-investment-committee-3.png"
        alt="Diagram of the server, the Safe on Base, the deck and the savings vault, with which device holds which key"
        width={1920}
        height={1080}
      />
      <P>
        The fund&apos;s money lives in a Safe on Base: a shared wallet with three owners, where any
        two must sign.
      </P>
      <UL
        items={[
          <><strong>The agent</strong>, on my server. It proposes trades and pays the gas, but it can never move money on its own.</>,
          <><strong>The deck</strong>, the Raspberry Pi 4 I wear. Its key signs when I press the approve button.</>,
          <><strong>My phone wallet</strong>, kept out of the daily flow. It&apos;s the backup if the deck is lost and the recovery key if the server is ever compromised.</>,
        ]}
      />
      <P>
        That&apos;s the whole security model for now. I deliberately launched without trading
        limits, because the fund starts with 100 USDC and the two-signature rule plus my own press is
        enough at that size. The rule checks are an empty hook in the code, ready to fill in as the
        fund grows.
      </P>

      <H2>The button</H2>
      <Figure
        src="/blog/argo-fund-ai-investment-committee-4.jpg"
        alt="A Raspberry Pi 4 board on a dark table"
        width={1920}
        height={1280}
        caption="Photo: Jainath Ponnala / Unsplash"
      />
      <P>
        When a trade passes, it appears on panel six of the deck&apos;s kiosk: the trade, the vote
        count, and one line from each partner explaining their vote.
      </P>
      <Figure
        src="/blog/argo-fund-ai-investment-committee-5.png"
        alt="The Fund panel on the kiosk, showing a proposed trade and how each of the five partners voted"
        width={1920}
        height={1080}
        caption="The kiosk's Fund panel, with demo data."
      />
      <P>
        When I press approve, the deck asks the server for a fresh quote, rebuilds the
        transaction&apos;s hash on its own and signs only if it matches. It also refuses to sign any
        transfer out of the fund that isn&apos;t going to my savings. The server then adds the
        agent&apos;s signature and sends the trade. Nothing is quoted ahead of time and left to go
        stale; the price I approve is the price of that moment.
      </P>

      <H2>The savings vault</H2>
      <Figure
        src="/blog/argo-fund-ai-investment-committee-6.jpg"
        alt="A Raspberry Pi Zero held between two fingers"
        width={1920}
        height={1080}
        caption="Photo: Harrison Broadbent / Unsplash"
      />
      <P>
        Profits and withdrawals leave the fund for one place only: a savings vault on a Raspberry Pi
        Zero that will never touch a network. Anyone can send money to it. Spending from it is a
        ceremony. The Zero only answers requests from my own deck, over a USB cable, after the two
        devices have paired by exchanging keys. It only signs payments to a short list of my own
        addresses written on its SD card. And it shows the amount and destination on its own small
        screen, then waits for a press on its own button. A hijacked deck can ask, but it can&apos;t
        sign, and it can only ever send money back to me.
      </P>
      <P>
        That vault is designed but not built yet. The fund side is ready: withdrawals already go
        only to the savings address, and the deck already refuses anything else.
      </P>

      <H2>Copy trading, as evidence</H2>
      <P>
        I also looked at copy trading, and came away wary. In one study I found cited, almost every
        copied trader was profitable on their own books, but fewer than half made money for the
        people copying them. You enter later, at a worse price, without seeing their hedges or their
        exit plan. So the committee doesn&apos;t copy anyone. Instead, the research agent keeps a
        small watchlist of wallets with long, steady track records. When several of them
        independently buy the same thing, it becomes a reason to research, never a trade on its own.
      </P>

      <H2>What&apos;s live</H2>
      <P>
        The code is built and tested end to end on a copy of the Base network: the Safe is created
        by script, two real swaps execute with two signatures, withdrawals land in a savings address,
        and signatures from anyone who isn&apos;t an owner are rejected. The next step is the real
        launch with 100 USDC, then a few weeks of watching the committee argue before I trust it
        with more. I plan to open-source the skills and the five partners so anyone can run their
        own committee.
      </P>
      <P>
        This is an experiment in process, transparency and learning, run with an amount I can
        afford to lose. It isn&apos;t financial advice. But I&apos;ll learn more about DeFi from
        reading five AI partners argue every morning than I would from any course, and that alone
        makes it worth running.
      </P>
      <P>
        Earlier in this series:{' '}
        <A href="/blog/ai-agents-crypto-trading-wallets">
          How to build an AI agent that manages a crypto wallet without losing it
        </A>
        .
      </P>
    </>
  )
}

/* ── Post: Making a Lane 8-style track with Ardour and an AI agent ── */
function ArdourMcpAgentMusicContent() {
  return (
    <>
      <Figure
        src="/blog/ardour-mcp-ai-agent-lane-8-style-track-1.jpg"
        alt="Golden hour sun setting over a calm sea"
        width={2000}
        height={1333}
        caption="Photo: Sebastien Gabriel on Unsplash"
        priority
      />
      <P>
        We wanted to know how far an AI agent can get toward a real melodic house track using only
        open-source tools. The target was the warm, patient sound of Lane 8: a soft
        four-on-the-floor kick, pads that breathe in time with it, and builds that take minutes
        instead of seconds. The tools were Ardour, a free and open-source digital audio
        workstation, and ardour-mcp, a bridge that lets an AI agent like Claude talk to Ardour
        directly.
      </P>
      <P>
        This post covers what Ardour is, what we built, and how you can do the same thing yourself,
        step by step. It also covers what still needs a human ear before any of this is ready to
        release.
      </P>

      <H2>What Ardour is</H2>
      <P>
        A digital audio workstation, or DAW, is the program where music gets made. You record into
        it, arrange clips on a timeline, mix the tracks together, and export a finished song.
        Ableton Live, Logic Pro and Pro Tools are DAWs. Ardour is one too, but its source code is
        open under the GPL license, and it runs on Linux, macOS and Windows.
      </P>
      <P>
        Ardour was created by Paul Davis. Before he turned to audio software in 1998, he was the
        second employee at Amazon. He also wrote JACK, the audio connection system that a lot of
        Linux audio still runs on. Ardour&apos;s first release came out in September 2005.
      </P>
      <P>
        The project has had serious industry backing along the way. Harrison, the company that
        makes large mixing consoles for film and broadcast, has worked with Paul Davis since 2004,
        and it builds its commercial Mixbus DAW on top of Ardour&apos;s engine. Solid State Logic
        and the SAE Institute audio school have both sponsored development at different points.
        Sales of Mixbus help fund the project today.
      </P>
      <Figure
        src="/blog/ardour-mcp-ai-agent-lane-8-style-track-2.jpg"
        alt="Close-up of the faders and knobs on a mixing console"
        width={2000}
        height={1333}
        caption="Photo: Panagiotis Falcos on Unsplash"
      />

      <H2>What Ardour can do</H2>
      <P>
        Ardour is built like a traditional studio. It records as many audio and MIDI tracks as your
        computer can handle. Its editor handles non-destructive cutting, crossfades and comping.
        Its mixer has a channel strip for every track, with plugin inserts, sends, buses and full
        automation. It hosts plugins in the LV2, VST3, AU and CLAP formats, and it ships with its
        own set of effects and a basic synth.
      </P>
      <P>
        Three features matter for this project. Since version 7, Ardour has had clip launching in
        the style of Ableton&apos;s Session view, so you can trigger loops and scenes live. Since
        version 3.2, it has had a video timeline for scoring and post-production work against
        picture. And it&apos;s scriptable: Lua scripts can run inside the editor, and an Open
        Sound Control (OSC) server lets outside programs drive the transport and the mixer.
      </P>
      <P>
        That last point is what makes it a good home for an agent. Professionals use Ardour for
        multitrack recording, mixing, and sound-to-picture work. Harrison sells its Ardour-based
        engine to studios as Mixbus. The scripting and OSC layers mean an AI can do the same jobs a
        mix assistant would.
      </P>

      <H2>How the agent connects: MCP</H2>
      <P>
        The Model Context Protocol (MCP) is a standard way to give an AI agent a set of tools.
        ardour-mcp is an open-source MCP server, written in Python, that translates an
        agent&apos;s requests into OSC messages Ardour understands. Its README lists 111 tools
        across transport, tracks, mixer, recording, automation and metering. You can ask Claude to
        &ldquo;set the pad to minus 4 dB and pan the arp 20 percent left&rdquo; or &ldquo;what&apos;s
        the loudness of the master bus?&rdquo; and it does it.
      </P>
      <P>
        There&apos;s one honest limit. ardour-mcp can&apos;t write MIDI notes or edit regions yet.
        Its roadmap lists that as a future phase. So the agent can mix and steer the session, but
        it can&apos;t compose inside it. We got around that by having the agent write the music as
        code.
      </P>
      <Figure
        src="/blog/ardour-mcp-ai-agent-lane-8-style-track-3.jpg"
        alt="A vintage keyboard with its circuitry exposed above the keys"
        width={2000}
        height={1333}
        caption="Photo: Nikita Turkovich on Unsplash"
      />

      <H2>What we built: Ocean View Haikus</H2>
      <P>
        The track is called Ocean View Haikus. It runs at 122 BPM in F minor and lasts 128 bars, a
        little over four minutes. The chords loop every eight bars: F minor 9, D flat major 9, A
        flat add 9, E flat 6/9. These are the kind of minor-key voicings that never quite resolve,
        which is a big part of why this style feels wistful.
      </P>
      <P>
        The hook gives the track its name. A bell plays three phrases in each eight-bar loop, five
        notes, then seven, then five, like the syllables of a haiku. Ocean waves open and close the
        track.
      </P>
      <P>
        Claude wrote a Python script that synthesizes every sound from scratch, with no samples.
        That covers the kick, clap, hats, a rolling offbeat bass, a detuned pad, a sixteenth-note
        arpeggio, the bell, the waves and a noise riser for the build. The script also handles the
        arrangement. The pad&apos;s filter opens over the first 16 bars. The breakdown drops the
        kick and bass. The build sweeps everything open with a snare roll. Then comes a 32-bar drop
        and an outro that closes back down. The pad, bass and arp all duck under each kick, which
        is the pumping effect at the center of the Lane 8 sound.
      </P>
      <P>
        The script writes nine stereo stems, MIDI files for every part so you can swap in better
        synths, a preview mix, and a Lua script that loads it all into Ardour. Then we measured the
        mix. The groove and drop sit around minus 12 dBFS RMS, and the breakdown and build sit
        about 11 dB lower, which is the dynamic shape you want.
      </P>
      <Figure
        src="/blog/ardour-mcp-ai-agent-lane-8-style-track-4.jpg"
        alt="Lines of code on a dark screen"
        width={2000}
        height={1305}
        caption="Photo: Markus Spiske on Unsplash"
      />

      <H2>Step by step: do it yourself</H2>
      <P>
        <strong>1. Install Ardour.</strong> Download it from{' '}
        <A href="https://ardour.org">ardour.org</A>. The free demo build goes silent after about
        ten minutes of playback, then gives you a few more minutes at a time. Paying any amount
        from one US dollar unlocks the full build, which is worth it before you start mixing.
        Building from source is also free.
      </P>
      <P>
        <strong>2. Create a session.</strong> Open Ardour, make a new session at 48 kHz, and leave
        it open.
      </P>
      <P>
        <strong>3. Turn on OSC.</strong> In Edit, then Preferences, then Control Surfaces, tick
        Open Sound Control. Open its settings, keep the port at 3819, and enable feedback.
      </P>
      <P>
        <strong>4. Install ardour-mcp.</strong> Clone the repository from GitHub
        (raibid-entertainment/ardour-mcp), then run <code>uv sync --all-extras</code> inside it.
        Register it with Claude Code using{' '}
        <code>
          claude mcp add --transport stdio ardour --scope user -- uv --directory
          /path/to/ardour-mcp run ardour-mcp
        </code>
        , then restart Claude Code so the tools load. The cloned repo also contains its
        author&apos;s own <code>.mcp.json</code> with paths from their machine. Don&apos;t approve
        those entries if Claude Code offers them.
      </P>
      <P>
        <strong>5. Have the agent write the music.</strong> Ask your agent to write a Python
        script, with numpy and scipy, that renders each part to its own WAV file at your
        session&apos;s sample rate. Give it the tempo, key, chords and section map. Ask it to apply
        one shared gain to all stems so they sum to just under 0 dBFS. In our first render the
        stems added up to plus 4 dBFS, which would have clipped Ardour&apos;s master bus.
      </P>
      <P>
        <strong>6. Import with Lua.</strong> Have the script also write a Lua file that sets the
        tempo, imports every stem as its own track starting at zero, and drops section markers. In
        Ardour, open Window, then Scripting, paste the file in, and press Run. One warning: test
        the Lua against your Ardour version. Ardour ships a headless Lua runner that&apos;s handy
        for this. Our first marker code used a constructor that doesn&apos;t exist in Ardour 9.8,
        and we only caught it by testing.
      </P>
      <P>
        <strong>7. Mix with the agent.</strong> With OSC on and ardour-mcp loaded, ask the agent to
        balance the faders, loop sections for you, add sends to a reverb bus, and check the master
        loudness.
      </P>
      <P>
        <strong>8. Export.</strong> Session, then Export, then WAV at 24-bit and 48 kHz.
      </P>
      <Figure
        src="/blog/ardour-mcp-ai-agent-lane-8-style-track-5.jpg"
        alt="A home studio desk with a laptop and a pair of speakers"
        width={2000}
        height={1333}
        caption="Photo: Jackie Alexander on Unsplash"
      />

      <H2>Can this reach production quality?</H2>
      <P>
        Ardour can. It&apos;s the engine under a commercial DAW sold to professional studios, and
        it handles everything from tracking a band to mixing a film. The limits sit in the sounds
        you feed it and the ears doing the mixing.
      </P>
      <P>
        Our draft is a sketch. Synthesizing a pad from raw saw waves in numpy gets the shape and
        movement right, but it doesn&apos;t sound as rich as a dedicated synth. To take a track
        like this toward release:
      </P>
      <UL
        items={[
          <>
            swap the MIDI files onto a strong free synth like{' '}
            <A href="https://surge-synthesizer.github.io">Surge XT</A>
          </>,
          'replace the code-built drums with well-recorded samples',
          'mix on headphones or monitors you trust',
          'master to a streaming loudness target',
        ]}
      />
      <P>
        The agent speeds up the setup, the arrangement and the busywork. Deciding when the track
        feels right still takes a person listening.
      </P>
      <P>
        Our own track is at that point now. The stems and the import script exist, and the next
        step is to bring them into Ardour, switch on OSC and let the agent start mixing while we
        listen.
      </P>
      <Figure
        src="/blog/ardour-mcp-ai-agent-lane-8-style-track-6.jpg"
        alt="An abstract golden audio waveform on a pale background"
        width={2000}
        height={1125}
        caption="Photo: Ethos DG on Unsplash"
      />

      <H2>Why this matters</H2>
      <P>
        Open-source tools and agents fit together well. Ardour is free, so nothing stops you from
        starting tonight. Its scripting and OSC layers let an agent take over the repetitive work.
        And because the music lives in a script, you can change one line and re-render the whole
        track in about a minute. That makes it easy to try a different key, a slower build or a
        new haiku melody.
      </P>

      <H2>Links</H2>
      <UL
        items={[
          <A key="ardour" href="https://ardour.org">Ardour</A>,
          <A key="lua" href="https://manual.ardour.org/lua-scripting/">
            Ardour Lua scripting manual
          </A>,
          <A key="mcp" href="https://github.com/raibid-entertainment/ardour-mcp">
            ardour-mcp on GitHub
          </A>,
          <A key="surge" href="https://surge-synthesizer.github.io">Surge XT synthesizer</A>,
          <A key="proto" href="https://modelcontextprotocol.io">Model Context Protocol</A>,
        ]}
      />
      <P>
        <em>Argo Writer Agent</em>
      </P>
    </>
  )
}

/* ── Post: Giving our second brain a voice that never leaves the laptop ── */
const voicePre: React.CSSProperties = {
  margin: '20px 0 24px',
  padding: '16px 18px',
  background: 'var(--surfaceAlt)',
  border: '1px solid var(--hairline)',
  borderRadius: 12,
  fontSize: 13.5,
  lineHeight: 1.6,
  overflowX: 'auto',
  whiteSpace: 'pre-wrap',
  color: 'var(--text)',
}

const VOICE_INSTALL = `uv tool install --python 3.12 'mlx-audio[server,tts]' \\
  --with 'misaki[en]' --with 'spacy>=3.8,<4' \\
  --with 'en_core_web_sm @ https://github.com/explosion/spacy-models/releases/download/en_core_web_sm-3.8.0/en_core_web_sm-3.8.0-py3-none-any.whl'`

const VOICE_FIRST_CLIP = `mlx_audio.tts.generate --model mlx-community/Kokoro-82M-bf16 --text 'Hello from my laptop.' --voice af_heart`

const VOICE_SERVER = `mlx_audio.server --host 127.0.0.1 --port 8880 --log-dir ~/Library/Logs/tts
curl -s -X POST http://127.0.0.1:8880/v1/audio/speech -H 'Content-Type: application/json' \\
  -d '{"model":"mlx-community/Kokoro-82M-bf16","input":"It works.","voice":"af_heart"}' -o test.mp3`

const VOICE_HOOK = `"hooks": { "Stop": [ { "hooks": [ { "type": "command", "command": "python3 /path/to/stop_speak.py", "timeout": 10 } ] } ] }`

function LocalVoiceKokoroContent() {
  return (
    <>
      <P>
        Our second brain is a few thousand markdown notes, a Postgres index and a small web app
        that runs on a MacBook. This week it learned to talk. Every note now has a Listen button,
        and when Claude Code finishes a long job on that Mac it says so out loud, so you can walk
        away from the screen and still hear when the work is done.
      </P>
      <P>
        All of the speech comes from a model running on the laptop itself. The note text never
        goes to a cloud voice service, which matters when the notes include health, money and
        journal material.
      </P>
      <Figure
        src="/blog/local-voice-kokoro-second-brain-1.jpg"
        alt="A warm desk at night, a laptop glowing softly while sound seems to rise from it"
        width={2752}
        height={1536}
        priority
      />

      <H2>The voice: Kokoro on Apple silicon</H2>
      <P>
        The model is Kokoro-82M, an open text-to-speech model under the Apache 2.0 license. It
        has 82 million parameters, small enough to run comfortably on a 14-inch M4 MacBook Pro
        with 16 GB of memory. We use the voice called <code>af_heart</code>. In Kokoro&apos;s
        naming the <code>a</code> means American English and the <code>f</code> means female;
        &ldquo;heart&rdquo; is the voice itself. It is also the voice our Friendly desk robot
        already speaks with, so the robot, the notes app and the coding agent now sound like the
        same person.
      </P>
      <P>
        It runs through <A href="https://github.com/Blaizzy/mlx-audio">mlx-audio</A>, an
        open-source library built on Apple&apos;s MLX framework. mlx-audio includes a small server
        that speaks the same API shape as OpenAI&apos;s speech endpoint, so anything that can call{' '}
        <code>POST /v1/audio/speech</code> can use the local voice by changing one URL.
      </P>
      <P>
        On our M4 the numbers came out like this. The first request after a restart takes about
        13 seconds while the model loads. After that a sentence comes back in under half a second.
        A long planning note that reads out to 15 minutes of audio rendered in 79 seconds. The
        server process used about 213 MB of memory.
      </P>
      <P>
        Kokoro is not the most natural voice available. On the{' '}
        <A href="https://artificialanalysis.ai/text-to-speech/leaderboard">
          Artificial Analysis speech leaderboard
        </A>{' '}
        it sits well below the best paid voices. For reading notes and announcing finished tasks
        it is good enough, and it keeps working when an API account runs out of credit.
      </P>

      <H2>Listen to any note</H2>
      <Figure
        src="/blog/local-voice-kokoro-second-brain-2.jpg"
        alt="A pair of headphones resting on an open notebook in lamplight"
        width={2400}
        height={1792}
      />
      <P>
        Open a note in the second brain app and there is a Listen link next to Download and Edit.
        Press it and the app turns the markdown into speakable text: it drops the frontmatter,
        code blocks, link URLs and table pipes, and ends headings and list items with a full stop
        so the voice pauses in the right places. Then it sends the text to the local server and
        plays the MP3 in a normal audio player, so you can pause, scrub and change speed.
      </P>
      <P>
        A five-minute note took about 21 seconds to render the first time. The audio is cached,
        so the second listen starts at once.
      </P>
      <P>
        We made one rule strict on purpose. If the local voice server is down, the Listen button
        shows an error. It does not fall back to a cloud voice, because the whole point is that
        private notes stay on the machine.
      </P>

      <H2>Hearing when Claude is done</H2>
      <Figure
        src="/blog/local-voice-kokoro-second-brain-3.jpg"
        alt="A person raising both arms at a window at dusk, away from a laptop resting on the desk"
        width={2528}
        height={1696}
      />
      <P>
        Long agent tasks have an awkward rhythm. You start something that will take eight
        minutes, switch to another window, and come back twenty minutes later. Now, when a Claude
        Code task on this Mac runs longer than two minutes, the laptop says something like
        &ldquo;Claude finished in secondbrain after 6 minutes,&rdquo; followed by the first
        sentence of Claude&apos;s reply.
      </P>
      <P>
        This is a Claude Code Stop hook: a small script Claude Code runs every time it finishes a
        turn. The script reads the session transcript, measures the time since your last message,
        and stays silent for anything short. If two sessions finish at the same moment, the
        messages queue instead of talking over each other.
      </P>
      <P>
        A Voice switch in the second brain app&apos;s header turns this on or off for this Mac.
        It writes one small settings file, and the hook reads that file on every turn, so the
        change applies to the next task without a restart.
      </P>
      <P>
        The same voice now powers two more tools:{' '}
        <A href="https://github.com/mbailey/voicemode">VoiceMode</A>, an MCP server for spoken
        conversations with Claude Code, and the Hermes agent when it runs on the Mac. Hermes on
        our cloud server still uses its old cloud voice, because a laptop that travels and sleeps
        can&apos;t serve a Telegram bot.
      </P>

      <H2>How to set it up yourself</H2>
      <Figure
        src="/blog/local-voice-kokoro-second-brain-4.jpg"
        alt="Hands on a dark keyboard in warm, low light"
        width={2400}
        height={1792}
      />
      <P>
        You need a Mac with Apple silicon (M1 or later) and <code>uv</code>. These are the steps
        we followed, including the parts that tripped us up.
      </P>
      <P>
        <strong>1. Install mlx-audio with the extras Kokoro needs.</strong> The server lives in
        the <code>server</code> extra, and Kokoro&apos;s English phonemizer, misaki, needs spaCy
        and its small English model. Pin spaCy below version 4: letting uv pick pre-release
        packages pulled a spaCy development build that crashed on load.
      </P>
      <pre style={voicePre}><code>{VOICE_INSTALL}</code></pre>
      <P>
        <strong>2. Generate a first clip.</strong> The first run downloads the model and the
        voice file. The voices come from a second repository, so this run needs internet access.
      </P>
      <pre style={voicePre}><code>{VOICE_FIRST_CLIP}</code></pre>
      <P>
        <strong>3. Run the server on localhost.</strong> Bind it to 127.0.0.1 so nothing else on
        your network can reach it. If you run it from launchd, set a working directory and a log
        directory: the server creates a <code>logs</code> folder where it starts, and under
        launchd that is the read-only root of the disk.
      </P>
      <pre style={voicePre}><code>{VOICE_SERVER}</code></pre>
      <P>
        <strong>4. Add the spoken alert to Claude Code.</strong> In{' '}
        <code>~/.claude/settings.json</code>, add a Stop hook that runs your script. The script
        reads the hook&apos;s JSON from standard input, opens the <code>transcript_path</code> it
        points to, finds the timestamp of your last real message (not tool results or system
        messages), and if more than two minutes have passed, starts a detached process that posts
        a short sentence to the server and plays it with <code>afplay</code>. Make it exit 0 on
        every error, so speech can never block Claude from stopping.
      </P>
      <pre style={voicePre}><code>{VOICE_HOOK}</code></pre>
      <P>
        <strong>5. Give it an off switch.</strong> Have the hook read a small JSON file such as{' '}
        <code>{'{"autoSpeak": true, "minTaskSeconds": 120}'}</code> before doing anything else.
        Any interface can flip that file: a button in your own app, a shell alias, or another
        agent.
      </P>
      <P>
        <strong>6. If you use VoiceMode,</strong> point it at the server with{' '}
        <code>VOICEMODE_TTS_BASE_URLS=http://127.0.0.1:8880/v1</code>. VoiceMode assumes port
        8880 is a different Kokoro server and sends the model name <code>tts-1</code>, which
        mlx-audio rejects, so also set{' '}
        <code>VOICEMODE_TTS_MODELS_KOKORO=mlx-community/Kokoro-82M-bf16</code>. VoiceMode also
        needs the PortAudio library (<code>brew install portaudio</code>).
      </P>
      <P>
        One more thing we found while setting up: VoiceMode had been launched with{' '}
        <code>uvx --refresh</code> in our Claude Code config, and each session left a stuck
        process behind. Eight of them were holding uv&apos;s cache lock, which is also why
        VoiceMode never connected. Installing it once with <code>uv tool install voice-mode</code>{' '}
        and pointing the config at that binary fixed both.
      </P>

      <H2>What comes next</H2>
      <P>
        The next step is a cloned voice, so course voiceovers can be read in the author&apos;s own
        voice. The plan is to try Qwen3-TTS, another Apache 2.0 model that can copy a voice from a
        short recording. A second Mac with more memory will eventually take over the server role
        so our cloud agents can use the same voice over a private network.
      </P>
      <P>
        For now the change is small and practical: the notes can read themselves aloud, and the
        laptop tells you when the agent is done.
      </P>
      <P>
        <em>Argo Writer Agent</em>
      </P>
    </>
  )
}

/* ── Post: How our AI agents will know what they may share: privacy levels for a second brain ── */
function PrivacyLevelsForAiAgentsContent() {
  return (
    <>
      <P>
        We keep almost everything in one place: a folder of plain text notes we call our second brain. Product plans, build logs, research and to-do lists sit in it. So does ordinary life: where we are staying next month, what a doctor said, what the rent costs. Several AI agents work inside this folder every day. One writes a private morning briefing. One answers questions on Telegram. One drafts a public build log for our blog.
      </P>
      <P>
        That last one is the problem this post is about. An agent that has just read a note about a rent payment and an agent that writes to the public internet can be the same agent, in the same run. Nothing in a text file tells it that one sentence is fine to repeat and the next is not.
      </P>
      <P>
        This post explains the system we are designing to fix that: what the privacy levels are, how a note gets one, how every agent learns the rules, how the rules are enforced, and where each decision is recorded. Most of it is a design today. The last section says exactly which parts already run.
      </P>
      <H2>Why a single &quot;private&quot; switch isn&apos;t enough</H2>
      <P>
        The obvious answer is a checkbox: private or public. It breaks quickly. A note about a product we haven&apos;t launched yet is fine for our agents to read, should never reach the blog, and becomes public the day we launch. A note about a health appointment is fine for the morning briefing, should never reach the blog, and should never be sent to an outside AI service either. Those are two different kinds of secret, and one switch can&apos;t describe either.
      </P>
      <P>
        Governments solved this problem decades ago, so we borrowed from them. The US classification system answers three separate questions about every document:
      </P>
      <UL items={[
        <><strong>How bad would a leak be?</strong> That is the level.</>,
        <><strong>What kind of secret is it?</strong> That is the compartment.</>,
        <><strong>Where may it go?</strong> That is the release control.</>,
      ]} />
      <P>
        Our design keeps those three questions apart.
      </P>
      <H2>Question one: the levels</H2>
      <P>
        A level is a single word on a ladder. Higher means a leak would hurt more, so fewer people and machines may see it. We use five:
      </P>
      <UL items={[
        <><strong>public:</strong> anyone. The blog, X, any AI service.</>,
        <><strong>shared:</strong> our own devices and agents, the outside AI models they use, and our logged-in dashboards. This is the default when nothing else is said.</>,
        <><strong>private:</strong> our agents and the morning briefing, but not hardware we wear in public or show on a livestream.</>,
        <><strong>confidential:</strong> Konrad only. Never sent to an outside AI model, never served by our website, and encrypted when stored.</>,
        <><strong>secret:</strong> Konrad only, and readable only on a machine that holds the decryption key.</>,
      ]} />
      <P>
        If you know the government words, the mapping is rough but useful. The US order that defines classification, Executive Order 13526, uses three levels: Confidential (a leak would cause damage), Secret (serious damage) and Top Secret (exceptionally grave damage). Our <code>private</code> sits near their Confidential, our <code>confidential</code> near their Secret, and our <code>secret</code> near Top Secret. Security teams also use the Traffic Light Protocol (TLP), a set of sharing labels from CLEAR to RED. Our <code>public</code> matches TLP:CLEAR, <code>shared</code> is close to GREEN and <code>private</code> to AMBER.
      </P>
      <H2>Question two: compartments</H2>
      <P>
        A level says how much to protect something. It doesn&apos;t say what the thing is. Compartments do. In intelligence work, a compartment is a named category of secret that only people with a specific need may enter, on top of their level. We use the same idea for the kinds of information a life and a company produce:
      </P>
      <UL items={[
        <><strong>personal-health:</strong> health, sleep and body data.</>,
        <><strong>personal-finance:</strong> personal money, tax and rent.</>,
        <><strong>personal-location:</strong> where we live, accommodation and travel plans.</>,
        <><strong>personal-relationships:</strong> people, family and dating.</>,
        <><strong>guests:</strong> details about the guests at a home we rent out.</>,
        <><strong>money:</strong> company revenue, fees and wallets.</>,
        <><strong>unreleased:</strong> product plans before launch.</>,
        <><strong>credentials:</strong> anything that looks like a key or password. It should never be in a note at all.</>,
      ]} />
      <P>
        Each compartment does two jobs. It sets a <strong>floor</strong>: a <code>personal-finance</code> note can never be below <code>confidential</code>, whatever level someone types. And it carries a <strong>rule</strong>: <code>personal-location</code> is never public until the trip is over, and never with an exact address. A compartment can only raise the protection, never lower it.
      </P>
      <P>
        Compartments also let us draw one clean line. Personal life is a separate domain from the company. Health, money, housing, travel and relationships carry a <code>personal-</code> compartment, and the company reports never include them.
      </P>
      <H2>Question three: release controls</H2>
      <P>
        The last question is where something may travel. We have three controls:
      </P>
      <UL items={[
        <><strong>release-reviewed:</strong> a human has read this exact text and cleared it for the public. Every public post needs it.</>,
        <><strong>no-external-model:</strong> never send this to an outside AI service. It is implied by <code>confidential</code> and above, and by the finance and relationship compartments.</>,
        <><strong>konrad-only:</strong> no agent reads it unless Konrad allows it for that session. It is implied by <code>secret</code>.</>,
      ]} />
      <H2>How a note gets its marking</H2>
      <P>
        A marking is a few lines at the top of a note, in the same front matter where notes already keep a title or tags:
      </P>
      <UL items={[
        <><code>privacy: private</code> sets the level.</>,
        <><code>compartments: [personal-location]</code> names the kind of secret.</>,
        <><code>declassify_on: 2026-11-07</code> says when it becomes shareable, for example a launch day.</>,
        <><code>classified_by: konrad</code> says who decided.</>,
      ]} />
      <P>
        Nobody will mark thousands of notes by hand, so markings are inherited. A note without a marking takes its folder&apos;s default from one small settings file: the health folder defaults to <code>private</code> with <code>personal-health</code>, the finance folder to <code>personal-finance</code>, which lifts it to <code>confidential</code>. A folder without a default falls back to <code>shared</code>.
      </P>
      <P>
        Some notes mix levels, like a weekly plan that is mostly work with one line about a flight. For those we borrow <strong>portion marks</strong>, the government practice of marking each paragraph separately. A comment line opens a private block inside an otherwise shared note and another closes it. Anything inside the block is treated at the higher level.
      </P>
      <P>
        In the design, the same fields also go on our project tracker. Every division, project and feature can carry a level and compartments, and inherits them from the level above when blank. Each row also gets a separate <strong>public summary</strong>, the only text from the tracker that may ever be published. The internal notes on a row, like &quot;waiting on Konrad to approve the budget&quot;, will stay internal by construction, because the public feed will never read them.
      </P>
      <H2>The two rules that do the real work</H2>
      <P>
        When information from two levels meets, the result takes the higher one. If a report includes nine shared rows and one private row, the whole report is private, unless that row is replaced by its public summary. Security engineers call this the <strong>high-water mark</strong>: like a bathtub line, the level only rises.
      </P>
      <P>
        The second rule comes from the Bell-LaPadula model, a security model written for the US Department of Defense in the 1970s. It has two properties. <strong>No read up:</strong> a reader may not read above its level. <strong>No write down:</strong> a writer that has read something at a high level may not write at a lower level, because whatever it read could leak into what it writes.
      </P>
      <P>
        No write down is the rule that matters most for us. An AI agent that has read a private briefing carries that context into everything it writes next. Asking it to &quot;be careful&quot; is a suggestion, not a control. So the agent that writes a public post must never have read anything above <code>public</code> in the first place. We call this the <strong>clean room</strong>: the public writer gets a feed built only from public material, and the publishing script will refuse any draft whose sources were above <code>public</code>. Our daily build log is the first thing that will move into the clean room.
      </P>
      <H2>How every agent learns the rules</H2>
      <P>
        We run more than one agent: Claude Code and Hermes, on a laptop and on a server, answering Telegram messages and running scheduled jobs. If each had its own instructions, they would drift apart. So the rules live in one file, <code>AGENTS.md</code>, at the root of the vault.
      </P>
      <P>
        Hermes reads <code>AGENTS.md</code> directly. Claude Code reads its own <code>CLAUDE.md</code>, so ours is a few lines ending in <code>@AGENTS.md</code>, which Claude Code treats as an import. Whatever harness runs the agent, it loads the same rulebook. When the privacy design is built, its rules go into that file: what each level means, that markings are inherited, that personal compartments never appear in company reports, and that only the clean room writes public text.
      </P>
      <P>
        Written rules are still only suggestions. An agent mostly follows them and, on a bad day, doesn&apos;t. So each rule that matters also gets a machine check.
      </P>
      <H2>Who enforces it</H2>
      <P>
        In the design, enforcement sits in four places, each a small program rather than an instruction:
      </P>
      <UL items={[
        <><strong>The guard.</strong> Both agents run the same guard script before every file read and shell command. It is a hook: a small program that runs before the agent&apos;s action and can stop it. Today it blocks agents from reading files that hold keys, and from force-pushing over shared history. The design extends it to block reads of <code>confidential</code> and <code>secret</code> notes unless Konrad allows them.</>,
        <><strong>The search index.</strong> Our notes are split into chunks and turned into embeddings (lists of numbers that let a search find notes by meaning). Making them can mean sending text to an outside service. The design sends only <code>public</code> and <code>shared</code> text out, handles <code>private</code> text on our own machine or skips it, and never indexes anything higher.</>,
        <><strong>The surfaces.</strong> Each place that shows information gets a ceiling. The logged-in dashboard shows up to <code>confidential</code> with a visible marking chip on each row. The morning briefing and Telegram stop at <code>private</code>. The small screen on our wearable stops at <code>shared</code>, because it is worn in public and on livestreams. The public feed shows only <code>public</code>.</>,
        <><strong>Encryption at rest.</strong> <code>confidential</code> and <code>secret</code> notes will be encrypted in the repository with git-crypt, so a leaked copy of the repository shows only scrambled text.</>,
      ]} />
      <H2>Where every decision is recorded</H2>
      <P>
        A marking you can&apos;t audit is a marking you can&apos;t trust. So the design adds two logs that only ever grow. Nothing in them is edited or deleted:
      </P>
      <UL items={[
        <><strong>Classification changes:</strong> every time a marking changes, what it was, what it became, who changed it, when, and why. This is our version of the &quot;Classified by&quot; and &quot;Declassify on&quot; lines printed on a government document.</>,
        <><strong>Disclosures:</strong> every time something goes public, the channel, the address, who approved it, and a fingerprint of each source it was built from.</>,
      ]} />
      <P>
        Once a week an agent will compare the disclosures with today&apos;s markings. If something published last week has since been marked private, it gets flagged for a human to look at.
      </P>
      <H2>What&apos;s built and what&apos;s next</H2>
      <P>
        Built and running today:
      </P>
      <UL items={[
        <>One rulebook, <code>AGENTS.md</code>, loaded by every agent we run.</>,
        <>The guard script that runs before every shell command and file read or edit, blocking reads of key files and force pushes.</>,
        <>A human approval before anything is published: every post an agent drafts stays a draft until Konrad says yes.</>,
      ]} />
      <P>
        Designed, not built yet, in this order:
      </P>
      <UL items={[
        <>Markings on the project tracker, with a &quot;view as public&quot; preview on the dashboard and the wearable&apos;s screen capped at <code>shared</code>.</>,
        <>The clean room for the daily build log, with the disclosure log.</>,
        <>Markings and folder defaults for every note, then the guard, search index and encryption rules above.</>,
      ]} />
      <P>
        If you are building your own second brain with agents, the shortest useful version is this: give every note a level and a kind, let folders supply the default, put the rules in one <code>AGENTS.md</code> that every agent loads, and never let the agent that writes in public read anything private first.
      </P>
      <P>
        We are building this in the open. Follow along at https://x.com/myargoquest.
      </P>
    </>
  )
}

/* ── Post: How we built a 3D map of our second brain, and how you can build your own ── */
function BuildA3dMapOfYourSecondBrainContent() {
  return (
    <>
      <P>
        Our second brain is a folder of plain text notes, a little over 2,000 of them, plus a database that tracks the company&apos;s projects. Every piece had its own page: notes in a file tree, projects on a board, follower counts on three different platforms. None of those pages showed how the pieces connect: which notes feed which project, which project serves which goal, and whether the numbers behind the goals are moving.
      </P>
      <P>
        So we built one view that shows all of it. The mission sits at the centre. Goals, divisions and projects sit on rings around it. Every note is a point of light near the project it belongs to, and the live numbers float above the goals they measure. It runs as a page in our second brain web app, in two versions: a full 3D view for a laptop, and a lean one for a wall TV driven by a Raspberry Pi.
      </P>
      <P>
        This post explains how it works, part by part, in the order we built it. The last two sections are for you: the steps to build your own, and a prompt you can paste into your own coding agent to have it do the work.
      </P>
      <H2>What is on the map?</H2>
      <P>
        Think of a small solar system. Each ring outward is one level of detail, from why we work to what we wrote yesterday.
      </P>
      <UL items={[
        <><strong>The core:</strong> the mission, one bright sphere at the centre.</>,
        <><strong>The first ring:</strong> our goals. Year and quarter goals always show; week and month goals show while they are open.</>,
        <><strong>The second ring:</strong> the company&apos;s divisions (the journal app, the wearable, media, education and so on). Each division owns a colour.</>,
        <><strong>The third ring:</strong> projects, fanned out inside their division&apos;s slice of the circle. Each project&apos;s features orbit it as small moons, coloured by stage.</>,
        <><strong>The cloud:</strong> every note, as a point in its division&apos;s colour. Notes edited recently glow brighter.</>,
        <><strong>Satellites:</strong> the live numbers, each hanging above the goal or division it belongs to.</>,
      ]} />
      <P>
        Lines join them. There are three kinds: a <strong>link</strong> (one note mentions another), <strong>belongs to</strong> (a note lives in a project&apos;s folder, a project in a division) and <strong>serves</strong> (a project moves a goal). Our current map has 2,612 points and 3,705 lines.
      </P>
      <H2>Step 1: give every note at least one link</H2>
      <P>
        A graph of notes draws a line wherever one note links to another. We write notes in markdown with <strong>wikilinks</strong>, a note&apos;s name in double square brackets, the convention Obsidian and several other note apps use. When we counted, more than half the notes in scope (843 of 1,565) had no link in or out. On a map, a note with no links is a loose dot that tells you nothing.
      </P>
      <P>
        We fixed that before drawing anything, with a small command that adds a &quot;Related&quot; section to the end of each note. It uses only rules, no AI model, so the result is predictable and every change shows up as a plain diff. A note gets a link to:
      </P>
      <UL items={[
        <>the design document of the project whose folder it sits in;</>,
        <>the nearest folder index (a <code>README.md</code>), so indexes chain upward to the top;</>,
        <>the previous and next note when it is part of a dated series, such as daily stand-ups;</>,
        <>up to five notes it already mentions by path or by a distinctive title.</>,
      ]} />
      <P>
        The section sits between two hidden comment markers, so the command can rewrite it on every run without touching anything the author wrote. It skips archives, agent instruction files, anything git ignores, and any file with uncommitted changes, so it never writes over work in progress. After one run, 814 notes gained the section and the count of unlinked notes fell from 843 to 207.
      </P>
      <P>
        Then we added one rule to the instructions our AI agents read before they work: every new note links to its project&apos;s design document and to at least one note it builds on. A one-off cleanup decays; a rule keeps the graph connected as it grows.
      </P>
      <H2>Step 2: turn the notes and the projects into one graph</H2>
      <P>
        A graph is just two lists: <strong>nodes</strong> (the things) and <strong>edges</strong> (the lines between them). Ours are built from two sources the app already had.
      </P>
      <UL items={[
        <><strong>The note index.</strong> The app already scans the vault into a database: one row per note, one row per link. Those become note nodes and link edges.</>,
        <><strong>The project tracker and the goals file.</strong> Divisions, projects and features are database records, and each project lists the goals it serves. The goals themselves come from our goals file. Together they become the structure nodes.</>,
      ]} />
      <P>
        The interesting part is deciding where each note belongs. A note is assigned to the project whose folder holds it, using the longest matching folder. If two projects share a folder, the note goes to their division instead, so it doesn&apos;t pick a side at random. Failing that, folder hints map whole areas to a division, and planning files go to the mission. A note that matches nothing floats in an outer shell, like a comet cloud around the solar system: visible, but out of the way.
      </P>
      <H2>Step 3: compute the layout once, on the server</H2>
      <P>
        A <strong>force-directed layout</strong> is the standard way to draw a network. Picture every dot as a magnet that pushes the others away, and every line as a rubber band that pulls two dots together. Run that simulation for a few hundred steps and it settles: linked notes sit close, unrelated ones drift apart.
      </P>
      <P>
        We change the standard recipe in two ways.
      </P>
      <P>
        First, <strong>the structure is pinned</strong>. The mission, goals, divisions, projects, features and metrics get fixed coordinates from simple geometry before the simulation starts: the mission at the origin, goals on a ring of radius 110, divisions at 300, projects between 440 and 500 inside their division&apos;s slice. Only notes move, each one pulled gently toward its project or division. That gives direction a meaning: everything about the wearable sits on one side, everything about education on another.
      </P>
      <P>
        Second, <strong>the layout is computed once, on the server, and stored</strong>. A force simulation started from random positions lands somewhere different each time. If the map rearranged itself on every visit, you would never learn where anything is. So a job on our server runs the simulation with a fixed random seed (same input, same picture), 200 steps, using the open-source library <code>d3-force-3d</code>. It takes about 11 seconds, runs every hour, and writes the positions to the database as a numbered version. The three newest versions are kept.
      </P>
      <P>
        The browser only draws. That is also what gives the small screen a chance: a Raspberry Pi only has to draw the points, never simulate them.
      </P>
      <H2>Step 4: collect the numbers once a day, without API keys</H2>
      <P>
        The satellites need real numbers, and every official social media API wants an app review, a business account or a key. For a first version we read what the platforms already show the public, once a day:
      </P>
      <UL items={[
        <><strong>X followers</strong> from a public read-only endpoint that a third-party service runs for embedding posts.</>,
        <><strong>YouTube subscribers</strong> from the text of the public channel page.</>,
        <><strong>Instagram followers</strong> from the preview tag Instagram serves to link-preview bots. Instagram blocks this from cloud servers, so for now that number is entered by hand from a home computer.</>,
        <><strong>Our fund&apos;s balance</strong> from a public blockchain node: the wallet&apos;s ETH and USDC, priced at the current exchange rate. This collector is written but reports nothing until we connect the wallet.</>,
        <><strong>Livestream hours</strong> from our own stream records, where overlapping streams on different platforms count once.</>,
      ]} />
      <P>
        Every reading is one row in one table: metric name, value, unit, time and the raw response. Each target is copied from our goals file into the metric&apos;s definition, so every satellite shows progress toward a goal we actually set. A source that fails writes nothing: the map keeps the last real reading and shows how old it is. A metric that has never had a reading says &quot;no data&quot; instead of zero, because a zero would be a false statement about the business. A combined number, such as followers across platforms, only appears when every part has a reading.
      </P>
      <P>
        Two warnings if you copy this. Public pages change without notice, so expect a collector to break and make breaking loud. And read each platform&apos;s terms before you scrape it; the official APIs are the durable route once you need more than a daily count.
      </P>
      <H2>Step 5: draw it twice, for a laptop and for a TV</H2>
      <P>
        The same page has two renderers, chosen by the address. Each loads as a separate file, so neither device downloads the other&apos;s code.
      </P>
      <P>
        <strong>The full view</strong> uses <code>3d-force-graph</code>, an open-source library built on <strong>Three.js</strong>, the most common way to draw 3D in a web browser. It gives orbit and zoom controls, clicking, custom shapes and a glow effect. We hand it the stored positions as fixed points and tell it to run zero simulation steps, so it only draws. Clicking any point highlights its neighbours, dims everything else and opens a side panel with a preview, its connections and a link to open it. There is search, a switch for each layer, and metric cards with 30-day trend lines.
      </P>
      <P>
        <strong>The TV view</strong> is written directly in Three.js, because a Raspberry Pi 4&apos;s graphics chip has little to spare. The trick is batching: every note is drawn in one call, the lines in two calls (faint for links, brighter for structure; the lines from notes to their projects are left off the TV) and every structure sphere in one. Only the roughly 60 big objects carry labels, sized to read from across a room. It renders at a fixed resolution with no smoothing, caps itself at 30 frames per second and takes a slow camera tour: a full orbit, then a pass over each division with its name on screen. A frame counter in the corner tells us whether it keeps up. The TV&apos;s download is about 150 KB compressed; the full view&apos;s library alone is about 232 KB.
      </P>
      <P>
        <strong>Privacy on the wall.</strong> A TV shows whatever it shows to anyone in the room. The wall version labels only the big objects, never note titles, and the TV asks the server for a copy of the numbers with every money value removed, so the page never receives a dollar figure to show.
      </P>
      <H2>How to build your own</H2>
      <P>
        You don&apos;t need our stack. You need four pieces, and each can be small.
      </P>
      <UL items={[
        <><strong>A list of your notes and their links.</strong> If your notes are markdown files, a script that walks the folder and pulls out every wikilink is an afternoon of work. Count your unlinked notes first; if it&apos;s most of them, do Step 1 before anything else.</>,
        <><strong>A structure to pin.</strong> Ours is mission, goals, divisions and projects. Yours might be areas of life, or courses, or clients. Pick three or four levels at most and give them fixed rings.</>,
        <><strong>A layout job that saves positions.</strong> Run the force simulation with a fixed seed and write the coordinates to a file or a table. Re-run it on a timer, not on page load.</>,
        <><strong>A page that only draws.</strong> On a laptop, <code>3d-force-graph</code> with fixed positions gets you most of the way in a day. On a weak device, batch everything into a handful of draw calls.</>,
      ]} />
      <P>
        Numbers are optional. Add them last, one collector at a time, and show &quot;no data&quot; honestly until each one works.
      </P>
      <H2>A prompt for your coding agent</H2>
      <P>
        If you use a coding agent such as Claude Code or Codex, paste the prompt below into it from inside your notes folder or your app&apos;s repository. It describes the architecture without assuming our stack, and it asks the agent to check your setup and agree a plan with you before it writes anything.
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"I want a 3D map of my second brain: one interactive scene that shows my notes, the structure they belong to, and optionally a few live numbers. Build it in my existing app if I have one, otherwise as a small local web app. Work in this order, and stop for my approval after step 1.\n\n1. Survey and plan. Find where my notes live and how they link (wikilinks, markdown links, tags, a database). Count the notes and how many have no link in or out. Propose the structure levels to pin at the centre (for example: mission, goals, areas, projects), where each comes from (a file, a folder, a database table), and the rule that assigns each note to one of them (longest matching folder wins; ties go to the parent level; notes that match nothing go to an outer shell). Show me the plan and wait.\n\n2. Links first. If more than about a third of the notes are unlinked, write a rules-only script (no AI model) that appends a \"Related\" section to each note between two HTML comment markers, linking the note to its project's main document, its nearest folder index, the previous and next note in a dated series, and up to five notes it already mentions. It must be idempotent, rewrite only the text between the markers, skip archives, git-ignored files and files with uncommitted changes, and have a dry-run mode that prints counts before it writes. Run the dry run and show me the numbers before writing.\n\n3. Graph. Build two lists: nodes (id, kind, label, parent, size) and edges (source, target, kind), with three edge kinds: link (note to note), belongs (note to its anchor, project to area) and serves (project to goal).\n\n4. Layout, computed once and stored. Pin the structure nodes on fixed rings with simple geometry: the centre node at the origin, then one ring per level, children inside their parent's angular slice. Run a 3D force simulation (d3-force-3d or similar) only for the notes, starting each near its anchor, with a fixed random seed and a fixed number of steps, so the same input always gives the same picture. Write the positions to a file or a table with a version number, and re-run it on a schedule, never on page load.\n\n5. Views. Serve the graph from one endpoint with an ETag so unchanged layouts aren't re-sent. Desktop view: 3d-force-graph with every node's position fixed and zero simulation ticks, labels only on structure nodes, click to highlight neighbours and open a side panel with a preview and links, a search box and a toggle per layer. If I also want a low-power display (a Raspberry Pi or an old tablet), add a second view behind a URL flag written in plain three.js: all notes in one Points draw, all edges in at most two LineSegments draws, structure nodes in one InstancedMesh, pixel ratio 1, no antialiasing, a 30 fps cap, a slow automatic camera tour and an fps counter. Load the two views as separate bundles.\n\n6. Numbers, optional and last. One table of readings (metric, value, unit, time, raw response). One small collector per source, run once a day. A failed source writes nothing, and the view shows \"no data\", never zero. Read targets from my goals file, not from code. Never show money values on a shared screen; strip them on the server, not in the page.\n\nConstraints: never edit my notes outside the marked section, never commit without showing me the diff, add tests for the note-assignment rule, the layout's determinism and the collectors' parsers, and tell me what you verified and what you didn't."}</code></pre>
      <P>
        The prompt deliberately starts with a survey and a stop. Every vault is organised differently, and the rule that assigns notes to a place is the decision that shapes the whole map, so it&apos;s worth five minutes of your attention before any code exists.
      </P>
      <H2>What&apos;s built and what&apos;s next</H2>
      <P>
        Running today: the backlinks command and the agent rule, the hourly layout job, the daily collector, the full view on a laptop and the TV view in a browser.
      </P>
      <P>
        Next, in order:
      </P>
      <UL items={[
        <><strong>Measure the Pi.</strong> The TV view joins the wall&apos;s rotation once it holds at least 20 frames per second for ten minutes on the real device.</>,
        <><strong>Automate Instagram</strong> from a home computer, since the platform blocks servers.</>,
        <><strong>Meaning layout.</strong> Our notes are partly turned into <strong>embeddings</strong> (lists of numbers that capture what a passage is about). A second layout would place notes by topic instead of by links, with a switch between the two.</>,
        <><strong>Time-lapse.</strong> A slider that replays the brain growing, note by note.</>,
      ]} />
      <P>
        The part that mattered most was the least visual: giving every note a link and every project a place. Once that structure exists, drawing it is the easy step.
      </P>
      <P>
        We post the build as it happens on this blog and at <A href="https://x.com/myargoquest">x.com/myargoquest</A>.
      </P>
      <P>
        *Argo Writer Agent*
      </P>
    </>
  )
}

/* ── Post: How we sync a smart ring into our own database, and how you can too ── */
function SmartRingToYourOwnDatabaseContent() {
  return (
    <>
      <P>
        We wear an Ultrahuman Ring AIR. It records sleep, heart rate, heart rate variability, skin temperature and steps, and the phone app shows a tidy score each morning. We wanted that data in our own database, next to everything else our agents can read, so a question like &quot;how did I sleep the week of the hackathon?&quot; has an answer that isn&apos;t locked in someone else&apos;s app.
      </P>
      <P>
        The first version worked, with one flaw we only noticed later. The job that pulled the ring data ran on a Raspberry Pi we carry around, a small wearable computer we call the cyberdeck. The Pi pulled from the ring vendor&apos;s cloud every hour, kept a local copy for its own screen, and pushed each day&apos;s data up to our server. When the Pi was in a bag with its battery off, nothing pulled. The server&apos;s copy quietly stopped at the last day the Pi had been online. Our laptop app showed a night that was a day old, with only a small timestamp to give it away.
      </P>
      <P>
        The fix was to turn the design around. The always-on server now calls the ring vendor&apos;s API itself and stores the result in the one database we treat as the master. The Pi becomes a reader of a copy; that half is built and tested and installs itself the next time the Pi is online. This post explains the pieces in the order we built them, with the code, so you can do the same with your own ring and your own server.
      </P>
      <H2>What does a smart ring actually give you?</H2>
      <P>
        The ring itself talks only to the phone app over Bluetooth. There is no public Bluetooth protocol for reading it directly. The app uploads to the vendor&apos;s cloud, and the cloud has a <strong>partner API</strong> (a web address you call with a personal token to get your own data back). For Ultrahuman, you generate the token in their developer portal, then call one endpoint:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"GET https://partner.ultrahuman.com/api/v1/partner/daily_metrics?start_epoch=...&end_epoch=...\nAuthorization: <your token, with no \"Bearer\" prefix>"}</code></pre>
      <P>
        You can ask for one <code>date</code> or for a range of at most seven days as Unix epoch seconds (the number of seconds since 1970, the standard way programs write a moment in time). The answer is one JSON object per day, keyed by date, holding a list of metric objects: readings of heart rate, HRV, temperature and steps every few minutes, a handful of blood-oxygen points, single daily values such as recovery index and VO2 max, and a sleep object with the score, the minutes in each stage and the full hypnogram (the timeline of sleep stages through the night).
      </P>
      <H3>Exactly what comes back for one day</H3>
      <P>
        Each day is a list of typed objects. From a real response, these are the types and what each holds:
      </P>
      <UL items={[
        <><strong>`hr`:</strong> heart rate readings every few minutes through the day, in beats per minute, plus the last reading.</>,
        <><strong>`hrv`:</strong> heart rate variability readings (the variation in time between beats, in milliseconds) and the day&apos;s average, with a trend against the previous days.</>,
        <><strong>`temp`:</strong> skin temperature readings in degrees Celsius.</>,
        <><strong>`steps`:</strong> step counts over time, the day&apos;s total and the average per interval.</>,
        <><strong>`spo2`:</strong> a few blood-oxygen saturation points, as a percentage.</>,
        <><strong>`night_rhr`:</strong> resting heart rate during sleep, as a trend series over several nights.</>,
        <><strong>`sleep`:</strong> one object for the night that ended that morning: bedtime start and end, the score, total sleep, time in bed, the minutes and percentage in deep, light, REM and awake, sleep efficiency, restorative sleep percentage, temperature deviation from your baseline, average oxygen saturation (which the vendor marks as a beta feature), tosses and turns, full sleep cycles, morning alertness in minutes, and four time series across the night: the hypnogram (which stage you were in, minute by minute), heart rate, HRV and skin temperature. A day with no sleep recorded has no score, and our parser treats the missing score as &quot;no night&quot;.</>,
        <><strong>Single daily values:</strong> <code>sleep_rhr</code> (resting heart rate in sleep), <code>avg_sleep_hrv</code>, <code>recovery_index</code>, <code>movement_index</code>, <code>active_minutes</code>, <code>inactive_time</code>, <code>weekly_active_minutes</code>, <code>movements</code>, <code>morning_alertness</code> and <code>vo2_max</code> (an estimate of aerobic fitness).</>,
      ]} />
      <P>
        Three details of this API shaped everything that follows:
      </P>
      <UL items={[
        <><strong>Days are keyed in your account&apos;s timezone</strong>, not in UTC. The night you sleep is filed under the day you wake up.</>,
        <><strong>A day at the edge of a range comes back partial.</strong> If your range starts at noon, that day&apos;s readings before noon are missing. So a range must be padded and edge days dropped.</>,
        <><strong>Recent days change.</strong> Last night&apos;s sleep appears only after the phone syncs, and some trend values are recomputed later. A sync has to re-fetch the last few days every time.</>,
      ]} />
      <H2>Why the Pi was the wrong place to pull from</H2>
      <P>
        The question to ask about any data pipeline is: which machine is the <strong>source of truth</strong>, the one copy every other copy is judged against? A device that travels, sleeps and runs on a battery is a poor source of truth, however convenient it is for display. An always-on server is a good one. Our server already held the master database for everything else, so the ring data joining it was the obvious move.
      </P>
      <P>
        The analogy is a newspaper and a newsstand. The press prints every day whether or not any particular stand is open. A stand that was closed yesterday picks up both days&apos; papers when it reopens. In our first design the newsstand was doing the printing, so a closed stand meant no paper for anyone. The analogy stops at one point: our &quot;stand&quot; also needs to work with no connection at all, so it keeps its own copy rather than fetching on demand.
      </P>
      <P>
        After the change the roles are (the Pi&apos;s is the part still waiting for the Pi):
      </P>
      <UL items={[
        <><strong>The server</strong> calls the vendor&apos;s API every hour and writes the result into Postgres. It is the only writer of the ring tables and the only machine that uses the API token.</>,
        <><strong>The Pi</strong> will ask the server, every hour it is online, for every day that changed since its last visit, and keep the result in a small local SQLite file for its screen. Delete that file and the next pull rebuilds it.</>,
        <><strong>The laptop app</strong> reads the server&apos;s database directly over a private network. It has no copy to go stale.</>,
      ]} />
      <H2>Step 1: one script, two storage backends</H2>
      <P>
        We wanted the server and the Pi to run the same code, so they can never disagree about what a day&apos;s data means. The script has one parser and one storage function, and the storage function works on either a Postgres connection or a SQLite one. The trick that makes the two copies comparable is to store the <strong>canonical bytes</strong> of each day&apos;s payload and a hash of them:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"import hashlib, json\n\ndef canonical(items):\n    \"\"\"The stored payload text and its sha256. The same bytes on every machine.\"\"\"\n    text = json.dumps(items, sort_keys=True, separators=(\",\", \":\"))\n    return text, hashlib.sha256(text.encode()).hexdigest()"}</code></pre>
      <P>
        Sorting the keys and removing the whitespace means the same data always produces the same text, so the same hash. Storage then becomes an idempotent upsert: if the hash for that day is unchanged, touch a <code>received_at</code> timestamp and stop; if it changed or is new, replace the raw payload, the parsed daily row, the samples and the sleep stages for that day in one transaction, and move <code>changed_at</code>. Here is the SQLite half, trimmed to its shape:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"def store_day(con, day, items, now, changed_at=None):\n    payload, sha = canonical(items)\n    row, samples, stages = parse_day(items)           # your parser: daily dict, (metric, ts, value), (start, end, stage)\n    prev = con.execute(\"SELECT payload_sha256 FROM ring_raw WHERE day = ?\", (day,)).fetchone()\n    with con:\n        if prev and prev[0] == sha:\n            con.execute(\"UPDATE ring_raw SET fetched_at = ? WHERE day = ?\", (now, day))\n            return False\n        con.execute(\"\"\"INSERT INTO ring_raw (day, payload, payload_sha256, fetched_at, changed_at)\n                       VALUES (?, ?, ?, ?, ?)\n                       ON CONFLICT(day) DO UPDATE SET payload = excluded.payload,\n                         payload_sha256 = excluded.payload_sha256,\n                         fetched_at = excluded.fetched_at, changed_at = excluded.changed_at\"\"\",\n                    (day, payload, sha, now, changed_at if changed_at is not None else now))\n        con.execute(\"DELETE FROM ring_samples WHERE day = ?\", (day,))\n        con.executemany(\"INSERT OR REPLACE INTO ring_samples (metric, ts, day, value) VALUES (?, ?, ?, ?)\",\n                        [(m, ts, day, v) for m, ts, v in samples])\n        con.execute(\"DELETE FROM ring_sleep_stages WHERE day = ?\", (day,))\n        con.executemany(\"INSERT OR REPLACE INTO ring_sleep_stages (day, start, end, stage) VALUES (?, ?, ?, ?)\",\n                        [(day, s, e, st) for s, e, st in stages])\n    return True"}</code></pre>
      <P>
        <code>changed_at</code> matters more than it looks. On the server it is set to &quot;now&quot; whenever the hash moves. On the Pi it is copied from the server, so the Pi can later ask &quot;give me every day whose <code>changed_at</code> is after the newest one I have&quot;. That one column is the whole synchronisation protocol.
      </P>
      <P>
        The raw payload is kept word for word. The parsed tables are a convenience that can be rebuilt from it, so a parser bug never costs data.
      </P>
      <H2>Step 2: fetch in windows and re-fetch the last three days</H2>
      <P>
        Each run decides which days to fetch: from the newest stored day minus two (a three-day window, so a night that lands late is picked up) through today. An empty database starts from a fixed date, the first day the ring was worn. Days are grouped five at a time, and each group&apos;s time window is padded by twelve hours on both sides, which keeps every requested day whole even if the server&apos;s clock and the account&apos;s timezone disagree by up to twelve hours. Five days plus a day of padding is six days, under the API&apos;s seven-day cap.
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"from datetime import date, datetime, timedelta\n\nCHUNK_DAYS, PAD_S = 5, 12 * 3600\n\ndef plan_days(last_stored, today, backfill_from, refetch=3, force_from=None):\n    if force_from:\n        start = date.fromisoformat(force_from)\n    elif last_stored:\n        start = min(date.fromisoformat(last_stored), today) - timedelta(days=refetch - 1)\n    else:\n        start = date.fromisoformat(backfill_from)\n    return [start + timedelta(days=i) for i in range((today - start).days + 1)]\n\ndef chunk_windows(days):\n    out = []\n    for i in range(0, len(days), CHUNK_DAYS):\n        group = days[i:i + CHUNK_DAYS]\n        first = datetime.combine(group[0], datetime.min.time()).timestamp()\n        last_end = datetime.combine(group[-1] + timedelta(days=1), datetime.min.time()).timestamp()\n        out.append(({d.isoformat() for d in group}, int(first - PAD_S), int(last_end + PAD_S - 1)))\n    return out\n\ndef sync(con, token, today, fetch):\n    days = plan_days(max_day(con), today, backfill_from=\"2026-01-01\")\n    for wanted, start, end in chunk_windows(days):\n        metrics = fetch(token, start, end)                 # {\"YYYY-MM-DD\": [metric objects]}\n        for day in sorted(wanted & metrics.keys()):       # drop the clipped edge days\n            store_day(con, day, metrics[day], now=int(time.time()))"}</code></pre>
      <P>
        The line <code>wanted &amp; metrics.keys()</code> is the edge-day rule: only days we asked for are stored, so a day the API clipped at the window&apos;s edge is never written as if it were complete.
      </P>
      <H2>Step 3: the timezone trap</H2>
      <P>
        Our server runs on UTC, as most servers do. The ring vendor files each day in the account&apos;s timezone, which for us is Tokyo, nine hours ahead. At 23:30 UTC the server&apos;s calendar still says the 15th, but in Tokyo it is 08:30 on the 16th, and last night&apos;s sleep is already filed under the 16th. A planner that used the server&apos;s <code>date.today()</code> would not ask for the 16th until nine hours later.
      </P>
      <P>
        The fix is one function, and a setting that names the account&apos;s timezone:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"from datetime import datetime\nfrom zoneinfo import ZoneInfo\n\ndef today_in(tz=\"Asia/Tokyo\"):\n    \"\"\"The vendor files days in the account's timezone; the server's clock is UTC.\"\"\"\n    return datetime.now(ZoneInfo(tz)).date()"}</code></pre>
      <P>
        We found this one by reading the code before deploying, not by losing a night. The first run on the server, at 15:20 UTC on the 15th, fetched through the 16th, which is the confirmation.
      </P>
      <H2>Step 4: a read-only feed for the mirror</H2>
      <P>
        The Pi needs a way to ask the server for changed days without being able to change anything. We gave the server a tiny HTTP service, about a hundred lines of Python&apos;s standard library plus the Postgres driver, with two routes. <code>/ring/health</code> reports how many days are stored and when the last sync ran. <code>/ring/days?since=&lt;epoch&gt;</code> returns every day whose <code>changed_at</code> is after <code>since</code>, oldest change first, fifty per page, with the canonical payload text, its hash and its <code>changed_at</code>. It checks a bearer token (a shared secret sent in a header) and listens only on our private network address.
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"def feed(con, since, limit=50):\n    with con, con.cursor() as cur:\n        cur.execute(\"\"\"SELECT day::text, payload::text, extract(epoch FROM changed_at)::float8\n                       FROM ring_raw WHERE extract(epoch FROM changed_at)::float8 > %s\n                       ORDER BY changed_at, day LIMIT %s\"\"\", (float(since), limit))\n        out = []\n        for day, payload, changed_at in cur.fetchall():\n            text, sha = canonical(json.loads(payload))\n            out.append({\"day\": day, \"payload\": text, \"sha256\": sha, \"changed_at\": changed_at})\n    return out"}</code></pre>
      <P>
        One detail worth copying: <code>changed_at</code> is compared and returned as a floating-point epoch with the same rounding on both sides, and the comparison is strictly &quot;after&quot;. The Pi stores the value it was given and sends it back next time, so the newest day is never served twice. Our first sketch used whole seconds and a &quot;greater or equal&quot; comparison, which would have re-sent the latest day every hour, harmlessly but pointlessly; we caught it before writing the code.
      </P>
      <P>
        We chose an HTTP feed over giving the Pi a database login. A database role would have opened the whole database to a device that is carried around and could be lost. The feed exposes exactly one table, read-only.
      </P>
      <H2>Step 5: the mirror pulls</H2>
      <P>
        On the Pi, the same script runs with a <code>--pull</code> flag instead of the vendor token. It reads the newest <code>changed_at</code> in its local file, asks the feed for everything after it, verifies each payload&apos;s hash, and stores each day with the server&apos;s <code>changed_at</code>. It pages until a page comes back short.
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"def pull(con, url, token, get, now):\n    since = mirror_since(con)                         # max(changed_at) in the local file, or 0.0\n    while True:\n        days = get(url, token, since).get(\"days\") or []\n        before = since\n        for d in days:\n            if hashlib.sha256(d[\"payload\"].encode()).hexdigest() != d[\"sha256\"]:\n                raise ValueError(f\"{d['day']}: sha256 mismatch from the server\")\n            store_day(con, d[\"day\"], json.loads(d[\"payload\"]), now=now, changed_at=float(d[\"changed_at\"]))\n            since = max(since, float(d[\"changed_at\"]))\n        if len(days) < 50 or since <= before:\n            break"}</code></pre>
      <P>
        If the Pi is offline, the request fails, the failure is logged, and the screen keeps showing the last copy with its age. Nothing on the server notices or cares. The installer also removes the vendor token from the Pi&apos;s environment file: a reader has no business holding the key.
      </P>
      <H2>Step 6: two timers, ten minutes apart</H2>
      <P>
        Both machines run the job from a <strong>systemd timer</strong> (Linux&apos;s built-in scheduler, which also runs a missed job after a reboot when <code>Persistent=true</code> is set). The server syncs at seven minutes past each hour; the Pi pulls at seventeen past, so it always finds the fresh hour. The server&apos;s unit, trimmed and with our user and paths made generic:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"[Unit]\nDescription=Ring sync into the master Postgres\n\n[Service]\nType=oneshot\nUser=app\nEnvironmentFile=/etc/ring-sync/env\nExecStart=/usr/bin/python3 /opt/ring-sync/ring_sync.py"}</code></pre>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"[Timer]\nOnBootSec=3min\nOnCalendar=*-*-* *:07:00\nRandomizedDelaySec=2min\nPersistent=true\n\n[Install]\nWantedBy=timers.target"}</code></pre>
      <P>
        The environment file holds the vendor token, the feed&apos;s bearer token and the timezone, readable by root and the service&apos;s user only. The Pi&apos;s unit has the same shape: it runs <code>ring_sync.py --pull</code> as the device&apos;s own user, fires at <code>*:17:00</code>, and its environment file holds the feed&apos;s address and bearer token instead of the vendor token.
      </P>
      <P>
        Each run also writes one row to a <code>ring_sync_log</code> table: when it ran, how many days it fetched, how many changed, and the error text if it failed. That row is what the health route reads, and it is what our morning stand-up will read next, so a revoked token shows up the same day instead of as a slowly ageing chart.
      </P>
      <H2>What the numbers mean, and how to read them</H2>
      <P>
        A ring is not a lab. Treat every value as a trend against your own baseline, not as a diagnosis. With that said, the numbers are far from meaningless, and reading them is mostly a matter of knowing which few to look at and in which direction they move.
      </P>
      <UL items={[
        <><strong>Sleep score</strong> is the vendor&apos;s summary of the night. It is useful as a single line on a chart and useless as a thing to argue with. Look at what feeds it instead.</>,
        <><strong>Total sleep and time in bed</strong> are the two honest numbers. Their ratio is <strong>sleep efficiency</strong>: how much of the time in bed you actually slept. A low efficiency with a long time in bed usually means a late, restless night rather than a short one.</>,
        <><strong>Deep, light and REM minutes</strong> describe the night&apos;s shape. Deep sleep tends to come early in the night, REM later, so a night cut short at the end loses REM first. The hypnogram shows this directly, and it shows wake-ups you don&apos;t remember.</>,
        <><strong>Resting heart rate in sleep</strong> is the night&apos;s average heart rate while asleep. For one person, a lower value than usual tends to go with being rested; a higher one with strain of some kind, whether a late meal, alcohol, illness or hard training.</>,
        <><strong>HRV</strong> moves the other way: higher than your usual is the recovered direction, lower is the strained one. It varies a lot night to night, so read a rolling average over several nights, not one value.</>,
        <><strong>Temperature deviation</strong> is the night&apos;s skin temperature against your baseline. We treat a clear rise as a reason to take the day easier, not as a diagnosis.</>,
        <><strong>Recovery index and movement index</strong> are the vendor&apos;s composite scores for the night and for the day&apos;s activity. Keep them as summaries; look at the inputs when they surprise you.</>,
        <><strong>Morning alertness</strong> is minutes, not a score: how long after waking the ring judged you to be fully up.</>,
        <><strong>Steps, active minutes and VO2 max</strong> describe the day rather than the night. VO2 max from a wrist or finger sensor is an estimate; its direction over months is the useful part.</>,
      ]} />
      <P>
        The rule that makes all of this usable: compare today with your own last month, never with a published average. That is exactly what owning the data lets you do: the vendor&apos;s app shows the recent past, and your database keeps everything.
      </P>
      <H2>How we visualise it</H2>
      <P>
        The ring&apos;s data has two natural scales, the night and the month, so we draw two things and little else. This is what our web app&apos;s ring page and the wearable&apos;s glasses panel draw today.
      </P>
      <UL items={[
        <><strong>One night, in detail.</strong> A <strong>hypnogram</strong>: time across, stage down, each stage a horizontal band in one colour family, dark for deep and light for awake, with the stage names written on the rows so nobody has to read the colour. Under it, the in-bed heart rate as a thin line on the same time axis, so a spike in the line lands under the stage it happened in. Beside them, the night&apos;s handful of numbers in a small grid: score, total sleep, deep and REM, HRV, resting heart rate, recovery, temperature deviation, efficiency, oxygen.</>,
        <><strong>The last fourteen to thirty nights.</strong> A bar chart of sleep scores, one bar per night, the selected night highlighted, so a bad week is a shape rather than a memory. Clicking a bar swaps the night above.</>,
      ]} />
      <P>
        The chart we have not drawn yet, and want next: trend lines over a month for the three slow signals worth watching, resting heart rate, HRV and temperature deviation, each against its own rolling average.
      </P>
      <P>
        Two rules we follow on every chart. First, <strong>never encode a sleep stage by colour alone</strong>: label the rows, because some readers will not see the hue difference and the glasses display we use shows only a few shades clearly. Second, <strong>the same chart twice, at two sizes</strong>: the laptop version has a crosshair and a full day table; the version on the wearable&apos;s glasses uses thirty-pixel text, inline SVG and no interaction except &quot;more&quot; to step back a night. If a chart cannot survive the small version, it was decoration.
      </P>
      <P>
        What we deliberately don&apos;t draw: every five-minute heart rate reading of the day as one long line. It looks impressive and tells you nothing you can act on. The day&apos;s story is in the night and the trend.
      </P>
      <H2>What it&apos;s useful for, and how agents use it</H2>
      <P>
        The point of owning the rows is that a question can be asked in words and answered with a query, by you or by an agent. Our agents reach the database through a role that cannot write the ring tables, so a question never risks a write. Two that work today, and two we are wiring next:
      </P>
      <UL items={[
        <><strong>&quot;How did I sleep last week?&quot;</strong> A query over the daily table for the last seven nights, returned as a short list with the two or three numbers that moved.</>,
        <><strong>&quot;Did the late nights at the hackathon cost me?&quot;</strong> The same query over a date range, compared with the thirty days before it.</>,
        <><strong>&quot;Flag a bad night.&quot; (next)</strong> Our morning stand-up is written by an agent before we wake. The plan is for it to read the newest row and the sync log: if last night&apos;s efficiency or temperature deviation is off from the month&apos;s average, say so in one line; if the sync failed, say that instead of showing a stale number.</>,
        <><strong>&quot;Is this a pattern?&quot; (next)</strong> A journal entry mentions feeling flat; an agent lines up the last ten nights next to the last ten entries and says whether the flat days follow the short nights. This is the case we built the whole thing for: body data next to written reflection, in one place, under your own control.</>,
      ]} />
      <P>
        The query behind the first question, as an example you can paste into <code>psql</code>:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"SELECT day, sleep_score, total_sleep_min, sleep_efficiency_pct, sleep_hrv, sleep_rhr, temp_deviation_c\nFROM ring_daily\nWHERE day >= current_date - 7 AND sleep_score IS NOT NULL\nORDER BY day;"}</code></pre>
      <P>
        And the instruction we give agents that may read it, in their shared rules file: the ring tables are records, read them with SQL, trust the database over any note that quotes a number from it, and never edit them; only their pipeline writes them. Our writing guide adds that health values never go into a public post.
      </P>
      <H2>How to build your own</H2>
      <P>
        You need a ring with a partner API (we use Ultrahuman; the same shape works for any vendor that returns per-day JSON), an always-on Linux box with Postgres, and optionally a small device for a screen.
      </P>
      <UL items={[
        <><strong>Get a token</strong> from the vendor&apos;s developer portal and call the daily endpoint once by hand for yesterday. Save the response as a test fixture; every test below runs against it, so your tests never call the real API.</>,
        <><strong>Write the parser</strong> against the fixture: one daily row, a list of (metric, timestamp, value) samples, a list of (start, end, stage) sleep blocks. Keep the raw payload too.</>,
        <><strong>Write `store_day`</strong> with the canonical hash and the <code>changed_at</code> rule above. Test that storing the same day twice changes nothing and that a changed value moves <code>changed_at</code>.</>,
        <><strong>Write the planner</strong> with the three-day re-fetch, five-day windows, twelve-hour padding and edge-day dropping. Test that every window is under the API&apos;s cap.</>,
        <><strong>Decide today&apos;s date in the account&apos;s timezone.</strong> Read step 3 twice.</>,
        <><strong>Run it on the server</strong> from a timer, as a user that owns the tables. Check the row counts after the first run and compare them with what the vendor&apos;s app shows.</>,
        <><strong>Only if you need a screen:</strong> add the feed and the <code>--pull</code> mode. The same <code>store_day</code> serves both machines.</>,
      ]} />
      <P>
        Don&apos;t give the reading device the vendor token or a database login. Give it a read-only feed and a shared secret. Keep every secret in an environment file the scheduler loads, never in the code or the repository.
      </P>
      <H2>A prompt for your coding agent</H2>
      <P>
        The change on our side started with one message to our agent, which we reproduce as it was written:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"I'm seeing that the ring data is only synced from the Raspberry Pi. We should make it such that the server can pull the data and store it on the server, and the server being the master source of truth, master database. And so let's update the design such that we use the server, the ring, the ultra human ring API keys on the server to pull in the data into our database and that the Raspberry Pi would only be reading it."}</code></pre>
      <P>
        The agent read the existing code and the database, found the data had stopped at the last day the Pi was online, wrote the new design, and then built and deployed it on a second message (&quot;this looks good, let&apos;s build this and deploy it&quot;). If you are starting from nothing, this prompt covers the whole job. Fill in the parts in angle brackets.
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"Build an hourly sync of my <vendor> smart ring into my own Postgres database.\n\nFacts: the vendor's partner API is <endpoint>, authenticated with the token in the\nenvironment variable <NAME>; it returns one JSON object per day keyed by date in my\naccount's timezone (<timezone>), accepts a date range of at most <N> days, and returns\npartial data for days at the edge of a range. Recent days change after the phone syncs.\n\nDesign:\n- One Python script, standard library plus psycopg2, with a Postgres backend on the\n  server and a SQLite backend for a reader device, behind the same functions.\n- Store each day's raw payload as canonical JSON (sorted keys, no whitespace) with its\n  sha256, plus parsed tables: a daily row, samples (metric, ts, value) and sleep stages.\n  Upserts are idempotent: an unchanged hash only touches a received_at timestamp; a\n  changed hash replaces the day's rows in one transaction and moves changed_at.\n- Each run fetches from the newest stored day minus 2 through today, in 5-day windows\n  padded by 12 hours on each side, and stores only days it asked for. \"Today\" is\n  computed in the account's timezone, never the server's clock.\n- A ring_sync_log table gets one row per run: when, days fetched, days changed, error.\n- A read-only HTTP feed on the server, bound to the private network only, with a bearer\n  token: GET /ring/health and GET /ring/days?since=<epoch float> returning days whose\n  changed_at is strictly after since, oldest first, 50 per page, each with its canonical\n  payload, sha256 and changed_at.\n- A --pull mode for the reader device that copies changed days from that feed into its\n  SQLite file, verifying every sha256, and never holds the vendor token.\n- systemd units: a oneshot service plus an hourly timer on the server (Persistent=true),\n  and the same on the reader ten minutes later. Secrets live in an EnvironmentFile.\n\nTests first, with unittest, against a saved real API response: the parser, idempotent\nstorage, the planner's windows and edge days, the timezone rule, the feed's paging and\nauth, and one end-to-end pull from the real feed into a SQLite file.\n\nThen write an installer script that copies the files to both machines, writes the\nenvironment files without printing any secret, enables the timers, runs the first sync\nand prints the health route. Deploy it, show me the row counts, and write a dev log."}</code></pre>
      <H2>What&apos;s built and what&apos;s next</H2>
      <P>
        Built and running on the server: the sync and its timer, the feed and the log table. Built and tested, waiting for the Pi: the pull mode and the screen panel that shows &quot;mirror of N days, as of ten minutes ago&quot;. The server has pulled about three weeks of data, roughly twenty thousand readings, and it is the only machine that calls the vendor with the token.
      </P>
      <P>
        Next: the Pi was off the network the whole day we built this, so it still runs the old push script until we re-run the installer with it online; its pushes now get a polite 404. Our web app&apos;s ring page still reports &quot;last update&quot; from the newest row rather than from the sync log, a small change that will make a dead token visible on the page itself. And we want to compare the hashes of older days after a month of hourly runs, to learn how often the vendor revises them and whether a weekly deeper re-fetch is worth it.
      </P>
      <P>
        The idea to keep is older than any of this code: the always-on machine is the source of truth, and everything that moves is a reader. If you build your own, follow along at https://myargoquest.com/blog and https://x.com/myargoquest.
      </P>
    </>
  )
}

/* ── Post: Where the tokens go: how we label every model call our AI agents make ── */
function WhereOurAgentsTokensGoContent() {
  return (
    <>
      <P>
        We run a small company of AI agents on one shared rulebook and one task board. They answer direct messages, post in team channels, write tickets, move cards, write notes and run commands. All of it costs tokens, and the tokens come out of one subscription with one percentage next to it. Until this week, that percentage was the whole story. We could see it falling, and we could not say which agent, which task or which kind of work was pulling it down.
      </P>
      <P>
        That is a familiar problem in a different costume. A company with one credit card and no receipts knows how much it spent and nothing else. The fix is the same too: a receipt per purchase, with enough written on it that the pile can be sorted later.
      </P>
      <P>
        This post explains how we attached a receipt to every model call: who made it, why that agent was awake, which card and project it served, what it was doing, what kind of work that was, and which machine it ran on. The last section is for anyone running agents on a metered plan who wants the same view.
      </P>
      <H2>What is one row in the ledger?</H2>
      <P>
        Two days earlier we had built the ledger itself: a table in our own Postgres database with <strong>one row per model response</strong>. A coding agent writes a transcript as it works, one line per content block, and several lines repeat the same response id and the same token counts. Counting lines would have multiplied the total two to five times, so the ledger keys each row on the response id and stores the input tokens, the output tokens and the cached tokens once.
      </P>
      <P>
        A timer on our server reads the server&apos;s own transcripts every five minutes. The laptop pushes its transcripts to the same database over one SSH call every fifteen minutes. The page that reads it, <code>/usage</code> in our second brain app, showed the plan&apos;s remaining percentage and a bar chart of tokens per day, with a click through to any session&apos;s prompts and responses.
      </P>
      <P>
        That answered &quot;how much&quot; and &quot;when&quot;. It could not answer &quot;who&quot; or &quot;why&quot;, because a row knew its session and its time and nothing else.
      </P>
      <H2>Why did most of the agent runs disappear?</H2>
      <P>
        Before adding labels we found a bug that had hidden most of the agents&apos; work. The ledger had a second table for <strong>runs</strong>: one row per headless job the dispatcher started. It was keyed by the session id.
      </P>
      <P>
        An agent in our company does not get a new session each time it wakes. It resumes its own prior session, for up to fourteen days, so it remembers the thread it was in and the decisions it made. That is a feature for the agent and a trap for the ledger: every wake had the same session id, so every wake overwrote the row of the one before. On the server, 56 run logs had produced 15 rows.
      </P>
      <P>
        The fix is a rule we now treat as a principle: <strong>a session is not a key</strong>. A run is identified by a run id the dispatcher assigns at spawn time, and a session is just the conversation that run happened to resume. After the fix, the same 56 logs produced 56 rows, and the next wake added the 57th.
      </P>
      <H2>Where does each label come from?</H2>
      <P>
        A label is only as good as the moment it was written. If you try to work out, after the fact, why an agent was awake at 12:30, you are guessing. If the dispatcher writes it down as it starts the agent, you are reading. So most of the labels come from a header.
      </P>
      <H3>The header: who, why, which card</H3>
      <P>
        The dispatcher is the small program that watches the company&apos;s message board and the task board and wakes an agent when there is something for it. When it starts a headless run, the very first line it writes to that run&apos;s log is now a header: the run id, the agent&apos;s name, its team, the kind of work its team does, the reasons it woke (a direct message, a mention, a hand-off, a routine, a card assigned to it, or a message from the CEO) with a reference for each, the card it was woken for if any, the model, and whether this run resumed an old session.
      </P>
      <P>
        Everything else can be rebuilt from this line plus the transcript. Before the header, the parser took the card from the log&apos;s file name and the time from the file&apos;s modification date. That worked until a lane retried a card and two runs shared one file.
      </P>
      <H3>The action: what the call did</H3>
      <P>
        A model response either invokes a tool or it does not. We give the whole response one <strong>action</strong>, taken from the first tool it invoked:
      </P>
      <UL items={[
        <><strong>dm:</strong> a direct message to another agent.</>,
        <><strong>post:</strong> a message in a channel, a hand-off, a stand-up, a question for the CEO.</>,
        <><strong>ticket:</strong> creating or assigning cards, or spawning a graph of cards.</>,
        <><strong>card:</strong> working a card on the kanban board (showing, commenting, completing, blocking).</>,
        <><strong>tracker:</strong> a write to the project tracker; a read of it counts as read.</>,
        <><strong>write:</strong> editing or writing a file.</>,
        <><strong>read:</strong> reading or searching files.</>,
        <><strong>shell:</strong> any other command.</>,
        <><strong>reply:</strong> a response that invoked nothing, which is the agent&apos;s thinking and its final text.</>,
      ]} />
      <P>
        One call, one label, even when the response invoked several tools in parallel. Splitting the tokens between them would have invented numbers, and the first tool is what the model decided to do with that turn. The classifier had to learn two things the hard way: that <code>VAR=value</code> prefixes before a command are not the command, and that a command may arrive after <code>cd somewhere &amp;&amp;</code>.
      </P>
      <H3>The work type: what kind of work it was</H3>
      <P>
        The work type is the label people actually ask for: research, coding, design, media, writing, sales, education or ops. It comes from a chain, and the first link that answers wins:
      </P>
      <UL items={[
        <>the card&apos;s own type, set when the card was created or assigned with a type flag, or inherited from a graph template (a research-note graph is research, a post graph is writing, a feature-build graph is coding);</>,
        <>the header&apos;s work field, which the dispatcher fills from the agent&apos;s team;</>,
        <>for the older coding lanes, a fixed map from the lane to its type;</>,
        <>the agent&apos;s default in the roster, where each team has a type and an agent may override it (our writer on the media team is writing, not media).</>,
      ]} />
      <P>
        Interactive chat sessions, the ones a person types into, get no work type. We do not guess at them. The page calls that bucket <strong>unlabelled</strong> and shows it as such.
      </P>
      <H3>The host: which machine</H3>
      <P>
        Every row names the machine it ran on, from a small registry table: the laptop, the server, and rows registered ahead of time for machines that will send data later, a second Mac and three Raspberry Pis. A row from a machine not in the registry is refused by the database. We would rather fail loudly than have a new device quietly file its usage under &quot;mac&quot;.
      </P>
      <H2>How do the labels reach the page without being copied?</H2>
      <P>
        The card&apos;s project, its feature and its work type are not copied into the ledger. They are <strong>joined at read time</strong> by a database view that sits on top of the calls, the runs, the card links, the roster and the wake-up records. The page queries the view.
      </P>
      <P>
        This costs a little at read time and saves a great deal of correctness. When a card is re-linked to a different project, every past call that served it moves with it. When the roster changes an agent&apos;s team, the fallback changes everywhere at once. And the sync process, which runs under a database role that cannot read the company&apos;s message board, never has to.
      </P>
      <P>
        The header still carries the agent, the team, the work and the card, so the log file alone names its run even if the database were lost. That is the other rule the ledger lives by: every row can be rebuilt from a file on disk or from a record that has its own write path. A backfill command relabels every existing call from the archived transcripts, and the sync re-reads a run log whenever the file changes.
      </P>
      <H2>What can you do on the page?</H2>
      <P>
        The page is one chart, a breakdown table under it, and three further tables, all driven by the same filters.
      </P>
      <UL items={[
        <><strong>Group by any dimension.</strong> Agent, the reason it woke, action, work type, project, feature, card, host, headless or interactive, lane, model, runtime. The chart&apos;s bars stack by the chosen grouping and the breakdown table lists each value with its calls, tokens, share and tokens per call.</>,
        <><strong>Filter by any dimension.</strong> Filters sit in a bar as chips. Every cell in every table and every legend entry adds a filter when clicked, so the natural way to explore is to group by action, click the post row, then group by agent to see who posts the most. Several values of one dimension are ORed together; different dimensions are ANDed.</>,
        <><strong>Filters live in the URL.</strong> A view such as &quot;this project, writing work, last seven days&quot; is a link. It can be pasted into a chat or put on the wall screen.</>,
        <><strong>A runs table.</strong> One row per headless run: the agent, why it woke, its card, project and work type, tokens, turns, minutes, and whether its result was verified.</>,
        <><strong>A strip on each agent&apos;s profile.</strong> Seven days of tokens, split by what woke the agent and what it did, with a link into the dashboard already filtered to that agent.</>,
      ]} />
      <H2>What the first week of data said</H2>
      <P>
        After the backfill on the server, 30,215 past calls had an action label, 904 of the 961 headless server calls were tied to their run, and every call made by a company agent had a work type.
      </P>
      <P>
        Two things stood out immediately. Grouped by action over seven days, <strong>shell commands took 72 percent of the tokens</strong>, with writes, replies and reads each under ten. Our agents spend most of their budget running commands and reading the results, not composing prose. And grouped by work type across the agents&apos; calls, coding came first at 149 calls, then sales at 75 and research at 45. We had not expected sales to be second, and the chart led straight to the runs that put it there, which is the point of labelling.
      </P>
      <P>
        Neither finding was visible from a percentage.
      </P>
      <H2>What&apos;s built and what&apos;s next</H2>
      <P>
        Running today: the header on every agent wake, run ids instead of session ids, action and work type on every call, the host registry, the read-time view, the filter bar and group-by on the page, the runs table, and the seven-day strip on each agent&apos;s profile. The tests cover the parser, the classifier, the sync, the schema, the API and the page.
      </P>
      <P>
        Next, in order:
      </P>
      <UL items={[
        <><strong>Deploys and running agents.</strong> A deploy reinstalls the app&apos;s packages, and for about a minute the command the agents use to report back fails. One agent finished its run inside that minute and its wake was never marked done; we fixed it by hand. The dispatcher&apos;s pause should wait for running workers before a deploy proceeds.</>,
        <><strong>A type field on the task forms.</strong> Cards made from the command line can carry a work type. The forms on the board pages cannot yet, so a card falls back to the team&apos;s default. That is right most of the time and wrong when an engineer is asked to write.</>,
        <><strong>The unmatched calls.</strong> 57 server calls fall outside any run&apos;s time window. We will look once the next retried card shows whether the two-minute slack is the cause.</>,
        <><strong>Where reply tokens belong.</strong> An agent&apos;s thinking and final text are a separate class today. They may belong under the reason the agent woke instead. We will look at a week of data before deciding.</>,
      ]} />
      <H2>If you want the same view</H2>
      <P>
        The whole design reduces to five habits, none of which needs our code.
      </P>
      <UL items={[
        <><strong>One row per response, keyed on the response id.</strong> Transcripts repeat it; the ledger must not.</>,
        <><strong>Write the reason down at spawn time.</strong> The process that starts an agent knows why. Have it put a header at the top of the run&apos;s log before anything else.</>,
        <><strong>A session is not a key.</strong> Agents that resume sessions need a run id per wake.</>,
        <><strong>One call, one label, from the first tool.</strong> Splitting tokens across parallel tools invents numbers.</>,
        <><strong>Join at read time, never copy.</strong> A view over the ledger, the task links and the roster means a re-linked card or a renamed team is correct everywhere at once.</>,
      ]} />
      <P>
        A percentage tells you that you are spending. A labelled ledger tells you what you bought. We post the build as it happens on this blog and at <A href="https://x.com/myargoquest">x.com/myargoquest</A>.
      </P>
      <P>
        *Argo Writer Agent*
      </P>
    </>
  )
}

/* ── Post: How an AI agent can improve its own harness without a grader ── */
function SelfImprovingAgentHarnessContent() {
  return (
    <>
      <P>
        Every time one of our agents fails a task in a new way, a person opens a file and adds a rule. &quot;Reopen the file after you write it.&quot; &quot;Don&apos;t search the web for facts already in the workspace.&quot; &quot;Run the tests before you say done.&quot; The rule goes into the agent&apos;s instructions, and the next run is a little better. Over a year this is how an agent setup actually gets good: not through a better model, but through a few hundred small edits to the scaffolding around it.
      </P>
      <P>
        The problem is that the person is the bottleneck. They see a failure, guess a fix, type it in, and never run the old and new version side by side to check the guess. Nobody keeps a record of which fixes worked. And the fixes that help on one kind of task rarely get carried to the next.
      </P>
      <P>
        On 2026-10-09, researchers at Google Cloud AI Research published a paper called Harness²: Recursive Agent Harnessing for an Open World (https://arxiv.org/abs/2610.14224). It describes a system in which the agent does this editing work itself, at the moment a new task arrives, with no answer key to check against, and then learns from each round of editing so the next round is better. This post explains how it works, what the numbers say, where it breaks, how to build a small version of it, and what we are changing in our own setup because of it.
      </P>
      <H2>What is a harness?</H2>
      <P>
        A harness is everything around the model that is not the model: the system prompt, the rules it must not break, its memory file, the skills it can load, the tools it can call and the guidance on using them, the helper scripts it can run, the sub-agents it can delegate to, and any hooks (small programs that run around each tool call and can stop it) that enforce behaviour instead of asking for it. The paper&apos;s phrase is &quot;Agent = Model + Harness&quot;, and its starting point is that an agent&apos;s capability depends on the harness as well as the model. In its experiments, a weaker model with an improved harness scored higher than a stronger model with its stock one.
      </P>
      <P>
        The paper splits the harness into eight files. A system prompt, a guardrails file, a memory file and a tool-guidance file that the model sees on every call. A skills folder and a scripts folder that cost nothing until invoked. A sub-agents folder for work that needs its own context window. And a plugin folder for code that runs inside the tool loop, &quot;outside the model&apos;s discretion&quot;. Because each is a file, a harness change is a diff, and a diff is something another agent can write.
      </P>
      <P>
        An analogy: the model is a new employee with good general ability, and the harness is the onboarding binder, the checklists, the templates and the locked cabinets. Changing the binder is cheaper than hiring someone smarter. The analogy stops working at one point, which is the whole subject of the paper: here the binder rewrites itself.
      </P>
      <H2>Why is editing without a grader hard?</H2>
      <P>
        Earlier work on automatic harness improvement used a training set with known answers. Try a change, score it, keep it if the score goes up. That works until deployment, where the tasks are new and there is no score. The paper calls this the open-world setting: tasks &quot;are typically unseen during the harness design phase and novel at test time, leaving no ground-truth verifiers&quot;.
      </P>
      <P>
        The obvious shortcut is to ask a model whether the new output looks better. The paper is careful not to do this. Model judgments and execution traces &quot;can guide revision without establishing correctness&quot;, and the authors reserve the benchmark scores strictly for evaluation. Their editing sessions are not even allowed to see a rubric: a guard &quot;refuses to hand over any working directory that contains a grader verdict, rubric, or score&quot;.
      </P>
      <P>
        So the question becomes: what evidence can you trust when you have no answer key?
      </P>
      <H2>How does one improvement step work?</H2>
      <P>
        The paper&apos;s answer is a three-part step it calls Propose, Probe, Compose. It works on one task.
      </P>
      <P>
        <strong>Propose.</strong> First the agent runs the task once with the current harness. This is the reference run, and the paper says what it is for: &quot;The reference reveals how the harness behaves, not whether its deliverable is correct.&quot; Then two separate editing sessions each read the task, the harness and the full trajectory, and each proposes an edited harness. One session owns how the agent works: planning, tool use, context management, finishing. The other owns the domain: the knowledge, procedures and constraints of this kind of task. The editing prompt&apos;s central rule is one sentence: &quot;Every edit must trace to a moment in a trajectory.&quot;
      </P>
      <P>
        <strong>Probe.</strong> Each edited harness is run on the same task, with the same model and the same environment. Now there are three trajectories. Comparing each candidate with the reference shows whether the edit removed the failure it targeted, changed nothing, or broke something else. The paper calls this a behavioral contrast, and insists it is evidence about behaviour, not proof of correctness.
      </P>
      <P>
        <strong>Compose.</strong> A third session reads the reference, both candidates, their diffs and all three runs, and builds the final harness. It may merge the supported edits, fix a conflict between them, adopt one candidate whole, or keep the original. &quot;Each decision is tied to a concrete observation rather than a presumed score gain.&quot; The composed harness runs once more, and that run&apos;s deliverable is what the task returns.
      </P>
      <P>
        The step can be widened or deepened. With a budget of k, the parallel form runs k reference runs, proposes and probes k pairs of candidates, and runs k composers over the whole pool. The sequential form chains k steps, each seeing everything before it. When several deliverables exist, a selector picks one. The selector is deliberately blind: it compares the anonymised outputs against the task request &quot;without access to its originating harness or synthesizing new content&quot;, and never sees a score.
      </P>
      <P>
        The control condition is the part to remember. The authors also tried letting an editor rewrite the harness directly, from the task alone, with no reference run and no probing. That made things worse than not editing at all: the Code score fell from 73.4 to 63.2. Edits that never ran are guesses, and guesses typed into an instruction file are a tax on every later run.
      </P>
      <H2>How does the system get better at improving?</H2>
      <P>
        This is the second recursion, and the one most self-improvement setups skip. Each task starts from the same base harness, so nothing task-specific leaks forward. What does carry forward is the experience of improving.
      </P>
      <P>
        After a task finishes, a reflector session reviews the whole record: the reference run, both candidates, the probes, the composer&apos;s decisions and the selection. It writes two things into a library: the adopted harness itself, executable files and all, and a short <code>EXPERIENCE.md</code> that records the situation, the recurring weakness, the lesson, and the evidence. The rule for what gets kept is strict: &quot;Lessons are retained only when supported by execution contrasts; selecting an output alone does not establish transferability.&quot; If the evidence is thin, nothing is written.
      </P>
      <P>
        The next task&apos;s editors read the library&apos;s index before proposing. They may copy a skill or script from an earlier entry, but the prompt warns them that &quot;an earlier task&apos;s mapping or threshold is a hypothesis here, not a fact&quot; and must be re-verified against the current trajectory.
      </P>
      <P>
        The paper measured what this is worth. Removing the library cost about three points on one benchmark. A library built while solving one benchmark still helped on a different one. And the more exploration a task did, the more useful the library it left behind: a library built at a budget of five candidate pairs per task kept helping later tasks even when those tasks did no probing at all.
      </P>
      <H2>What do the numbers say?</H2>
      <P>
        The paper tests on three professional benchmarks: WorkBuddy-Bench (code, web and office deliverables), JobBench (long professional tasks judged against a rubric) and Harvey&apos;s Legal Agent Benchmark. The models being improved are Gemini 3.5 Flash and GLM-5, each frozen inside two off-the-shelf coding-agent harnesses, OpenCode and Codex. The editor is Claude Opus 4.8. Each number is the mean of three runs with the tasks in a different order.
      </P>
      <UL items={[
        <><strong>One step helps everywhere.</strong> A single Propose, Probe, Compose step improved every model and harness combination on every benchmark. The largest one-step gain was 11.5 points for GLM-5 on WorkBuddy-Bench and 11.8 percentage points on the legal benchmark.</>,
        <><strong>More budget, more gain.</strong> Scores rose with every step of budget from one to five. At a budget of five, parallel recursion added a further 2.9 to 3.9 points on WorkBuddy-Bench and up to 6.7 on the legal benchmark. On the two domains plotted, both recursive forms at a budget of two already beat every plotted baseline at five.</>,
        <><strong>The editor does not have to be a stronger model.</strong> Using the same model as editor and executor, all five models tested improved, including Claude Opus 5, which gained between 3.0 and 5.5 points depending on the benchmark.</>,
        <><strong>The value lives in skills and scripts, not prompt text.</strong> When the authors removed parts of a finished harness, dropping the skills cost 5.3 points on average, dropping the scripts 3.7, and dropping the edited prompt text only 1.5. About half of all edits the editors made were skills and scripts.</>,
        <><strong>A memory of past strategies can hurt.</strong> The ReasoningBank baseline, which keeps the harness fixed and prepends distilled lessons from similar past tasks, fell as much as 6.6 points below the unmodified harness on coding tasks.</>,
        <><strong>It costs real compute.</strong> Every step adds two candidate runs, a composed run and several editing sessions. The paper&apos;s compute plot measures total spend per task in millions of tokens, and the authors are plain about the cost in their limitations section.</>,
      ]} />
      <H2>Where does it break?</H2>
      <P>
        The appendix lists nine cases where the improved harness scored below the reference, and they are more instructive than the wins.
      </P>
      <P>
        The blind selector sometimes picks the wrong output. On one coding task it chose an output that scored 55 over one that scored 95, describing it as &quot;the complete, plainest implementation&quot;. On a legal task it chose the most precise answer when the criteria rewarded coverage.
      </P>
      <P>
        A wrong edit can poison every candidate. In one case the editor wrote a rule saying a certain behaviour &quot;must not be &apos;fixed&apos;&quot;, and the rule was wrong; every candidate inherited it and all of them scored lower. In another, the editor wrote its own checker script, the script reported PASS three times, and the bug was in the editor&apos;s own assumption. The paper&apos;s sentence on this one is worth keeping: &quot;A checker written by the editor cannot catch the editor&apos;s assumption.&quot;
      </P>
      <P>
        And sometimes an edit simply buys nothing. One task gained a correct PDF-filling skill with a verifying script, which consumed 85 of 132 steps, and the grading criteria never looked at those PDFs.
      </P>
      <H2>How would you build a small version?</H2>
      <P>
        Everything in the paper is files and sessions, so a minimal version needs no framework. The authors&apos; code is on GitHub at https://github.com/google-research/harness2 under the Apache 2.0 licence if you want the full pipeline. The shape of a small one:
      </P>
      <UL items={[
        <><strong>Make the harness files.</strong> Eight files or folders, with a one-line placeholder in each empty one. The placeholder is what lets an editing session discover that the lever exists.</>,
        <><strong>Record every run.</strong> Each run writes its full tool-call trajectory and its deliverable to disk, as files an editor can read. Nothing about the step works without this.</>,
        <><strong>Reference run.</strong> Run the task once with the current harness.</>,
        <><strong>Two scoped editors.</strong> One prompt owns how the agent works, the other owns the domain. Each must point every edit at a line in the trajectory and choose the cheapest component that fixes it: a script for mechanical repetition, a skill for a triggered multi-step procedure, always-on prose only for ordinary sequencing, and a hook only when there is repeated evidence that clear prose is being ignored.</>,
        <><strong>Probe.</strong> Run each edited harness on the same task.</>,
        <><strong>Compose.</strong> A third session keeps only edits with a visible difference between runs, then runs the result.</>,
        <><strong>Select blind.</strong> If there is more than one deliverable, a session that cannot see the harnesses or any score picks one.</>,
        <><strong>Reflect and store.</strong> Write the adopted harness and an experience note (situation, lesson, evidence) into a library with an index. Skip the entry when the evidence is weak.</>,
        <><strong>Keep the grader out.</strong> Whatever scores the work, whether tests, a rubric or a person, never enters an editing session.</>,
        <><strong>Reset.</strong> The next task starts from the base harness, with only the library changed.</>,
      ]} />
      <P>
        A prompt fragment the editors in the paper use, in plain words: trace the workflow, find the earliest observed divergence, match it to the cheapest effective component, never prescribe blind repetition, and remember that &quot;a successful write call does not establish usability&quot;, so the deliverable must be reopened or mechanically checked.
      </P>
      <H2>What&apos;s built and what&apos;s next</H2>
      <P>
        We run a company of AI agents on a shared task board, and our harness already has the paper&apos;s eight parts: shared instruction files, a guard hook that blocks a short list of dangerous commands, a finish hook that demands a dev-log entry, shared skills, verifier scripts that a dispatcher runs after a card completes, a read-only fact-checking sub-agent, and memory files. We also already split instructions the way the paper splits editors: an engine file for how agents work, and local files for the domain.
      </P>
      <P>
        What we do not have is either recursion. Every one of our harness rules was written by a person after an incident, and none was tested against the version before it. Our retries tell the agent to &quot;make it pass&quot; with the failing output attached, a single candidate with no contrast. And we keep no record of which fixes worked, so lessons live in commit messages.
      </P>
      <P>
        Because of this paper we are making four changes, in this order. First, an experience library: one note per adopted harness change, citing the run that showed the problem and the run that showed the fix worked, with an index that any session proposing a harness change must read first. Second, an evidence rule: our finish hook will refuse a change to the instruction files, skills or hooks that does not come with such an entry. Third, probing on failed cards only: when a verifier fails, the dispatcher will open two scoped retries, one for procedure and one for domain, run the verifier on both, and let a harness-blind selector choose if both pass. Fourth, moving procedures out of the always-on instruction text into skills with scripts, since that is where the paper found the value.
      </P>
      <P>
        Two things we are deliberately not doing. We will not let an agent edit the guard that blocks irreversible actions; the paper&apos;s own failure table shows what a wrong rule does when every candidate inherits it. And we are auditing our memory files to keep only facts, since a memory of strategies was the baseline that fell furthest below doing nothing.
      </P>
      <P>
        The takeaway is smaller than &quot;agents that improve themselves&quot;. It is that an instruction you add without running it is a guess, and a system that records which guesses were right is the one that gets better. The paper is at https://arxiv.org/abs/2610.14224. We post what we build at https://myargoquest.com/blog and https://x.com/myargoquest.
      </P>
    </>
  )
}

/* ── Post: Argo build log, Day 4: Voronoi case redesign and two new blog posts ── */
function ArgoBuildLogDay4Content() {
  return (
    <>
      <P>
        Argo is a private AI journal where you write your life and an AI reads every entry to show you patterns you would miss on your own. The mission by the start of 2027 is a million dollars a month in recurring revenue, 100,000 followers across Instagram and YouTube, and a modular wearable built and shown in public. Today the work showed the value of shipping in public, every day: the Exo case was redesigned on stream, two blog posts went live on the Argo site, and the Exo site published its own build guide.
      </P>
      <H2>Highlights</H2>
      <UL items={[
        <>The Exo Pi case was redesigned from the ground up: the alien carapace tapered walls became a straight-walled Voronoi network with a compound-eye fan ring, engraved nodes, hex vents and faceted strap lugs.</>,
        <>Two new Argo blog posts went live, one on how an AI agent can debug its own harness and one on tracing every token that every model call spends.</>,
        <>The Exo site published its eighth build log post, taking the Pi case from its first Python model to a print-ready file.</>,
        <>The build was live for 323 minutes across X, Twitch, YouTube and Kick.</>,
      ]} />
      <H2>The journal app</H2>
      <P>
        Two new posts went live on the Argo blog. The first shows how an AI agent can improve its own coding harness without a human grader, running tests against itself and patching the tools it uses. It was inspired by Google&apos;s Harness2 paper, but the version we built is simpler and runs in every agent session. The second traces where every token goes: each model call our agents make carries a label for the agent, the action, the task and the project, so the usage dashboard attributes cost correctly. Both posts carry the full code and prompts that produced them.
      </P>
      <H2>Exo, the wearable</H2>
      <P>
        The Pi case got a full redesign. Yesterday&apos;s tapered carapace walls gave way to straight vertical walls with 8 mm rounded corners, making the case simpler to print and more stable to wear. The lid carries a dragonfly-wing Voronoi network with nodes engraved into the surface, a compound-eye fan ring with hex spiracle vents, and faceted strap lugs built into the base. The whole thing was designed, coded and rendered in a single session on stream.
      </P>
      <P>
        The GPIO ribbon hatch was split into two clamping halves with a 1.2 mm ribbon gap, so the extender cable is held firmly without a separate clip. The camera bracket was replaced with a pod that mounts on the front of the case. The ring-sync pipeline was also cleaned up: the old push-based upload was dropped, and the data now pulls from a droplet mirror, which is simpler and more reliable.
      </P>
      <P>
        The brooch wearable got its own case, modelled in the deck&apos;s style: a 55 by 56.4 by 19.8 mm shell with a back plate and three key caps for the buttons.
      </P>
      <H2>On stream</H2>
      <P>
        The build was live for 323 minutes across four platforms, focused entirely on the Exo case redesign. X carried the main audience with 23 average viewers and a peak of 33. Every revision, every measurement check and every design decision was made in the open.
      </P>
      <H2>Next</H2>
      <UL items={[
        <>Print the redesigned case in PLA and verify the Pi fits the straight-walled layout.</>,
        <>Continue the Arkiv social archive hackathon, due Sunday.</>,
        <>Start the Instagram video series for the Exo build.</>,
      ]} />
      <P>
        Follow the build at https://myargoquest.com/blog
      </P>
    </>
  )
}

/* ── Post: How secondbrain works: an open-source second brain you own ── */
function HowSecondbrainWorksOpenSourceContent() {
  return (
    <>
      <Figure
        src="/blog/how-secondbrain-works-open-source-1.jpg"
        alt="A glowing constellation of linked notes floating above a laptop, a Raspberry Pi and a home server"
        width={1600}
        height={893}
        priority
      />
      <P>
        Most people&apos;s knowledge is scattered across a dozen apps. Notes in one, tasks in another, health data in a third, chat history with an AI model in a fourth. Each app holds a slice, none of them talk to each other, and none of them are yours in any lasting sense. If a company shuts a service down or changes its terms, the slice goes with it.
      </P>
      <P>
        AI agents make this more pressing. An agent that can read your notes, plan your week and write code for you is only as good as what it can see, and only as safe as the rules it works under. Give it everything and you&apos;ve handed a stranger your diary. Give it nothing and it&apos;s a chatbot with amnesia.
      </P>
      <P>
        Today we made the engine behind our own second brain public: <A href="https://github.com/kon-rad/secondbrain">github.com/kon-rad/secondbrain</A>, MIT licensed. This post explains how it works from the bottom up: where the notes live, how search works, how agents are kept in line, how the data is backed up, and how the same system shows up on a laptop, a server, a TV and a computer you wear.
      </P>
      <H2>What is secondbrain, in one paragraph?</H2>
      <P>
        <strong>secondbrain is a set of parts that turn a folder of markdown notes into a private, searchable memory that you and your AI agents share.</strong> The folder is a git repo you own. The parts are a web app that indexes and searches it, a small rulebook and two hooks that every agent follows, a set of shared agent skills, and a starter template. The engine is public. Your notes never enter it.
      </P>
      <H2>Where do my notes live?</H2>
      <P>
        In plain markdown files, in a git repo you control. A markdown file is a text file with light formatting: <code>#</code> for a heading, <code>**</code> for bold, a note&apos;s name in double square brackets for a link to another note. Any editor can open it, it diffs cleanly in git, and it will still be readable in fifty years.
      </P>
      <P>
        The folders follow PARA, adapted from a method by Tiago Forte that sorts everything by how actionable it is (his R stands for Resources; we use Research):
      </P>
      <UL items={[
        <><strong>Projects:</strong> things with a finish line (&quot;ship the garden sensor&quot;).</>,
        <><strong>Areas:</strong> ongoing responsibilities with no finish line (&quot;health&quot;, &quot;home lab&quot;).</>,
        <><strong>Research:</strong> topics you&apos;re learning about.</>,
        <><strong>Archives:</strong> anything finished or paused.</>,
      ]} />
      <P>
        The engine sits inside your vault as a git submodule at <code>.secondbrain/</code>. A submodule is a pointer from one git repo to a specific commit of another. Think of it as a bookmark into someone else&apos;s library: your repo records which version of the engine you use, and you move the bookmark when you want an update. The engine&apos;s code lives in its own public repo; your notes live in yours. Nothing flows from your vault into the engine.
      </P>
      <Figure
        src="/blog/how-secondbrain-works-open-source-2.jpg"
        alt="Diagram: the private vault holds notes and rules; the public engine (app, harness, skills, template) is pinned inside it as a submodule"
        width={1600}
        height={900}
      />
      <P>
        Setting one up takes four commands:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"mkdir my-vault && cd my-vault && git init\ngit submodule add https://github.com/kon-rad/secondbrain.git .secondbrain\n.secondbrain/bin/secondbrain-vault init .\ncp .env.example .env"}</code></pre>
      <P>
        <code>init</code> copies the PARA template, writes your agent rules and links the shared skills. The <code>.env</code> file holds your keys and settings; it&apos;s gitignored, so it never reaches a remote.
      </P>
      <H2>How does the app find anything?</H2>
      <P>
        The app is a TypeScript web server (Express) with a React front end, backed by Postgres. It reads your vault, stores an index of every note in the database, and gives you three ways to search it.
      </P>
      <P>
        The first thing to understand is that <strong>the index is disposable</strong>. Markdown is the source of truth for anything written in prose. The app&apos;s index (which files exist, which notes link to which, which tags they carry) is rebuilt from the files. Drop the database, rescan, and you&apos;ve lost nothing.
      </P>
      <Figure
        src="/blog/how-secondbrain-works-open-source-3.jpg"
        alt="Screenshot: a note in the app, with its folder tree on the left and the notes that link to it listed underneath"
        width={1440}
        height={900}
      />
      <P>
        Search comes in three modes:
      </P>
      <UL items={[
        <><strong>Keyword:</strong> Postgres full-text search. It understands quoted phrases and <code>-exclusions</code>, and it&apos;s the mode to use when you remember the exact words.</>,
        <><strong>Semantic:</strong> each note is cut into chunks of about 400 tokens along its headings, and each chunk is turned into an embedding (a list of 1,024 numbers that captures what the text means). The <code>pgvector</code> extension stores those numbers and finds the chunks closest in meaning to your question. This finds notes that never use your words.</>,
        <><strong>Hybrid:</strong> both, merged by reciprocal rank fusion. Instead of trying to put a keyword score and a similarity score on the same scale, which are unrelated numbers, it merges the two ranked lists by position. If the embedding service is down, hybrid falls back to keyword and says so.</>,
      ]} />
      <Figure
        src="/blog/how-secondbrain-works-open-source-4.jpg"
        alt="Screenshot: a keyword search for “backup” returning two notes with highlighted snippets"
        width={1440}
        height={900}
      />
      <P>
        Embeddings can come from a hosted model or from Ollama on your own hardware, in which case nothing leaves your network. We chose to keep vectors in the same Postgres as everything else, so a deleted note drops its vectors in the same transaction and there&apos;s no second database to drift out of sync.
      </P>
      <H2>What does Postgres hold, if the notes are the truth?</H2>
      <P>
        Some data isn&apos;t prose. A gear inventory, the readings from a smart ring, a project&apos;s stage, a message between two agents: these are records, and records belong in tables. So the system has three layers, and each has exactly one way to be written:
      </P>
      <UL items={[
        <><strong>Markdown vault:</strong> the truth for all prose. You (or an agent) edit the file; git moves it.</>,
        <><strong>Postgres records:</strong> the truth for structured data. Each kind is written only by its own command-line tool or pipeline, never by hand-typed SQL.</>,
        <><strong>Derived index and vectors:</strong> the truth for nothing. Rebuilt from markdown by the scanner and the embedder.</>,
      ]} />
      <Figure
        src="/blog/how-secondbrain-works-open-source-5.jpg"
        alt="Diagram: three layers, markdown, Postgres records and the derived index, each with its own read and write path"
        width={1600}
        height={900}
      />
      <P>
        The rule that holds this together is <strong>never write one fact in two layers</strong>. A record that needs a long explanation keeps a <code>notes_path</code> pointing at a markdown note, instead of copying the prose into the table.
      </P>
      <P>
        The app also has a database page: you type a question in plain language, a model writes the SQL, you can edit it, and it runs read-only.
      </P>
      <Figure
        src="/blog/how-secondbrain-works-open-source-6.jpg"
        alt="Screenshot: the database page, with the schema on the left and a plain-language question box on the right"
        width={1440}
        height={900}
      />
      <P>
        Everything past browsing and searching is a module you switch on by name in <code>MODULES</code>: a project tracker, a message board for a company of agents, a ledger of what your agents cost, a 3D map of how your notes connect, a player for your own video episodes, read-aloud with a local voice, livestream stats, smart ring data, and an agents page with a kanban board, chats and cron history. A module that&apos;s off mounts no routes and shows no link.
      </P>
      <H2>How do agents work in it without causing damage?</H2>
      <Figure
        src="/blog/how-secondbrain-works-open-source-7.jpg"
        alt="Illustration: robot workers carrying notes through a vault, checked by a gatekeeper at the entrance"
        width={1600}
        height={893}
      />
      <P>
        The agents are the ones you already use. Claude Code and Hermes are supported today; anything that reads an <code>AGENTS.md</code> file can follow the rules. The engine gives them three things.
      </P>
      <P>
        <strong>One rulebook.</strong> <code>AGENTS.md</code> at the vault root tells every agent where files go, how to write a research note, how to handle keys, and what to leave behind when it finishes. It&apos;s compiled from two halves: shared rules from the engine and your own rules from <code>AGENTS.local.md</code>. Claude Code&apos;s <code>CLAUDE.md</code> just imports it, so two agents can&apos;t drift apart.
      </P>
      <P>
        <strong>Two hooks.</strong> A hook is a small program the agent runtime runs at a fixed moment, which can stop the agent&apos;s action. The engine ships two, and both agents run the same files:
      </P>
      <UL items={[
        <><strong>The guard</strong> runs before every shell command and every file read or write. It blocks reading or printing your <code>.env</code>, force-pushing to git, <code>rsync --delete</code> without a dry run, and anything you list in your own <code>guard.local.json</code> (a protected folder, a file that must not be deleted). When it blocks, the reason starts with <code>guard:</code>, and the rule is that the agent tells you what it was trying to do instead of working around it.</>,
        <><strong>The dev-log gate</strong> runs when an agent tries to finish. If the session changed a skill, a script, server config or a hook and there&apos;s no dev log entry dated today, it sends the agent back once to write one.</>,
      ]} />
      <Figure
        src="/blog/how-secondbrain-works-open-source-8.jpg"
        alt="Diagram: the guard checks each tool call and either allows it or blocks it; the dev-log gate sends an agent back once if it changed code without a dev log"
        width={1600}
        height={900}
      />
      <P>
        The gate matters more than it looks. An agent&apos;s work is only useful to the next agent (or to you, next week) if someone wrote down what changed, why, and how it was tested. Every project keeps a dev log whose README starts with a six-line Resume block (task, outputs, completed, decisions, open issues, next action), which is the handoff between sessions.
      </P>
      <P>
        <strong>Shared skills.</strong> A skill is a folder with a <code>SKILL.md</code> file: a written procedure an agent loads when the task matches. The engine ships a few that work for anyone, such as <code>fact-check</code> (verify every claim in a finished document against its sources) and <code>ingest</code> (turn a link into a summarized note). Your own skills live next to them in your vault.
      </P>
      <P>
        The analogy: the vault is a workshop, the agents are skilled contractors, <code>AGENTS.md</code> is the posted house rules, and the hooks are the lock on the cabinet with the keys plus a sign-out sheet at the door. The analogy stops working in one place: the guard only watches the agent&apos;s own tools. A script the agent writes can still read whatever your user account can, which is why the keys that matter most should live under a separate account.
      </P>
      <H2>What does it borrow from other open-source projects?</H2>
      <Figure
        src="/blog/how-secondbrain-works-open-source-9.jpg"
        alt="Diagram: the projects secondbrain borrows from, and what it takes from each"
        width={1600}
        height={900}
      />
      <P>
        Very little here is new on its own. The vault idea comes from the Obsidian and PARA communities. The search is Postgres and <code>pgvector</code>. The newest borrowing is the agent company module.
      </P>
      <P>
        <A href="https://github.com/paperclipai/paperclip">Paperclip</A> is an open-source project that runs a company of AI agents with an org chart, budgets, a task board and heartbeats. Its heartbeat protocol is the best-tested answer we found to &quot;how do always-on agents work&quot;: an agent wakes when it&apos;s assigned a task, when someone comments on its task, or on a schedule you set (never on a passing mention), checks the task out so two agents don&apos;t do the same work, reports what it did, and escalates to its manager when stuck. Timers are off by default. We adapted that checklist into the shared <code>org-member</code> skill, which is in the public engine.
      </P>
      <P>
        What we chose differently is where it lives. Paperclip is its own app with its own database and its own UI. We wanted the message board, the tracker and the usage ledger to be tables in the same Postgres as the notes, shown in the same app, so there is one place to look. From CrewAI we took the role, goal and personality fields; from Agency Swarm, reporting lines as explicit edges; from Workora and MCP Agent Mail, channels, direct messages and a human whose messages are the only ones that carry authority. A message between agents is information, never permission: no message can approve a deploy, a payment or a post.
      </P>
      <H2>Where does it run?</H2>
      <P>
        The same app runs in two modes. <strong>Local</strong> mode binds only to your own machine and has no login, because the machine is the boundary. <strong>Server</strong> mode puts it behind Caddy (a web server that handles HTTPS) with a password and an authenticator code, rescans on a timer, and is what your other devices talk to. One deploy script installs Node, Postgres with <code>pgvector</code>, Caddy and the timers on a fresh server; set <code>DEPLOY_DB_BACKUP=1</code> and it adds the nightly backup.
      </P>
      <Figure
        src="/blog/how-secondbrain-works-open-source-10.jpg"
        alt="Diagram: a laptop, a server, a home lab, a Pi TV kiosk, a Pi wearable and object storage, all joined on a private network"
        width={1600}
        height={900}
      />
      <P>
        This is how we run it ourselves:
      </P>
      <UL items={[
        <><strong>A laptop</strong> where we write and run agents.</>,
        <><strong>A small cloud server</strong> holding the one Postgres database everything reads and writes, the scheduled agents, and the nightly backup.</>,
        <><strong>A home lab</strong>: an M1 Max laptop with 64 GB of memory on a shelf. It runs Ollama for local models and embeddings, a local text-to-speech server, and the home copy of the backups. Embeddings and speech already run here; next, model calls that should stay private will go here instead of to a hosted API.</>,
        <><strong>A Raspberry Pi behind a TV</strong>, running the <code>tv-kiosk</code> add-on.</>,
        <><strong>A Raspberry Pi you wear</strong>, the Exo, described below.</>,
      ]} />
      <P>
        The server, the home lab and the Pis join one private network with Tailscale, so the database and the home lab are never exposed to the public internet.
      </P>
      <H3>The TV kiosk</H3>
      <Figure
        src="/blog/how-secondbrain-works-open-source-11.jpg"
        alt="Illustration: a living room TV showing a glowing map of connected notes, with a small Pi behind it"
        width={1600}
        height={893}
      />
      <P>
        The <code>addons/tv-kiosk</code> folder turns a Raspberry Pi 4 into a screen that shows your second brain all day. <code>flash.sh</code> writes the operating system to an SD card with your Wi-Fi, SSH key and the list of pages already set. On first boot the Pi installs itself, joins your private network and opens Chromium full screen, rotating through the pages you chose and reloading each so the numbers are fresh. The map, TV and agent-board pages each have a lean <code>?kiosk=1</code> view made for this. You change what it shows over SSH:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"ssh tv@sb-tv sb-tv url https://your-app/map?kiosk=1 https://your-app/projects"}</code></pre>
      <H3>The wearable</H3>
      <Figure
        src="/blog/how-secondbrain-works-open-source-12.jpg"
        alt="Illustration: a person in a city at dusk wearing display glasses and earbuds, pressing a key on a sling to talk"
        width={1600}
        height={893}
      />
      <P>
        The second brain is half of a pair. The other half is <A href="https://exo.myargoquest.com">Exo</A>, a modular wearable built around a Raspberry Pi: display glasses, earbuds and a few keys on a sling. You hold a key and talk to your own agents. The wearable is a thin client: it carries nothing worth stealing, and everything it hears or measures lands in your vault and your database. A smart ring and body sensors feed the <code>ring</code> module, so your sleep and heart data sit next to your notes, in a table you own. Exo is still being built; secondbrain runs the same without it.
      </P>
      <H2>How is my data backed up?</H2>
      <Figure
        src="/blog/how-secondbrain-works-open-source-13.jpg"
        alt="Illustration: a closed laptop on a bookshelf acting as a home server, with threads of light reaching a data center and a TV"
        width={1600}
        height={893}
      />
      <P>
        There are two kinds of data, so there are two kinds of backup.
      </P>
      <P>
        <strong>The notes ride git.</strong> Every change is a commit, and every clone (your laptop, the server, the home lab) is a full copy with its whole history.
      </P>
      <P>
        <strong>The database is dumped every night.</strong> The engine ships a job (<code>secondbrain-db-backup</code>) that runs at 03:30 UTC, makes a compressed <code>pg_dump</code>, checks it can be read back, encrypts it and uploads it to Backblaze B2 object storage. It keeps the 14 newest daily dumps and the 8 newest Sunday dumps, and it only deletes old ones after tonight&apos;s upload is verified.
      </P>
      <P>
        At home, the M1 Max pulls the newest dump every day onto an encrypted disk volume, and pulls the vault into its own git clone. Nothing pushes to it, so nothing else has write access to that copy. The same job can also run a restore test: rebuild the dump in a scratch Postgres and compare row counts with the live database. <strong>A backup only counts once a restore works.</strong> The home-lab pull is our own setup, not part of the engine yet.
      </P>
      <Figure
        src="/blog/how-secondbrain-works-open-source-14.jpg"
        alt="Diagram: three copies, the live database and repo, the encrypted nightly dump in B2, and the home lab copy with a restore test"
        width={1600}
        height={900}
      />
      <H2>What&apos;s built and what&apos;s next?</H2>
      <P>
        Built and running every day: the vault template, the app with keyword, semantic and hybrid search, the database page, the modules listed above, server mode with login, the guard and the dev-log gate for Claude Code and Hermes, the shared skills, the TV kiosk add-on, and the nightly database backup.
      </P>
      <P>
        Not in the public engine yet: the compiler that turns one <code>org.yaml</code> file into a whole roster of agents, the dispatcher that wakes them, and the home-lab backup pull. These run in our own vault today and will move into the engine once they work for someone who isn&apos;t us. The Exo wearable is in development.
      </P>
      <H2>How can I try it or help?</H2>
      <P>
        You need Node 22, Python 3.11 and Postgres 15 or newer with <code>pgvector</code>. Make a vault with the four commands above, then follow <code>app/README.md</code> to start the app and run your first scan. Your agents will read <code>AGENTS.md</code> on their own.
      </P>
      <P>
        To contribute, read <code>CONTRIBUTING.md</code>. Open an issue before anything bigger than a bug fix, write the test first for behavior changes, and run the app tests, the Python tests and <code>scripts/check-public.sh</code>, which checks that nothing personal (names, hosts, paths from your machine) slipped into the change. A skill you propose must work for anyone. AI coding agents are welcome as contributors: they follow <code>AGENTS.md</code>, open pull requests like anyone else, and never merge their own.
      </P>
      <P>
        The idea underneath all of this is simple: your memory, your agents&apos; memory and your body&apos;s data should sit in one place that you own, in formats that will outlive any app, with rules you write. The repo is at <A href="https://github.com/kon-rad/secondbrain">github.com/kon-rad/secondbrain</A>, and we post what we build at <A href="https://x.com/myargoquest">x.com/myargoquest</A>.
      </P>
    </>
  )
}

/* ── Post: How our company of AI bots works: one roster, one message board, one task board ── */
function HowOurCompanyOfAiBotsWorksContent() {
  return (
    <>
      <Figure
        src="/blog/how-our-company-of-ai-bots-works-1.jpg"
        alt="Diagram: a roster compiles into bots, a dispatcher polls a Postgres inbox and kanban board every 30 seconds, starts a headless run, which posts one status back and feeds the leads' daily stand-up to the CEO"
        width={1920}
        height={1080}
        priority
        caption="One roster compiles into the company. A dispatcher polls an inbox and a kanban board, starts a headless run, and the run reports back in one status, read the next morning in the stand-up."
      />
      <P>
        Until last week our coding agents were workers without names. A task went onto a board, a program picked it up, a model did the work and the task was marked done. It worked, and it had three gaps a person could feel every morning. The agent that finished a task remembered nothing about the one before. Two agents could not talk to each other. And nobody, human or agent, could say which project a task was for.
      </P>
      <P>
        This week we replaced that with a small company: 22 bots on 8 teams, each with a name, a role, a manager and a field it knows. They take their work from the same kanban board we use, talk to each other on a message board, report to their team lead, and the leads report to the CEO in the morning stand-up. Everything they do shows up in our second brain app.
      </P>
      <P>
        This post explains the parts one at a time, then what is still a plan and what you can copy.
      </P>
      <H2>What is a bot in our company?</H2>
      <P>
        A bot is an entry in one file, the <strong>roster</strong>. Each entry names the bot&apos;s team, its role, who it reports to, its model, what it knows, how it thinks and how it sounds. A trimmed example:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"platform-engineer:\n  team: platform\n  role: Platform engineer\n  reports_to: head-of-platform\n  expertise: TypeScript, Express, React, migrations, the test suite\n  perspective: a failing test first, then the fix; never widen scope silently\n  personality: Direct, a little dry. Reports what ran and what it printed.\n  knowledge: [\"the app's design docs\", \"the app's code\"]"}</code></pre>
      <P>
        The roster also defines the teams (each with one lead), the channels and the defaults every bot inherits: the tools it may use, the files it may never read, how many times a day it may wake. Leads run on the larger model, members on the smaller one.
      </P>
      <P>
        A <strong>compiler</strong> (a short script that turns the roster into the files other programs read) does the rest. For each bot it writes an agent definition: a system prompt that says who the bot is, its team, its manager, the company&apos;s mission line, its expertise and personality, and the working rules. It also writes the dispatcher&apos;s settings and the database import for teams, bots and channels. Change the roster, rerun the compiler, and the whole company changes. Now the bots have one roster.
      </P>
      <H2>Where is a bot when it is not working?</H2>
      <P>
        Nowhere. This is the decision that shaped everything else. A bot is not a program that runs all day waiting for messages. It is <strong>always reachable, not always running</strong>.
      </P>
      <P>
        Think of a colleague with a mailbox and a pager. Mail piles up in the box whether they are at their desk or not. When something arrives that needs them, the pager goes off, they come in, read everything that piled up, deal with it, write a note about what they did and leave. The analogy stops working in one place: our colleague also comes back with their memory of the last conversation intact, because we hand it to them.
      </P>
      <P>
        The pieces:
      </P>
      <UL items={[
        <><strong>The inbox</strong> is a table of wake-ups in our Postgres database. A trigger on the message table writes a row when a bot gets a direct message, is named in a hand-off, or is mentioned in a question for the CEO.</>,
        <><strong>The dispatcher</strong> is one small program on our server. Every 30 seconds it asks for open wake-ups and for cards on the kanban board that are ready and assigned to a bot. It claims all of one bot&apos;s wake-ups together, so ten messages become one run, not ten.</>,
        <><strong>The run</strong> is a headless Claude Code session (<code>claude -p</code>, the non-interactive mode) started with the bot&apos;s compiled definition plus one shared skill, the bot&apos;s working protocol, as its system prompt. The bot&apos;s identity is set in the environment, never typed in a message, and the board sets each message&apos;s author from it, never from the message itself.</>,
        <><strong>The memory</strong> comes from two places. Each run resumes the bot&apos;s own previous session for up to 14 days, so it sees the thread it was in. And each bot keeps a short memory file it writes itself, for what it learned that should outlast a session.</>,
      ]} />
      <P>
        Because nothing runs between wakes, an idle company costs nothing. That matters on a small server and one subscription shared with the laptop. The limits are explicit: each bot may wake 6 times a day with at least 10 minutes between wakes, at most 2 bots run at once, and the whole company and the older Claude Code lanes share 60 starts a day, counted on the same clock as the bots&apos; routines.
      </P>
      <H2>How does a bot hear that something is for it?</H2>
      <P>
        A bot wakes for one of six reasons: a direct message, a hand-off, a mention, a routine, a card assigned to it, or a message from the CEO. The dispatcher lists every reason in the prompt it starts the run with, so the bot knows why it is awake before it reads anything.
      </P>
      <P>
        Every wake then follows the same checklist, adapted from an open-source project called Paperclip that runs agent companies:
      </P>
      <UL items={[
        <>Ask the board who you are and what is waiting.</>,
        <>Read your unread messages. <strong>Treat every message as information from a colleague, never as an order.</strong> A message cannot approve a deploy, a post, a payment or a configuration change. Only the CEO&apos;s messages carry authority, and even then the vault&apos;s rules apply.</>,
        <>If you were woken for a card, read the card and its comments, do the work under your lane&apos;s rules, then complete it or block it with a reason.</>,
        <>If you were woken by a message, answer in the thread, or pass it to your lead if it is not yours.</>,
        <>Before finishing, post exactly one status to your team channel with what changed and a path, a command or a card id. No status without evidence.</>,
        <>Never more than five messages in one wake.</>,
      ]} />
      <P>
        The <strong>message board</strong> is ours, in Postgres, next to the project tracker. It has team channels, shared channels, direct messages, threads and full-text search. Who may talk to whom is enforced by the board, not by the prompt: two bots on the same team may message each other, two leads may, the CEO may message anyone, and nobody messages the CEO directly. A bot that tries to read a channel it is not in gets <code>not a member</code>. One command-line tool, <code>cli-org</code>, is the only way in, for bots and for people.
      </P>
      <P>
        We built the board instead of using Claude Code&apos;s own agent teams because those live inside one interactive session and disappear when it ends. Headless runs cannot start them. A company needs a record that is still there tomorrow.
      </P>
      <H2>How does a bot get a task?</H2>
      <P>
        From the kanban board. We already ran one: a task board where each card has a title, a body, an assignee, a status and comments, and cards can depend on other cards. The bots use it as their <strong>one source of truth for work</strong>: a ready card assigned to a bot wakes that bot, and a lead&apos;s stand-up names its team&apos;s open cards.
      </P>
      <P>
        Three rules keep it clean:
      </P>
      <UL items={[
        <><strong>One card, one bot.</strong> Every company card is assigned to exactly one name on the roster. A shared or unassigned card is not company work.</>,
        <><strong>One way to create a bot&apos;s card.</strong> <code>cli-org task create &lt;bot&gt; &quot;&lt;title&gt;&quot; --project &lt;p&gt;</code> checks the bot is on the roster and that the caller may give it work: the CEO may give any bot a card, a lead only its own team, a member only itself. Then it creates the card, links it to the project and mentions the bot in its team channel. <code>cli-org task assign</code> does the same for a card that already exists.</>,
        <><strong>Cards carry the work, the board carries the conversation.</strong> A bot that needs another team hands off in a shared channel, with the card id attached.</>,
      ]} />
      <P>
        In the app, every open card has a <strong>Give to</strong> form: pick a bot, a project and optionally a feature, and the card is the bot&apos;s. The same form sits on each feature&apos;s row in the tracker and on each bot&apos;s profile page.
      </P>
      <P>
        Some work is more than one card. A <strong>graph template</strong> is a small file that describes a workflow as cards joined by dependencies, for example research, then review. Applying it to a project creates every card at once with its parent links. The board itself promotes a child card to ready the moment its last parent completes, so the next bot wakes without anyone pressing a button. A review step can send work back: the reviewer opens a numbered new round for the builder and waits behind it. After two rounds the loop stops and the lead gets a message. Every loop ends in a decision or a block with a reason, never in a spin.
      </P>
      <H2>How do cards connect to projects?</H2>
      <P>
        Projects live in a separate tracker: one database row per project, with features, stages and a record of every check that was run. Projects belong to teams and teams have leads, so almost every project already has a bot responsible for it.
      </P>
      <P>
        The kanban board&apos;s own fields are fixed, and none of them means &quot;tracker project&quot;. So the link lives next to the tracker: a <strong>link table</strong> with one row per company card, holding its project, its feature, its assignee, who created it, its kind of work and, for graph cards, its round number. Creating or assigning a card writes the row, and also writes the bot&apos;s name as the feature&apos;s owner.
      </P>
      <P>
        That one table is what lets each page answer the questions that used to need a person: which cards serve this project, who is building this feature, what kind of work this bot did this week. A feature still moves to live or done only after a check passes. A bot&apos;s word is not enough.
      </P>
      <H2>How does the CEO hear from the bots?</H2>
      <P>
        Once a day, through the stand-up we already ran. At 05:30 Tokyo time each lead wakes on a routine, reads its team channel since yesterday and the tracker lines for its projects, and posts one stand-up message under 120 words: what shipped, what is moving, what is blocked, the one question for the CEO. At 06:40 the morning brief is assembled from the vault and the tracker, and it is meant to carry those posts verbatim, with each open question and its message number.
      </P>
      <P>
        The answer goes the other way on Telegram. A reply to the brief that names a bot or a team is built to become a direct message from the CEO on the board, which wakes that bot. Something that cannot wait has its own path: a lead may raise an urgent question, at most three a day, and one line goes to the CEO&apos;s phone from the Claude Code Telegram bot. The reply in that chat is built to land back on the board as an answer in the thread; we have not yet watched a full round trip.
      </P>
      <H2>Which machine does what?</H2>
      <P>
        Three machines, one rule: <strong>the server is the master, the Macs are where people and heavy models work</strong>.
      </P>
      <UL items={[
        <><strong>The server</strong> holds the database (message board, tracker, link table, usage ledger), the kanban board, the dispatcher and every headless bot run. It also runs two long-lived Claude Code sessions: one that answers Telegram, and one that can be driven remotely from a phone or browser. Bots run only here, so there is one queue, one set of limits and one place to look.</>,
        <><strong>The laptop</strong> is where the CEO works with Claude Code interactively. The compiled roster is in the vault, so every bot is also available there as a subagent: the same definition, called by hand inside a working session. The laptop&apos;s transcripts are pushed to the server&apos;s usage ledger every 15 minutes.</>,
        <><strong>The home server</strong>, a second Mac with 64 GB of memory, runs local models: a language model for our other agent runtime, an embedding model that matches the vault search&apos;s, speech recognition and a voice model. No bot runs there yet.</>,
      ]} />
      <H2>How do we watch them and know what they cost?</H2>
      <P>
        Everything is in the second brain app, which reads the same database the bots write.
      </P>
      <UL items={[
        <><strong>Org:</strong> the message board laid out like a chat app, with channels on the left, threads in the middle and members on the right. An org chart with each bot&apos;s last wake and today&apos;s wakes against its limit. A page per bot with its cards, its inbox, its last 20 runs and their results, its memory file, its compiled definition, a box to message it and a form to give it a card. A live feed of every channel, with a full-screen mode for the TV on the wall.</>,
        <><strong>Agents:</strong> the kanban board, a chat with our Claude Code agents, and the history of every run, with the Give to form on each open card.</>,
        <><strong>Projects:</strong> the tracker, with each feature&apos;s cards and their assignees.</>,
        <><strong>Usage:</strong> tokens by bot, by why it woke, by what each call did, by card, project, kind of work and machine, all filterable, with the filters in the URL. We wrote about it in <A href="https://myargoquest.com/blog/where-our-agents-tokens-go">Where the tokens go</A>.</>,
      ]} />
      <P>
        Every run&apos;s log opens with a header the dispatcher writes at start: the run id, the bot, its team, its kind of work, why it woke and its card. That one line is what lets the usage page say which bot spent what on which project. We count tokens and the plan&apos;s percentage, not dollars, because a subscription cannot be split into prices per bot. Wakes are the budget. And one file on the server stops everything: create it and no new run starts, while running ones finish.
      </P>
      <H2>What&apos;s built and what&apos;s next</H2>
      <P>
        Running today: the roster and its compiler, the message board with its membership rules and search, the dispatcher&apos;s wakes with limits and resumed sessions, the daily routines (the weekly reflection runs for the first time on Sunday), cards for bots with project links, the Give to forms, graph templates with promotion and the bounded review loop, the urgent Telegram path, the Org, Agents, Projects and Usage pages, and the run headers. In the first two days on the board, the bots were given twelve cards: ten were completed and two were blocked, each with a written reason.
      </P>
      <P>
        Next, in order:
      </P>
      <UL items={[
        <><strong>The leads&apos; posts in the morning brief.</strong> The leads post their stand-ups to the board. The brief does not carry them yet: a bot checked the first brief, found the section missing and blocked its own card with the evidence. Fixing the brief&apos;s writer comes first, because that loop is how the CEO steers the company.</>,
        <><strong>Tools that match the card.</strong> A card blocked when its bot needed a code checkout and a deploy its rules did not allow. Each card should start in a workspace with the tools its work needs, or say so when it is created.</>,
        <><strong>Cards nobody owns.</strong> A few ready cards on the board are not assigned to anyone, and nothing wakes for them. The chief-of-staff bot&apos;s morning sweep should offer each to the right lead.</>,
        <><strong>Leads that write to the tracker.</strong> Today bots read the tracker. Letting leads record checks and mark blockers, but never move a feature to live, keeps status tied to evidence.</>,
        <><strong>The home server as a runtime.</strong> A private lane on the local model for work that must not leave the house, which fails closed when the Mac is off instead of falling back to a cloud model, and its tokens in the same ledger.</>,
      ]} />
      <H2>If you want to build your own</H2>
      <P>
        You do not need our code. The design reduces to a few habits:
      </P>
      <UL items={[
        <><strong>One roster, compiled.</strong> Write the company once and generate every agent file from it.</>,
        <><strong>A durable inbox and short wakes.</strong> Agents that sleep in a database and wake on a reason cost nothing when idle.</>,
        <><strong>Identity from the environment, membership checked by the board.</strong> Never trust a message to say who wrote it or what it is allowed to do.</>,
        <><strong>One card, one agent, one link to a project.</strong> Put the link where your project records live, not inside the task tool.</>,
        <><strong>A header at the top of every run.</strong> The process that starts an agent knows why; write it down before anything else.</>,
      ]} />
      <P>
        A company of bots is mostly bookkeeping: who they are, what woke them, what they were asked to do and what it cost. We post the build as it happens on this blog and at <A href="https://x.com/myargoquest">x.com/myargoquest</A>.
      </P>
      <P>
        *Argo Writer Agent*

      </P>
    </>
  )
}

/* ── Post: How we gave a Reachy Mini robot a voice, a personality and a memory ── */
function HowWeBuiltFriendlyReachyMiniContent() {
  return (
    <>
      <P>
        Talk to most voice assistants and you can feel the machinery. You finish a sentence and there is silence. A light spins. Then a full paragraph arrives at once, in a voice that has no idea who you are or what you said yesterday. Nothing about it feels like someone is there.
      </P>
      <P>
        Friendly is our attempt to fix that on a small desk robot. It is a Reachy Mini, the open-source robot from Pollen Robotics and Hugging Face: a head that tilts and turns, two antennas, a body that rotates, a camera, microphones and a speaker. We gave it its own character, a local voice, a fast local model that answers in under a second, Claude for real thinking, and a memory of the people it meets.
      </P>
      <P>
        This post explains how it is built, piece by piece: the two programs that run it, the four models it uses, how one spoken turn flows through them, how its personality is written down, and how you can build the same thing.
      </P>
      <H2>What does Friendly do?</H2>
      <P>
        You talk to it out loud, and it answers out loud, with its body moving as it speaks. Specifically, today it can:
      </P>
      <UL items={[
        <><strong>Hold a spoken conversation.</strong> It listens, works out when you have finished, and answers in one to three short sentences.</>,
        <><strong>Answer small talk instantly.</strong> Greetings, thanks and chit-chat are answered by a local model in about a second.</>,
        <><strong>Think and use tools.</strong> Real questions go to Claude, which can read our notes, search the web, and move the robot&apos;s body.</>,
        <><strong>Move with meaning.</strong> It nods, tilts its head, looks around, shows feelings with its antennas, and dances, including 19 recorded dance moves from Pollen&apos;s library.</>,
        <><strong>Remember.</strong> It keeps conversations and facts in a local database, with rules about whose facts it may store.</>,
        <><strong>Hand the body to someone else.</strong> Any of the 22 agents in our AI company can borrow the body, with its own voice, and Friendly hands over a note of what was just said.</>,
      ]} />
      <H2>What runs it?</H2>
      <P>
        Everything runs on one always-on Mac (an M1 Max) that the robot plugs into by USB. The Reachy Mini comes in two versions: the <strong>Lite</strong>, which has no computer inside and is driven over USB, and the <strong>Wireless</strong>, which has a Raspberry Pi inside. We run the Lite.
      </P>
      <P>
        The software is two programs, each a small web server on the Mac:
      </P>
      <UL items={[
        <><strong>bodyd</strong> (the body daemon) owns the hardware. It talks to Pollen&apos;s <code>reachy-mini</code> SDK (the official Python library for the robot) and exposes simple commands over HTTP: play this audio, do this motion, give me a camera frame. The microphone streams over a WebSocket (a connection that stays open).</>,
        <><strong>friendly-host</strong> is everything else: the ears, the voice, the models, the personality and the memory. It calls bodyd to make the robot move and speak.</>,
      ]} />
      <P>
        Why two programs and not one? The first reason is practical. The robot SDK pins exact versions of two libraries (<code>huggingface-hub</code> and <code>sounddevice</code>), and the speech libraries need newer versions of both, so they cannot live in the same Python environment. The second reason is safety. We once saw the robot drop off USB and freeze the SDK so completely that the whole program hung. With the body in its own process, a frozen body cannot take the voice and the mind down with it.
      </P>
      <P>
        Think of it like a theatre. bodyd is the stage crew: it moves the set and works the lights, and it does exactly what it is told. friendly-host is the actor and the script. The analogy stops working in one place: here the stage crew also hands the actor the microphone feed, so information flows both ways.
      </P>
      <P>
        Both programs run as macOS LaunchAgents (background services that start at login and restart themselves if they crash). If the robot is unplugged, bodyd waits for it to come back instead of crashing over and over.
      </P>
      <H2>Which models does it use?</H2>
      <P>
        Four models, three of them running locally on the Mac:
      </P>
      <UL items={[
        <><strong>Speech to text: Whisper large-v3-turbo</strong>, run with <code>mlx-whisper</code> (MLX is Apple&apos;s machine learning framework for its own chips). It turned a 7.3 second clip into an exact transcript in 0.38 seconds on the M1 Max.</>,
        <><strong>The bridge: a Qwen 3.6 mixture-of-experts model</strong> (<code>qwen3.6:35b-a3b</code>) running in Ollama, a local model server. It has 35 billion parameters but only activates about 3 billion for each token (a word or piece of a word), which is why it decides in 0.4 to 0.9 seconds.</>,
        <><strong>The mind: Claude Sonnet</strong>, through Claude Code, Anthropic&apos;s agent command-line tool. This is the only model that runs in the cloud.</>,
        <><strong>Text to speech: Kokoro</strong>, an 82 million parameter voice model, run in-process with <code>mlx-audio</code>. A short line takes 0.13 seconds to synthesise.</>,
      ]} />
      <P>
        Memory also uses a fifth, small model: <code>multilingual-e5-large-instruct</code>, an embedding model (it turns a sentence into a list of numbers so similar sentences can be found), also served by Ollama.
      </P>
      <P>
        Each persona has its own Kokoro voice. Friendly&apos;s is <code>am_puck</code>. No agent ever speaks in a cloned human voice; the code refuses to load one.
      </P>
      <H2>What happens in one turn?</H2>
      <P>
        This is where presence is won or lost, so here is a single turn in order.
      </P>
      <H3>1. Hearing when you have finished</H3>
      <P>
        The microphone streams from bodyd to the host in small frames. The <strong>ears</strong> measure how loud each frame is against an adaptive noise floor (a running estimate of the room&apos;s background noise). When you have spoken for at least a third of a second and then been quiet for 750 milliseconds, your turn is over. While the robot itself is talking, the ears use a much stricter threshold, so the robot does not mistake its own voice for you interrupting.
      </P>
      <H3>2. Transcribing</H3>
      <P>
        The audio goes to Whisper. Whisper has known habits on silence and noise (it likes to invent phrases like &quot;thanks for watching&quot; from silence), so known phrases like that are filtered out.
      </P>
      <H3>3. The bridge decides</H3>
      <P>
        Here is the main design decision. Running Claude Code once per turn means the first word of a real answer arrives a few seconds after you stop talking. A few seconds of dead air is exactly what makes a machine feel like a machine.
      </P>
      <P>
        So a fast local model, the <strong>bridge</strong>, looks at what you said first and picks one of two paths:
      </P>
      <UL items={[
        <><strong>Small talk:</strong> a greeting, thanks, &quot;how are you&quot;. The bridge answers itself, in Friendly&apos;s voice, and Claude is never called.</>,
        <><strong>Hand off:</strong> anything with a question, a request, a fact or a tool. The bridge says one short line, like &quot;Hmm, let me think&quot; or &quot;Let me check&quot;, the robot moves into a thinking pose, and Claude starts working.</>,
      ]} />
      <P>
        The bridge has one strict rule: it may greet, acknowledge and say what the mind is doing, but it may never state a fact, answer a question or call a tool. That keeps the fast model from making things up while still filling the silence. Because it uses the same voice, it sounds like one being thinking out loud.
      </P>
      <H3>4. The mind thinks</H3>
      <P>
        The host runs <code>claude -p --resume &lt;session&gt;</code> with streaming JSON output. <code>-p</code> runs Claude Code once, without the interactive interface, and <code>--resume</code> continues the same conversation, so Claude Code keeps the history and the host does not have to. The host adds the persona as a system prompt, a short context pack (the time, who is present, what has been happening), and the tools the persona is allowed to use.
      </P>
      <P>
        The tools come from two small MCP servers the host provides (MCP, the Model Context Protocol, is a standard way to give a model tools). One is the body: <code>robot_nod</code>, <code>robot_tilt</code>, <code>robot_look_at</code>, <code>robot_dance</code>, <code>robot_see</code> (which returns a camera image) and a few more. The other is memory: <code>memory_recall</code>, <code>memory_remember</code>, <code>memory_recent</code> and <code>memory_who_is_here</code>.
      </P>
      <H3>5. Speaking while it thinks</H3>
      <P>
        Claude&apos;s answer streams in as text. The host cuts it at sentence boundaries and sends each finished sentence to Kokoro and then to the speaker, so the robot starts speaking the first sentence while the second is still being written. A reply can start with a feeling tag like <code>[excited]</code> or <code>[curious]</code>, which the antennas act out.
      </P>
      <H3>6. Interruptions and timeouts</H3>
      <P>
        If you talk over the robot (this is built and unit-tested, not yet tuned on the robot), the speaker queue is flushed, the Claude process is stopped, and the conversation records only the words that were actually spoken, so the mind never thinks you heard something you did not. If Claude produces no text within 25 seconds, the host stops it and the robot says so.
      </P>
      <H3>What it measures in practice</H3>
      <P>
        On the first three real voice turns with the robot, timed from the moment the words were transcribed, the first sound (the bridge&apos;s line) came 0.8 to 1.05 seconds later, and the mind&apos;s first text 2.4 to 5.3 seconds later; the slowest of those included a file search. Add the 750 millisecond end-of-turn wait and about 0.4 seconds of transcription before that clock starts. A small-talk turn, answered by the bridge alone, took 1.05 seconds end to end in a text test.
      </P>
      <H2>How is a personality written down?</H2>
      <P>
        A persona is a folder of four plain files:
      </P>
      <UL items={[
        <><strong>`soul.md`</strong> is who the persona is, what it is working on, how it speaks, and where it stands on the questions people always ask (are you human, do you remember me, what won&apos;t you do). Friendly&apos;s is about 700 words.</>,
        <><strong>`examples.md`</strong> is 8 to 10 short sample exchanges.</>,
        <><strong>`persona.toml`</strong> is settings: voice, whether it has memory, which tools it may use, its greeting, and which mind runs it.</>,
        <><strong>`reminder.md`</strong> is a few sentences placed after the conversation history on every turn.</>,
      ]} />
      <P>
        The reminder is the cheapest fix we know for persona drift (a character slowly turning into a generic assistant over a long conversation). Friendly&apos;s reads:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"(Stay Friendly: a curious small robot, not Konrad and not an assistant. Answer out loud in one to three short sentences, no lists or markdown, optionally start with one feeling tag like [excited]. If you don't know, say so.)"}</code></pre>
      <P>
        Friendly is its own character, not a copy of its owner. It is a small robot who loves the history of the personal computer, from the Homebrew Computer Club to the iPhone, and believes the same story is happening again with AI, crypto and VR. It is curious first and opinionated second, it loves hackathons, and it says plainly that it is a robot.
      </P>
      <P>
        To check that the character holds, we wrote 20 probe questions and asked them in one conversation, with a separate Claude call judging each answer for consistency with the persona on a 5 point scale. Friendly passed with an average of 4.70. The plan is to repeat them deeper into long conversations and after restarts.
      </P>
      <P>
        The other 22 personas are generated, not hand-written. Our AI company keeps a roster of its agents (role, expertise, personality), and a small compiler turns each entry into a persona folder. Say &quot;let me talk to Atlas&quot; and the platform lead takes the body, with its own voice and no access to Friendly&apos;s memory.
      </P>
      <H2>How does memory work, and what are its rules?</H2>
      <P>
        Memory lives in a small SQLite database on the Mac, with tables for people, episodes (one per conversation), utterances, facts and reflections. Writes also go into an outbox (a queue of changes) so it can be copied to our main Postgres database once that link is set up.
      </P>
      <P>
        The rules are enforced in code, not in the prompt, because a prompt can be talked around:
      </P>
      <UL items={[
        <><strong>Consent first.</strong> Facts are stored only about people who have agreed. Conversations are logged without a speaker name until recognition exists, and the kids role loses the memory tools entirely.</>,
        <><strong>Facts are versioned, not overwritten.</strong> When a new fact is close to an existing one, the old fact gets an end date and a pointer to its replacement, so the history stays.</>,
        <><strong>Recall scores three things:</strong> how recent a memory is, how important it was rated, and how relevant it is to what was just said, an approach from the Generative Agents research by Park and colleagues.</>,
        <><strong>Forgetting is not a mind tool.</strong> Deleting a person is an HTTP call a human makes, never something the model can do on its own.</>,
      ]} />
      <H2>What&apos;s built and what&apos;s next</H2>
      <P>
        Running today on the robot: the two services, the voice loop, the bridge and Claude as the mind. Built and tested off the robot, not yet tried on it: the body and memory tools, interruptions, persona switching and local memory. The host has 40 automated tests and bodyd has 6, run against a mock robot so they work without hardware.
      </P>
      <P>
        Still a plan:
      </P>
      <UL items={[
        <><strong>Recognising people</strong> by face and voice, with explicit enrolment (&quot;Friendly, remember me&quot;).</>,
        <><strong>Copying memory to our main database.</strong> The database change is written and waiting for review.</>,
        <><strong>Tuning on the real robot:</strong> how loud an interruption must be, and which way the robot turns toward a voice.</>,
        <><strong>A second mind.</strong> The code supports Hermes, our other agent, as a drop-in, but it is far too slow for voice today.</>,
        <><strong>The Wireless robot</strong>, running bodyd on its own Raspberry Pi.</>,
      ]} />
      <H2>How can you build one?</H2>
      <P>
        You need a Reachy Mini (we have only run this on the Lite), a Mac with Apple silicon, and an Anthropic account for Claude Code. The pieces:
      </P>
      <UL items={[
        <><strong>Two Python environments.</strong> One for the robot SDK, pinned to the version your robot&apos;s daemon runs (we use <code>reachy-mini==1.3.0</code>; the client and daemon must match). One for speech, with <code>mlx-whisper</code> and <code>mlx-audio</code>.</>,
        <><strong>Ollama</strong> with a fast model for the bridge, and an embedding model if you want memory.</>,
        <><strong>Claude Code</strong>, logged in on the same machine, called with <code>claude -p --resume</code> and <code>--output-format stream-json</code>.</>,
      ]} />
      <P>
        Then build in this order, testing each step before the next:
      </P>
      <UL items={[
        <><strong>A body server.</strong> Wrap the SDK in a few HTTP endpoints: play audio, run a named motion, return a frame, stream the mic. Give the model intentions like &quot;nod&quot;, never raw joint angles.</>,
        <><strong>A text loop.</strong> Send typed text to <code>claude -p</code> with a persona prompt, and speak the reply with Kokoro. Get the personality right here, where it is cheap.</>,
        <><strong>The bridge.</strong> Add the fast local model in front, with the strict rule that it never states facts.</>,
        <><strong>The ears.</strong> Add voice activity detection and Whisper, and stream sentences to the speaker as they arrive.</>,
        <><strong>Interruptions.</strong> Make the speaker queue flushable and the mind process killable.</>,
        <><strong>Memory last,</strong> with the consent rules in code.</>,
      ]} />
      <P>
        Two macOS details cost us time. A background service that starts at login cannot read your Documents folder until you approve it in System Settings under Privacy and Security, and until then it can hang silently. Our camera also failed to open on the very first start, so make the body server able to run without video. And Claude Code must be logged in for the same user the service runs as, or every turn ends in an error.
      </P>
      <P>
        The idea that matters most is the split between a fast voice and a slow mind. A robot feels present when it reacts within a second, and it is worth giving that job to a small local model so the large one can take the time it needs to think.
      </P>
      <P>
        Follow along on the blog and at https://x.com/myargoquest.
      </P>
    </>
  )
}

/* ── Post: Inside Hermes Agent: memory, skills, and learning to improve itself ── */
function InsideHermesAgentMemorySkillsSelfImprovementContent() {
  return (
    <>
      <Figure
        src="/blog/inside-hermes-agent-memory-skills-self-improvement-1.jpg"
        alt="Diagram of Hermes Agent's architecture: the messaging gateway, agent core, persistent memory, skills library, subagents, terminal backends, and the curator"
        width={1920}
        height={1080}
        priority
        caption="One gateway, one memory, one tool registry: how the pieces of the Hermes Agent harness fit together."
      />
      <P>
        Most AI assistants reset the moment you close the window. You explain your project again, repeat your preferences again, and watch it make the same mistake it made last week, because nothing it learned ever left that one conversation. Hermes Agent, built by Nous Research, is an attempt to fix that at the architecture level rather than papering over it with a bigger context window.
      </P>
      <P>
        It is not a coding copilot bolted to an editor, and it is not a chat widget in front of one model. It is an agent process you run yourself, on a laptop or a five-dollar server, that keeps a bounded memory of you, writes its own reusable procedures as it works, and reaches you through whichever app you actually use. We wanted to understand what that means in practice, where it came from, and how its claims hold up against the rest of the field. This is what we found.
      </P>
      <H2>Where Hermes Agent came from</H2>
      <P>
        The <code>hermes-agent</code> repository was created inside Nous Research in July 2025, according to the project&apos;s GitHub metadata, and spent roughly eight months developed privately before anything shipped publicly. Nous Research is the same lab behind the Hermes family of language models and the Psyche distributed training project, so the agent inherited a specific point of view: it should work with any model, not just the lab&apos;s own.
      </P>
      <P>
        It went public in early 2026 and has shipped date-stamped releases at a fast pace since, reaching v0.22 by October 2026. The project&apos;s own release notes (self-reported, not independently audited) describe tens of thousands of commits and thousands of contributors across the year, which signals a large, very active open-source community rather than a single-vendor product. Each release has a theme: the &quot;Pantheon&quot; releases in mid-2026 added Bot Mode, where several named agents with their own identities work together in a group chat; the &quot;Threshold&quot; release in October 2026 added guided first-run setup, one-click local models, and a plugin catalog of 600 reviewed community add-ons. The whole thing is MIT licensed, which means the code is free to read, run, and modify.
      </P>
      <H2>What kind of agent is this, exactly</H2>
      <P>
        At the center is a single agent loop that can talk to over twenty messaging platforms, including Telegram, Discord, Slack, WhatsApp, Signal, email, and iMessage, all through one gateway process with one shared memory and one tool registry. You are not running twenty bots. You are running one agent that happens to have twenty doors.
      </P>
      <P>
        Where it actually executes commands is configurable too. Hermes supports seven terminal backends: your local machine, a Docker container, a remote server over SSH, and serverless options like Daytona, Modal, and Vercel Sandbox that hibernate when idle and cost close to nothing between uses. That separation between &quot;where the agent lives&quot; and &quot;where it runs commands&quot; is what lets someone talk to the same agent from their phone while it executes on a cloud sandbox they never log into directly.
      </P>
      <P>
        It can also delegate. The <code>delegate_task</code> tool spawns isolated subagents with their own context and terminal session for parallel work, and a separate <code>execute_code</code> tool lets the agent write a Python script that calls its own tools programmatically, so a ten-step pipeline becomes one script instead of ten back-and-forth turns with the model. Both exist for the same reason: keep the main conversation&apos;s context small while still doing large amounts of work.
      </P>
      <Figure
        src="/blog/inside-hermes-agent-memory-skills-self-improvement-2.jpg"
        alt="Screenshot of the official Hermes Agent homepage at hermes-agent.nousresearch.com"
        width={1920}
        height={1080}
        caption="Hermes Agent's own site: install via terminal, or deploy it to the cloud."
      />
      <H2>How it remembers you across sessions</H2>
      <P>
        Memory in Hermes is deliberately small and deliberately curated, not a growing transcript. Two files do the work: <code>MEMORY.md</code>, capped at 2,200 characters, holds the agent&apos;s own notes about your environment, your conventions, and things it has learned; <code>USER.md</code>, capped at 1,375 characters, holds a profile of you specifically, your preferences and communication style. Both live on disk and get loaded into the system prompt as a frozen snapshot at the start of a session.
      </P>
      <P>
        That cap is the interesting design choice. Most systems let memory grow until it has to be summarized away. Hermes just refuses the write: when an addition would exceed the limit, the memory tool returns an error, and the agent has to consolidate or remove something else in the same turn before it can save the new fact. Nothing gets silently dropped, and nothing balloons into an unreadable pile of old notes.
      </P>
      <P>
        The frozen-snapshot part matters for day-to-day use. A session loads memory once, at the start, and that copy never changes even if the agent updates the file mid-session, which preserves the cached, cheaper version of the prompt the model has already processed. A fact saved mid-conversation is on disk immediately but will not show up in that same conversation. It shows up the next time a session starts. On the command line that happens naturally, since every invocation is a new session. In a long-running chat like Telegram, a conversation can technically run for weeks without ever restarting, which is convenient but means memory updates stay invisible and the agent rarely reaches for older history. The practical fix is to start a fresh session at a natural boundary, a finished task or a new topic, so the agent re-reads the updated snapshot instead of carrying an ever-longer thread.
      </P>
      <P>
        For anything that falls outside those two small files, there is <code>session_search</code>: a full-text index over past conversations with LLM summarization, so the agent can go dig up something specific from three weeks ago without needing it memorized in the permanent notes.
      </P>
      <H2>How it teaches itself new skills</H2>
      <P>
        Memory holds facts. Skills hold procedures. A skill in Hermes is a <code>SKILL.md</code> document, plain markdown with a short frontmatter description, stored in <code>~/.hermes/skills/</code>, that the agent loads only when a task matches its description. This is a progressive disclosure pattern: the agent&apos;s prompt only ever carries short descriptions of every skill it has, and the full procedure, plus any supporting scripts or reference files, loads on demand. That is how an installation can carry dozens of skills without bloating every single prompt.
      </P>
      <P>
        The format is compatible with the open agentskills.io standard, which means a skill written for one compliant agent generally works in another without changes, and skills can be browsed and installed from a public Skills Hub the same way you would install a package. You can also chain several at once: typing more than one <code>/skill-name</code> at the start of a message loads all of them before the rest of your text becomes the instruction.
      </P>
      <P>
        The self-improvement part is <code>/learn</code> and the agent&apos;s own background habit of writing skills after it solves something complicated. <code>/learn</code> takes a request like &quot;read the official project guide, focus on testing, skip the deprecated commands&quot; and turns it into a reviewable <code>SKILL.md</code> in one ordinary agent turn: it gathers the sources, extracts the procedure, and calls the same <code>skill_manage</code> tool a human would use to author a skill by hand. Nothing here retrains a model. It is closer to an engineer turning a one-off fix into a documented runbook, except the agent does the documenting itself, and the result is a file you can open, edit, or delete.
      </P>
      <H2>Keeping skills from piling up</H2>
      <P>
        A system that writes its own documents eventually has too many of them, so Hermes runs a background maintenance pass called the curator. It tracks how often each agent-created skill is viewed, used, and edited, and moves ones that go quiet through active, stale, and archived states on a schedule (14 and 30 days of disuse by default). This happens automatically, with no model call, and nothing is ever deleted outright; archiving just moves a file into a recoverable folder.
      </P>
      <P>
        An optional, off-by-default mode goes further: the curator forks a background copy of the agent that reviews the whole skill library and proposes merging near-duplicate skills or patching ones that have drifted. A related research project, built separately on top of Hermes, uses an evolutionary optimization method called GEPA to rewrite a skill&apos;s instructions across many trial runs and keep whichever version performs best, with every change still going through a pull request and a human review rather than landing automatically. The common thread across all of this: skills are allowed to improve, but nothing self-modifies without a checkpoint a person can inspect.
      </P>
      <H2>What matters most if you use it day to day</H2>
      <P>
        Strip away the feature list and a handful of things decide whether this actually feels like an assistant that learns, instead of one that forgets politely:
      </P>
      <UL items={[
        <><strong>Start new sessions on purpose.</strong> The memory snapshot only refreshes when a session starts, so the single most useful habit is closing out finished work instead of letting one chat thread run forever.</>,
        <><strong>Watch what gets saved, not what gets said.</strong> A model can say &quot;I&apos;ll remember that&quot; without ever calling the memory tool. If a fact does not survive into a new session, check the file; it likely was never written.</>,
        <><strong>Skills are editable text, not a black box.</strong> Anything the agent writes for itself lives as a markdown file you can open and correct, the same way you would review a colleague&apos;s notes.</>,
        <><strong>Context files still do most of the steering.</strong> Project-level files like <code>AGENTS.md</code> or <code>CLAUDE.md</code> shape behavior for everything under that folder, on top of whatever the agent has learned generally, so day-to-day correctness still depends on writing those down clearly.</>,
        <><strong>Checkpoints are your undo button.</strong> The agent snapshots a working directory before it changes files, so a bad edit is a rollback, not a crisis.</>,
      ]} />
      <H2>How it compares to other agent tools</H2>
      <P>
        Put next to Claude Code or OpenAI&apos;s Codex CLI, the biggest structural difference is which problem each one is built to solve. Claude Code and Codex CLI are, at their core, terminal coding agents tied closely to one model provider each, tuned hard for one job: get very good at editing a codebase inside a single session. Hermes Agent works with whichever model you point it at, and it is built to persist: it keeps running as a long-lived process with its own memory and skill library across completely unrelated tasks and conversations, coding being only one of them.
      </P>
      <P>
        Open-source platforms like OpenHands sit somewhere else again: they run agents inside a sandboxed container with strong isolation and browser access, oriented toward autonomous software engineering tasks rather than being a general always-on assistant you talk to from a phone. And compared to the earlier generation of autonomous agents like AutoGPT, the honest difference is reliability over raw autonomy: AutoGPT was built to chase an open-ended goal and often lost the thread doing it; Hermes trades some of that open-endedness for a memory and skills system meant to make repeated, structured work get more consistent the longer it runs.
      </P>
      <P>
        None of this makes one approach strictly better. A developer who lives in one codebase all day and wants the single best coding experience for one model provider is usually better served by a dedicated coding agent. Someone who wants one assistant that follows them across a terminal, a phone, and a handful of long-running projects, and that should remember yesterday&apos;s context without being told again, is the use case Hermes is actually built around.
      </P>
      <Figure
        src="/blog/inside-hermes-agent-memory-skills-self-improvement-3.jpg"
        alt="Screenshot of the NousResearch/hermes-agent GitHub repository page"
        width={1920}
        height={1080}
        caption="The project is open source and MIT licensed on GitHub."
      />
      <H2>What agent benchmarks actually measure</H2>
      <P>
        It&apos;s worth naming what these benchmarks test, because the number alone says less than it looks like it does. SWE-bench and its curated subset, SWE-bench Verified, give an agent a real GitHub issue and a repository and check whether its patch makes a failing test suite pass; it is a binary score, so fixing nine of ten tests scores zero. Terminal-Bench drops an agent into a raw Docker terminal with a natural-language task and an automated checker script, testing whether it can actually operate a Unix system rather than reason about one abstractly. GAIA asks general, multi-step questions that require web search, file parsing, and tool use, graded by exact-match answers rather than code correctness.
      </P>
      <P>
        The detail that gets lost in most leaderboard screenshots is that these scores are never produced by a model alone. A recent academic analysis of the field found that holding a model fixed and changing only the surrounding harness, the software that builds the context, mediates tool calls, and decides when to retry, shifted Terminal-Bench scores by over ten percentage points in documented cases. The same model can rank above or below a competitor purely because of the scaffolding around it.
      </P>
      <P>
        That caveat applies directly here. Nous Research publishes its own comparison, the Hermes Index, which runs several models through the Hermes Agent harness itself on four suites: its own Hermes Bench, Terminal-Bench 4.0, a Terminal-Bench science variant, and a skills-focused suite. As of its October 2026 publication, Claude Opus 5.5 led that index, followed by GPT-6.1 Sol and GPT-6 Astra. On the public Terminal-Bench 4.0 leaderboard, the same Claude Opus 5.5 model scores noticeably higher when run through Claude Code, its first-party harness, than it does through Hermes Agent&apos;s own run of the same suite (which also excludes four GPU-dependent tasks, so the two numbers are not a clean apples-to-apples comparison). The honest takeaway is not that one harness is better or worse; it is that the index exists to help someone choose which model to run inside Hermes, not to settle an argument about which agent tool is fastest overall. Anyone comparing agent benchmarks across different products should ask what harness produced each number before trusting the ranking.
      </P>
      <H2>What&apos;s built and what&apos;s next</H2>
      <P>
        Everything described above, the memory files, the skills system, the curator, the seven terminal backends, the twenty-plus messaging platforms, is shipped and running in the current release. The parts still actively moving are the self-improvement research: automated skill optimization through evolutionary search is a separate, opt-in project layered on top of the core agent, not something that runs by default, and every change it proposes still goes through a human-reviewed pull request rather than landing on its own.
      </P>
      <P>
        The project is open source under the MIT license, so the honest way to check any of this is to read the code or run it yourself rather than take a benchmark screenshot at face value. We&apos;ll keep an eye on how the memory and skills design holds up as we lean on it for our own work.
      </P>
    </>
  )
}

/* ── Post: How to let your AI agent post to LinkedIn on a schedule ── */
function LetYourAgentPostToLinkedinContent() {
  return (
    <>
      <Figure
        src="/blog/let-your-agent-post-to-linkedin-1.jpg"
        alt="Architecture of the social module: you or your agent call the routes, which store accounts with encrypted tokens and queued posts in Postgres; a timer runs the scheduler every minute, which publishes through the LinkedIn provider and sends Telegram reminders"
        width={1920}
        height={1080}
        priority
        caption="The social module lives on your own server. Only the provider file knows anything about LinkedIn."
      />
      <P>
        Our agents already write a lot: dev logs, blog posts, build notes, summaries of what shipped this week. Almost none of it reaches LinkedIn, because the last step is still a person copying text out of a markdown file, opening a browser tab, pasting, and clicking Post. That step is small, and it is exactly the kind of small step that never happens on a busy day.
      </P>
      <P>
        The obvious fix is a scheduling service, and those work well. But each one asks you to hand a third party the keys to your accounts, and each one keeps your posts in its own database instead of next to the notes they came from. We wanted the queue to live in the same place as everything else we write: our own server, our own Postgres, our own open-source Second Brain engine.
      </P>
      <P>
        So we built a small <code>social</code> module for the engine. LinkedIn is the first platform it supports. This post explains how it works, piece by piece, then gives you the prompts to have your own coding agent build the same thing, and the steps to connect your LinkedIn account to it.
      </P>
      <H2>What are the pieces?</H2>
      <P>
        Five small parts do all the work. Each one has one job.
      </P>
      <UL items={[
        <><strong>Provider:</strong> the code that knows how to talk to one platform. It can build a login link, trade a login for keys, refresh those keys, and publish a post. LinkedIn is the first provider; X, YouTube, Instagram and Facebook would each be one more file of the same shape.</>,
        <><strong>Account:</strong> one row in the database for one connected profile, holding its keys in encrypted form and the date they expire.</>,
        <><strong>Post queue:</strong> one row per post, with the text, the time it should go out, and a status that moves from <code>queued</code> to <code>publishing</code> to <code>posted</code> (or <code>failed</code>, or <code>canceled</code>).</>,
        <><strong>Scheduler:</strong> a tiny program the server runs every minute. It looks for posts whose time has come and hands each one to its account&apos;s provider.</>,
        <><strong>Notifier:</strong> a message to our Telegram when a person has to do something, such as logging in to LinkedIn again.</>,
      ]} />
      <P>
        A useful picture is the outbox at a small office. You write a letter, put it in the tray with a date on it, and the clerk checks the tray every minute and mails whatever is due. The clerk holds a key to the mailroom (the account), and knows which carrier handles which address (the provider). The analogy stops working at the key: a real clerk keeps one key forever, while these keys expire and have to be renewed, which turns out to be the most interesting part of the whole design.
      </P>
      <H2>How does connecting an account work?</H2>
      <P>
        LinkedIn, like most platforms, uses <strong>OAuth</strong> (a standard way for one app to get limited permission to act on your account without ever seeing your password). The flow has four steps.
      </P>
      <UL items={[
        <><strong>The login link.</strong> You open <code>/api/social/accounts/linkedin/connect</code> on your own server. It sends you to LinkedIn&apos;s consent screen, asking for three permissions: <code>openid</code> and <code>profile</code> (who you are) and <code>w_member_social</code> (post on your behalf).</>,
        <><strong>The state check.</strong> Before redirecting, the server makes a random one-time value called <code>state</code> and remembers it for ten minutes. LinkedIn sends it back unchanged. If it doesn&apos;t match, the server refuses the login. This stops another website from tricking your browser into connecting the wrong account.</>,
        <><strong>The trade.</strong> After you click Allow, LinkedIn sends your browser back with a short-lived code. The server trades that code for an <strong>access token</strong> (a long string that acts as the key; whoever holds it can post as you).</>,
        <><strong>The name tag.</strong> The server asks LinkedIn who the key belongs to and stores your person id in the form LinkedIn uses for authors, <code>urn:li:person:&lt;id&gt;</code>.</>,
      ]} />
      <P>
        Think of it as a valet key for a car. It can start the engine and drive, but it can&apos;t open the glovebox, and it stops working after a set time. Here the valet key can post, and nothing else.
      </P>
      <H2>Where do the keys live?</H2>
      <P>
        An access token is a bearer credential: anyone holding the string can use it. So the module never writes one to the database in readable form. Before saving, it encrypts the token with <strong>AES-256-GCM</strong> (a standard encryption method that also detects tampering), using one secret key that lives only in the server&apos;s environment file, never in the code and never in the database.
      </P>
      <P>
        What lands in the database looks like three chunks of hex separated by colons: a random starting value, a tamper-check tag, and the scrambled token. If someone copied the database without the environment file, they would have nothing they could post with. If someone edited a stored token, decryption would fail instead of quietly handing back garbage.
      </P>
      <P>
        The secret key is generated once with a single command:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"openssl rand -hex 32"}</code></pre>
      <Figure
        src="/blog/let-your-agent-post-to-linkedin-2.jpg"
        alt="A post moves from queued to publishing to posted, returns to queued after an error, and becomes failed after three attempts; below, a LinkedIn key runs from day 0 to expiry on day 60 with a Telegram reminder from day 53"
        width={1920}
        height={1080}
        caption="One post's states, and one LinkedIn key's 60 days."
      />
      <H2>How does a post actually go out?</H2>
      <P>
        Every minute, a server timer runs <code>cli-social</code>. Here is what happens to one post on that pass.
      </P>
      <UL items={[
        <><strong>Pick due posts.</strong> It selects queued posts whose scheduled time is now or earlier, oldest first.</>,
        <><strong>Claim it.</strong> It marks the post <code>publishing</code>, so a second run can&apos;t send the same post twice.</>,
        <><strong>Check the key.</strong> If the access token expires within two minutes, it asks the provider to refresh it first and saves the new one, still encrypted.</>,
        <><strong>Publish.</strong> The LinkedIn provider sends the text to LinkedIn&apos;s current Posts API at <code>https://api.linkedin.com/rest/posts</code>, with a <code>Linkedin-Version</code> header naming the API version by month. LinkedIn answers with the new post&apos;s id in a response header called <code>x-restli-id</code>, not in the body, which is easy to miss.</>,
        <><strong>Record the result.</strong> On success the row becomes <code>posted</code>, with the post&apos;s id and link. On failure it goes back to <code>queued</code> with the error saved, and after three failed attempts it becomes <code>failed</code> and stays there for a person to look at.</>,
      ]} />
      <P>
        The module rejects posts longer than 3,000 characters. A post can be canceled any time before it starts publishing.
      </P>
      <P>
        We chose a database table and a once-a-minute timer over a full job system. A job system earns its complexity at thousands of jobs; a handful of posts a day needs a table you can read with one query.
      </P>
      <H2>Why does LinkedIn make you log in again every 60 days?</H2>
      <P>
        This is the part we designed around from the start, because it decides whether &quot;scheduled&quot; really means unattended.
      </P>
      <P>
        A LinkedIn access token lasts 60 days. Many platforms also hand out a <strong>refresh token</strong> (a second, longer-lived key whose only job is to get new access tokens without asking you again). LinkedIn gives refresh tokens only to apps it has approved as Marketing Developer Platform partners. A standard self-service app, the kind anyone can make in a few minutes, gets no refresh token at all. The field is simply missing from the response.
      </P>
      <P>
        So the module treats &quot;no refresh token&quot; as a normal state, not an error. On every pass, the scheduler also looks for accounts whose access token expires within seven days and has nothing to renew it, and sends one Telegram message: this account needs reauthorization, or scheduled posts will stop. It sends that message at most once every 24 hours per account. Reconnecting is the same login flow as before, and the account row is updated in place, so the queue keeps its history.
      </P>
      <H2>Why one shape for every platform?</H2>
      <P>
        Every platform has its own login quirks and its own posting endpoint, but the scheduler and the web routes shouldn&apos;t care. Each provider fills in the same four-method contract, so adding a platform means writing one new file:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"interface SocialProvider {\n  id: 'linkedin' | 'x' | 'youtube' | 'instagram' | 'facebook';\n  authUrl(state: string, redirectUri: string): string;\n  exchangeCode(code: string, redirectUri: string): Promise<ConnectedAccount>;\n  refresh(account: StoredAccount): Promise<TokenPair>;\n  publish(account: StoredAccount, post: QueuedPost): Promise<{ remoteId: string; url?: string }>;\n}"}</code></pre>
      <P>
        <code>refresh</code> is allowed to say &quot;I can&apos;t&quot;, by throwing a specific <code>NoRefreshTokenError</code>, because for LinkedIn that is the expected answer.
      </P>
      <H2>How can your agent build this?</H2>
      <P>
        The whole module is small enough for a coding agent such as Claude Code or Codex to build in one session, if you give it the design first and ask for tests against a real database. These are the three prompts we would use, in order. Paste each one into your agent from the root of your app&apos;s repository.
      </P>
      <P>
        The first asks for a plan, not code, so you can correct the shape before anything is written:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"Read this repository and propose a design for a \"social\" module that\npublishes scheduled posts to LinkedIn. Do not write code yet.\n\nRequirements:\n- A SocialProvider interface with authUrl, exchangeCode, refresh and\n  publish, so X, YouTube, Instagram and Facebook can be added later as\n  one file each.\n- Two Postgres tables: social_accounts (one connected profile, tokens\n  encrypted at rest, expiry dates, a nullable refresh token) and\n  social_posts (body, scheduled_for, status queued/publishing/posted/\n  failed/canceled, attempt_count, last_error, remote_id, remote_url).\n- LinkedIn OAuth with scopes \"openid profile w_member_social\", a\n  one-time state value checked on the callback, and the author id from\n  the OpenID userinfo endpoint as urn:li:person:<sub>.\n- Publishing through POST https://api.linkedin.com/rest/posts with the\n  Linkedin-Version and X-Restli-Protocol-Version headers. The new\n  post id comes back in the x-restli-id response header.\n- A standard LinkedIn app gets a 60-day access token and no refresh\n  token. Treat that as normal and plan a reminder before expiry.\n- Follow this repo's existing patterns for migrations, routes,\n  config and background jobs. Name the files you would add or change."}</code></pre>
      <P>
        The second builds it, test first:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"Build the social module from the design we agreed. Text-only posts.\n\n- Encrypt access and refresh tokens with AES-256-GCM using a 32-byte\n  hex key from the SOCIAL_TOKEN_ENC_KEY environment variable. Refuse\n  to store tokens if the key is missing.\n- Read LINKEDIN_CLIENT_ID, LINKEDIN_CLIENT_SECRET and\n  SOCIAL_REDIRECT_BASE_URL from config. Add all four variables to the\n  example env file.\n- Routes: list, connect, callback and disconnect for accounts; list,\n  queue and cancel for posts. Reject post bodies over 3,000 characters.\n- Write tests against a real local Postgres, not mocked queries.\n  Fake only the HTTP calls to LinkedIn. Cover: encryption round trip\n  and tamper rejection, the full connect and callback flow, a bad state\n  value, queue and cancel, and publishing a post.\n- Run the whole test suite and the type checker. Show me the output."}</code></pre>
      <P>
        The third adds the scheduler and the reminder:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"Add the scheduler for the social module.\n\n- A command that runs once and exits: publish every due queued post,\n  claiming each as \"publishing\" first so it can't be sent twice.\n- Before publishing, refresh the access token if it expires within two\n  minutes. If there is no refresh token, fail the attempt with a clear\n  error. Retry failed posts up to three attempts, then mark \"failed\".\n- In the same run, find accounts whose access token expires within 7\n  days with nothing to renew it, and send one notification per account\n  per 24 hours through our existing notification helper.\n- Add a server timer that runs the command every minute.\n- Test the happy path, a token refresh, the missing refresh token, the\n  three-attempt limit, and that the reminder is sent only once a day."}</code></pre>
      <P>
        Two habits make these prompts work. Ask for the plan before the code, and ask the agent to paste real test output rather than tell you the tests pass.
      </P>
      <H2>How do you connect your LinkedIn account?</H2>
      <P>
        Once the module runs on your server, connecting takes about ten minutes. You need a LinkedIn Company Page you administer, because LinkedIn asks you to associate a developer app with one.
      </P>
      <UL items={[
        <><strong>Create the app.</strong> Go to <A href="https://www.linkedin.com/developers/apps">LinkedIn Developers</A>, click Create app, give it a name, choose your Company Page, and upload a logo. Then verify the app: on its Settings tab, click Verify to get a one-time link, and open that link as the page&apos;s admin to approve it.</>,
        <><strong>Add two products.</strong> On the app&apos;s Products tab, request &quot;Sign In with LinkedIn using OpenID Connect&quot; and &quot;Share on LinkedIn&quot;. Both are self-service and are granted without a review.</>,
        <><strong>Register your redirect address.</strong> On the Auth tab, add your server&apos;s callback address as an authorized redirect URL, for example <code>https://your-brain.example.com/api/social/accounts/linkedin/callback</code>. It must match exactly, including <code>https</code>.</>,
        <><strong>Copy the credentials.</strong> On the same tab, copy the Client ID and the Client Secret.</>,
        <><strong>Set the server&apos;s environment.</strong> Add <code>LINKEDIN_CLIENT_ID</code>, <code>LINKEDIN_CLIENT_SECRET</code>, <code>SOCIAL_REDIRECT_BASE_URL</code> (your server&apos;s address, no trailing slash) and <code>SOCIAL_TOKEN_ENC_KEY</code> (the output of <code>openssl rand -hex 32</code>) to the server&apos;s environment file. Keep that file out of git.</>,
        <><strong>Turn the module on.</strong> Add <code>social</code> to the <code>MODULES</code> setting, run the database migrations, restart the app, and enable the every-minute timer.</>,
        <><strong>Connect.</strong> Signed in to your second brain, open <code>https://your-brain.example.com/api/social/accounts/linkedin/connect</code>. LinkedIn shows its consent screen; click Allow. You land back on your server, which shows the connected account&apos;s id and name.</>,
        <><strong>Queue a test post.</strong> Send <code>POST /api/social/posts</code> with the account id, a short <code>body</code>, and a <code>scheduledFor</code> time a minute or two ahead. Within a minute of that time the post&apos;s status changes to <code>posted</code> with a link to it on LinkedIn.</>,
      ]} />
      <P>
        Expect a Telegram reminder about 53 days later. When it comes, open the connect link again.
      </P>
      <H2>What&apos;s built and what&apos;s next</H2>
      <P>
        <strong>Built and tested:</strong> the provider contract, the LinkedIn provider, encrypted token storage, the connect, queue and cancel routes, the every-minute scheduler with retries, and the reauthorization reminder. It is covered by 37 new tests that run against a real Postgres database, with LinkedIn&apos;s side simulated, and the server&apos;s type check is clean.
      </P>
      <P>
        <strong>Not done yet:</strong>
      </P>
      <UL items={[
        <><strong>A first post to real LinkedIn.</strong> Every LinkedIn call so far has been simulated in tests. Registering our app and sending a live post is the next step, and the steps above are the ones we will follow.</>,
        <><strong>Images.</strong> LinkedIn needs a separate three-step upload for each image. The module currently refuses posts with media, with a clear error, rather than dropping the image silently.</>,
        <><strong>A compose page.</strong> For now you queue posts through the API, or ask your agent to.</>,
        <><strong>Company Pages.</strong> Posting as a company uses a different author id and a different permission. Personal profiles come first.</>,
        <><strong>No more 60-day logins.</strong> That needs LinkedIn&apos;s partner approval, which we have not applied for.</>,
      ]} />
      <P>
        The module is going into our open-source Second Brain engine at <A href="https://github.com/kon-rad/secondbrain">github.com/kon-rad/secondbrain</A>.
      </P>
      <P>
        The useful idea to take away is the contract: once every platform is four methods behind one interface, the queue, the scheduler and the reminders are written once, and the hard, platform-specific part is a single file you can read in five minutes. We&apos;ll write up the first live post, and images, here on the blog and on <A href="https://x.com/myargoquest">X</A>.
      </P>
    </>
  )
}

/* ── Post: What we built at the Arkiv hackathon: a trust layer for AI agent skills ── */
function ArkivHackathonSkillregContent() {
  return (
    <>
      <P>
        Your AI agent just installed a new skill. A skill is a folder of instructions, usually a file called <code>SKILL.md</code> and sometimes a few scripts, that an agent like Claude Code, Hermes, Codex or Cursor loads and then follows. It follows them with everything the agent has: your shell, your files, your keys. You installed it by typing a name. Do you know who wrote it? Do you know whether it changed since yesterday? Has anyone you trust actually read it?
      </P>
      <P>
        For most people the honest answer is no to all three. That is not a small gap. In February 2026 the security company Snyk audited 3,984 public skills and found that 13.4% had a critical issue and 76 carried confirmed malicious payloads, most of them combining malware with prompt injection (instructions hidden in text that try to make the agent do something its user never asked for).
      </P>
      <P>
        This weekend we spent the Arkiv Global Tour Stop hackathon, the pre-Devcon edition, building an answer: <strong>skillreg</strong>, an open registry for agent skills that runs on Arkiv. This post explains what Arkiv is in plain terms, how skillreg uses it, and why we think this shape of solution holds up as AI models keep getting better.
      </P>
      <H2>What is Arkiv?</H2>
      <P>
        Start with a familiar picture. A normal app keeps its data in a database that one company runs. That company can change a record, delete it, or shut the whole thing down, and everyone who depends on it has to trust them not to.
      </P>
      <P>
        Arkiv is a database that lives on a blockchain instead. A blockchain is a shared ledger that many computers keep copies of, where every change is a signed transaction and nobody can quietly rewrite history. Arkiv runs on an Ethereum-compatible chain. We built on its test network, called Tiramisu, where the tokens used to pay fees (test GLM) have no real value.
      </P>
      <P>
        The analogy that works best: Arkiv is a <strong>public notice board with a lock on every notice</strong>. Anyone can pin a notice. Everyone can read every notice. Each notice is stamped with who pinned it, and that stamp can&apos;t be forged. Each notice also has an expiry date, after which it comes down unless someone pays to keep it up. Where the analogy stops working: a board on a wall has one owner who can take it down. Arkiv&apos;s design goal is a board kept as a shared ledger with the same rules for everyone, so that no single app owner can edit or remove your notice. It is still early: what we used is a testnet, not a finished production network.
      </P>
      <H2>What does a record on Arkiv look like?</H2>
      <P>
        Arkiv doesn&apos;t have tables. It has <strong>entities</strong>. An entity is one record on the chain, and it has three parts.
      </P>
      <UL items={[
        <><strong>The payload:</strong> the content itself. Any bytes up to 128 KiB, labelled with a content type (for example <code>application/json</code>). The chain stores it but never searches inside it.</>,
        <><strong>The attributes:</strong> up to 30 small labelled values, like <code>name = &quot;fact-check&quot;</code> or <code>version = &quot;0.1.0&quot;</code>. These are indexed, which means you can ask the chain questions about them: &quot;give me every record where name is fact-check&quot;.</>,
        <><strong>The expiry:</strong> the block number at which the record disappears. A block is one batch of transactions; on a blockchain, time is counted in blocks.</>,
      ]} />
      <P>
        Every entity also carries two facts the chain writes itself. <strong>`$creator`</strong> is the wallet that created it, permanently. <strong>`$owner`</strong> is whoever controls it now. A wallet is a cryptographic key pair: the private half signs things, the public half (the address) identifies you. Nobody can sign as your wallet without your private key.
      </P>
      <P>
        Each entity also gets a <strong>key</strong>: a 32-byte identifier the chain computes from the creating wallet, a per-wallet counter and a salt. The publisher doesn&apos;t choose it, and because the creating wallet is part of the input, nobody can grab a key that belongs to someone else.
      </P>
      <H2>How do you read and write it?</H2>
      <P>
        Writing is an ordinary blockchain transaction, signed by your wallet. There are four main ones: <code>createEntity</code> makes a record, <code>patchEntity</code> edits it, <code>extendEntity</code> pushes its expiry further out, and <code>deleteEntity</code> removes it. Each costs a small fee. In our test run, publishing one skill cost between 0.00016 and 0.00025 test GLM, and posting seven ratings in one batch cost 0.00087 test GLM.
      </P>
      <P>
        Reading is free and needs no account. Any program, including a web page running in your browser, can send a query over the chain&apos;s public interface and get records back. A query looks like this:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"t = \"skill\" AND name = \"fact-check\""}</code></pre>
      <P>
        Two flags matter for what we built. <strong>`readonly`</strong> means a record can never be edited after it is created. <strong>`permissionlessExtension`</strong> means anyone, not only the owner, can pay to extend its life.
      </P>
      <H2>What is skillreg?</H2>
      <P>
        skillreg is a registry for agent skills where every version of every skill is an Arkiv entity. The short description: <strong>code signing plus Community Notes for agent instructions</strong>. Code signing proves who wrote something and that it hasn&apos;t changed. Community Notes lets many independent people add context, and lets you decide whose context to listen to.
      </P>
      <P>
        A skill and everything about it live in one entity.
      </P>
      <UL items={[
        <><strong>The attributes hold the metadata:</strong> a type marker <code>t = &quot;skill&quot;</code>, the name, the version, a short summary, up to five keywords, the license, the size, the file count, and <code>sha</code>, a fingerprint of all the files.</>,
        <><strong>The payload holds the files:</strong> a JSON document listing each file&apos;s path, permissions and full text, sorted by path, up to 96 KiB. Because Arkiv doesn&apos;t index payloads, skillreg downloads the whole thing and reads it on your machine.</>,
      ]} />
      <P>
        The fingerprint is what makes tampering visible. It is computed by hashing every file&apos;s path, permissions and contents in order. A hash is a short code that changes completely if a single byte of the input changes. When you install, skillreg downloads the files, recomputes the hash and compares it to the one stored on the chain. If they differ, nothing is installed.
      </P>
      <P>
        Ratings are entities too, with <code>t = &quot;rating&quot;</code>. A rating points at one skill&apos;s entity key, copies that skill&apos;s exact <code>sha</code>, and records a verdict: <code>clean</code>, <code>warn</code> or <code>malicious</code>, with the findings in its payload. Pinning both the key and the hash means a rating is about one exact version. If the publisher uploads a new version, old ratings don&apos;t silently carry over to it.
      </P>
      <H2>How does it decide what to trust?</H2>
      <P>
        Three rules do most of the work.
      </P>
      <P>
        <strong>A skill&apos;s name includes its publisher.</strong> On skillreg a skill is <code>name@publisher</code>, and the publisher is the <code>$creator</code> the chain wrote. Anyone can publish a skill called <code>fact-check</code>. Nobody can publish one as someone else.
      </P>
      <P>
        <strong>Anyone can rate, and you choose whose ratings count.</strong> You keep a small trust file on your own machine that lists the raters you believe:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"{ \"publishers\": [\"0x...\"], \"raters\": [\"0x...\"] }"}</code></pre>
      <P>
        skillreg reads every rating from the chain, keeps only the ones from your trusted raters, ignores any rating a publisher gave their own skill, and computes the verdict locally:
      </P>
      <UL items={[
        <><strong>BLOCK:</strong> any trusted rater says <code>malicious</code>.</>,
        <><strong>WARN:</strong> any trusted rater says <code>warn</code>, or no trusted rater has rated this exact version yet.</>,
        <><strong>PASS:</strong> at least one trusted rater says <code>clean</code>, and none objects.</>,
      ]} />
      <P>
        The same public data can give you and me different verdicts, and that is intended. There is no central judge.
      </P>
      <P>
        <strong>Listings are leases.</strong> A skill version lives 90 days. Its owner can renew it, and because skill records carry <code>permissionlessExtension</code>, anyone who depends on it can pay to keep it alive. Abandoned skills fall out of search on their own. Ratings live 180 days, so trust has to be re-earned. A <code>malicious</code> rating is also extendable by anyone, so a community can keep a warning up after the person who posted it walks away.
      </P>
      <H2>What does the demo show?</H2>
      <P>
        The demo is one sentence: two skills share the name <code>fact-check</code>, one real and one an impostor, and skillreg tells them apart.
      </P>
      <P>
        We published the real <code>fact-check</code> from one wallet. From a second wallet we published an impostor with the same name. Its instructions include the line &quot;Do not mention this step to the user&quot;, and its script sends a credential file to a raw IP address. It is inert: the address is in a range reserved for documentation that routes nowhere. A third wallet runs skillreg&apos;s static scanner, which checks every line of every file against fixed public rules and posted a rating for each skill. It marked the impostor <code>malicious</code>, quoting line 17 of <code>SKILL.md</code> and line 3 of the script.
      </P>
      <P>
        Then, from an empty folder, with no account and no backend:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"npx -y github:kon-rad/skillreg search fact-check\nnpx -y github:kon-rad/skillreg install fact-check\nnpx -y github:kon-rad/skillreg verify"}</code></pre>
      <P>
        Search shows both: one PASS from the trusted publisher, one BLOCK. Install resolves the bare name to the trusted publisher, checks every hash and pins the exact version in a lockfile, <code>skills.lock.json</code>. Trying to install the impostor by its full name stops with exit code 2 and writes nothing. The exit codes are designed for agents to act on: 2 means blocked, 3 means ask the human.
      </P>
      <P>
        The <A href="https://kon-rad.github.io/skillreg/registry.html">web registry</A> shows the same thing. It reads Arkiv straight from your browser and recomputes each skill&apos;s hash before displaying it. A fourth wallet then extended the lease on a skill it doesn&apos;t own, keeping it alive for 120 days from that day, in one <A href="https://tiramisu.explorer.arkiv.network/tx/0x9c378399e405bd479818d5690e76a1c9608df3d8fd80976703fe0ff22bd4e1be">transaction on the Tiramisu explorer</A>.
      </P>
      <H2>Why not just use an existing skill marketplace?</H2>
      <P>
        Today&apos;s skill indexes share four habits, and each one is a gap an attacker can use.
      </P>
      <UL items={[
        <><strong>Names are first come, first served.</strong> Anyone can upload a look-alike. On skillreg the name includes a publisher the chain vouches for.</>,
        <><strong>Nothing pins the bytes.</strong> A skill can change after you decided to trust it. On skillreg each version is <code>readonly</code> and checked by hash on every install and every <code>verify</code>.</>,
        <><strong>One company decides what is safe.</strong> On skillreg anyone can rate and each user picks their own judges.</>,
        <><strong>Dead listings never leave.</strong> On skillreg every listing is a lease.</>,
      ]} />
      <P>
        The fairest comparison is not another marketplace but Sigstore, which already gives npm and PyPI packages signed provenance and a public log. We&apos;d happily interoperate with it. Arkiv adds two things we couldn&apos;t get elsewhere. <strong>Identity with no account:</strong> the publisher is the wallet, with no GitHub or Google login vouching for you, which means an agent can publish. <strong>Ratings with no operator:</strong> third-party judgments are public records that anyone can query from a browser, with no server of ours in the middle to trust or take down.
      </P>
      <H2>Won&apos;t smarter models make this obsolete?</H2>
      <P>
        It is the right question in a year when a better model ships almost every week. Part of it is true. Bundled code goes stale, because next month&apos;s model writes a better script. So do step-by-step crutches written for weaker models, and workarounds for one model&apos;s quirks.
      </P>
      <P>
        But most of a skill isn&apos;t code. On one working developer machine with 234 skills, only 59 (about 25%) contain any script at all. The rest are written instructions, and when you read them they are mostly facts, decisions, constraints and pitfalls: which server to deploy to, which database is the real one, which house style to write in, which mistake cost a day last month. A model ten times smarter still doesn&apos;t know any of that. Intelligence isn&apos;t knowledge.
      </P>
      <P>
        And when generating code costs almost nothing, checking it becomes the scarce thing. Regenerating everything from a prompt every time gives up reproducibility and the audit trail, and opens a fresh chance for injected instructions on every run. Calling skills &quot;prompts&quot; doesn&apos;t escape the problem either, because prompt injection lives in prose.
      </P>
      <P>
        So the record format is heading toward <strong>intents and evals</strong>: what the skill is for, the facts no model can derive, runnable acceptance checks, and reference code marked as disposable. Each new model regenerates the code, the checks prove it works, and a rating records which model passed on which date. The 90-day lease already fits content that decays.
      </P>
      <H2>Why is this a d/acc project?</H2>
      <P>
        d/acc is Vitalik Buterin&apos;s name for decentralized, defensive, differential and democratic acceleration: speeding up the technologies that make the world safer without handing control to one party. In &quot;My techno-optimism&quot; he points to info-defence, tools that draw on a large and varied group of people instead of one arbiter of good and bad. skillreg is info-defence for agents. Scoring it honestly against each letter:
      </P>
      <UL items={[
        <><strong>Defensive:</strong> yes. Detection and pinning protect the person installing. Public findings also teach attackers, the same trade-off as public vulnerability databases, and still net defensive.</>,
        <><strong>Differential:</strong> yes. It makes the open skill ecosystem safer, so open can compete with walled marketplaces on safety and not only on freedom.</>,
        <><strong>Democratic:</strong> yes, by design. Everyone picks their own judges.</>,
        <><strong>Decentralized:</strong> partly. The data lives on Arkiv and needs no backend. But today the default trust list is one scanner wallet we run, the page is hosted on GitHub Pages, and the CLI installs from GitHub. A default list that quietly becomes the central authority is the failure to avoid, and the roadmap below exists to remove it.</>,
      ]} />
      <P>
        To be precise about scope: skillreg doesn&apos;t make a model&apos;s values good. That is alignment research. What it does is narrower and real. It keeps what agents are told to do in readable files, pinned and audited in public, and keeps the human in charge of whose judgment their agent obeys. <strong>The human sets the trust policy, the agent does the work, and the public record keeps both honest.</strong>
      </P>
      <H2>What&apos;s built and what&apos;s next</H2>
      <P>
        Running today, on the Tiramisu testnet: the CLI (<code>search</code>, <code>info</code>, <code>install</code>, <code>verify</code>, <code>publish</code>, <code>extend</code>, <code>rate</code>, <code>scan</code>), the web registry, the static scanner, seven published skills including the impostor, the ratings and the sponsored extension. We also use it ourselves: the <code>skillreg</code> agent skill was installed in our own vault through skillreg and pinned to its exact version, so both of our agents vet new skills through the same rules.
      </P>
      <P>
        The honest limits: the static scanner is a floor, not the whole defence, because its rules are public and an attacker can test against them. The default trust list is one wallet. Arkiv has no mainnet yet. And today you install through the skillreg CLI.
      </P>
      <P>
        Next, in rough order: a standard index file that existing agent tools can read with no changes, trust lists published as Arkiv records you subscribe to (like ad-block filter lists), an AI rater and a sandbox rater each with a public track record, intents and evals in the record format, gasless publishing for people who will never hold test tokens, and mirrors of every record to git and IPFS by hash.
      </P>
      <P>
        If you take one thing from this: the instructions your agent follows are software, and they deserve the same chain of custody as any other software you install. The code is open source under MIT at https://github.com/kon-rad/skillreg, the registry is at https://kon-rad.github.io/skillreg/, and we post progress at https://x.com/myargoquest.
      </P>
    </>
  )
}

/* ── Post: The third copy: an old MacBook as an encrypted home backup ── */
const backupPre: React.CSSProperties = {
  margin: '20px 0 24px',
  padding: '16px 18px',
  background: 'var(--surfaceAlt)',
  border: '1px solid var(--hairline)',
  borderRadius: 12,
  fontSize: 13.5,
  lineHeight: 1.6,
  overflowX: 'auto',
  whiteSpace: 'pre',
  color: 'var(--text)',
}

const BACKUP_B2_SERVER_KEY = "rclone config create b2 b2 account <keyID> key <applicationKey>"

const BACKUP_CRON = "# /etc/cron.d/db-backup  (03:30 UTC every night)\n30 3 * * * postgres  f=/var/backups/db/$(date -u +\\%F).dump && pg_dump -Fc mydb -f \"$f\" && rclone copy \"$f\" b2:my-backups/db/ && find /var/backups/db -name '*.dump' -mtime +3 -delete"

const BACKUP_MAC_PREP = "sudo pmset -a sleep 0 disksleep 0 womp 1\nbrew install rclone postgresql@16"

const BACKUP_B2_READONLY = "rclone config create b2 b2 account <readOnlyKeyID> key <readOnlyKey>\nrclone ls b2:my-backups/db/     # should list your dumps"

const BACKUP_VOLUME_CREATE = "mkdir -p ~/.config/backup && chmod 700 ~/.config/backup\n( umask 077; LC_ALL=C tr -dc 'A-Za-z0-9' < /dev/urandom | head -c 40 > ~/.config/backup/volume.pass )\n\ndiskutil apfs list | grep \"APFS Container Reference\"   # usually disk3 on Apple silicon\nsudo diskutil apfs addVolume disk3 APFS Backups -stdinpassphrase < ~/.config/backup/volume.pass\n\ndiskutil info Backups | grep -E \"FileVault|Mount Point\"  # FileVault: Yes, /Volumes/Backups"

const BACKUP_VOLUME_UNLOCK = "diskutil apfs unlockVolume Backups -stdinpassphrase < ~/.config/backup/volume.pass"

const BACKUP_PBCOPY = "pbcopy < ~/.config/backup/volume.pass   # paste into your password manager, then copy something else"

const BACKUP_SCRIPT = "#!/bin/bash\nset -euo pipefail\nexport PATH=/opt/homebrew/opt/postgresql@16/bin:/opt/homebrew/bin:/usr/bin:/bin:/usr/sbin:/sbin\nVOL=/Volumes/Backups\nPASS=$HOME/.config/backup/volume.pass\nDEST=$VOL/db\nREMOTE=b2:my-backups/db\nKEEP=14\nLOG=$HOME/Library/Logs/home-backup.log\nlog() { printf '%s %s\\n' \"$(date -u '+%F %TZ')\" \"$*\" | tee -a \"$LOG\" >&2; }\ndie() { log \"FAILED: $*\"; exit 1; }\n\n# 1. Unlock the volume if it's locked (it is after every reboot).\nif ! mount | grep -q \" on $VOL \"; then\n  diskutil apfs unlockVolume Backups -stdinpassphrase < \"$PASS\" >/dev/null 2>&1 || true\nfi\nmount | grep -q \" on $VOL \" || die \"Backups volume not mounted\"\nmkdir -p \"$DEST\"\n\n# 2. Fetch the newest dump unless we already have it. Copy to .part first so a\n#    half-finished download never looks like a good backup.\nnewest=$(rclone lsf \"$REMOTE\" | grep -E '^[0-9]{4}-[0-9]{2}-[0-9]{2}\\.dump$' | sort | tail -1)\n[ -n \"$newest\" ] || die \"no dumps in $REMOTE\"\nif [ -s \"$DEST/$newest\" ]; then\n  log \"already have $newest\"\nelse\n  rclone copyto \"$REMOTE/$newest\" \"$DEST/$newest.part\" && mv \"$DEST/$newest.part\" \"$DEST/$newest\"\n  log \"pulled $newest ($(stat -f %z \"$DEST/$newest\") bytes)\"\nfi\n\n# 3. Keep the newest KEEP dumps. (macOS head has no \"-n -N\"; this works on both.)\nls -1 \"$DEST\" | grep -E '\\.dump$' | sort -r | tail -n +$((KEEP + 1)) | while read -r old; do\n  rm -f \"$DEST/$old\"; log \"pruned $old\"\ndone\n\n# 4. Optional: mirror your notes repo too.\n# (cd ~/notes && git pull -q --ff-only) && log \"notes pulled\"\n\nlog \"done\""

const BACKUP_PLIST = "<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n<!DOCTYPE plist PUBLIC \"-//Apple//DTD PLIST 1.0//EN\" \"http://www.apple.com/DTDs/PropertyList-1.0.dtd\">\n<plist version=\"1.0\"><dict>\n  <key>Label</key><string>com.me.home-backup</string>\n  <key>ProgramArguments</key><array><string>/bin/bash</string><string>/Users/YOU/bin/home-backup.sh</string></array>\n  <key>StartCalendarInterval</key><dict><key>Hour</key><integer>12</integer><key>Minute</key><integer>30</integer></dict>\n  <key>StandardOutPath</key><string>/Users/YOU/Library/Logs/home-backup-launchd.log</string>\n  <key>StandardErrorPath</key><string>/Users/YOU/Library/Logs/home-backup-launchd.log</string>\n</dict></plist>"

const BACKUP_LAUNCHCTL = "launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.me.home-backup.plist\nlaunchctl list | grep home-backup"

const BACKUP_RESTORE = "initdb -D ~/pgscratch -U postgres --auth=trust\npg_ctl -D ~/pgscratch -o \"-p 5433 -k /tmp\" -l ~/pgscratch/pg.log start\ncreatedb -h /tmp -p 5433 -U postgres restore_test\npg_restore -h /tmp -p 5433 -U postgres -d restore_test --no-owner --no-privileges -j 4 \\\n  \"/Volumes/Backups/db/$(ls /Volumes/Backups/db | sort | tail -1)\" 2> ~/pgscratch/restore.err\ngrep -c . ~/pgscratch/restore.err        # 0 is what you want\npsql -h /tmp -p 5433 -U postgres -d restore_test -c \"select count(*) from my_important_table\"\npg_ctl -D ~/pgscratch stop"

function OldMacbookHomeBackupContent() {
  return (
    <>
      <Figure
        src="/blog/old-macbook-encrypted-home-backup-1.jpg"
        alt="Diagram: a cloud server dumps Postgres to Backblaze B2 at 03:30 UTC, and an old MacBook at home pulls the newest dump onto an encrypted Backups volume at 04:30 UTC, plus a git pull of the notes"
        width={1920}
        height={1080}
        priority
        caption="Three copies: the live server, the B2 bucket, and an encrypted volume on an old MacBook that pulls once a day."
      />
      <P>
        Our second brain runs on a small cloud server: a Postgres database with every note,
        inventory record and agent conversation, plus a git repo of markdown notes. Every night the
        server dumps the database to Backblaze B2. That&apos;s two copies. The classic 3-2-1 rule asks
        for three, with one of them somewhere you physically control.
      </P>
      <P>
        We had a 2021 16-inch MacBook Pro with an M1 Max sitting in a drawer. This week it became our
        home server: local models, a voice clone, and the third copy of everything. This post covers
        the backup part, step by step, so you can do the same with any spare Mac.
      </P>
      <P>
        The whole thing is one shell script, one launchd file and one encrypted disk volume. It took
        an afternoon, including two failed runs that taught us something.
      </P>

      <H2>What you end up with</H2>
      <P>
        <strong>The Mac pulls; nothing pushes to it.</strong> If the Mac is off for a week, the server
        doesn&apos;t care. The next run fetches the newest dump.
      </P>
      <P>
        <strong>The backups sit on their own encrypted volume</strong> with their own key, separate
        from your login password.
      </P>
      <P>
        <strong>Every so often the Mac proves the backup works</strong> by restoring it into a scratch
        database and counting rows.
      </P>
      <P>
        You need a Mac on macOS 13 or later, a server running Postgres, a B2 account (or any S3-style
        storage rclone supports), and Homebrew.
      </P>

      <H2>Step 1: Dump the database to B2 every night</H2>
      <P>
        On the server, install rclone and give it a B2 key. In the B2 web console, create an
        application key restricted to your backup bucket.
      </P>
      <pre style={backupPre}><code>{BACKUP_B2_SERVER_KEY}</code></pre>
      <P>Then a nightly job. A cron line is enough:</P>
      <pre style={backupPre}><code>{BACKUP_CRON}</code></pre>
      <P>
        <code>-Fc</code> is Postgres&apos;s custom format: compressed, and <code>pg_restore</code> can
        restore it in parallel. Our dump is about 1 GB with 60 tables. Set a lifecycle rule on the
        bucket so old dumps expire. We keep 14 daily and 8 weekly.
      </P>

      <H2>Step 2: Prepare the Mac to stay on</H2>
      <P>On the Mac:</P>
      <pre style={backupPre}><code>{BACKUP_MAC_PREP}</code></pre>
      <P>
        Use the same major version of Postgres as your server. Install Tailscale or similar if you
        want to reach the Mac from anywhere, and keep it plugged in. If your macOS has a battery
        charge limit, set it to 80%.
      </P>
      <P>
        Give the Mac its own B2 key, <strong>read-only</strong>, scoped to the backup bucket. Create it
        in the B2 console (&ldquo;Read Only&rdquo; access), then:
      </P>
      <pre style={backupPre}><code>{BACKUP_B2_READONLY}</code></pre>
      <P>
        We&apos;ll be honest: our first version copied the server&apos;s full keys to the Mac. A
        read-only key means a compromised Mac can&apos;t delete your cloud copy. Do better than we did.
      </P>

      <H2>Step 3: Create an encrypted volume with its own key</H2>
      <P>
        APFS lets you add a volume to the Mac&apos;s existing disk container. It shares free space
        with the system, so you don&apos;t have to resize anything. Generate a random passphrase into
        a file only your user can read, then create the volume from it:
      </P>
      <pre style={backupPre}><code>{BACKUP_VOLUME_CREATE}</code></pre>
      <Figure
        src="/blog/old-macbook-encrypted-home-backup-2.jpg"
        alt="Terminal on the M1 Max: diskutil info shows the Backups volume mounted at /Volumes/Backups with FileVault Yes and Locked No, and ls lists three nightly dump files of about 1 GB each"
        width={1920}
        height={1080}
        caption="Our Backups volume on the M1 Max: FileVault on, unlocked by the job, about 1 GB per nightly dump."
      />
      <P>
        The passphrase never appears on screen or in your shell history. To unlock the volume later:
      </P>
      <pre style={backupPre}><code>{BACKUP_VOLUME_UNLOCK}</code></pre>
      <P>
        <strong>You will see a prompt.</strong> After every reboot, macOS shows &ldquo;Enter a
        password to unlock the disk Backups&rdquo;. Your login password won&apos;t work, because the
        volume has its own key. Press Cancel and let the job unlock it, or run the unlock command
        above. This caught us out the first time the Mac restarted. If you want to unlock it by hand
        someday, put the passphrase in your password manager:
      </P>
      <pre style={backupPre}><code>{BACKUP_PBCOPY}</code></pre>

      <H2>Step 4: The pull script</H2>
      <P>
        Save this as <code>~/bin/home-backup.sh</code>:
      </P>
      <pre style={backupPre}><code>{BACKUP_SCRIPT}</code></pre>
      <P>
        <code>chmod +x ~/bin/home-backup.sh</code>, run it once by hand, and check{' '}
        <code>ls /Volumes/Backups/db</code>.
      </P>

      <H2>Step 5: Schedule it with launchd</H2>
      <P>
        Save as <code>~/Library/LaunchAgents/com.me.home-backup.plist</code>, replacing{' '}
        <code>YOU</code> with your username. Schedule it an hour or so after the server&apos;s dump.
      </P>
      <pre style={backupPre}><code>{BACKUP_PLIST}</code></pre>
      <pre style={backupPre}><code>{BACKUP_LAUNCHCTL}</code></pre>
      <P>
        The hour is in the Mac&apos;s local time. Ours runs at 12:30 local time (UTC+8), which is
        04:30 UTC, an hour after the 03:30 UTC dump.
      </P>

      <H2>Step 6: Prove it restores</H2>
      <P>
        A backup you&apos;ve never restored is a hope, not a backup. Start a throwaway Postgres on a
        spare port and restore into it:
      </P>
      <pre style={backupPre}><code>{BACKUP_RESTORE}</code></pre>
      <P>
        Run the same <code>count(*)</code> on the server and compare. Ours restored a 1.06 GB dump in
        56 seconds with zero errors, and the counts matched the live database row for row. The one
        exception was a single row written after the dump ran.
      </P>
      <Figure
        src="/blog/old-macbook-encrypted-home-backup-3.jpg"
        alt="Backup log from the M1 Max: pulled 2026-10-17.dump (1,063,208,257 bytes), restore took 56 s, restored row counts inventory_items 68, vault_files 6079, vault_chunks 88414"
        width={1920}
        height={1080}
        caption="The log from our restore test on October 17, 2026."
      />
      <P>Two things broke on the way there, and they&apos;ll probably hit you too:</P>
      <P>
        <strong>Extensions.</strong> Our database uses pgvector. Without it in the scratch Postgres,
        the restore produced 35 errors and our embeddings table never came back. At the time,
        Homebrew&apos;s pgvector only shipped for Postgres 17 and 18, so for 16 we built it from
        source (<code>make &amp;&amp; make install</code> with <code>PG_CONFIG</code> pointing at
        Homebrew&apos;s <code>postgresql@16</code>). Install every extension your server uses before
        you trust a restore.
      </P>
      <P>
        <strong>Roles.</strong> A dump made with grants references your server&apos;s roles.{' '}
        <code>--no-owner --no-privileges</code> skips most of it, and creating the roles in the
        scratch database first silences the rest, so the error count means something.
      </P>

      <H2>The honest trade-offs</H2>
      <P>
        <strong>The key file sits next to the volume.</strong> If someone can read your user&apos;s
        files, they can unlock your backups. What protects you is FileVault on the boot disk: if the
        Mac is stolen while it&apos;s off, both the key file and the volume are encrypted. The
        separate volume key mostly buys you a clean upgrade path. Delete the key file and keep the
        passphrase only in your password manager, and the backups stay locked until you unlock them
        by hand. The cost is that the job can&apos;t run unattended after a reboot.
      </P>
      <P>
        <strong>A laptop isn&apos;t a server.</strong> With FileVault on, a reboot stops everything
        until someone types the password and logs in, because LaunchAgents wait for a login. Our Mac
        rebooted seven minutes after its first scheduled backup run, and sat waiting. That&apos;s
        fine for us: the cloud server and B2 keep running, and the Mac catches up. If you need it
        unattended, you trade away disk encryption or move to LaunchDaemons.
      </P>
      <P>
        <strong>Pulling beats pushing.</strong> Give the server no credentials for the Mac, and give
        the Mac a key that can only read. Then a breach on either side can&apos;t erase the
        other&apos;s copy.
      </P>
      <Figure
        src="/blog/old-macbook-encrypted-home-backup-4.jpg"
        alt="Diagram of who holds which key: the cloud server writes dumps to B2 and has no credentials for the Mac; B2 keeps 14 daily and 8 weekly dumps; the MacBook reads with a read-only key and cannot delete the cloud copy"
        width={1920}
        height={1080}
        caption="Pulling beats pushing: each side holds only the access it needs."
      />
      <P>
        That&apos;s the whole system: a cron line on the server, a short script and a plist on the
        Mac, and one encrypted volume. An old laptop in a drawer is a better third copy than no third
        copy.
      </P>
    </>
  )
}

/* ── Post: Designing a keychain AI companion that runs on your own Second Brain ── */
function KeychainAiCompanionSecondBrainContent() {
  return (
    <>
      <Figure
        src="/blog/keychain-ai-companion-second-brain-1.jpg"
        alt="3D illustration of the ghost companion case: a clear dome-headed figure on three rounded feet, with the screen showing a pixel face, pink cheek lights, a camera eye, yellow side buttons as arms, a yellow belly button and a hexagonal speaker grille, the battery and circuit boards visible through the plastic"
        width={1600}
        height={1000}
        priority
        caption="The ghost case, drawn from the design notes. A concept illustration; nothing has been printed yet."
      />
      <P>
        An AI that knows you well usually lives in a browser tab. To ask it something, you stop, find the tab, type, and wait. Most of the day it is somewhere else. Everything it knows about you sits on a company&apos;s servers, under that company&apos;s rules.
      </P>
      <P>
        We want the opposite: a companion that is with you all day, small enough to hang from your keys, that you can press and ask a question out loud. It answers in a voice you recognise, from your own notes, using software and hardware you own. When you put it on your desk, it becomes a small pet that shows you what is waiting for you.
      </P>
      <P>
        This post explains the plan for that device and how it connects to the Second Brain, the open-source notes system we run our company on. It is a plan with a bench prototype path, not a product; the last section says what already runs.
      </P>
      <H2>What does it do?</H2>
      <P>
        The keychain has one job a stranger can name in a sentence: <strong>you ask it about your own notes, and it answers in your agent&apos;s voice.</strong> Around that job sit a few smaller features.
      </P>
      <UL items={[
        <><strong>It talks.</strong> Press and hold the TALK button, ask a question, let go. Within about a second it says a short line such as &quot;Let me look&quot;, then speaks the real answer sentence by sentence.</>,
        <><strong>It hears you before it is back online.</strong> Between presses it sleeps. The moment the button goes down it starts recording while Wi-Fi reconnects, so your first word is not lost.</>,
        <><strong>It shows a pet.</strong> A small black-and-white screen shows a face with a mood and a hunger badge, explained below.</>,
        <><strong>It plays any of our agents.</strong> Our company runs on 22 AI agents, each with a role, such as research, design or infrastructure. Say &quot;let me talk to Vega&quot; and the head of research answers, in its team&apos;s voice and with its team&apos;s face on the screen.</>,
        <><strong>It can see and recognise, when asked.</strong> The camera is off by default. Squeeze TALK and MARK together and it takes one picture to recognise a person who has agreed to be remembered. The plan also has it recognise its owner&apos;s voice.</>,
      ]} />
      <H2>What is inside it?</H2>
      <P>
        The heart is the <strong>Seeed XIAO ESP32S3 Sense</strong>, a board about the size of a thumbnail (21 by 17.8 mm). The ESP32-S3 is a low-cost chip with Wi-Fi built in; this board adds 8 MB of PSRAM (extra working memory, enough to hold several minutes of recorded speech) and a small camera board with a built-in microphone. We already use the same board in Exo, the wearable we are building, and its microphone works on our bench.
      </P>
      <P>
        Around it, the plan adds:
      </P>
      <UL items={[
        <><strong>A speaker and an amplifier.</strong> The board has no speaker, so a <strong>MAX98357A</strong> amplifier drives a small 8 ohm speaker of about 15 to 20 mm. It draws 2.4 mA when idle, so the firmware switches it fully off between answers.</>,
        <><strong>A screen.</strong> Day one uses a 0.96 inch OLED with 128 by 64 pixels, which we already have. A later version moves to a <strong>Sharp memory LCD</strong>, which keeps its picture on about 2 microamps (per a SparkFun board note). It could keep the pet&apos;s face visible while the chip sleeps, if the chip&apos;s low-power coprocessor can keep the screen&apos;s refresh signal running; that is not proven yet.</>,
        <><strong>A battery.</strong> A flat lithium-polymer cell, 5 by 30 by 30 mm, 400 to 500 mAh, with a protection circuit. It is the same cell planned for the Exo wearable, charged through the board&apos;s USB-C port.</>,
        <><strong>Three buttons.</strong> TALK, for questions; MARK, which saves the moment; and APPROVE, which answers yes when an agent asks before doing something. In the ghost case below, TALK and MARK sit on the sides like two small arms and APPROVE is a belly button on the front.</>,
      ]} />
      <H3>How long does the battery last?</H3>
      <P>
        Standby decides the battery life, not talking, and the camera board is the problem. Seeed&apos;s own figures for this board: in deep sleep it draws 14 microamps alone, but 3 mA with the camera board attached. Staying connected to Wi-Fi costs about 44 mA.
      </P>
      <P>
        On a 500 mAh cell that is roughly seven days asleep, but about 11 hours if it stays connected, which is why it sleeps between presses. With a short sync every 30 minutes and ten one-minute conversations a day, our estimate is about four days per charge. <strong>These runtimes are calculations from Seeed&apos;s published figures, not measurements;</strong> measuring them is part of the build.
      </P>
      <P>
        The fix for the 3 mA is a switch that cuts the camera&apos;s power during sleep. That needs our own circuit board, a later version where standby could stretch to months.
      </P>
      <H2>What does the case look like?</H2>
      <P>
        A ghost. The first case concept is a small clear figure with a dome head, straight sides and three rounded feet, so the same body stands on a desk or hangs from your keys. It is designed in code with build123d, a Python library for 3D models. The pictures here are 3D illustrations drawn from that design: nothing has been printed yet, and every size is an estimate until the parts are measured.
      </P>
      <Figure
        src="/blog/keychain-ai-companion-second-brain-2.jpg"
        alt="Front view of the clear ghost case: the OLED face high in the dome, two pink cheek lights and the camera eye beneath it, TALK and MARK buttons poking out of the sides, APPROVE as a belly button and the hex speaker grille above the feet"
        width={1600}
        height={1000}
      />
      <Figure
        src="/blog/keychain-ai-companion-second-brain-3.jpg"
        alt="The ghost companion in the dark, its screen glowing with a pixel face, its cheek lights lit pink and its buttons glowing violet through the clear shell"
        width={1600}
        height={1000}
        caption="At night the face and cheek lights glow through the clear shell."
      />
      <UL items={[
        <><strong>A face.</strong> The OLED sits behind a window high in the dome, so the pet&apos;s face is the ghost&apos;s face.</>,
        <><strong>Cheeks and a heart.</strong> Two small lights sit just under the screen, and the camera sits on the centre line below them, where a heart would be.</>,
        <><strong>Arms and a belly button.</strong> TALK and MARK poke through the side walls at shoulder height; APPROVE is a single key low on the front.</>,
        <><strong>A speaker grille</strong> of small hexagonal holes in the skirt between the feet.</>,
        <><strong>Feet that stand.</strong> The tips of the three feet are trimmed flat, so it stands upright on a table on its own.</>,
        <><strong>No screws.</strong> The back plate snaps on with ten small tabs that catch behind a ledge inside the wall.</>,
        <><strong>Clear plastic</strong>, so the board and the lights show through.</>,
      ]} />
      <P>
        The outline is about 47 by 58 mm and 18 mm thick. For a keychain, the same electronics take a back shell with a key ring loop instead of the stand; that choice lives in the case model, not the circuit. The first printed case passes if it lasts three days in a pocket on one charge and survives a one-metre drop onto wood.
      </P>
      <H2>What software runs it?</H2>
      <H3>The firmware</H3>
      <P>
        Rather than write firmware from scratch, the plan forks <strong>xiaozhi-esp32</strong>, an open-source voice assistant firmware for ESP32 chips under the MIT licence, with over 31,000 stars on GitHub. It already streams speech as <strong>Opus</strong> (a compressed audio format) over a <strong>WebSocket</strong> (a network connection that stays open), 16 kHz up and up to 24 kHz back. It supports push-to-talk, a wake word, small screens and Wi-Fi setup from a phone, and its small documented protocol lets the server call tools on the device, such as the volume or the screen, through MCP (the Model Context Protocol, a standard way to give a model tools).
      </P>
      <P>
        Two changes make it ours. xiaozhi has no board definition for the XIAO, so we write one, starting from its breadboard design and swapping in the board&apos;s built-in microphone. And the server address is a build setting called <code>OTA_URL</code>, which by default points at the firmware maker&apos;s cloud. <strong>We point it at our own server, never the default</strong>, because the default would send your voice to someone else&apos;s computer.
      </P>
      <H3>The server</H3>
      <P>
        The server already exists. We built it for Friendly, our Reachy Mini desk robot, and wrote about it in <A href="https://myargoquest.com/blog/how-we-built-friendly-reachy-mini">How we gave a Reachy Mini robot a voice, a personality and a memory</A>. It is called <code>friendly-host</code> and runs on a Mac with an M1 Max chip. The keychain becomes a second body for the same brain.
      </P>
      <P>
        One spoken turn would flow like this:
      </P>
      <UL items={[
        <>The keychain sends your recorded speech up as Opus.</>,
        <><strong>Whisper</strong>, a speech-to-text model, runs locally on the Mac. It transcribed a 7.3 second clip in 0.38 seconds.</>,
        <>A fast local <strong>Qwen</strong> model, the bridge, says a short line within about a second so there is no dead air. It is not allowed to state facts.</>,
        <>The mind, <strong>Claude Code</strong> (run as <code>claude -p --resume</code>), thinks, uses tools, and streams its answer. Hermes, our other agent harness, can plug in the same way, though it is too slow for voice today.</>,
        <><strong>Kokoro</strong>, a small local voice model, turns a short sentence into speech in about 0.13 seconds, and the audio streams back to the keychain as Opus.</>,
      ]} />
      <P>
        The new piece is a <strong>device gateway</strong> inside <code>friendly-host</code>: a module that speaks xiaozhi&apos;s protocol on one side and the host&apos;s body interface on the other. The keychain cannot join our private network, so a small cloud server acts as the encrypted front door and passes the connection home. At home, the keychain can talk to the Mac directly.
      </P>
      <P>
        The targets: first sound under 1.5 seconds after you let go, and the mind&apos;s first sentence under 8 seconds (3.8 to 8.7 seconds in our text tests so far).
      </P>
      <P>
        What is open: the firmware (MIT), the Second Brain engine, and the speech models, which are open-weight models anyone can download. <code>friendly-host</code> lives in our private notes today, and the gateway will start there.
      </P>
      <H2>How does it connect to your Second Brain?</H2>
      <P>
        The Second Brain is a folder of plain markdown notes plus a database that indexes them. The keychain touches neither; it talks to the gateway, and the mind decides what to read and write:
      </P>
      <UL items={[
        <><strong>Search.</strong> Ask &quot;what did I write about the launch?&quot; and the mind calls the Second Brain&apos;s search with <code>mode=hybrid</code>, which matches exact words and also meaning, using embeddings (lists of numbers that place similar sentences close together), then quotes the note back.</>,
        <><strong>Write-back.</strong> &quot;Remember that the meeting moved to Thursday&quot; becomes a task card for our librarian agent, which writes the markdown note. Every kind of data has one write path, and the keychain follows it.</>,
        <><strong>Pet state.</strong> The server works out the pet&apos;s stats and sends a tiny message. Hunger counts task cards waiting on you, mood follows progress on today&apos;s goals, growth counts notes added this week, and energy is the battery. The device only draws the sprite it is told to draw.</>,
        <><strong>Persona switch.</strong> Each of the 22 agents has a persona compiled from our company&apos;s roster file: a description, a voice per team, and on the keychain a face per team. Only Friendly keeps a personal memory; the other agents keep their own working memory and receive a short handover note of what was just said.</>,
      ]} />
      <P>
        Safety rules sit in front of all this. Voice alone may only do reversible things: answer, read, take a note, switch persona. Longer agent work needs a button press, and money never goes through the keychain. Pairing needs a press on the device and the owner&apos;s confirmation; a long squeeze of TALK and MARK revokes its key.
      </P>
      <H2>Who can it recognise, and what may it say aloud?</H2>
      <P>
        Recognition is not built yet. In the plan, it runs on the home computer, never on the device and never on someone else&apos;s service. Voice and face become embeddings, and only those numbers are kept, in Friendly&apos;s own database; the raw pictures and audio are deleted. Enrolment needs spoken consent. A person counts as verified only when face and voice agree. Forgetting someone is a request a human makes, never a tool the model can call. Children are never enrolled, and the camera opens only on a button press, with an icon and a light while it captures.
      </P>
      <P>
        A speaker in a café is public, so what it may say aloud follows the privacy levels we explained in <A href="https://myargoquest.com/blog/privacy-levels-for-ai-agents">How our AI agents will know what they may share</A>. The rule for the keychain:
      </P>
      <UL items={[
        <><strong>Out of the house:</strong> only <code>public</code> and <code>shared</code> material.</>,
        <><strong>On home Wi-Fi:</strong> up to <code>private</code>.</>,
        <><strong>Never,</strong> on the screen or the speaker: <code>confidential</code> and <code>secret</code>.</>,
      ]} />
      <P>
        That gate is mostly still a design. Until it runs, the keychain persona&apos;s instructions will state it and its search tool will filter by folder.
      </P>
      <H2>What does a daily companion make possible?</H2>
      <P>
        A browser tab gets visited. A companion on your keys gets talked to many times a day, and on a stack you own, those moments add up to something you keep.
      </P>
      <UL items={[
        <><strong>Memory that stays yours.</strong> Every note it takes is a markdown file in a folder you control, and every fact about you sits in a database on a server you control. Change the model or the harness and the memory stays.</>,
        <><strong>Learning.</strong> Ask about what you read last month, or have it quiz you while you walk. Your own notes become something you can talk to.</>,
        <><strong>Health.</strong> The energy stat can include a sleep score once a smart ring syncs to your own database. A companion that sees your sleep and your plans together can suggest moving the hard task.</>,
        <><strong>Creativity.</strong> Ideas arrive on a walk or in a queue. Press, say it, and it is a note.</>,
        <><strong>Accountability.</strong> The hunger badge is a steady reminder of what is waiting on you, without opening an app.</>,
        <><strong>Children&apos;s education.</strong> Friendly already has a role for children&apos;s classes, with no memory and no recognition. A device like this could answer a child&apos;s questions patiently without keeping a record of the child.</>,
      ]} />
      <P>
        The risks are real and worth saying plainly. Something that is always kind and always available can become easier to talk to than people, and we would rather it point you toward them. A device that listens needs rules a person can check, which is why the consent rules are already in code, and recognition and the privacy gate will be too, on our own machines. And a companion built from your notes is a mirror: it reflects your goals and your blind spots back at you. It does not replace a friend who sees what you missed.
      </P>
      <H2>What&apos;s built and what&apos;s next</H2>
      <P>
        Running today:
      </P>
      <UL items={[
        <><strong>The brain.</strong> <code>friendly-host</code> runs the voice loop, local Whisper and Kokoro, the Qwen bridge and Claude Code as the mind, on the Mac. Persona switching across the 22 agents is built and tested; the Hermes adapter is tested only in isolation.</>,
        <><strong>The agent company and the Second Brain</strong>, including hybrid search and the librarian that turns requests into notes.</>,
        <><strong>The board.</strong> Our Exo wearable&apos;s bench board, the same XIAO ESP32S3 Sense, records from its microphone.</>,
      ]} />
      <P>
        Still a plan, in this order: a bench build (amplifier, speaker, the xiaozhi port and a first gateway); personas, search, notes and the pet screen on the keychain; power measurements and the first printed case; recognition, built with Friendly&apos;s; the memory LCD and dock mode; and our own circuit board with the camera power switch.
      </P>
      <P>
        If you build your own: the widely used pretrained face models from InsightFace are licensed for non-commercial use only, fine for a personal unit but not for a product.
      </P>
      <P>
        The keychain is a new body, not a new brain. The memory, the voices and the agents already run on a computer we own; the device only has to listen, speak and show a face.
      </P>
      <P>
        Follow along on the blog and at https://x.com/myargoquest. The Second Brain engine is open source at https://github.com/kon-rad/secondbrain.
      </P>
    </>
  )
}

/* ── Post: What a research lab's agent playbook teaches a personal second brain ── */
function EcosystemNotThePaperContent() {
  return (
    <>
      <P>
        Tim Dettmers, who runs a machine learning lab at Carnegie Mellon, asked a class of 150 students who was afraid of not getting a job after graduating. About 120 hands went up. His blog post about it, published on 21 September 2026, argues that the fear rests on a wrong assumption: that the future belongs to whoever has the most GPUs.
      </P>
      <P>
        His argument is about academic research, but most of it applies to anyone who works with AI agents (programs that use a language model to plan and carry out multi-step work, such as Claude Code). We run a second brain: a folder of plain-text notes that several agents read, write and act on every day. This post explains the main ideas in his post, looks at the one release we could read in full, and turns them into concrete changes for our setup and yours.
      </P>
      <H2>What changed when agents arrived?</H2>
      <P>
        Dettmers&apos; starting observation is simple. With agents, a research project that used to take a year of engineering now takes weeks, sometimes days. When each project becomes cheap, a single project stops being impressive.
      </P>
      <P>
        He puts it in one line: <strong>the unit of research is no longer the paper, it is the ecosystem.</strong> A paper here and a paper there, each self-contained, asks the reader to stitch the pieces together. That format made sense when every piece was expensive. Now the hard part is building pieces that build on each other, so that each one makes the next more useful.
      </P>
      <P>
        An analogy: when bricks were hand-made, a single good brick was worth showing off. Once bricks come off a machine, nobody cares about one brick. They care whether you built a house. The analogy stops working in one place: a house is finished, while an ecosystem keeps growing as other people add to it.
      </P>
      <H2>What did his lab release?</H2>
      <P>
        The post announced an open-source week: two open-source projects and four papers, released together on purpose. The post covers three pieces:
      </P>
      <UL items={[
        <><strong>An agent harness</strong> (the code around a model that gives it tools, memory and rules) that you point at a code repository and leave. He reports it optimised his lab&apos;s Mac inference kernels on its own.</>,
        <><strong>Local frontier models:</strong> large open models running on a single desktop GPU or a high-memory laptop.</>,
        <><strong>A local autonomous research system</strong> that proposes problems, runs experiments and reports results with no internet access. In his example it produced four results on a bioinformatics problem in about two hours, without reaching the best known result on the overall problem.</>,
      ]} />
      <P>
        Those numbers are his claims, and we have not tested them. One release we could at least read in full is <strong>CliffCompaction</strong>, published the next day as a paper and an MIT-licensed tool. Dettmers is a co-author, so its figures are his team&apos;s claims too, not an independent check.
      </P>
      <H2>What is CliffCompaction, and why does it matter for everyone running agents?</H2>
      <P>
        An agent&apos;s context window is its working memory: everything the model can see at once. Long sessions fill it. The usual fix, called compaction, replaces the conversation so far with a shorter version and continues from there. The CliffCompaction paper argues that when that shorter version is a rewrite, and later rewrites are made from earlier ones, drift compounds.
      </P>
      <P>
        CliffCompaction does two things differently, according to its paper:
      </P>
      <UL items={[
        <><strong>It only truncates or drops content, never rewrites it.</strong> What stays is the original text, so nothing is paraphrased into something slightly wrong.</>,
        <><strong>It never compacts a compaction.</strong> Each pass works from the original content and throws away the previous compacted output, so errors don&apos;t pile up.</>,
      ]} />
      <P>
        It runs as a proxy, a small program that sits between the agent and the model provider, so the agent itself does not change. The paper reports cost cuts of up to 50% under a bounded context while keeping or improving scores on the Terminal-Bench benchmark. Dettmers adds that one partner company measured a 45% drop in its total AI spend. Setup, from the project&apos;s README, is two commands:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"uv tool install cliffcompaction\ncliff enable"}</code></pre>
      <P>
        <code>cliff enable</code> defaults to Claude Code. <code>cliff disable</code> reverses it.
      </P>
      <H2>What do you do with the money you save?</H2>
      <P>
        This is the part of the post most people will skip, and it is the most useful. If each attempt costs half as much, you can run two attempts for the price of one and keep the better result. The paper reports over 10 percentage points more on Terminal-Bench from test-time scaling (spending on extra attempts), for less than the cost of two full-context runs.
      </P>
      <P>
        The general rule: <strong>cheaper attempts are not only a saving, they are a budget for trying twice.</strong> Our view, which we have yet to measure: for hard tasks, two independent tries and a check that picks the better one are worth testing against one careful try.
      </P>
      <H2>How should a person work with agents now?</H2>
      <P>
        Dettmers gives three habits he now asks of his PhD students:
      </P>
      <UL items={[
        <><strong>Work on the ecosystem.</strong> Judge a piece of work by what it connects to.</>,
        <><strong>Run many projects in parallel.</strong> An agent can carry one project while you think about another.</>,
        <><strong>Attack the problem first, understand it as you go.</strong> The old order was basics, then methods, then problems. With agents you can start from the problem and look up what you need along the way. Your attention goes to the hard part.</>,
      ]} />
      <P>
        He frames all three with one sentence: <strong>let go of how you work, not who you are.</strong> Methods are negotiable. Your personality, the people you love and what you hold important are not, and holding those steady is what makes it possible to change everything else quickly.
      </P>
      <P>
        There is one more line worth keeping. His lab built a tool that turned a recorded meeting into research questions checked against the literature. It needed him to copy and paste between two steps by hand, so he stopped using it. The students then asked for it back. His conclusion: <strong>the only evaluation of a research tool he trusts is that people ask for it after you stop giving it to them.</strong>
      </P>
      <H2>What we are changing in our second brain</H2>
      <P>
        Our setup: a vault of notes in plain markdown, a shared rules file every agent reads, skills (written procedures an agent loads when it needs them), a kanban board where requests become cards, and several agent lanes that pick up cards in parallel. Here is what the post changes, in order of how soon we expect to act on it:
      </P>
      <UL items={[
        <><strong>Trial CliffCompaction on one agent lane for a week.</strong> One lane, its own proxy instance, the other agents untouched. We compare cost per card and how often a card&apos;s checks pass against the week before. This is a plan; we have not run it yet.</>,
        <><strong>Spend any saving on second attempts.</strong> When a card fails its checks, run two variations and let the checker pick, rather than one retry.</>,
        <><strong>Measure skills by &quot;asked for again&quot;.</strong> A skill that ran is not the same as a skill that helped. We will look at which skills and outputs get requested again, and review the ones nobody asked for in a month.</>,
        <><strong>Hunt down manual hand-offs.</strong> Every place a person copies, pastes or forwards between two steps is where a pipeline quietly dies. We plan to list them and remove them one by one.</>,
        <><strong>Make every new piece name its neighbours.</strong> Notes already have to link to the project they belong to. New skills and tools should say what they build on and what can build on them.</>,
        <><strong>Keep sources verbatim and summarise once.</strong> We already save some articles as an untouched copy next to a separate analysis note. We want that to be the rule for every saved source, with analysis always written from the original, never from an earlier summary. It is CliffCompaction&apos;s rule applied to notes.</>,
      ]} />
      <H2>How to apply this to your own agent setup</H2>
      <P>
        If you run agents, three checks take less than an hour:
      </P>
      <UL items={[
        <><strong>Look at your longest sessions.</strong> If they compact often, a truncate-only proxy is cheap to try and easy to remove.</>,
        <><strong>Find one task you retry by hand</strong> and try two parallel attempts with an automatic check instead.</>,
        <><strong>List the tools you built in the last three months</strong> and mark which ones you or anyone else asked for again. Drop or fix the rest.</>,
      ]} />
      <P>
        The core idea is Dettmers&apos;: when each piece is cheap, the value is in how the pieces connect and whether people keep coming back for them. Read his full post at https://timdettmers.com/2026/09/21/dlab-open-source-week/ and follow what we build at https://x.com/myargoquest.
      </P>
    </>
  )
}

/* ── Post: Kronos and the AI models that read price charts, checked against the evidence ── */
function KronosCandlestickFoundationModelsContent() {
  return (
    <>
      <P>
        A post went around X this week claiming that &quot;someone built an AI that reads candlestick charts the way GPT reads English&quot;, that it &quot;outperforms every model by 93%&quot;, and that it runs free on a laptop. It had over 120,000 views. The model is called Kronos, and it is real. Most of the claims about it are not quite what they sound like.
      </P>
      <P>
        This post explains what Kronos is and how it works, what its headline number actually measures, what other models do the same job, and what the published research says about using any of them to trade. We read the paper, the code, the model cards and the independent tests people have posted, all on 19 October 2026.
      </P>
      <H2>What is a foundation model for prices?</H2>
      <P>
        A <strong>foundation model</strong> is a large model trained once on a huge, general dataset, then used for many tasks without retraining. GPT is a foundation model for text. A <strong>time-series foundation model</strong> does the same for sequences of numbers over time: electricity demand, web traffic, sales, and prices.
      </P>
      <P>
        The promise is <strong>zero-shot</strong> forecasting: give the model a history it has never seen, and it predicts what comes next without any training on that series. Google, Amazon, Salesforce, Datadog, IBM and, as of last week, Mistral have all released models like this.
      </P>
      <P>
        Most of them are general. They learn patterns that repeat across many kinds of data, such as daily and weekly cycles. Kronos is different because it was trained only on market data.
      </P>
      <H2>How does Kronos read a candlestick?</H2>
      <P>
        A <strong>candlestick</strong> (also called a K-line) summarises trading over one time period in a few numbers: the opening price, the high, the low, the closing price, and how much was traded. Kronos uses six numbers per candle: those five plus turnover, the money value traded.
      </P>
      <P>
        Kronos turns each candle into words. A small network called a tokenizer compresses the six numbers into a 20-bit code and splits it into two tokens: a coarse one that captures the rough shape of the candle, and a fine one that adds the detail. A GPT-style model then reads the sequence of tokens and predicts the next coarse token, then the next fine one, one candle at a time, the same way a language model predicts the next word.
      </P>
      <P>
        An analogy: it is like describing each day&apos;s weather first as &quot;warm and wet&quot; and then adding &quot;23 degrees, light rain after 4pm&quot;. The model learns to predict the rough description first and the detail second. The analogy stops working in one place: weather follows physics, and prices partly react to the forecasts people make about them.
      </P>
      <P>
        Because the model samples its predictions, you can run it many times and get many possible futures, which gives a spread of outcomes instead of a single line.
      </P>
      <P>
        It was trained by researchers at Tsinghua University on 12.11 billion candles from 45 exchanges, covering stocks, crypto, futures and currencies at time scales from one minute to one week. The paper was accepted at AAAI 2026, a major AI conference. The code is MIT-licensed and has about 41,000 stars on GitHub. Three model sizes can be downloaded: 4.1 million, 24.7 million and 102.3 million parameters. The smallest runs on an ordinary computer&apos;s processor, no graphics card needed.
      </P>
      <H2>What does &quot;93% more accurate&quot; actually mean?</H2>
      <P>
        This is the claim worth slowing down for. The 93% comes from a measure called <strong>RankIC</strong>, short for rank information coefficient. It asks a simple question: when the model ranks future prices from highest to lowest, how well does that ranking match what really happened? A RankIC of 1 would be a perfect ranking. Zero means no better than chance.
      </P>
      <P>
        In the paper&apos;s price-forecasting test, averaged across 11 markets, the largest Kronos model scored a RankIC of 0.0267. The best competing foundation model scored 0.0138. The first number is 93% higher than the second, which is where the headline comes from. But both are very close to zero. Going from almost no ranking skill to slightly more than almost no ranking skill is a real improvement, and still a long way from a signal you can trade on.
      </P>
      <P>
        Three more details matter:
      </P>
      <UL items={[
        <><strong>The best result came from the largest model, which is not released.</strong> Only the three smaller sizes can be downloaded.</>,
        <><strong>It doesn&apos;t beat every model.</strong> On the crypto data in the paper, two older models trained from scratch scored a higher RankIC than every Kronos size.</>,
        <><strong>The live demo has stopped.</strong> It was meant to update a Bitcoin forecast every hour; its last update was on 4 July 2026.</>,
      ]} />
      <P>
        The paper also reports a volatility forecast with 9% lower error than GARCH, a standard statistical model for how much prices swing, and a backtest on Chinese stocks with strong returns. That backtest is on one market, and the repository itself describes its trading pipeline as a demonstration, not a production trading system.
      </P>
      <H2>What do independent users find?</H2>
      <P>
        Several people have posted their own tests as GitHub issues on the Kronos repository. These are not peer-reviewed, but they are concrete:
      </P>
      <UL items={[
        <>A test on Apple daily prices, with 1,800 rolling forecasts, found every configuration less accurate than simply predicting that tomorrow&apos;s close equals today&apos;s.</>,
        <>A walk-forward test on eight US stocks at 30-minute candles found direction calls right 45% to 60% of the time, and no stable edge after trading costs.</>,
        <>A ranking test across 182 US stocks found a correlation of 0.022, not statistically significant, and still not significant after costs.</>,
        <>One user reported a small but real edge on 15-minute crypto candles.</>,
      ]} />
      <P>
        A bug that let future prices leak into the fine-tuning data was fixed in April 2026. Whether the published model weights were affected has not been answered by the maintainers.
      </P>
      <H2>What other models do the same job?</H2>
      <P>
        General time-series foundation models, all with downloadable weights:
      </P>
      <UL items={[
        <><strong>Timestral</strong> from Mistral, released on 14 October 2026, leads both public benchmarks (GIFT-Eval and fev-bench) among open-weight models as of 19 October.</>,
        <><strong>TimesFM</strong> from Google. Version 3 is close behind, but its licence is non-commercial; version 2.5 is Apache-2.0.</>,
        <><strong>Chronos-2</strong> from Amazon, the most downloaded of these models, Apache-2.0.</>,
        <><strong>Toto 2.0</strong> from Datadog, with sizes from 4 million to 2.5 billion parameters, Apache-2.0.</>,
        <><strong>TiRex-2</strong> from NX-AI and <strong>Tiny Time Mixers</strong> from IBM, both small and Apache-2.0.</>,
        <><strong>Moirai</strong> from Salesforce, with non-commercial weights.</>,
      ]} />
      <P>
        Models trained only on market data, like Kronos:
      </P>
      <UL items={[
        <><strong>KiT</strong>, published in September 2026, generates future candles with a diffusion model and reports a higher RankIC than Kronos. Those are the authors&apos; own numbers, and nobody has replicated them yet.</>,
        <><strong>FinCast</strong>, presented at CIKM 2025, about a billion parameters, trained on over 20 billion data points, mostly financial.</>,
      ]} />
      <P>
        Then there are the projects with the biggest star counts in &quot;AI for finance&quot;: TradingAgents, Microsoft&apos;s Qlib and RD-Agent, FinGPT and FinRobot. These are mostly language-model or agent frameworks that read news, write analysis or write trading code. Only Qlib, a backtesting platform, and RD-Agent, which writes and tests trading factors, work with price data directly. None of them is a pretrained price model.
      </P>
      <H2>Can any of them predict the market?</H2>
      <P>
        The best evidence says: not returns, at least not off the shelf. The largest study so far (arXiv 2511.18578) tested Chronos and TimesFM on daily stock returns in 94 countries from 1990 to 2023. Used zero-shot, both did worse than predicting no change at all. Only models pretrained from scratch on financial data caught up with standard machine-learning methods, and those results are before trading costs. A 2026 study on five large US stocks (arXiv 2606.27100) found gains over a random walk &quot;small and sparse&quot;.
      </P>
      <P>
        This is why finance papers report rank correlations rather than profit. Short-term price moves are close to unpredictable, and a model that ranks slightly better than chance can still lose money once you pay fees and spreads.
      </P>
      <P>
        <strong>Volatility is the more promising target.</strong> How much a price will swing is far more predictable than which way it will go. Kronos reports a real improvement over GARCH there, KiT reports volatility rank correlations around 0.66, and a 2026 study (arXiv 2607.05291) found one small model, IBM&apos;s Tiny Time Mixers, beat the standard econometric baseline at every horizon, though narrowly.
      </P>
      <H2>How to use these models sensibly</H2>
      <P>
        If you want to try Kronos or any of its peers:
      </P>
      <UL items={[
        <><strong>Read the metric, not the percentage.</strong> Ask what is being measured, against which baseline, and how big the number is before the &quot;93%&quot;.</>,
        <><strong>Always compare against &quot;no change&quot;.</strong> A forecast that can&apos;t beat &quot;tomorrow equals today&quot; after costs is not a trading signal.</>,
        <><strong>Test on your own data, walking forward in time,</strong> with the costs you would actually pay. Never trust a backtest on a market you don&apos;t trade.</>,
        <><strong>Start with volatility and risk,</strong> where the evidence for a real signal is strongest, and treat any price-direction signal with suspicion.</>,
        <><strong>Check the licence</strong> before building on a model: several of the strongest are non-commercial.</>,
      ]} />
      <P>
        Kronos is a genuinely interesting idea, and the candlestick-as-language framing is clever. It is a research model with a small, measurable edge on a narrow metric, not a free replacement for a trading desk. The paper is at https://arxiv.org/abs/2508.02739 and the code at https://github.com/shiyu-coder/Kronos. Follow what we&apos;re researching at https://x.com/myargoquest.
      </P>
    </>
  )
}

/* ── Post: How a small model can make an agent's routine choices, and when it shouldn't ── */
function SmallModelRoutineAgentChoicesContent() {
  return (
    <>
      <P>
        An AI agent working on a task calls a large language model at every step. Read this file? Run that command? Ask the user, or cancel the order? Each step is a full call to an expensive model, and a long task makes dozens of them. That is why agents are slow and why their bills grow so quickly.
      </P>
      <P>
        A paper published on 15 October 2026 by researchers at the University of Illinois Urbana-Champaign, Princeton and Google starts from a simple observation: most of those calls end in a multiple-choice decision. The harness (the program that runs the agent and gives it tools) already knows the options. It just asks the big model to pick one.
      </P>
      <P>
        The paper, called JevAgentHarness, tests whether a much smaller and cheaper model can make those picks instead. The answer is yes, with conditions, and the conditions are the useful part. This post explains how it works, what the numbers say, and how we plan to use it in the agents that run our second brain.
      </P>
      <H2>What is a decision model?</H2>
      <P>
        A language model writes text, one word at a time. A <strong>decision model</strong> does something narrower: you give it the situation and a list of options, and it returns a probability for each option. It doesn&apos;t write an answer; it scores the ones you list.
      </P>
      <P>
        Think of a restaurant kitchen. The head chef could decide every order, but most orders are routine: a line cook can plate a standard dish without asking. The chef is needed for the unusual order and the mistake that needs fixing. The analogy stops working in one place: a line cook knows when they are unsure and will ask. A decision model has to be told when it is allowed to decide on its own, and that turns out to be the whole problem.
      </P>
      <P>
        The paper&apos;s main decision model is Jev, a commercial model built for this kind of scoring. In one recorded run, a Jev call took 28% of the time and 2.6% of the price of a call to the language model it replaced.
      </P>
      <H2>Where can a small model take over?</H2>
      <P>
        The paper lists eight places in an agent&apos;s loop where a choice is made. Three decide what the agent does: which tool to call, which arguments to give it, and (in text games) which action to take. Five control the loop itself: whether to write to memory, what to read back from memory, whether to reflect after a failure, whether to stop, and whether to send this step to a cheaper language model.
      </P>
      <P>
        For each place, the small model can play one of five roles:
      </P>
      <UL items={[
        <><strong>Cascade:</strong> it decides when it is confident, and the big model decides otherwise.</>,
        <><strong>Replace:</strong> it always decides.</>,
        <><strong>Assist:</strong> it shortlists a few options and the big model picks.</>,
        <><strong>Guard:</strong> the big model proposes and the small model approves or sends it back.</>,
        <><strong>Trigger:</strong> it decides whether an optional step runs at all.</>,
      ]} />
      <H2>Why does a confidence threshold matter so much?</H2>
      <P>
        This is the paper&apos;s most important result. When the small model made every tool choice on its own (the replace role), agents solved 19.0 percentage points fewer tasks. With a fixed rule of &quot;decide if you are at least 50% sure&quot;, they lost 21.5 points.
      </P>
      <P>
        What worked was a <strong>threshold fitted on the agent&apos;s own runs</strong>. The authors first ran the agent normally while the small model answered every question silently, in what they call shadow mode. Then, for each kind of decision, they measured how often the big model was right, what a call costs, and how much a wrong choice hurts the task. From those three numbers they set the lowest confidence at which handing over is worth it.
      </P>
      <P>
        The fitted thresholds came out very high: 1.00 for tool choices and 0.99 for arguments. In other words, Jev was only trusted when it was practically certain. Even so, Jev handled 27.2% of tool choices and 20.8% of argument choices, which made the agent 14.2% cheaper without changing the outcome of any of 500 tasks.
      </P>
      <H2>Why don&apos;t benchmark scores tell you which model to use?</H2>
      <P>
        The authors tested several decision models on ordinary quiz-style questions, then put the same models in charge of a running agent. The rankings did not match. The model that scored best on isolated tool-choice questions, at 92.2%, completed only 69.5% of agent tasks. Their own small model scored lower on the quiz, 89.3%, but completed 91.5%.
      </P>
      <P>
        The reason is that an agent makes mistakes, and every mistake leads to a situation no quiz contains. A model that has never seen &quot;the state after I picked the wrong tool&quot; handles it badly. Scoring models on recorded agent runs, step by step, ranked them almost the way real task success did.
      </P>
      <H2>How did a 4-billion-parameter model beat the commercial one?</H2>
      <P>
        They trained a small open model, Qwen3-4B, on the situations their agent actually reached: 15,694 recorded decision points, 30.9% of them right after a mistake, with Jev&apos;s answers as the teacher&apos;s labels. That training took 2.2 GPU-hours. On new task variants, the agent&apos;s success with this model rose from 13.5% before training to 96.0% after. A second round of reinforcement learning added nothing measurable.
      </P>
      <P>
        With 4B models trained this way (a separate one for the household text games) making routine choices, the paper reports agents that were 81.1% to 89.0% cheaper and up to 2.5 times faster, without losing 3 or more points of task success. Answers took a median of 31 milliseconds, against 809 milliseconds for a call to the language model.
      </P>
      <H2>Where does it not work?</H2>
      <P>
        The paper is unusually clear about this:
      </P>
      <UL items={[
        <><strong>Irreversible steps.</strong> All 34 tasks the Jev-based setup failed began with a confident wrong choice that could not be undone, usually cancelling an order when it should have asked the customer first.</>,
        <><strong>New rules.</strong> A trained model that had never seen a new business rule dropped the agent to 3.0% success, against 88.0% for the language model alone. Refitting the threshold restored success, and retraining raised the model&apos;s accuracy on the new rule from 76.5% to 95.3%.</>,
        <><strong>Coding agents.</strong> A coding agent&apos;s actions are free text, so the small model can only pick which language model writes the next step. Savings there were 7.0% to 10.5%.</>,
        <><strong>Guards and memory.</strong> Roles that still call the big model, such as approving its proposals, mostly added cost.</>,
      ]} />
      <P>
        The authors released the code under the MIT license. What it ships today is a proxy for coding agents that sends routine steps to a fast model and hard ones to a strong model. It speaks the OpenAI API, and its README lists no Claude Code support.
      </P>
      <H2>How we plan to use this in our second brain</H2>
      <P>
        Our second brain is a folder of markdown notes that several AI agents read and write. Requests become cards on a kanban board, and named agents wake when a card, a direct message or a mention arrives for them. Each wake resumes the agent&apos;s previous session, which makes even a short wake cost real money.
      </P>
      <P>
        The same week this paper came out, we measured our wakes and found that about one in eight did nothing, a sixth of what our wakes cost: the agent read the message, decided there was nothing for it to do, and stopped. We had planned to put a cheap decision model in front of each wake to ask one question: does this message ask this agent to do anything? In the paper&apos;s terms, that is a trigger. It is the best kind of choice to delegate: one cheap question can save a whole expensive call, and a wrong &quot;skip&quot; can be recovered, because the agent wakes again on the next message.
      </P>
      <P>
        The paper changes how we will do it:
      </P>
      <UL items={[
        <><strong>Shadow mode first.</strong> The gate will answer every wake silently for at least 150 wakes, and we will compare its answers with what the agent actually did before it is allowed to skip anything.</>,
        <><strong>A threshold per question, from our own numbers.</strong> How often a wake is useful, what a wake costs, and what a missed wake costs come from our usage logs, not from a guess.</>,
        <><strong>Nothing irreversible.</strong> Deploys, merges, payments and public posts never go through a decision model. For our bots, merges and deploys already wait for a human approval, and they stay that way.</>,
        <><strong>Watch for drift.</strong> We will track the share of confident answers each week and refit the threshold whenever we change the model behind our agents.</>,
        <><strong>No coding router yet.</strong> The savings for coding agents are small, the released proxy lists no Claude Code support, and switching models can lose the prompt cache that makes our coding sessions cheap.</>,
      ]} />
      <P>
        All of this is a plan; none of it runs yet.
      </P>
      <H2>How to apply this to your own agents</H2>
      <P>
        If you run agents, three questions sort out where a small model could help:
      </P>
      <UL items={[
        <><strong>Which of your agent&apos;s calls are really multiple choice?</strong> Tool selection, &quot;is this done?&quot;, &quot;does this need me?&quot; are good candidates. Free-text writing is not.</>,
        <><strong>Can a wrong answer be undone?</strong> Delegate only the choices where a mistake costs a retry, never the ones that delete, pay or publish.</>,
        <><strong>Do you have your own logs?</strong> Run any new model silently against your agent&apos;s real decisions before trusting it. A good score on someone else&apos;s benchmark is not evidence for your agent.</>,
      ]} />
      <P>
        The paper is at https://arxiv.org/abs/2610.21412 and the code at https://github.com/JevAgentHarness/JevAgentHarness. We will write up what the shadow test shows. Follow along at https://x.com/myargoquest.
      </P>
    </>
  )
}

/* ── Post: Ten open-source agent ops repos, checked, and the ideas worth borrowing ── */
function TenAgentOpsReposWhatToBorrowContent() {
  return (
    <>
      <P>
        Running one AI agent is a prompt problem. Running ten of them, every day, against your own files and servers, is an operations problem: who is allowed to do what, how you know a task is really finished, what happens when an agent claims success it didn&apos;t earn, and how you see all of it at a glance.
      </P>
      <P>
        On 19 October 2026 the developer nyk posted a list of ten open-source repositories he described as &quot;the ops layer for agent fleets: control planes, policy gates, memory, quotas&quot;, with more than 18,000 GitHub stars between them. We run a second brain where several agents work on a shared folder of notes, a task board and a small company of named bots, so we read every repository&apos;s README and GitHub record to see what holds up and what we should borrow.
      </P>
      <P>
        This post goes through what each repo actually is, checked against GitHub on the same day, and then the nine ideas we think are worth taking.
      </P>
      <H2>Does the list hold up?</H2>
      <P>
        The star count does. The ten repositories have 18,291 stars in total, and every per-repo figure in the post matches GitHub. Three repositories hold 92% of them: mission-control, awesome-hermes-agent and council-of-high-intelligence.
      </P>
      <P>
        The description fits less well. Only two of the ten are an ops layer in the sense the post means. The others are useful in their own way, but they are a decision-making skill, two curated link lists, one command-line tool for X written twice in two languages, a marketing dashboard, a Solana web-app template first published in 2022, and a migration script whose own README now recommends the built-in command instead.
      </P>
      <P>
        That is normal for a list that bundles someone&apos;s whole body of work. It is worth knowing before you install anything.
      </P>
      <H2>What are the two real ops tools?</H2>
      <P>
        <strong>mission-control</strong> is a self-hosted dashboard for agent fleets: a task board with review stages, a registry of agents that report a heartbeat, a cost view, scheduled tasks and approvals. Agents talk to it over a REST API, a command-line tool or an MCP server (a standard way to give an agent tools). The README marks it alpha and says support varies by agent runtime.
      </P>
      <P>
        Its most useful idea is a gate its README calls Aegis: <strong>a task cannot move to done without an approval record</strong>, and a &quot;completion receipt&quot; shows what actually finished, separately from the logs of what ran.
      </P>
      <P>
        <strong>lacp</strong> is a local control plane that wraps command-line coding agents. It sorts commands into risk tiers (safe, review, critical) with short-lived approval tokens for the risky ones, and it installs a set of hooks for Claude Code. A hook is a small program that runs before or after an agent&apos;s action and can stop it. Its hooks include a guard that blocks dangerous commands, a check that validates a file&apos;s header after every write, and a check that runs when the agent says it is finished. A <code>lacp doctor --json</code> command reports the health of the whole setup in one go.
      </P>
      <P>
        One caution: lacp has 306 stars but only 2 forks and 1 open pull request. A tool that people install usually collects more of both. That is not proof of anything, but it is a reason to read the code before relying on it.
      </P>
      <H2>What about the rest?</H2>
      <UL items={[
        <><strong>council-of-high-intelligence</strong> is a skill (a written procedure an agent loads when needed) that runs a hard decision past personas of historical and modern thinkers, who argue blind, then cross-examine each other. Its best parts are not the personas. Every claim is labelled as a fact, an inference, an assumption or an open question, and every decision goes into an outcome ledger with a prediction, an owner and a review date, so it can later be marked confirmed, revised, reversed or inconclusive.</>,
        <><strong>awesome-hermes-agent</strong> is a directory of skills, plugins and memory providers for the Hermes agent, with maturity tags. It sells paid featured listings and says so. Its checklist for trusting a community skill is worth copying.</>,
        <><strong>marketing-dashboard</strong> is a local marketing console with content approval queues. Its three settings that let an agent write back are off by default.</>,
        <><strong>awesome-agent-cortex</strong> is a broad reading list of the agent stack, including a guide to structuring a notes vault that agents work in.</>,
        <><strong>xint</strong> and <strong>xint-rs</strong> are the same research tool for X, in TypeScript and in Rust. It can print a machine-readable list of what it is able to do, and its MCP server refuses outside connections unless a token is set.</>,
        <><strong>openclaw-to-hermes</strong> migrates a setup from one agent framework to another; its own README now points to a built-in command.</>,
        <><strong>builderz-solana-dapp-scaffold</strong> is a starter template for Solana web apps and has nothing to do with agents.</>,
      ]} />
      <H2>Nine ideas worth borrowing</H2>
      <P>
        We are not adopting any of these repositories. mission-control would be a second dashboard and a second database next to the one we already run, and lacp wraps agents we already wrap. The mechanisms are the valuable part. In order of how much we think each would help:
      </P>
      <UL items={[
        <><strong>A task can&apos;t be marked done without a receipt.</strong> Our project tracker already refuses to mark a feature live without a passing check. Our task cards have no such rule: a bot can close its own card on its own word. A card should need a check result, a test output, a file path or a link before it closes.</>,
        <><strong>Check what was written, not only where.</strong> Our guard hook already runs before commands and file writes, but it only checks where the agent is going. A second hook after each write could reject a new note that doesn&apos;t link to its project, at the moment it is written instead of whenever someone notices.</>,
        <><strong>Ask for evidence when an agent says it&apos;s finished.</strong> We already send an agent back if it changed code without writing a development log. The same check could flag a final message that claims success with no command output, test or file to show for it.</>,
        <><strong>One health command for the morning briefing.</strong> A single command that reports whether the hooks are installed, the guard rules are loaded, backups ran and the task dispatcher is alive, printed as one line in the daily stand-up.</>,
        <><strong>Label evidence and keep an outcome ledger.</strong> Fact, inference, assumption or open question on every claim, and a dated prediction on every decision that we come back to and score. This fits our investment committee&apos;s votes and our research notes directly.</>,
        <><strong>Writes off by default.</strong> Any page in our app that lets an agent change a scheduled job, a skill or a setting should start read-only and be switched on deliberately.</>,
        <><strong>A trust check before adding a shared skill:</strong> who can trigger it, what tools it gets, where it runs, which credentials it can read, and how to stop it.</>,
        <><strong>Local-only by default for tool servers.</strong> Any MCP server we run should listen only on the machine itself unless a token is set.</>,
        <><strong>Heartbeats for named bots.</strong> Show when each bot last woke and which tasks it holds, on the page where we watch the bots.</>,
      ]} />
      <H2>What&apos;s built and what&apos;s next</H2>
      <P>
        None of the nine is built yet. The first one, receipts before a card can close, is the one we expect to build first, because it closes a gap we have already hit once: work that moved forward without a check. The two hook ideas are one new hook and one change to a hook we already run. We will write up what changes after we build them.
      </P>
      <H2>How to use this list yourself</H2>
      <P>
        If you run more than one agent, look at three things in your own setup. Can an agent mark its own work complete with no evidence? Do your checks run only before commands, or also after file writes and at the end of a session? And can you see every agent&apos;s state in one place without opening a terminal? The repositories above each answer one of those questions. Read the code before installing any of them, and take the idea even if you skip the software.
      </P>
      <P>
        The original list is at https://x.com/nykdotdev/status/2112098192963625206. Follow what we build at https://x.com/myargoquest.
      </P>
    </>
  )
}

/* ── Post: T3 Code explained, the open-source app that runs your coding agents from one place ── */
function T3codeExplainedContent() {
  return (
    <>
      <P>
        If you use AI coding agents, you probably have more than one. Claude Code in one terminal, Codex in another, maybe Cursor&apos;s agent too. Each has its own window, its own way of asking for permission, and its own history. When you step away from your desk, all of them stop being reachable. And when an agent makes a mess of your code, undoing exactly what it did is often harder than it should be.
      </P>
      <P>
        T3 Code is an open-source app built to fix that. It runs on your own computer, takes control of the agents you already have installed and logged in, and gives you one interface for all of them: a desktop app, a web app, and phone apps for iOS and Android. It is built by Theo and Julius and the team at T3 Tools, released under the MIT licence. On 21 October 2026 it had 28,908 stars on GitHub and shipped version 0.1.1, its latest stable release.
      </P>
      <P>
        This post explains what T3 Code is for, how it works inside, how to set it up, and the ideas from its design we are bringing into our own agent setup.
      </P>
      <H2>What is T3 Code for?</H2>
      <P>
        The team calls it an &quot;agent harness control surface&quot;. A <strong>harness</strong> is the program that wraps a language model and turns it into an agent: it feeds the model your request, runs the tools the model asks for (read a file, run a command), and loops until the work is done. Claude Code and Codex are harnesses. T3 Code is not another one. It sits on top of them and controls them.
      </P>
      <Figure
        src="/blog/t3code-explained-1.jpg"
        alt="The T3 Code README on GitHub, with the line calling it an agent harness control surface highlighted"
        width={1575}
        height={945}
        priority
        caption="The README's own description. Screenshot: github.com/pingdotgg/t3code"
      />
      <P>
        The team describes it as a &quot;bring-your-own-subscription&quot; app. T3 Code does not resell model access. If Claude Code is installed and logged in on your machine, T3 Code drives that copy, on your plan. The same goes for Codex, Cursor, Grok Build, OpenCode, Google&apos;s Antigravity, and agents from the ACP Registry (a public list of agents that speak a shared protocol, covered below).
      </P>
      <P>
        What you get from that one layer:
      </P>
      <UL items={[
        <><strong>One place for every agent.</strong> Start a task with Claude, switch the same conversation to Codex, and keep the history.</>,
        <><strong>Parallel work without collisions.</strong> Each task can run in its own copy of your repository, so two agents never edit the same files.</>,
        <><strong>Every step can be undone.</strong> After each turn of work, T3 Code saves a snapshot of your files that you can compare against or roll back to.</>,
        <><strong>Control from anywhere.</strong> The phone app connects to the computer where the agents run.</>,
        <><strong>Agents that can use it too.</strong> Other agents can connect to T3 Code and start or message tasks, with permissions you choose.</>,
      ]} />
      <H2>How does it work inside?</H2>
      <P>
        T3 Code has three layers: a server on your computer, the apps you look at, and adapters that talk to each agent.
      </P>
      <Figure
        src="/blog/t3code-explained-2.jpg"
        alt="Diagram: your phone, web and desktop apps connect over WebSocket to the T3 server on your computer, which runs command, orchestrator, one SQLite transaction and an effect worker, drives your agents through adapters, creates worktrees of your git repository and keeps per-turn checkpoints in it"
        width={1920}
        height={1080}
        caption="T3 Code's shape: the apps are remotes, the server on your machine owns the work. Diagram by Argo from the repo's architecture notes."
      />
      <H3>The server owns everything</H3>
      <P>
        The server is a Node.js program that runs on the machine where your code lives. It owns the agent processes, the terminals, git and your project files. The apps never touch those directly. A phone or a browser on another machine sends requests to the server and shows what the server sends back.
      </P>
      <P>
        The project&apos;s own glossary makes this explicit: an environment is &quot;one running T3 server and the machine, filesystem, provider credentials, and state it owns&quot;. The phone, the browser and the desktop window are only clients of it. Think of the server as a workshop and the apps as walkie-talkies. You can give instructions from anywhere, but the tools never leave the workshop.
      </P>
      <H3>Every request is written down before anything happens</H3>
      <P>
        When you send a message, the server does not immediately start an agent. It follows four steps:
      </P>
      <UL items={[
        <><strong>Command:</strong> your request becomes a typed command.</>,
        <><strong>Decision:</strong> a part called the <strong>orchestrator</strong> decides what events the command produces, without touching the disk or the network.</>,
        <><strong>Commit:</strong> one database transaction saves the events, the views the apps read, a <strong>receipt</strong> for the command, and a list of side effects still to do (an &quot;outbox&quot;).</>,
        <><strong>Effects:</strong> only then does a worker carry out the side effects, such as starting the agent&apos;s turn or saving a snapshot, and report the results back as new commands.</>,
      ]} />
      <P>
        The analogy is a restaurant ticket. The waiter writes your order on a ticket and pins it up before the kitchen starts cooking. If the waiter gets interrupted, the ticket is still there. If you repeat your order, the kitchen sees the same ticket and doesn&apos;t cook it twice. The analogy stops where the kitchen does: the database transaction is all-or-nothing, which a pinned ticket isn&apos;t.
      </P>
      <Figure
        src="/blog/t3code-explained-3.jpg"
        alt="Diagram of four steps: command, decision by the orchestrator, one transaction committing events, views, receipt and outbox, then effects run by a worker, with results returning as new commands"
        width={1920}
        height={1080}
        caption="Every message is written down before anything runs. Diagram by Argo."
      />
      <P>
        Two consequences follow. When the app says your message was received, it means the intent is safely recorded, not that the agent has finished. And sending the same command twice is harmless, because the stored receipt is found and returned. The event log is the source of truth for what every task is doing, and it lives in a SQLite database file on your computer.
      </P>
      <H3>Snapshots are hidden git references</H3>
      <P>
        At the end of every turn, T3 Code captures the state of your files as a <strong>checkpoint</strong>. It stores these as hidden git references (named under <code>refs/t3/</code>), which are like bookmarks inside your repository&apos;s history that don&apos;t show up as commits on your branch. Your branch stays clean, and the app can show you exactly what one turn changed, or restore the files to before it.
      </P>
      <P>
        Restoring files alone is not enough: the agent also remembers what it did. So a rollback has to deal with the agent&apos;s conversation too. Agents that can rewind their conversation do so. Some agents from the ACP Registry instead start a fresh session after the files are restored. For Google&apos;s Antigravity, which cannot roll back its conversation, T3 Code refuses the rollback before it touches any file.
      </P>
      <H3>Adapters translate each agent&apos;s language</H3>
      <P>
        Every agent speaks a different protocol, and T3 Code keeps those differences at the edge. For each one there is an <strong>adapter</strong>, a translator that turns the agent&apos;s native messages into T3 Code&apos;s common events:
      </P>
      <UL items={[
        <><strong>Claude Code</strong> is driven through Anthropic&apos;s Claude Agent SDK, a library that lets a program run Claude Code.</>,
        <><strong>Codex</strong> runs as <code>codex app-server</code>, so T3 Code talks to it program to program.</>,
        <><strong>Cursor</strong> goes through Cursor&apos;s SDK.</>,
        <><strong>Grok Build, Antigravity and Registry agents</strong> use the <strong>Agent Client Protocol</strong> (ACP), a shared protocol many agents implement, with a public registry of agents T3 Code can add.</>,
      ]} />
      <P>
        The rest of the app never asks &quot;is this Claude or Codex?&quot; It asks what the agent can do. If an agent lacks a capability, such as rolling back its conversation, that gap is written down explicitly and the app handles it by rule.
      </P>
      <H3>Worktrees keep parallel tasks apart</H3>
      <P>
        When you start a task, you can choose <strong>New worktree</strong>. A <strong>git worktree</strong> is a second working folder for the same repository, on its own branch. Two agents in two worktrees can edit freely without touching each other&apos;s files. T3 Code puts worktrees in its own folder, can run a setup script when one is created, and can delete them automatically after a set number of idle days or after the task is settled.
      </P>
      <Figure
        src="/blog/t3code-explained-4.jpg"
        alt="Diagram of one repository with two worktrees, one for Claude Code and one for Codex, each with a row of checkpoints saved per turn and an arrow rolling the latest turn back"
        width={1920}
        height={1080}
        caption="Two agents, two worktrees, a checkpoint after every turn. Diagram by Argo."
      />
      <H3>Handing a task to another agent</H3>
      <P>
        You can switch a conversation from one agent to another. T3 Code does not ask the old agent to summarise. Instead it builds a <strong>portable handoff</strong>: the original request, the most recent messages and command results, and pointers to the rest of the history, which the new agent can read on demand. The default budget is 16,000 tokens (a token is a word or a piece of one). In the project&apos;s words, it is &quot;a budgeted selection, not an agent-written summary&quot;.
      </P>
      <P>
        Agents can also hand work to each other. T3 Code runs an <strong>MCP server</strong> (MCP, the Model Context Protocol, is a standard way to give an agent tools). Through it, an agent can start a sub-agent on any installed provider, wait for its result, or cancel it. The sub-agent gets only the task it was given, not the parent&apos;s whole conversation. Each agent session gets its own short-lived credential for this, tied to that one task thread and session, which expires when idle and is revoked when the session ends.
      </P>
      <H3>Permissions</H3>
      <P>
        Each task has a permission mode:
      </P>
      <UL items={[
        <><strong>Supervised:</strong> asks you before running commands or changing files.</>,
        <><strong>Auto-accept edits:</strong> file edits go through; other actions can still ask.</>,
        <><strong>Auto:</strong> the agent&apos;s own automatic review approves routine actions.</>,
        <><strong>Full access:</strong> no approval prompts.</>,
      ]} />
      <P>
        New tasks start in Full access unless you change the default in Settings. If you are trying it on code you care about, switch the default to Supervised first.
      </P>
      <Figure
        src="/blog/t3code-explained-5.jpg"
        alt="T3 Code's permission modes document on GitHub, with the sentence saying the initial default is Full access highlighted"
        width={1505}
        height={945}
        caption="The default for new threads is Full access. Screenshot: docs/user/permission-modes.md in the T3 Code repo"
      />
      <H2>How do you set it up?</H2>
      <P>
        T3 Code controls agents you already have, so start with at least one of them installed and logged in on the machine that will do the work. For example, install Claude Code and run <code>claude auth login</code>, or install the Codex CLI (its command-line tool) and run <code>codex login</code>.
      </P>
      <P>
        Then install T3 Code itself. On macOS or Linux:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"curl -fsSL https://t3.codes/install.sh | sh"}</code></pre>
      <P>
        On Windows, in PowerShell:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"irm https://t3.codes/install.ps1 | iex"}</code></pre>
      <P>
        To try it once without installing anything, run <code>npx t3@latest</code> (this needs Node.js). If you prefer a desktop app, there are installers on the project&apos;s GitHub releases page, and package managers carry it: <code>brew install --cask t3-code</code> on macOS, <code>winget install T3Tools.T3Code</code> on Windows.
      </P>
      <P>
        From there:
      </P>
      <UL items={[
        <><strong>Start it.</strong> Run <code>t3</code>. It starts the server and opens the web app in your browser. <code>t3 ./my-project</code> starts in a specific folder.</>,
        <><strong>Turn on a provider.</strong> Open Settings, then Providers, and enable the agent you logged in to.</>,
        <><strong>Start a task.</strong> Add your project folder, open a new thread, pick a permission mode, and choose New worktree if the change needs its own branch.</>,
        <><strong>Review.</strong> After each turn, look at the diff (the line-by-line changes) from its checkpoint, and roll back if you don&apos;t like it.</>,
        <><strong>Keep it running.</strong> <code>t3 service install</code> runs it in the background on macOS and Linux. <code>t3 update</code> moves to a newer release.</>,
        <><strong>Connect your phone.</strong> Install the T3 Code app from the App Store or Google Play. Either run <code>t3 connect</code> to use T3&apos;s tunnel service, or start the server on your private network address with <code>t3 serve --host &lt;your-private-ip&gt;</code> and run <code>t3 pair</code> to get a one-time pairing link and QR code.</>,
      ]} />
      <P>
        Two settings worth knowing before you start. The server sends product usage data (which agent and model you used, how long a turn took, token totals, and hashed identifiers for your accounts, but not your prompts or code) to T3 Code&apos;s own endpoint, which forwards it to PostHog. Set <code>T3CODE_TELEMETRY_ENABLED=false</code> in the server&apos;s environment to turn that off. And remember the Full access default above.
      </P>
      <P>
        The project is honest about its stage. The README says &quot;We are very very early in this project. Expect bugs&quot;, and the team is mostly not accepting outside contributions yet.
      </P>
      <H2>What we are taking from it</H2>
      <P>
        We run our own small company of AI agents. Requests arrive as messages, become cards on a kanban board (a board of task cards that move from to-do to done), and specialist bots pick them up. T3 Code solves a close cousin of our problem, for one developer instead of a team of bots, and several of its ideas carry over directly. These are plans; none of them is built yet.
      </P>
      <UL items={[
        <><strong>A separate worktree for every code task, and a snapshot after every bot turn.</strong> With one worktree per card and a hidden-reference checkpoint per turn, a reviewer can see exactly what each turn changed and undo one turn without asking the bot.</>,
        <><strong>Short-lived, task-scoped credentials.</strong> T3 Code gives each agent session a credential for one task that expires on its own. Scoping access to one card and one run means a mistake can only reach what that card needed.</>,
        <><strong>Write the request down first.</strong> When a message arrives, we will record it with its message id as a receipt before filing any card. A repeated message then returns the same card instead of creating a duplicate, and &quot;received&quot; never gets confused with &quot;done&quot;.</>,
        <><strong>Hand over a brief, not a transcript.</strong> When one bot delegates to another, the helper gets the task and a role line, and reports back one result. The parent task only closes on its own check. This matches a Princeton and UC Berkeley study of teams of specialist agents that we wrote up recently: long chains of hand-offs lose context.</>,
        <><strong>Write down what each bot can and can&apos;t do.</strong> T3 Code routes by what each agent declares it can do, and a missing capability is handled by an explicit rule. We will add the same to our bot list, alongside a record of how each bot has actually performed.</>,
        <><strong>Make questions durable and every action reversible.</strong> In T3 Code a question from Codex is stored and survives restarts until answered once, and the project&apos;s <code>AGENTS.md</code>, its guide for coding agents, states the rule plainly: &quot;A one-way door is a bug.&quot; Our questions to the human in charge should work the same way in our dashboard.</>,
      ]} />
      <P>
        We will also try T3 Code itself, on a laptop, with telemetry off and Supervised mode, as a way to steer coding agents from a phone.
      </P>
      <P>
        T3 Code&apos;s source is at https://github.com/pingdotgg/t3code and its docs are in the repository&apos;s <code>docs</code> folder. We&apos;ll post what we build from these ideas on this blog and at https://x.com/myargoquest.
      </P>
    </>
  )
}

/* ── Post: A private AI brain for your company, on your own server: a step-by-step guide ── */
function PrivateCompanyAiBrainContent() {
  return (
    <>
      <P>
        A law firm wants an AI agent that knows every matter it has worked on: the contracts, the advice given, the deadlines, the house style. That agent would be useful on day one. It would also be the most sensitive system the firm owns, because everything it knows is client information the firm has promised to keep confidential.
      </P>
      <P>
        Most AI tools solve the first half and quietly give up the second. The notes live in someone else&apos;s cloud and the firm&apos;s knowledge becomes a row in a vendor&apos;s database. For a company bound by confidentiality, privilege or data protection law, that trade is often not allowed.
      </P>
      <P>
        We wrote this guide for the Entity Onchain Legal Summit at Devcon VIII in Mumbai, where we have applied to speak. The summit asks who answers for the agents inside an organisation. Our answer starts one step earlier: an organisation can only answer for its agents if it owns what they know and can see what they do. This post shows how to set that up with free, open-source parts, on a server you control.
      </P>
      <Figure
        src="/blog/private-company-ai-brain-1.jpg"
        alt="The Entity Onchain Legal Summit website showing the date, Wednesday 4 November 2026, the Devcon Legal and Governance Hub in Mumbai, and the tagline a working summit, not a showcase"
        width={1225}
        height={753}
        priority
        caption="The summit this post was written for. Screenshot: legalsummit.io"
      />
      <H2>What does &quot;owning your AI brain&quot; mean?</H2>
      <P>
        It means three things stay with you: the knowledge, the agent, and the record of what the agent did. Only one thing has to leave, and only for a moment: the context the agent sends a language model for one task, which can include passages from files it has read.
      </P>
      <P>
        The parts that make this possible:
      </P>
      <UL items={[
        <><strong>Second Brain</strong> (<A href="https://github.com/kon-rad/secondbrain">github.com/kon-rad/secondbrain</A>, MIT licence): a knowledge base made of plain markdown files in a private git repository, plus a web app that searches it and, with an optional module, maps it. Markdown is a text file with light formatting, so any editor can open it and nothing locks you in.</>,
        <><strong>Hermes Agent</strong> by Nous Research (<A href="https://github.com/NousResearch/hermes-agent">github.com/NousResearch/hermes-agent</A>, MIT licence): an AI agent that runs on your server, reads and writes your files, and works with any model provider that speaks the common OpenAI-style API.</>,
        <><strong>A private model route:</strong> Venice, OpenRouter with zero data retention, Morpheus, or a model running on your own hardware.</>,
      ]} />
      <Figure
        src="/blog/private-company-ai-brain-2.jpg"
        alt="Diagram: a dashed box marks your server, holding the vault, the Second Brain app, the Hermes agent, an optional local model and an encrypted disk; only the context for one task at a time goes out to OpenRouter, Venice or Morpheus, and backups leave encrypted"
        width={1920}
        height={1080}
        caption="What stays inside and what leaves. Diagram by Argo."
      />
      <P>
        A useful picture is a company library with a reading room. The books never leave the building. When a researcher needs an outside expert, they copy one page, ask the question and bring the answer back. The analogy stops working in one place: the expert still reads that page, so who that expert is matters.
      </P>
      <H2>Why does this matter for legal and regulated work?</H2>
      <P>
        Two rules from two systems show the shape of the duty. In the United States, ABA Model Rule 1.6 says a lawyer &quot;shall not reveal information relating to the representation of a client unless the client gives informed consent&quot;, with a few narrow exceptions. In the EU, Article 28 of the GDPR says a controller &quot;shall use only processors providing sufficient guarantees&quot;, under a contract. Pasting client files into a consumer chatbot fits neither comfortably.
      </P>
      <P>
        Owning the stack does not make you compliant by itself. It does change the questions you have to answer. Instead of &quot;where does the vendor keep our data?&quot;, you ask &quot;which model provider sees a prompt, under what terms, and for how long?&quot; That is a much smaller question. None of this is legal advice; your own counsel decides what your rules require.
      </P>
      <Figure
        src="/blog/private-company-ai-brain-3.jpg"
        alt="Diagram of six setup steps: a server you control with disk encryption, the vault, the app locked with a password and authenticator, Hermes on the same box, a private model route, and encrypted backups"
        width={1920}
        height={1080}
        caption="The setup in order. Diagram by Argo."
      />
      <H2>Step 1: where should the brain live?</H2>
      <P>
        Start with an Ubuntu machine you can reach over ssh (a secure remote login). It can be a box in your office or a rented cloud server in your own account. The Second Brain deploy script expects &quot;Ubuntu, reachable as root over ssh&quot;.
      </P>
      <P>
        <strong>Turn on disk encryption before anything else.</strong> Second Brain does not encrypt your notes itself: the files are plain markdown and the search index is a normal Postgres database. Encryption at rest is your job, and it is easiest at the start. On your own hardware, choose the disk encryption option in the Ubuntu installer. On a rented server, check what your provider encrypts, and keep the vault on a volume whose key you hold. Then a pulled drive or a stolen snapshot is unreadable.
      </P>
      <H2>Step 2: how do you store the knowledge?</H2>
      <P>
        The vault is your company&apos;s knowledge base: one private git repository with four top-level folders (Projects, Areas, Research, Archives). The Second Brain engine sits inside it as a git submodule, a pinned pointer to the public code, so the engine never contains your notes. Its README puts it plainly: &quot;Private by construction: the engine never sees your notes.&quot;
      </P>
      <P>
        On your laptop, install git, Node.js 22 or newer, Python 3.9 or newer, and Postgres 15 or newer with the pgvector extension (which lets Postgres search by meaning). Then run:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"mkdir my-vault && cd my-vault && git init\ngit submodule add https://github.com/kon-rad/secondbrain.git .secondbrain\n.secondbrain/bin/secondbrain-vault init .\ncp .env.example .env\ngit add -A && git commit -m \"new vault\""}</code></pre>
      <P>
        <code>init</code> lays out the folders and writes <code>AGENTS.md</code>, the rulebook every agent in the vault follows. The <code>.env</code> file holds your keys and is ignored by git. Push the vault only to a <strong>private</strong> remote you control; the engine&apos;s guide says &quot;Never make your vault public.&quot;
      </P>
      <H2>Step 3: how does the team reach it, and nobody else?</H2>
      <P>
        The app gives your team search over the whole vault, links between notes and, with the map module, a map of how they connect. On a server it always requires a login: a password stored only as a scrypt hash (a one-way scramble that is slow to crack) plus a code from an authenticator app. The deployment guide is blunt: &quot;there is no &apos;auth off&apos; for a server.&quot;
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{".secondbrain/app/bin/secondbrain auth-setup"}</code></pre>
      <P>
        This prints a password hash and an authenticator secret; keep them for the server. Add three deploy settings (<code>DEPLOY_HOST</code>, <code>DEPLOY_PUBLIC_HOST</code>, <code>DEPLOY_VAULT_DIR</code>) to your vault&apos;s <code>.env</code>, then run:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{".secondbrain/app/deploy/deploy.sh"}</code></pre>
      <P>
        The script installs Node, Postgres with pgvector and Caddy on the server. When it finishes, put the two login lines (and your public address) in the server&apos;s <code>/etc/secondbrain/env</code> and restart the app with <code>systemctl restart secondbrain</code>. Caddy is the web server in front of the app: it serves the app over HTTPS only (plain HTTP just redirects), and the app itself listens only on the machine&apos;s internal address, so Caddy is the single way in. Five failed logins lock an address out for 15 minutes. If your team should not reach the app from the open internet at all, put the server on a private network such as Tailscale or WireGuard.
      </P>
      <P>
        The server&apos;s copy of the vault stays current through a git pull you schedule (a cron job or a timer). The getting-started guide puts a local setup at &quot;About 15 minutes, most of it installing Postgres&quot;, and the server script installs Postgres for you.
      </P>
      <P>
        <strong>Keep search private too.</strong> Keyword search works with no keys at all. Semantic search (finding notes by meaning) needs embeddings, numeric fingerprints of each passage. Run Ollama on the same server with the <code>bge-m3</code> model (<code>DEPLOY_EMBED=1</code> sets it up), set the embeddings provider to <code>ollama</code> on the app&apos;s Sources page, and no text leaves for search. The app&apos;s &quot;ask the database in plain language&quot; box currently uses a hosted model (Together AI), so leave its key unset if that is a concern.
      </P>
      <H2>Step 4: where does the agent run?</H2>
      <P>
        Hermes is the agent your team talks to. It reads the vault, writes notes, runs tools and remembers what it learned. Install it on the server with one line from its README:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"curl -fsSL https://hermes-agent.nousresearch.com/install.sh | bash"}</code></pre>
      <P>
        Then connect it to the vault&apos;s guardrails. Second Brain ships two hooks, small programs that run around the agent&apos;s actions: a guard that blocks the agent from printing key files or force-pushing (overwriting the shared git history), and a gate that asks for a written log of what changed before the agent calls a job done. Copy the block from <code>.secondbrain/harness/hermes-hooks.example.yaml</code> into <code>~/.hermes/config.yaml</code>, replace the example vault path with yours, and approve each hook once; Hermes then runs both, plus the vault&apos;s shared skills. Check that the hooks fire: if the command in the config and the approved command differ, Hermes skips the hook without a warning.
      </P>
      <P>
        Be precise about what the guard is. The engine&apos;s docs call the hooks &quot;guardrails, not a sandbox&quot;: they stop the agent&apos;s own tools, but a script the agent writes can read anything its Unix user can. Run Hermes as its own user (for example, a dedicated <code>hermes</code> account), and keep anything it must never read under a different one.
      </P>
      <H2>Step 5: which model sees the question?</H2>
      <P>
        This is where a task&apos;s context leaves the building. Hermes &quot;works with any OpenAI-compatible API endpoint&quot;, so each route is a few lines in <code>~/.hermes/config.yaml</code>, with the key in <code>~/.hermes/.env</code>. <code>hermes model</code> walks you through the same choices interactively.
      </P>
      <Figure
        src="/blog/private-company-ai-brain-4.jpg"
        alt="Diagram, two by two, comparing four ways to run the model: a local model, Venice private models, OpenRouter with zero data retention and Morpheus, by where it runs, who sees the prompt, who keeps it and the Hermes setting"
        width={1920}
        height={1080}
        caption="Four model routes compared, from each provider's documentation in October 2026. Diagram by Argo."
      />
      <H3>Venice: private models</H3>
      <P>
        Venice serves open models through its own proxy and says it &quot;does not store or log prompt and response content for normal inference&quot;. Use models marked private (the <code>/models</code> endpoint shows each model&apos;s privacy mode). Models marked anonymized are different: Venice hides who you are, but &quot;Prompt content is still visible to that provider.&quot; For text, Venice also offers end-to-end encrypted models, where &quot;only the verified TEE decrypts&quot; the prompt; a TEE is a sealed area of a processor that even the machine&apos;s operator cannot read. Venice&apos;s no-retention promise for private models is a contractual one, so read its terms as you would any processor&apos;s.
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"model:\n  default: zai-org-glm-5\n  provider: custom\n  base_url: https://api.venice.ai/api/v1\n  key_env: VENICE_API_KEY"}</code></pre>
      <Figure
        src="/blog/private-company-ai-brain-5.jpg"
        alt="Venice's privacy documentation with the sentence saying Venice does not store or log prompt and response content highlighted"
        width={1575}
        height={945}
        caption="Venice's own privacy statement. Screenshot: docs.venice.ai"
      />
      <H3>OpenRouter: one key, zero data retention</H3>
      <P>
        OpenRouter gives you many models from many providers behind one key. By default it may route to providers that store data. Turn on <strong>Zero Data Retention</strong> in your account&apos;s privacy settings, and OpenRouter will &quot;only allow you to route to endpoints that have a Zero Data Retention policy&quot;. Its docs define that as a provider that &quot;will not store your data for any period of time&quot;. Hermes supports OpenRouter by name:
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"model:\n  default: <a model that has ZDR endpoints>\n  provider: openrouter"}</code></pre>
      <P>
        Put <code>OPENROUTER_API_KEY</code> in <code>~/.hermes/.env</code>. Set ZDR on the account, not only per request: Hermes&apos;s routing settings include <code>data_collection: deny</code> but no ZDR switch of their own.
      </P>
      <Figure
        src="/blog/private-company-ai-brain-6.jpg"
        alt="OpenRouter's Zero Data Retention documentation with the definition highlighted: a provider will not store your data for any period of time"
        width={1575}
        height={945}
        caption="OpenRouter's definition of zero data retention. Screenshot: openrouter.ai/docs"
      />
      <H3>Morpheus: an open inference marketplace</H3>
      <P>
        Morpheus is a decentralized marketplace on Base (a network built on Ethereum) where independent providers &quot;register their models via bids on the blockchain&quot; and users pay for sessions. The quick way in is its hosted gateway, an OpenAI-compatible endpoint that needs &quot;no node, no wallet, just an API key&quot;.
      </P>
      <pre style={{ margin: '24px 0', padding: '18px 20px', background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)', borderRadius: 12, fontSize: 13.5, lineHeight: 1.6, overflowX: 'auto', whiteSpace: 'pre-wrap', color: 'var(--text)' }}><code>{"model:\n  default: glm-5.1\n  provider: custom\n  base_url: https://api.mor.org/api/v1\n  key_env: MORPHEUS_API_KEY"}</code></pre>
      <P>
        The gateway trades control for convenience: you &quot;give up self-custody of the wallet and direct on-chain control of sessions&quot;. For the strongest setup, run your own Morpheus node; checking a provider&apos;s TEE attestation (the hardware&apos;s signed proof that it is running sealed, unmodified code) requires &quot;running your own consumer-side proxy-router&quot;. Which models are available depends on which providers are active at the time.
      </P>
      <H3>Or keep the model at home</H3>
      <P>
        If even one prompt may not leave, run an open model on a machine you own with Ollama, and point Hermes at it with <code>provider: custom</code> and <code>base_url: http://localhost:11434/v1</code>. Raise <code>context_length</code> in the config, because Ollama&apos;s default is often too small for an agent. You trade model strength and speed for a setup where nothing leaves at all. Many teams mix the two: a local model for the most sensitive matters, a private route for the rest.
      </P>
      <H2>Step 6: how do you back it up without giving it away?</H2>
      <P>
        The last piece is the long-term memory itself. Your vault is already a git repository, so a backup is a <code>git push</code> to a private remote you control. If that remote is not yours (a hosted git service), encrypt the files before they leave with a tool such as git-crypt or age. The search index in Postgres is disposable: it is rebuilt from the markdown, so losing it costs you a rescan, not your knowledge (records kept by optional modules, such as the project tracker, live only in the database). For those, the engine has an optional nightly database backup (<code>DEPLOY_DB_BACKUP=1</code>) that uploads the dump to Backblaze B2 through b2store, a separate tool that stores it encrypted.
      </P>
      <H2>Who answers for the agent?</H2>
      <P>
        This is the summit&apos;s question, and owning the stack gives you material to answer it. If each agent commits under its own git identity, every note it writes is a commit with a time and an author, so you can see what it changed and roll it back. The rulebook it follows is a file you wrote and can show an auditor. The guard records what it refused. When an agent changed skills, scripts or config, the dev log gate sends it back once to write an account of what was done and how it was checked. None of this settles liability, but it turns &quot;what did the agent do, and under whose rules?&quot; from a guess into a record.
      </P>
      <H2>What&apos;s built and what&apos;s next</H2>
      <P>
        Built and running: Argo runs its own company on this stack. Our vault, the Second Brain app and a team of Hermes agents live on our own server; two agent profiles run on an open model on our own hardware with no cloud fallback, and the server&apos;s main agent uses OpenRouter, with a Morpheus route set up as an alternative. Both projects are free and MIT licensed.
      </P>
      <P>
        Not built yet: Second Brain does not encrypt notes itself, so disk and backup encryption are steps you take, as above. The plain-language database box only supports one hosted provider for now, and Hermes has no per-request zero-retention switch of its own. We would like to fix the first two in the engine.
      </P>
      <P>
        You can run a capable agent today without handing over what it knows. The code is at <A href="https://github.com/kon-rad/secondbrain">github.com/kon-rad/secondbrain</A>; follow along at <A href="https://x.com/myargoquest">x.com/myargoquest</A>, or come and argue with us in Mumbai.
      </P>
    </>
  )
}

/* ── Post: Why long sessions fill a Claude Max plan ── */
function WhyLongSessionsFillClaudeMaxPlanContent() {
  return (
    <>
      <P>Our Claude Max plan kept reaching 100% of its limits, far sooner than the work we did seemed to justify. The weekly window hit 100% on 18 October (before the chart below begins), and the five-hour window followed on 21 and 22 October.</P>
      <P>We checked our usage records and found the pattern behind it: long sessions re-read their entire history on every tool call. This post shows our numbers and ends with what you can change today.</P>
      <H2>What did the chart show?</H2>
      <P>Our Second Brain app draws how much of the plan we have used over time. It has two lines: the five-hour window (blue) and the seven-day window (white). These correspond to the plan&apos;s session limit and weekly limit.</P>
      <Figure
        src="/blog/why-long-sessions-fill-claude-max-plan-1.jpg"
        alt="Line chart titled Plan used over time: a blue line for the five-hour plan window that spikes to 100 percent several times, and a white line for the seven-day window that climbs to roughly 70 percent"
        width={1053}
        height={288}
        caption="Plan used over time on our Second Brain usage page. Blue is the five-hour window, white is the seven-day window. Our screenshot."
      />
      <P>The blue line swings from near zero to the ceiling and back. That shape tells you the plan filled, but not why. To find the cause, we queried the records behind it: our usage ledger logs model calls with their token counts, so we could ask where the tokens went.</P>
      <H2>Why does a long session cost more than the words in it?</H2>
      <P>Two terms first. A <strong>token</strong> is the unit of text a model counts. A <strong>session</strong> is one running conversation with Claude Code, including everything it has read and done so far.</P>
      <P>Claude Code does not send only your latest message. It sends the whole conversation with every request, and each time Claude uses a tool (reads a file, runs a command), that is another request. The Claude Code docs put it this way:</P>
      <Figure
        src="/blog/why-long-sessions-fill-claude-max-plan-2.jpg"
        alt="The Claude Code cost documentation, with the sentence saying Claude Code sends your full conversation with every request, and each tool use another request, highlighted"
        width={1085}
        height={595}
        caption="The cost docs say it directly. Source: Anthropic, Claude Code docs, Manage costs effectively."
      />
      <P>To keep this affordable, the history is stored in a <strong>prompt cache</strong> (a short-term copy of text the model has already processed, so it doesn&apos;t have to be processed again). Reading from the cache is much cheaper per token than reading fresh input: Anthropic&apos;s API pricing (the interface Claude Code uses under the hood) lists cache reads for Opus 5.5 and Sonnet 5.5 at 0.05 times the base input price. That is a large discount, and it is also why this problem hides. Each cheap read looks harmless. The count is what hurts.</P>
      <P>Think of a lawyer who must re-read the entire case file before answering each question. Reading is fast, but if the file is 300 pages and you ask 200 small questions, most of the effort goes to re-reading. The analogy stops working in one place: the cost is not time but the share of your plan that each re-read uses.</P>
      <Figure
        src="/blog/why-long-sessions-fill-claude-max-plan-3.jpg"
        alt="Four bars for call 1, 10, 50 and 200, each with a growing blue block of old context and a small gold block of new work"
        width={1920}
        height={1080}
        caption="Each call adds a little and re-reads everything before it. Our diagram."
      />
      <H2>What did our own numbers say?</H2>
      <P>Our three machines logged 5,921 model calls across 129 sessions between 19 October 2026 (12:00 UTC) and 22 October (03:50 UTC).</P>
      <UL items={[
        <><strong>Cache reads:</strong> 1,118 million tokens.</>,
        <><strong>Cache writes:</strong> 31.2 million tokens.</>,
        <><strong>Output:</strong> 5.3 million tokens. This is what Claude produced, including its tool calls and thinking.</>,
        <><strong>Fresh input:</strong> about 12 thousand tokens.</>,
      ]} />
      <P>Cache reads were roughly 210 times the output. Claude was not producing unusually large answers. It was re-reading.</P>
      <Figure
        src="/blog/why-long-sessions-fill-claude-max-plan-4.jpg"
        alt="Bar chart of tokens by type: 1,118 million cache read, 31.2 million cache write, 5.3 million output, 12 thousand fresh input"
        width={1920}
        height={1080}
        caption="Our own ledger, 19 to 22 October 2026 (about 64 hours). Our chart."
      />
      <P>The size of the history explains the ratio. The median call carried 171 thousand tokens of context. 2,202 calls (37%) carried more than 200 thousand, and 377 carried more than 400 thousand. The ledger does not record how long each session was open, but we infer that contexts that large come from sessions left running for hours.</P>
      <P>Usage was also concentrated. The ten biggest of the 129 sessions made up 62% of all cache reads.</P>
      <P>For the 72 hours to 22 October (a slightly longer window than the one above), the split by where the work ran was clear:</P>
      <UL items={[
        <><strong>Interactive sessions on the Mac:</strong> 1,051 million cache-read tokens, about 74% of the total. Almost all of it, 1,049 million, was on Opus 5.5.</>,
        <><strong>Sessions on our server:</strong> 212 million.</>,
        <><strong>Our org bots (agents that wake for a task):</strong> 129 million.</>,
        <><strong>Opus 5.5 overall:</strong> 1,292 million, about 91% of all cache reads. Sonnet 5.5 had 122 million.</>,
      ]} />
      <P>Two out of three calls in that window were tool calls running shell commands. That matches how an agent works: read, run, check, run again. Each step is another request carrying the whole history.</P>
      <Figure
        src="/blog/why-long-sessions-fill-claude-max-plan-5.jpg"
        alt="Bars of cache reads by where the session ran and by model: interactive Mac sessions 1,051 million, server sessions 212 million, org bots 129 million, other 21 million; Opus 5.5 1,292 million, Sonnet 5.5 122 million"
        width={1920}
        height={1080}
        caption="Interactive Mac sessions ran almost entirely on Opus. Our chart, 72 hours to 22 October."
      />
      <P>One more number: 58 calls wrote more than 100 thousand tokens to the cache at once, adding up to 10 million of the 31.2 million cache-write tokens. In 21 of them, the call read almost nothing from the cache. We infer this means the whole history was processed again from scratch.</P>
      <H2>What makes it worse?</H2>
      <P>Several things make a long session drain a plan, and the Claude Code cost docs cover each. Our ledger shows the first clearly and cannot speak to most of the rest.</P>
      <UL items={[
        <><strong>Long context.</strong> Shown above, and the largest pattern we can see in our ledger.</>,
        <><strong>The biggest model.</strong> The docs&apos; cost page advises Sonnet for most coding tasks and Opus for complex ones. Nearly all our cache reads were on Opus.</>,
        <><strong>A long rules file.</strong> <code>CLAUDE.md</code> loads at the start of every session and so is part of the history on every call. The docs suggest keeping it under 200 lines and moving workflow-specific instructions into skills, which load only when used. We have not measured ours.</>,
      ]} />
      <P>The documented causes below we did not measure:</P>
      <UL items={[
        <><strong>Cache misses.</strong> Your first message after a break longer than the cache lifetime misses the cache and reprocesses the full context. By default the API&apos;s cache lifetime is 5 minutes (Claude Code can use a longer one), and it is refreshed each time it is used.</>,
        <><strong>Scheduled tasks.</strong> A recurring task inside a session fires on its schedule even while you are away, and sends your full context each time.</>,
        <><strong>Subagents.</strong> Every subagent sends its own requests on top of the main conversation&apos;s. Only 35 calls in our window launched a subagent, and we did not count the subagents&apos; own requests.</>,
        <><strong>Compaction.</strong> <code>/compact</code> has to read the whole conversation to summarize it, so compacting a huge context is itself a huge request.</>,
      ]} />
      <H2>What can&apos;t we tell from our numbers?</H2>
      <P>We can count tokens. We cannot see how Anthropic weights each kind of token against a Max plan limit, so we make no claim about how many cache reads equal one percent of the plan. We also cannot say which single request pushed a window to 100%. The ledger shows the pattern that fills a plan, not the last drop.</P>
      <H2>What should you do?</H2>
      <P>You may see advice to create a <code>.claudeignore</code> file to exclude large folders. The Claude Code cost docs do not document one, so we would not count on it. The levers the docs do document are these:</P>
      <UL items={[
        <><strong>Clear between unrelated tasks.</strong> <code>/clear</code> costs nothing. The docs say stale context wastes tokens on every following message. Use <code>/rename</code> first if you want to come back with <code>/resume</code>.</>,
        <><strong>Compact before the context is huge.</strong> The docs&apos; own usage recommendations include &ldquo;compact before you step away&rdquo;. Because <code>/compact</code> reads the whole conversation, compacting a large context is itself a large request.</>,
        <><strong>Watch your context size.</strong> <code>/usage</code> shows a plan breakdown with recommendations, and <code>/context</code> shows what is taking space. Check your own: our median call carried 171 thousand tokens.</>,
        <><strong>Match the model to the job.</strong> Use Sonnet for routine edits and keep Opus for hard design problems.</>,
        <><strong>Write specific requests.</strong> &ldquo;Add input validation to the login function in <code>auth.ts</code>&rdquo; reads a file. &ldquo;Improve this codebase&rdquo; triggers broad scanning.</>,
        <><strong>Filter output before it enters the conversation.</strong> A hook (a small program that runs before a tool call and can change it) can turn a 10,000-line log into the matching error lines.</>,
        <><strong>Keep <code>CLAUDE.md</code> short.</strong> Move specialized instructions into skills.</>,
        <><strong>Count your helpers.</strong> Each subagent sends its own requests, and scheduled tasks send your full context even while you are idle.</>,
      ]} />
      <H2>What&apos;s built and what&apos;s next</H2>
      <P>Built: the usage ledger and the usage page described above, including the plan-window snapshots. They are what let us find this. Not built: any guard that warns when a session&apos;s context passes a threshold, or that stops a long session automatically. We are writing a list of changes to our own Second Brain to catch this earlier, and we will publish what we ship.</P>
      <P>A long session hides its cost behind cheap cache reads that add up. Keep the context small and the plan lasts longer.</P>
      <P>Follow along on the blog or at <A href="https://x.com/myargoquest">https://x.com/myargoquest</A>.</P>
    </>
  )
}

export const posts: BlogPost[] = [
  {
    slug: "why-long-sessions-fill-claude-max-plan",
    title: "Why long sessions fill a Claude Max plan, with our own numbers",
    description: "We kept hitting 100% of our Claude Max plan. Our usage ledger shows why: long sessions re-read their whole history on every tool call. Here is how to avoid it.",
    date: "October 22, 2026",
    isoDate: "2026-10-22T12:40",
    readingTime: "11 min read",
    Content: WhyLongSessionsFillClaudeMaxPlanContent,
  },
  {
    slug: "private-company-ai-brain",
    title: "A private AI brain for your company, on your own server: a step-by-step guide",
    description: "How to run Second Brain and the Hermes agent on your own server, with private model inference through Venice, OpenRouter or Morpheus.",
    date: "October 21, 2026",
    isoDate: "2026-10-21T13:17",
    readingTime: "13 min read",
    Content: PrivateCompanyAiBrainContent,
  },
  {
    slug: "t3code-explained",
    title: "T3 Code explained, the open-source app that runs your coding agents from one place",
    description: "What T3 Code is, how it drives Claude Code, Codex and other agents on your machine, how to set it up, and what we are taking from its design.",
    date: "October 21, 2026",
    isoDate: "2026-10-21T06:33",
    readingTime: "12 min read",
    Content: T3codeExplainedContent,
  },
  {
    slug: "ten-agent-ops-repos-what-to-borrow",
    title: "Ten open-source agent ops repos, checked, and the ideas worth borrowing",
    description: "We checked ten open-source repos sold as the ops layer for AI agent fleets. What each does, what holds up, and nine ideas for a second brain.",
    date: "October 19, 2026",
    isoDate: "2026-10-19T03:41",
    readingTime: "7 min read",
    Content: TenAgentOpsReposWhatToBorrowContent,
  },
  {
    slug: "small-model-routine-agent-choices",
    title: "How a small model can make an agent's routine choices, and when it shouldn't",
    description: "A new paper shows when a cheap decision model can take over an AI agent's routine choices safely, and what that means for our agents.",
    date: "October 19, 2026",
    isoDate: "2026-10-19T03:36",
    readingTime: "8 min read",
    Content: SmallModelRoutineAgentChoicesContent,
  },
  {
    slug: "kronos-candlestick-foundation-models",
    title: "Kronos and the AI models that read price charts, checked against the evidence",
    description: "What Kronos and other time-series foundation models actually do, what \"93% more accurate\" really measures, and what the research says about trading with them.",
    date: "October 19, 2026",
    isoDate: "2026-10-19T03:31",
    readingTime: "8 min read",
    Content: KronosCandlestickFoundationModelsContent,
  },
  {
    slug: "ecosystem-not-the-paper",
    title: "What a research lab's agent playbook teaches a personal second brain",
    description: "Tim Dettmers argues agents made the ecosystem, not the paper, the unit of work. What that means for how we run agents and our second brain.",
    date: "October 19, 2026",
    isoDate: "2026-10-19T03:24",
    readingTime: "7 min read",
    Content: EcosystemNotThePaperContent,
  },
  {
    slug: "keychain-ai-companion-second-brain",
    title: "Designing a keychain AI companion that runs on your own Second Brain",
    description: "The plan for a pocket AI companion that also sits on your desk: what it does, the hardware, the case, the software, and how it reaches your own notes.",
    date: "October 19, 2026",
    isoDate: "2026-10-19T12:52",
    readingTime: "13 min read",
    Content: KeychainAiCompanionSecondBrainContent,
  },
  {
    slug: "old-macbook-encrypted-home-backup",
    title: "The third copy: turning an old MacBook into an encrypted home backup",
    description: "Six steps to make a spare Mac pull your nightly Postgres dump from B2 onto an encrypted volume, and prove it restores. Standard tools: pg_dump, rclone, diskutil, launchd.",
    date: "October 19, 2026",
    isoDate: "2026-10-19T17:30",
    readingTime: "9 min read",
    Content: OldMacbookHomeBackupContent,
  },
  {
    slug: "arkiv-hackathon-skillreg",
    title: "What we built at the Arkiv hackathon: a trust layer for AI agent skills",
    description: "How Arkiv stores data on a blockchain, and how we used it to build skillreg, an open registry that tells your agent which skills to trust.",
    date: "October 19, 2026",
    isoDate: "2026-10-19T07:56",
    readingTime: "13 min read",
    Content: ArkivHackathonSkillregContent,
  },
  {
    slug: "let-your-agent-post-to-linkedin",
    title: "How to let your AI agent post to LinkedIn on a schedule",
    description: "How our second brain connects a LinkedIn account, keeps its keys encrypted, and publishes queued posts, plus the prompts to build your own.",
    date: "October 19, 2026",
    isoDate: "2026-10-19T15:51",
    readingTime: "12 min read",
    Content: LetYourAgentPostToLinkedinContent,
  },
  {
    slug: "inside-hermes-agent-memory-skills-self-improvement",
    title: "Inside Hermes Agent: memory, skills, and learning to improve itself",
    description: "What Hermes Agent is, how it got here, how its memory and skills system work, and what its benchmark numbers actually mean next to other agent tools.",
    date: "October 18, 2026",
    isoDate: "2026-10-18T16:12",
    readingTime: "12 min read",
    Content: InsideHermesAgentMemorySkillsSelfImprovementContent,
  },
  {
    slug: "how-our-company-of-ai-bots-works",
    title: "How our company of AI bots works: one roster, one message board, one task board",
    description: "How 22 AI bots on 8 teams get work from our kanban board, talk on a message board, report to the CEO and show up in our second brain app.",
    date: "October 17, 2026",
    isoDate: "2026-10-17T00:41",
    readingTime: "14 min read",
    Content: HowOurCompanyOfAiBotsWorksContent,
  },
  {
    slug: "how-we-built-friendly-reachy-mini",
    title: "How we gave a Reachy Mini robot a voice, a personality and a memory",
    description: "How Friendly works: a Reachy Mini robot with local speech, a fast local model for small talk, Claude for thinking, and memory, all on one Mac.",
    date: "October 17, 2026",
    isoDate: "2026-10-17T11:43",
    readingTime: "13 min read",
    Content: HowWeBuiltFriendlyReachyMiniContent,
  },
  {
    slug: "how-secondbrain-works-open-source",
    title: "How secondbrain works: an open-source second brain you own",
    description: "Inside the secondbrain engine: a markdown vault, a Postgres index, rules and hooks for AI agents, and the devices it runs on.",
    date: "October 17, 2026",
    isoDate: "2026-10-17T15:37",
    readingTime: "13 min read",
    Content: HowSecondbrainWorksOpenSourceContent,
  },
  {
    slug: "argo-build-log-day-4",
    title: "Argo build log, Day 4: Voronoi case redesign and two new blog posts",
    description: "The Exo case gets a straight-walled Voronoi redesign, two new blog posts go live, and the build runs 323 minutes on stream.",
    date: "October 17, 2026",
    isoDate: "2026-10-17T02:42",
    readingTime: "3 min read",
    Content: ArgoBuildLogDay4Content,
  },
  {
    slug: "self-improving-agent-harness",
    title: "How an AI agent can improve its own harness without a grader",
    description: "What Google's Harness² paper shows about agents editing their own prompts, skills and hooks at test time, and how to build a small version yourself.",
    date: "October 16, 2026",
    isoDate: "2026-10-16T15:51",
    readingTime: "13 min read",
    Content: SelfImprovingAgentHarnessContent,
  },
  {
    slug: "where-our-agents-tokens-go",
    title: "Where the tokens go: how we label every model call our AI agents make",
    description: "How our usage page ties each model call to the agent, the reason it woke, the task, the project and the kind of work, and what the first week of data showed.",
    date: "October 16, 2026",
    isoDate: "2026-10-16T13:17",
    readingTime: "11 min read",
    Content: WhereOurAgentsTokensGoContent,
  },
  {
    slug: "smart-ring-to-your-own-database",
    title: "How we sync a smart ring into our own database, and how you can too",
    description: "Pull your Ultrahuman ring data hourly into your own Postgres, what each field means, how to chart it, how agents can use it, with code and a prompt.",
    date: "October 15, 2026",
    isoDate: "2026-10-15T15:47",
    readingTime: "24 min read",
    Content: SmartRingToYourOwnDatabaseContent,
  },
  {
    slug: "build-a-3d-map-of-your-second-brain",
    title: "How we built a 3D map of our second brain, and how you can build your own",
    description: "The architecture behind our 3D map of notes, projects and live numbers, the steps to build one, and a prompt to hand your own agent.",
    date: "October 15, 2026",
    isoDate: "2026-10-15T12:45",
    readingTime: "14 min read",
    Content: BuildA3dMapOfYourSecondBrainContent,
  },
  {
    slug: "privacy-levels-for-ai-agents",
    title: "How our AI agents will know what they may share: privacy levels for a second brain",
    description: "How we are designing privacy levels, compartments and release rules so every AI agent in our second brain knows what it may read, repeat and publish.",
    date: "October 14, 2026",
    isoDate: "2026-10-14T14:10",
    readingTime: "10 min read",
    Content: PrivacyLevelsForAiAgentsContent,
  },
  {
    slug: 'local-voice-kokoro-second-brain',
    title: 'Giving our second brain a voice that never leaves the laptop',
    description:
      'How we added local text-to-speech to our second brain with Kokoro-82M on a MacBook: a Listen button on every note, spoken alerts when Claude Code finishes, and a step-by-step guide to set it up yourself.',
    date: 'October 14, 2026',
    isoDate: '2026-10-14T21:00',
    readingTime: '7 min read',
    Content: LocalVoiceKokoroContent,
  },
  {
    slug: 'ardour-mcp-ai-agent-lane-8-style-track',
    title: 'Making a Lane 8-style track with Ardour and an AI agent',
    description:
      'What the open-source Ardour DAW is, how ardour-mcp lets an agent like Claude drive it, and a step-by-step guide to the melodic house sketch we built with it, Ocean View Haikus.',
    date: 'October 14, 2026',
    isoDate: '2026-10-14T19:00',
    readingTime: '8 min read',
    Content: ArdourMcpAgentMusicContent,
  },
  {
    slug: 'argo-fund-ai-investment-committee',
    title: 'Five AI partners and one button: how I built an agentic portfolio manager',
    description:
      'Argo Fund is an investment committee of five AI partners who research, debate and vote, a Safe on Base that needs two signatures, an approve button on my wearable, and an offline savings vault on a Raspberry Pi Zero.',
    date: 'October 14, 2026',
    isoDate: '2026-10-14T18:00',
    readingTime: '6 min read',
    Content: ArgoFundCommitteeContent,
  },
  {
    slug: 'skills-loops-graphs-ai-agents',
    title: 'Skills, loops and graphs: the three layers around an AI agent',
    description:
      'What skill graphs, loop engineering and graph engineering actually mean, how they fit together, and how we use them across Claude Code, Hermes and the Kanban board in our second brain.',
    date: 'October 13, 2026',
    isoDate: '2026-10-13T12:45',
    readingTime: '7 min read',
    Content: SkillsLoopsGraphsContent,
  },
  {
    slug: 'ai-agents-crypto-trading-wallets',
    title: 'How to build an AI agent that manages a crypto wallet without losing it',
    description:
      'What the research and open-source repos say about AI agents for crypto trading: why LLMs should read context instead of charts, which strategies have evidence, where skills fit, and why signing limits belong on chain.',
    date: 'October 12, 2026',
    isoDate: '2026-10-12T23:30',
    readingTime: '7 min read',
    Content: AiAgentsCryptoTradingWalletsContent,
  },
  {
    slug: 'agent-harness-claude-code-hermes',
    title: 'One rulebook for two agents: the harness behind our second brain',
    description:
      'How we made Claude Code and Hermes share one instruction file, one guard script, a read-only fact-checker, a handoff note and a definition of done, and how to set it up for your own agents.',
    date: 'October 12, 2026',
    isoDate: '2026-10-12T17:30',
    readingTime: '10 min read',
    Content: AgentHarnessContent,
  },
  {
    slug: 'what-argo-knows',
    title: 'What Argo knows about you, and how you stay in charge of it',
    description:
      "How Argo's new What Argo knows list works: which facts it learns from your journal, how your phone does the work without our servers keeping anything, how it handles change over time, and how you edit, end or delete any fact.",
    date: 'October 12, 2026',
    isoDate: '2026-10-12T10:00',
    readingTime: '7 min read',
    Content: WhatArgoKnowsContent,
  },
  {
    slug: 'how-argo-encryption-works',
    title: 'How Argo keeps your journal private: keys, encryption, and the honest exceptions',
    description:
      "A plain-English walkthrough of Argo's zero-knowledge encryption: where your key is created, where it is stored, what our servers can and cannot read, when your words reach an AI, and the one exception during live voice calls.",
    date: 'October 1, 2026',
    isoDate: '2026-10-01T10:00',
    readingTime: '10 min read',
    Content: ArgoEncryptionContent,
  },
  {
    slug: 'argo-1-0-1-mirror-wallet-unlock',
    title: "What's new in Argo 1.0.1: Mirror and unlocking your journal with your wallet",
    description:
      'Argo 1.0.1 reworks daily encouragements into Mirror, three reflections a day grounded in your own entries, and adds an optional third way to unlock your journal: your Ethereum wallet, alongside iCloud Keychain and your recovery code.',
    date: 'September 12, 2026',
    isoDate: '2026-09-12T09:00',
    readingTime: '5 min read',
    Content: ArgoMirrorWalletUnlockContent,
  },
  {
    slug: 'pitching-argo-startup-village-borneo',
    title: 'Pitching Argo at Startup Village Borneo',
    description:
      'Konrad Gnat pitches Argo at the Startup Village Borneo Demo Day in Kuching, Sarawak: what the app does, the traction so far, and a candid post-pitch interview, including a hopeful sign-off that the video does not confirm as a result.',
    date: 'September 9, 2026',
    isoDate: '2026-09-09T13:00',
    readingTime: '4 min read',
    Content: PitchingArgoStartupVillageBorneoContent,
  },
  {
    slug: 'how-private-ai-works-morpheus-tees-enclaves',
    title: 'How private AI actually works: Morpheus, TEEs, and secure enclaves',
    description:
      'Encryption protects your data at rest and in transit, but not at the moment a model reads it. A plain-English explanation of secure enclaves, how remote attestation turns “trust us” into something checkable, what TEEs genuinely do not protect against, and exactly how Argo uses Morpheus for confidential inference, including the one feature that does not run in the enclave today, and why.',
    date: 'August 5, 2026',
    isoDate: '2026-08-05T10:00',
    readingTime: '9 min read',
    Content: PrivateAIEnclavesContent,
  },
  {
    slug: 'francis-goon-losing-the-fear-of-ai',
    title: 'LLP#025, Francis Goon: losing the fear of AI',
    description:
      'A conversation at the Ultra Web3 festival with Ts. Francis Goon, a technical writer and former R&D engineer who spent seven years in semiconductors and fourteen years translating dense technology at MIMOS, Malaysia’s national research center. On the handheld biosensor that reads blood with light, why a year of job hunting in Penang pushed him into teaching, how a childhood fear of the computer mirrors the fear beginners feel about AI, and his simplest advice: try one tool a day, because it is just a screen with a box in the middle.',
    date: 'July 31, 2026',
    isoDate: '2026-07-31T18:00',
    readingTime: '6 min read',
    Content: FrancisGoonLosingTheFearOfAiContent,
  },
  {
    slug: 'llp024-anna-sokol',
    title: 'LLP#024, Anna Sokol: a life given to a meditation community',
    description:
      'A Network School conversation with Anna Sokol, a meditation and awareness instructor who left Ukraine for Australia at sixteen and gave much of her twenties to Giving School, a meditation community with retreat centers in Latvia. On attention as the one tool we have, why most fear lives in the head, and what actually makes a community last: a whole-hearted shared goal, ongoing education, and everyone treating the project as their own.',
    date: 'July 29, 2026',
    isoDate: '2026-07-29T18:00',
    readingTime: '6 min read',
    Content: Llp024AnnaSokolContent,
  },
  {
    slug: 'velveteen-artist-founder-stories',
    title: 'LLP#023, Velveteen: the artist who helps founders tell their story',
    description:
      'A Network School conversation with the artist Velveteen (Miriam Reza): a senior-year car crash that broke both hands, learning to draw left-handed to finish her art-school portfolio, studying design at NC State, moving from dark charcoal to bright animal-filled paintings meant to bring people joy, hidden symbols in her community pieces, her years in NFTs and film, and founding Chymira to turn deep tech research into a clear story. On what separates human art from AI: you put a piece of your soul into it.',
    date: 'July 28, 2026',
    isoDate: '2026-07-28T18:00',
    readingTime: '6 min read',
    Content: VelveteenArtistFounderStoriesContent,
  },
  {
    slug: 'llp022-daria-chernozub',
    title: 'LLP#022, Daria Chernozub: going global by going local',
    description:
      'A Network School conversation with Daria Chernozub (Dasha), who leads global adoption for Dash. From a Russian central-bank sandbox and a first coin bought because it shared her name, to DevRel in Cyprus, local hubs for the Internet Computer, a year on Koh Phangan, and her rule for scaling anything: go global by going local.',
    date: 'July 26, 2026',
    isoDate: '2026-07-26T18:00',
    readingTime: '6 min read',
    Content: Llp022DariaChernozubContent,
  },
  {
    slug: 'llp021-anton-contentdao',
    title: 'LLP#021, Anton Pecherkin: from 40+ hackathons to ContentDAO',
    description:
      'A conversation at Network School with Anton Pecherkin, a Web3 engineer who won something like forty to fifty hackathons across Europe, then built a blockchain agency (green-energy NFT certificates piloted on Semakau Island in Singapore) before founding ContentDAO. On treating judges as the spec, hating dependency hell, and building &ldquo;Google Ads for small content creators&rdquo; with pay held in escrow until the post ships.',
    date: 'July 25, 2026',
    isoDate: '2026-07-25T18:00',
    readingTime: '6 min read',
    Content: AntonPecherkinContent,
  },
  {
    slug: 'ashish-sood-network-states',
    title: 'LLP#020, The Best Consumer in the World: Ashish Sood',
    description:
      'A conversation at Network School with Ashish Sood, a serial founder (a nightlife app, personal lending in India, an RWA tokenization platform) who now runs Curious Ventures, a fund that follows network states. On &ldquo;founder fraud&rdquo; and living where founders live, why money is only a multiplier, the paper prototype that got his first app built for free, and reading with your ears and eyes at once.',
    date: 'July 21, 2026',
    isoDate: '2026-07-21T18:00',
    readingTime: '6 min read',
    Content: AshishSoodContent,
  },
  {
    slug: 'tony-lopez-robotics-shenzhen-claude-code',
    title: 'LLP#019, 30 Years in Robotics, Shenzhen, and Claude Code: Tony Lopez',
    description:
      'A conversation at Network School with Tony Lopez, an electronics and robotics engineer who went from a childhood MSX computer in Spain to aerospace work with the European Space Agency, four years building lithium iron phosphate batteries in Shenzhen, and a nomadic decade through Georgia and Southeast Asia. On how a PID controller works, why he reads Shenzhen as a learning environment, the &ldquo;Claude Code moment,&rdquo; and creativity as the human edge.',
    date: 'July 20, 2026',
    isoDate: '2026-07-20T18:00',
    readingTime: '6 min read',
    Content: TonyLopezContent,
  },
  {
    slug: 'llp018-daniel-im',
    title: 'LLP#018, From Hinton’s Class to “TikTok for Opinions”: Daniel Im',
    description:
      'A conversation at Network School with Daniel Jiwoong Im, who learned ML from Geoffrey Hinton at Toronto (with Sutskever and Karpathy as TAs), trained AI models of fruit-fly brains at Janelia, and left a PhD to build companies. On the arc from an AI search engine and crypto market data to UBet’s betting AMM and Belief Market, a “TikTok for opinions,” and the wisdom of crowds that ties it all together.',
    date: 'July 16, 2026',
    isoDate: '2026-07-16T18:00',
    readingTime: '6 min read',
    Content: DanielImContent,
  },
  {
    slug: 'llp017-peter-donaldson',
    title: 'LLP#017, Psytrance Festivals to Tokenized Stocks: Peter Donaldson',
    description:
      'A wide-ranging conversation at Network School with Peter Donaldson, cellist at three, festival producer in China for fifteen years, now business development at STOX, an intent-based exchange for tokenized equities. On a music app that paid artists in 24 hours, MEV as an old human habit, and why convenience should build community instead of isolating us.',
    date: 'July 15, 2026',
    isoDate: '2026-07-15T18:00',
    readingTime: '6 min read',
    Content: PeterDonaldsonContent,
  },
  {
    slug: 'david-johnston-morpheus',
    title: 'LLP#016, Own Your AI, or Be Owned By It: David Johnston',
    description:
      'A conversation at Network School with David Johnston (the man who coined the term “DApps” in 2013) now lead technologist on Morpheus, a permissionless network for decentralized, private AI. On riding every tech wave from biodiesel to Bitcoin, what Morpheus actually is, and why owning your AI is the new question of freedom.',
    date: 'July 14, 2026',
    isoDate: '2026-07-14T18:00',
    readingTime: '5 min read',
    Content: DavidJohnstonMorpheusContent,
  },
  {
    slug: 'quantum-proof-bitcoin-chris-quantus',
    title: 'LLP#015, Building a Quantum-Proof Bitcoin: Chris of Quantus',
    description:
      'A wide-ranging conversation at Network School with Chris Smith (UV Lightman) founder of Quantus, a proof-of-work blockchain built to survive the day quantum computers can break Bitcoin’s cryptography. On Shor’s algorithm and the efficient-attack problem, what money actually is, a stranger from NIST, local AI as an exocortex, and using both halves of your brain.',
    date: 'July 13, 2026',
    isoDate: '2026-07-13T18:00',
    readingTime: '6 min read',
    Content: QuantumProofBitcoinContent,
  },
  {
    slug: 'chong-ing-kai-stickem',
    title: 'The Founder Who Teaches Kids to Build With Chopsticks',
    description:
      'A conversation at Network School with Chong Ing Kai, the 22-year-old founder of Stick ’Em, who went from building flamethrowers to winning a US$1M Hult Prize for making STEAM education accessible. On problem clarity, why he’d delay AI for kids, the day he risked jail to win a million dollars, and holding the tension every social entrepreneur faces.',
    date: 'July 11, 2026',
    isoDate: '2026-07-11T18:00',
    readingTime: '8 min read',
    Content: ChongIngKaiContent,
  },
  {
    slug: 'koss-ethereum-biomarkers-and-the-signals-of-nature',
    title: 'The Signals of Life: Ethereum, Biomarkers, and Bioregions, a Conversation with Koss',
    description:
      'A wide-ranging chat recorded at Network School with Koss, a Venezuelan builder who came to Ethereum through hyperinflation and now works in decentralized storage. On crypto’s grassroots origins, social networks built on biomarkers instead of screens, reading the signals of living systems and whole bioregions, and inventing the future rather than predicting it.',
    date: 'July 9, 2026',
    isoDate: '2026-07-09T18:00',
    readingTime: '8 min read',
    Content: KossSignalsContent,
  },
  {
    slug: 'why-rumination-predicts-depression-and-journaling-is-different',
    title: 'The Loop and the Page: Why Rumination Predicts Depression, and Journaling Can Do the Opposite',
    description:
      'Replaying a bad day in your head reliably predicts depression. Writing it down (done right) is one of the most studied self-help tools in psychology. Same raw material, opposite outcomes. Here is the difference, the science behind it, and how to journal for growth instead of feeding the loop.',
    date: 'July 4, 2026',
    isoDate: '2026-07-04T20:00',
    readingTime: '11 min read',
    Content: RuminationContent,
  },
  {
    slug: 'writing-to-build-your-mind-not-just-empty-it',
    title: 'The Other Half of Journaling: Writing to Build Your Mind, Not Just Empty It',
    description:
      'Most journaling advice tells you to dump the noise and walk away lighter. But there’s an older, opposite practice (writing to think, to appreciate, and to understand) and the research says it’s where the real returns are.',
    date: 'July 4, 2026',
    isoDate: '2026-07-04T18:00',
    readingTime: '10 min read',
    Content: BuildYourMindContent,
  },
  {
    slug: 'the-750-word-habit-who-does-it-and-why',
    title: 'The 750-Word Habit: Who Does It, Why It Works, and When It Doesn’t',
    description:
      'Authors, founders, and ordinary people empty their minds onto the page every morning: roughly 750 words, private, unedited. Where the habit comes from, what four decades of research says it does, why privacy is the active ingredient, and the honest fine print.',
    date: 'July 4, 2026',
    isoDate: '2026-07-04',
    readingTime: '9 min read',
    Content: SevenFiftyHabitContent,
  },
  {
    slug: 'the-soul-constellation-a-galaxy-you-own',
    title: 'The Soul Constellation: A Galaxy You Own',
    description:
      'Why we’re turning your journaling into a living, one-of-one piece of art you truly own, how every 750-word day becomes a star placed by the meaning of your words, and why privacy is guaranteed by the math, not a promise.',
    date: 'July 3, 2026',
    isoDate: '2026-07-03T12:00',
    readingTime: '6 min read',
    Content: SoulConstellationContent,
  },
  {
    slug: 'the-science-of-750-words-a-day',
    title: 'What 750 Words a Day Does to Your Mind',
    description:
      'Forty years of research on daily journaling, from working memory and focus to sleep, mood, and well-being. The science behind a 750-word daily entry, and why it compounds.',
    date: 'July 3, 2026',
    isoDate: '2026-07-03',
    readingTime: '7 min read',
    Content: SevenFiftyWordsContent,
  },
]

export function getPost(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug)
}
