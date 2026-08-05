import type { Metadata } from 'next'
import { ExerciseList, LessonLayout, LessonSection } from '@/components/course'
import { DAYS, EXERCISES } from '@/lib/ai-power-users/course'

export const metadata: Metadata = {
  title: 'Day 1 · Foundations, Models & Prompting — AI Power Users — Argo',
  description:
    'What AI actually is, how large language models really work, the agent loop, the model ecosystem, and the prompt-engineering framework used by power users.',
}

const day = DAYS.find((d) => d.slug === 'day-1')!

export default function Day1Page() {
  return (
    <LessonLayout day={day}>
      <LessonSection eyebrow="Topic 1" title="A short history of AI">
        <p>
          The phrase &ldquo;artificial intelligence&rdquo; was coined in 1956 at a summer workshop
          at Dartmouth College. For the next fifty years, progress came in waves. Early researchers
          hand-wrote rules — <strong>expert systems</strong> that tried to capture human knowledge
          as long lists of &ldquo;if this, then that.&rdquo; They worked in narrow domains and then
          hit a wall, and funding dried up in periods now called the <strong>AI winters</strong>.
        </p>
        <p>
          The modern era runs on a different idea: instead of writing the rules, you let a system{' '}
          <strong>learn patterns from data</strong>. That is machine learning, and its most
          powerful form — deep learning with <strong>neural networks</strong> — took off in the
          2010s as computers got fast enough and data got plentiful enough. The pivotal moment was
          a 2017 research paper that introduced the <strong>transformer</strong>, the architecture
          behind today&rsquo;s chatbots. When that was scaled up on enormous amounts of text, the
          generative-AI boom of 2022 followed: ChatGPT, Claude, Gemini, and the tools you are here
          to master.
        </p>
        <p>
          Why now? Three things arrived together — enough data, enough computing power, and an
          architecture that scales. None alone was enough; the combination changed everything.
        </p>
      </LessonSection>

      <LessonSection eyebrow="Topic 2" title="What a large language model actually is">
        <p>
          A large language model (LLM) does one deceptively simple thing:{' '}
          <strong>it predicts the next chunk of text</strong>. Given everything so far, it
          estimates the most likely continuation, adds it, and repeats. &ldquo;Chunks&rdquo; are
          called <strong>tokens</strong> — roughly word-pieces. That is the whole trick. Everything
          that feels like reasoning, writing, or conversation emerges from next-token prediction
          done extraordinarily well.
        </p>
        <p>
          There are two phases. <strong>Training</strong> happens once, ahead of time: the model
          reads a huge slice of the internet and books and adjusts billions of internal numbers
          (its <strong>weights</strong>) until its predictions are good. <strong>Inference</strong>{' '}
          is what happens when you use it: the weights are frozen, and the model simply runs its
          prediction over your prompt. This is why a model has a <strong>knowledge cutoff</strong>{' '}
          — it only knows what was in its training data, up to a certain date.
        </p>
        <p>
          Two consequences matter enormously for using AI well. First, an LLM is{' '}
          <strong>not a database and not a search engine</strong>. It does not &ldquo;look things
          up&rdquo;; it generates plausible text. Second, when it lacks the real answer, it will
          often produce a confident, fluent-sounding wrong one — this is a{' '}
          <strong>hallucination</strong>. The model is not lying; it is doing exactly what it was
          built to do — predicting likely text — and likely text is not always true text. Your job
          as a power user is to know when that gap matters and to verify.
        </p>
      </LessonSection>

      <LessonSection eyebrow="Topic 3" title="The agent loop">
        <p>
          A plain chatbot gives you one reply and stops. An <strong>agent</strong> runs a loop:{' '}
          <strong>perceive → think → act → observe → repeat</strong>. It reads the situation,
          decides on a step, takes an action — searching the web, running code, calling a tool,
          editing a file — then looks at the result and decides the next step. It keeps going until
          the goal is met.
        </p>
        <p>
          That loop is the whole difference between &ldquo;a model that answers questions&rdquo;
          and &ldquo;a system that gets things done.&rdquo; A chatbot can tell you how to book a
          trip; an agent can check dates, compare options, and fill the form. The loop is also
          where autonomy — and risk — comes from, which is why later in the week we spend real time
          on what you should and should not let an agent do on your behalf.
        </p>
      </LessonSection>

      <LessonSection eyebrow="Topic 4" title="Tokens, context windows, and temperature">
        <p>
          Three dials control every model, and understanding them turns confusing behaviour into
          something you can predict.
        </p>
        <p>
          <strong>Tokens</strong> are the pieces of text the model reads and writes — a token is
          about three-quarters of a word. You are billed by the token, and limits are counted in
          tokens.
        </p>
        <p>
          The <strong>context window</strong> is how many tokens the model can &ldquo;hold in
          mind&rdquo; at once — your prompt plus its reply plus the conversation so far. When a
          chat gets long and the model seems to <strong>forget</strong> what you said earlier, you
          have overflowed the window: the oldest text falls out of view. The fix is not to repeat
          yourself endlessly but to re-state the essentials, or start fresh with a tight summary.
        </p>
        <p>
          <strong>Temperature</strong> controls randomness. Low temperature makes the model pick
          the single most likely next token every time — good for consistency, code, and facts.
          High temperature lets it wander into less likely choices — good for brainstorming and
          creative writing. This is why the same prompt can give different answers twice: unless
          temperature is zero, there is deliberate randomness in the pick.
        </p>
      </LessonSection>

      <LessonSection eyebrow="Topic 5" title="The model ecosystem">
        <p>
          There is no single &ldquo;AI.&rdquo; There is a landscape, and power users choose
          deliberately within it.
        </p>
        <p>
          <strong>Open vs. closed.</strong> Closed models (like GPT and Claude) run on the
          maker&rsquo;s servers; you use them through an app or an API and cannot see the weights.
          Open-weight models (like Meta&rsquo;s Llama, Mistral, DeepSeek, and Qwen) can be
          downloaded and run yourself. Closed models are often the most capable and the most
          convenient; open models give you control, privacy, and no per-use fee. Neither is
          &ldquo;better&rdquo; — they trade off differently, and by Friday you will have run an
          open model on your own laptop.
        </p>
        <p>
          <strong>The major families.</strong> GPT (OpenAI), Claude (Anthropic), Gemini (Google),
          Llama (Meta), plus Mistral, DeepSeek, and Qwen. They differ in tone, strengths, price,
          and openness — which is exactly what your peer mini-teach on Wednesday will map out.
        </p>
        <p>
          <strong>Modalities.</strong> Models specialise by what they handle: text, images, video,
          audio and voice, and speech-to-text. A <strong>multimodal</strong> model does several at
          once — it can see an image, read text, and reply in words. Multimodal is the direction of
          travel, and it is the whole theme of Day 2.
        </p>
        <p>
          <strong>Reasoning models.</strong> Some models are tuned to &ldquo;think&rdquo; before
          answering — working through a problem step by step, visibly or invisibly, before giving a
          final answer. They are slower and cost more, and they are worth it for hard, multi-step
          problems and not much else. Matching the model to the task — small and fast when that is
          enough, large and thoughtful when it is not — is a core power-user skill.
        </p>
      </LessonSection>

      <LessonSection eyebrow="Topic 6" title="Prompt engineering and system prompts">
        <p>
          A prompt is not a magic spell; it is a brief. The habit that separates power users from
          casual users is giving the model a <strong>complete brief</strong>, and there is a simple
          framework for it:
        </p>
        <p>
          <strong>Role · Task · Context · Constraints · Examples · Format.</strong> Tell the model
          who to be (&ldquo;You are a careful copy editor&rdquo;), what to do, the background it
          needs, the limits (length, tone, what to avoid), an example or two of what good looks
          like, and the exact output shape you want (a table, a checklist, JSON, three bullet
          points). The more of these you supply, the less the model has to guess — and guessing is
          where weak answers come from.
        </p>
        <p>
          A <strong>system prompt</strong> is a special, persistent instruction that sits above the
          whole conversation and sets the model&rsquo;s persona and rules — it applies to every
          message, not just one. Writing your own is how you turn a general chatbot into a tool
          that behaves consistently: &ldquo;Always answer in plain English, flag anything you are
          unsure about, and never invent a citation.&rdquo;
        </p>
        <p>
          Finally, treat AI as a <strong>conversation, not a vending machine</strong>. Your first
          prompt is a draft. Read the reply, correct it, add the constraint you forgot, ask for a
          different format — iterating two or three times reliably beats trying to write one
          perfect prompt. In the lab, you will do exactly that.
        </p>
      </LessonSection>

      <LessonSection title="Practice">
        <p>
          Concepts stick when you use them. Work through today&rsquo;s lab and peer exercise now,
          and the homework and essay are due Wednesday.
        </p>
        <ExerciseList exercises={EXERCISES['day-1']} />
      </LessonSection>
    </LessonLayout>
  )
}
