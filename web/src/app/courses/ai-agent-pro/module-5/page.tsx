import type { Metadata } from 'next'
import Link from 'next/link'
import ModulePage, { type Idea } from '@/components/ModulePage'
import { COURSE_BASE } from '@/lib/ai-agent-pro/course'
import {
  MODULE_5_AGENDA,
  MODULE_5_STEPS,
  MODULE_5_MCQ,
  MODULE_5_OPEN_QUESTIONS,
  MODULE_5_MATERIALS_URL,
  MODULE_5_GUIDE_URL,
} from '@/lib/ai-agent-pro/program'

export const metadata: Metadata = {
  title: 'Module 5 · Deploy Your Agent and Sync Your Brain, AI Agent Pro, Argo',
  description:
    'Your agent moves off the laptop onto a hardened server that does not close, holding the same notes and the same skills. The vault becomes a private git repository and a sync loop keeps both machines identical. Live, 60 minutes.',
}

const IDEAS: Idea[] = [
  {
    title: 'Measure before you design the sync',
    body: 'A 16 GB vault whose markdown is 4.7 MB does not have a 16 GB problem. Every heavyweight option people reach for first, block storage, object storage, a file sync daemon, exists to solve a problem this vault does not have.',
  },
  {
    title: 'The ignore list comes before the first commit',
    body: 'Git tracks a file from the moment it is committed. Commit 15 GB of video, add the rule afterwards, and the video is still in the object store, in every clone, forever. Undoing it means rewriting history.',
  },
  {
    title: 'Skills belong in the repository',
    body: 'A skill in the repo wins over the global profile, the autonomous curator will not rewrite it, and a poisoned skill arriving on a git pull gets quarantined rather than loaded. Write once, and both machines have it.',
  },
  {
    title: 'Hardening has an order',
    body: 'Confirm a second SSH session as the new user before you lock root out. Locking yourself out of a server is memorable and costs ten minutes. The order is the lesson, not the commands.',
  },
  {
    title: 'Nothing is listening',
    body: 'No web server, no dashboard, no published port. The reason this is safe is that the only open door is SSH from your own address. A server with one door is a server you can reason about.',
  },
  {
    title: 'Write lanes beat conflict resolution',
    body: 'Give each machine a lane and write it into a context file both agents read. Nothing enforces it. It is a convention plus one paragraph, and it turns a weekly merge conflict into a rare one.',
  },
  {
    title: 'A job with no reasoning in it should not cost tokens',
    body: 'The push script stages, commits and pushes. None of that needs a model. Using the agent would spend tokens, add latency, and make the sync depend on the gateway being healthy.',
  },
  {
    title: 'Sync the notes, never the state',
    body: 'Two agents share a folder, not a mind. Sessions, memory and the state database stay on the machine that made them. Two writers pointed at one home compound each other into state neither of them authored.',
  },
  {
    title: 'The SSH backend moves commands, not content',
    body: 'Hermes can run the laptop agent\'s commands on the droplet directly, over the same hardened connection from the hardening step, instead of on the laptop. It does not sync the vault: that still moves by git, on purpose, so nothing writes to the same folder from two places at once.',
  },
]

export default function ModuleFivePage() {
  return (
    <ModulePage
      n={5}
      slug="module-5"
      title="Deploy Your Agent and Sync Your Brain"
      lede="Everything so far has run on your laptop. Close the lid and the agent stops existing. Today it moves to a machine that does not close, and the notes and skills stay identical on both."
      costBadge="About 6 USD a month"
      prereq={
        <>
          <strong>You need a working agent and a vault</strong> from{' '}
          <Link href={`${COURSE_BASE}/module-1`} style={{ color: 'var(--accentDeep)', fontWeight: 600 }}>
            Module 1
          </Link>
          . Local commands are macOS; the server is Ubuntu. Bring a payment method if you want to
          create the server live.
        </>
      }
      guideUrl={MODULE_5_GUIDE_URL}
      materialsUrl={MODULE_5_MATERIALS_URL}
      ideas={IDEAS}
      agenda={MODULE_5_AGENDA}
      agendaLede="Part one turns the vault into a repository. Part two builds the server. The last seven minutes are protected for the sync loop, because a note written on the server and read on the laptop is the deliverable."
      steps={MODULE_5_STEPS}
      cost={[
        { item: 'A Droplet, 1 vCPU, 1 GB, 25 GB SSD', amount: 'About 6 USD a month' },
        { item: 'Weekly backups, optional', amount: 'About 1.20 USD a month' },
        { item: 'A private GitHub repository', amount: 'Free' },
      ]}
      costNote="This is the first recurring cost in the course. It keeps billing after the session ends, so the last segment shows how to destroy the server, and the homework includes setting a billing alert."
      caveat="You now have two agents, and they do not share a mind. They share a folder. Sessions and memory stay on the machine that made them, and that is deliberate: two agents pointed at one home compound each other's entries into state neither of them authored. Sync the notes. Never sync the state, the session history, or the environment file."
      quizId="module-5"
      mcq={MODULE_5_MCQ}
      openQuestions={MODULE_5_OPEN_QUESTIONS}
    />
  )
}
