import type { Metadata } from 'next'
import Link from 'next/link'
import ModulePage, { type Idea } from '@/components/ModulePage'
import { COURSE_BASE } from '@/lib/ai-agent-pro/course'
import {
  MODULE_6_AGENDA,
  MODULE_6_STEPS,
  MODULE_6_MCQ,
  MODULE_6_OPEN_QUESTIONS,
  MODULE_6_MATERIALS_URL,
  MODULE_6_GUIDE_URL,
} from '@/lib/ai-agent-pro/program'

export const metadata: Metadata = {
  title: 'Module 6 · The Telegram Front Door, AI Agent Pro, Argo',
  description:
    'Your agent becomes reachable from your phone and asks permission before it acts. Deny by default, approvals you answer from anywhere, access tiers for a second person, and scheduled results that stay silent on quiet days. Live, 60 minutes, free.',
}

const IDEAS: Idea[] = [
  {
    title: 'Deny is the default, and that is the whole design',
    body: 'With nothing configured the gateway answers nobody. The one line that changes that is the one line worth getting right, and there are two flags that turn the system off entirely.',
  },
  {
    title: 'The lock is a Telegram account',
    body: 'Your agent can run commands on a server. The thing standing between a stranger and that shell is a number identifying your Telegram account. It is a good lock. It is the only one.',
  },
  {
    title: 'Adding an interface did not open a port',
    body: 'Long polling means the agent reaches out, so the firewall stays exactly as Module 5 left it. Most people expect the opposite, which is why the firewall gets checked on camera.',
  },
  {
    title: 'Unanswered means denied',
    body: 'Walking away from your desk never approves anything. The system fails closed, and that is only reassuring once you have watched a prompt time out and refuse itself.',
  },
  {
    title: 'Silence is a feature',
    body: 'A job that reports every healthy run is noise you will learn to ignore, and an ignored monitor is not a monitor. The quiet marker is what keeps the alert worth reading.',
  },
  {
    title: 'Not everything that messages you needs a model',
    body: 'When the text is already decided, send it. Asking an agent to relay a sentence you wrote costs tokens and adds a dependency on the gateway being healthy.',
  },
]

export default function ModuleSixPage() {
  return (
    <ModulePage
      n={6}
      slug="module-6"
      title="The Telegram Front Door"
      lede="Module 5 put your agent on a server that does not close. It is still only reachable by SSH from a laptop. This session moves the interface to your phone, and spends half the hour on who is allowed through the door."
      costBadge="Free"
      prereq={
        <>
          <strong>You need the server from Module 5</strong>, running your agent with the vault
          cloned onto it. The{' '}
          <Link href={`${COURSE_BASE}/module-5`} style={{ color: 'var(--accentDeep)', fontWeight: 600 }}>
            Module 5 page
          </Link>{' '}
          rebuilds it if yours is down. Bring Telegram on your phone, signed in, and your SSH access
          already tested.
        </>
      }
      guideUrl={MODULE_6_GUIDE_URL}
      materialsUrl={MODULE_6_MATERIALS_URL}
      ideas={IDEAS}
      agenda={MODULE_6_AGENDA}
      agendaLede="Part one gets the bot answering. Part two is about making it safe and useful, and the approval flow is protected: a prompt you deny from your phone is the deliverable."
      steps={MODULE_6_STEPS}
      cost={[
        { item: 'Telegram', amount: 'Free' },
        { item: 'The server', amount: 'Already running from Module 5' },
        { item: 'Model usage', amount: 'Only what your scheduled jobs spend' },
      ]}
      costNote="This module costs nothing. The entire cost is the risk you take by opening a door, which is why half the hour is spent on who is allowed through it."
      caveat="If your bot token leaks, whoever holds it controls your bot until you revoke it. If your Telegram account is taken over, the person holding it is already on the allowlist and the approval prompts go to them. Manual approvals and a one person allowlist make this a reasonable setup for your own server. They do not make it a vault, and anyone putting client data behind it should know the difference before they do."
      quizId="module-6"
      mcq={MODULE_6_MCQ}
      openQuestions={MODULE_6_OPEN_QUESTIONS}
    />
  )
}
