import { H2, P, UL, A, Pull, Note } from '@/components/blog'

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

/* ── Post: The science of 750 words a day ── */
function SevenFiftyWordsContent() {
  return (
    <>
      <P>
        You already know the day got away from you. You reacted to it instead of thinking
        through it. Decisions got made on a full head. You lay down at night and your mind
        kept running — a dozen open loops, none of them closed. By morning, whatever insight
        you had is gone.
      </P>
      <P>
        Daily journaling is the oldest fix for this, and it turns out to be one of the
        best-studied ones. For forty years, researchers have handed people a pen and a few
        quiet minutes and measured what happens next — to their focus, their stress, their
        sleep, even their immune systems. The findings are consistent enough, and the cost is
        low enough, that it&apos;s worth understanding exactly what a substantial daily entry —
        on the order of <strong>750 words</strong> — actually does to your mind.
      </P>

      <H2>Where 750 words comes from</H2>
      <P>
        The number isn&apos;t arbitrary. It traces back to Julia Cameron&apos;s{' '}
        <em>Morning Pages</em> from <em>The Artist&apos;s Way</em>: three longhand pages,
        which come to roughly 750 words. The classic psychology studies used a close cousin of
        this — 15 to 20 minutes of continuous writing — which for most people lands in the
        same several-hundred-to-750-word range. It&apos;s enough to get past the surface layer
        of logistics and venting and into the part where you write the thing you didn&apos;t
        know you were thinking.
      </P>
      <P>
        And 750 words is format-independent. Three handwritten pages, a typed entry, or about
        ten minutes of talking all land in the same place. The benefits below come from the
        act of getting your inner life <em>out</em> — not from how you do it.
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
        This isn&apos;t only about feeling calmer — it shows up in performance. When
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

      <H2>3. It measurably improves well-being — and even physical health</H2>
      <P>
        The foundational work here is James Pennebaker&apos;s. In his original study, people
        who wrote about their deepest thoughts and feelings for 15 minutes a day over four
        days showed improved immune markers and made fewer visits to the doctor in the months
        that followed. Four decades and{' '}
        <A href="https://pubmed.ncbi.nlm.nih.gov/17073523/">
          146 randomized studies later
        </A>, a meta-analysis confirmed the effect is real and positive (Frattaroli, 2006) —
        modest in size, but remarkable given how brief, portable, and nearly free the practice
        is, and larger for people actually going through something hard.
      </P>
      <P>
        You don&apos;t have to write about pain to benefit. When people wrote about their{' '}
        <A href="https://journals.sagepub.com/doi/10.1177/0146167201277003">
          &ldquo;best possible future self&rdquo;
        </A>{' '}
        for 20 minutes a day, their well-being rose and — five months later — they&apos;d made
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
        compounds — not a cure, and not a substitute for professional care. If you&apos;re
        struggling, talk to someone qualified. LuminaLog is a tool for reflection, not
        treatment.
      </Note>

      <H2>Why LuminaLog is built around 750 words</H2>
      <P>
        Everything above points to the same practice: a substantial daily entry, done
        consistently, in whatever format gets you past the surface. That&apos;s exactly what
        LuminaLog is designed for.
      </P>
      <UL items={[
        <>A daily 750-word goal that&apos;s enough to reach real depth — framed as an invitation, never guilt.</>,
        <>Capture in text, voice, or video — talk for ten minutes on a walk and reach the same depth as three written pages.</>,
        <>AI summaries that turn a rambling brain-dump into something you can actually review and act on.</>,
        <>Insights that surface the patterns across weeks you&apos;d never catch alone.</>,
        <>Private and encrypted, with anonymized AI processing — because you can only write the honest version if it stays yours.</>,
      ]} />
      <P>
        Your mind moves faster than your day. Seven hundred and fifty words is how you catch up
        with yourself.
      </P>
    </>
  )
}

export const posts: BlogPost[] = [
  {
    slug: 'the-science-of-750-words-a-day',
    title: 'What 750 Words a Day Does to Your Mind',
    description:
      'Forty years of research on daily journaling — from working memory and focus to sleep, mood, and well-being. The science behind a 750-word daily entry, and why it compounds.',
    date: 'July 3, 2026',
    isoDate: '2026-07-03',
    readingTime: '7 min read',
    Content: SevenFiftyWordsContent,
  },
]

export function getPost(slug: string): BlogPost | undefined {
  return posts.find((p) => p.slug === slug)
}
