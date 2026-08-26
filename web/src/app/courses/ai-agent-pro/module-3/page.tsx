import type { Metadata } from 'next'
import Link from 'next/link'
import ModulePage, { SkillsSection, type Idea } from '@/components/ModulePage'
import { COURSE_BASE } from '@/lib/ai-agent-pro/course'
import {
  MODULE_3_SKILLS,
  MODULE_3_AGENDA,
  MODULE_3_STEPS,
  MODULE_3_MCQ,
  MODULE_3_OPEN_QUESTIONS,
  MODULE_3_MATERIALS_URL,
  MODULE_3_GUIDE_URL,
} from '@/lib/ai-agent-pro/program'

export const metadata: Metadata = {
  title: 'Module 3 · Media Models and Your Own Domain, AI Agent Pro, Argo',
  description:
    'Your agent gets access to image and video models, turns one photograph into a moving hero, takes a design direction from work you admire, and puts the site on a domain you own. Live, 60 minutes, about 2 USD of generation.',
}

const IDEAS: Idea[] = [
  {
    title: 'Know the price before you spend it',
    body: 'Text models are cheap enough to be careless with. Media models are not. The habit that matters is not picking the best model, it is being able to work out what a job costs before you run it.',
  },
  {
    title: 'The family decides the result',
    body: 'If you already have the photograph, you want image to video. Hand the same job to a text to video model and it will invent a different fence. Most bad media output is the right prompt sent to the wrong family.',
  },
  {
    title: 'The depth is a guess',
    body: 'Image to video infers depth from one photograph and re-renders the frames. Ask for a slow camera move and the model has less to invent, which is why slow moves look expensive and fast ones look cheap.',
  },
  {
    title: 'Rules, not adjectives',
    body: '"Modern and clean" gets you the average of everything the model has ever seen. A type scale, a spacing value and one accent colour get you a decision you can check against the built page.',
  },
  {
    title: 'Steal the mechanism, not the layout',
    body: 'Extracting principles from work you admire is what designers have always done. Reproducing someone else’s site is not. The test is whether a visitor could tell where you got it.',
  },
  {
    title: 'A domain is rented, not bought',
    body: 'It expires, and then it returns to the market for anyone to register. Turn on auto renew the day you buy it, not the day you remember.',
  },
]

export default function ModuleThreePage() {
  return (
    <ModulePage
      n={3}
      slug="module-3"
      title="Media Models and Your Own Domain"
      lede="Your agent gets a camera. Two skills that read the media model catalogue and price a job before running it, one photograph turned into a moving hero, a design direction taken from work you admire, and the whole site on a domain you own."
      costBadge="About 2 USD"
      prereq={
        <>
          <strong>You need the site from Module 2</strong>, built, committed and deployed. If you
          missed it, the{' '}
          <Link href={`${COURSE_BASE}/module-2`} style={{ color: 'var(--accentDeep)', fontWeight: 600 }}>
            Module 2 page
          </Link>{' '}
          has the guide. Bring two or three high resolution photographs and three to five sites you
          admire, tabs already open.
        </>
      }
      guideUrl={MODULE_3_GUIDE_URL}
      materialsUrl={MODULE_3_MATERIALS_URL}
      ideas={IDEAS}
      agenda={MODULE_3_AGENDA}
      agendaLede="Part one gives the agent a camera. Part two uses it. The domain and the deploy are protected: a live HTTPS URL is the deliverable."
      steps={MODULE_3_STEPS}
      cost={[
        { item: 'Media generation on fal.ai', amount: 'About 2 USD' },
        { item: 'A domain, per year', amount: '10 to 20 USD' },
        { item: 'ffmpeg, and the hosting', amount: 'Free' },
      ]}
      costNote="Add the credit and set a spend limit before you arrive. This is the first module in the course that spends real money."
      caveat="A video hero is not automatically better than a photograph. It is better when the motion shows something a still cannot, which for a fence is depth, length, and how light sits on the boards. If the clip does not do that, a sharp photograph beats it, loads faster, and never warps a post. The same goes for the domain: it makes the site look like a business, and it changes nothing about whether the site gets quote requests."
      quizId="module-3"
      mcq={MODULE_3_MCQ}
      openQuestions={MODULE_3_OPEN_QUESTIONS}
    >
      <SkillsSection
        heading="The two skills your agent writes"
        lede="Neither one hardcodes a model name. Media models change monthly, so a skill with a model written into it is wrong by the time you finish writing it. The skill is told where to look, not what to use."
        skills={MODULE_3_SKILLS}
      />
    </ModulePage>
  )
}
