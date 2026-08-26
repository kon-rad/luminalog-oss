import type { Metadata } from 'next'
import Link from 'next/link'
import ModulePage, { type Idea } from '@/components/ModulePage'
import { SectionHeading } from '@/components/course'
import { COURSE_BASE } from '@/lib/ai-agent-pro/course'
import {
  MODULE_7_CATEGORIES,
  MODULE_7_AGENDA,
  MODULE_7_STEPS,
  MODULE_7_MCQ,
  MODULE_7_OPEN_QUESTIONS,
  MODULE_7_MATERIALS_URL,
  MODULE_7_GUIDE_URL,
} from '@/lib/ai-agent-pro/program'

export const metadata: Metadata = {
  title: 'Module 7 · Your Own Cloud Drive, AI Agent Pro, Argo',
  description:
    'Git carries five megabytes; the vault is nineteen gigabytes. Object storage takes the rest, one filter file defines the split, and a guarded two way sync keeps a laptop, a server and a bucket in step. Live, 60 minutes, about 2 cents a month.',
}

const IDEAS: Idea[] = [
  {
    title: 'There are three categories, not two',
    body: 'Everyone splits a folder into small and large, then wonders why the sync is still enormous. The third category is rebuildable, and a thousand copies of node_modules belong in none of the systems you are paying for.',
  },
  {
    title: 'Git is for things that merge, object storage is for things that do not',
    body: 'Git has merged text for twenty years. Nothing merges an MP4. Picking the tool by file size is the wrong instinct; pick it by whether a conflict has a sensible resolution.',
  },
  {
    title: 'Never let two sync systems own the same file',
    body: 'One line in the filter file excludes markdown from the bucket, because git already owns it. Without that line a pull and a sync race each other, and the loser is overwritten with no error.',
  },
  {
    title: 'The safety default is not enough on its own',
    body: 'The built-in guard aborts above 50 percent deleted. Losing 40 percent of a vault proceeds silently. The access check is the guard that fires on the real failure mode: a path that is empty or mistyped.',
  },
  {
    title: 'A script must never answer a resync request on its own',
    body: 'The sync asks for one when it has lost track of what changed. That is the system asking for a human, and a resync means one side wins. A script that answers automatically will flatten the other side.',
  },
  {
    title: 'Scope the key, not the trust',
    body: 'The server needs to read the archive and has never needed to delete it. A read only key makes that structural rather than a promise you are relying on an unattended machine to keep.',
  },
  {
    title: 'A backup nobody has restored from is not a backup',
    body: 'The first homework item is a restore, for exactly this reason. Old versions also accumulate quietly and bill forever unless a lifecycle rule removes them.',
  },
  {
    title: 'Object storage is not automatically cheaper',
    body: 'At 2 TB it costs more than a consumer sync plan. The win is paying for the 13 GB you actually have instead of buying a 2 TB plan to hold it, and reaching it from any machine with one command.',
  },
]

/* The sorting exercise the module opens with, with the host's own measured
 * numbers. Students run the same commands on their own vault. */
function CategoriesSection() {
  return (
    <section>
      <div className="wrap" style={{ padding: '64px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 38 }}>
          <SectionHeading>Three categories, not two</SectionHeading>
          <p style={{ fontSize: 17, lineHeight: 1.6, color: 'var(--text2)', maxWidth: 620, margin: '12px auto 0' }}>
            One 19 GB vault, measured on 2026-08-26. You will run the same commands on your own and
            read your numbers into chat. The ratio is what decides the design.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3" style={{ gap: 22 }}>
          {MODULE_7_CATEGORIES.map((cat) => (
            <div key={cat.label} className="card flex flex-col" style={{ padding: '26px 28px' }}>
              <span
                className="inline-flex items-center justify-center"
                style={{ width: 46, height: 46, borderRadius: 14, background: 'var(--accentSoft)', color: 'var(--accentDeep)', marginBottom: 16 }}
              >
                <cat.icon style={{ width: 22, height: 22 }} />
              </span>
              <h3 className="serif" style={{ fontSize: 19, fontWeight: 600, color: 'var(--text)', marginBottom: 10 }}>
                {cat.label}
              </h3>
              <div className="flex items-baseline gap-2" style={{ marginBottom: 4 }}>
                <span
                  className="serif"
                  style={{ fontSize: 28, fontWeight: 600, color: 'var(--accentDeep)', letterSpacing: '-0.02em' }}
                >
                  {cat.size}
                </span>
                <span style={{ fontSize: 14, color: 'var(--text3)' }}>{cat.count}</span>
              </div>
              <p style={{ fontSize: 15.5, lineHeight: 1.55, color: 'var(--text2)', marginBottom: 16 }}>{cat.note}</p>
              <p
                style={{
                  fontSize: 14.5,
                  marginTop: 'auto',
                  paddingTop: 14,
                  borderTop: '1px solid var(--hairline)',
                  color: 'var(--text2)',
                }}
              >
                <span style={{ fontWeight: 600, color: 'var(--text)' }}>Goes to: </span>
                {cat.destination}
              </p>
            </div>
          ))}
        </div>
        <p
          style={{
            fontSize: 16,
            lineHeight: 1.6,
            color: 'var(--text2)',
            textAlign: 'center',
            maxWidth: 640,
            margin: '30px auto 0',
          }}
        >
          The vault is roughly <strong style={{ color: 'var(--text)' }}>3,800 times bigger</strong>{' '}
          than the part git carries. That is not an argument for a bigger git. It is an argument for
          two systems, and one file that decides which is which.
        </p>
      </div>
    </section>
  )
}

export default function ModuleSevenPage() {
  return (
    <ModulePage
      n={7}
      slug="module-7"
      title="Your Own Cloud Drive"
      lede="Module 5 put the vault in git and moved it to a server. Git carries five megabytes. The vault is nineteen gigabytes. Today the other 18.99 GB gets somewhere to live, and both agents get a way to reach it."
      costBadge="About 2 cents a month"
      prereq={
        <>
          <strong>You need the setup from Module 5</strong>: a private vault repository and a server
          running your agent. The{' '}
          <Link href={`${COURSE_BASE}/module-5`} style={{ color: 'var(--accentDeep)', fontWeight: 600 }}>
            Module 5 page
          </Link>{' '}
          rebuilds it.{' '}
          <Link href={`${COURSE_BASE}/module-6`} style={{ color: 'var(--accentDeep)', fontWeight: 600 }}>
            Module 6
          </Link>{' '}
          is optional and only affects the last segment.
        </>
      }
      guideUrl={MODULE_7_GUIDE_URL}
      materialsUrl={MODULE_7_MATERIALS_URL}
      ideas={IDEAS}
      agenda={MODULE_7_AGENDA}
      agendaLede="Part one defines the split and runs the first sync. Part two is the loop. The access check is protected: a sync that refuses to run when one side is missing is the deliverable."
      steps={MODULE_7_STEPS}
      cost={[
        { item: 'Object storage, first 10 GB', amount: 'Free' },
        { item: 'Above that, per TB per month', amount: '6.95 USD' },
        { item: 'A 13 GB media library', amount: 'About 2 cents a month' },
        { item: 'Uploads, and downloads up to 3x stored', amount: 'Free' },
      ]}
      costNote="Figures checked against the Backblaze pricing page on 2026-08-26. You still need a payment method on file even though the first 10 GB is free."
      caveat="Two way sync is the sharpest tool in this course. rclone's own manual calls bisync an advanced command and says data loss can result if you have not read the whole thing. Every guard set in this session, the dry run, the access check, the delete ceiling, the refusal to auto resync, exists because the failure mode is not an error message. It is a folder that is quietly emptier than it was."
      quizId="module-7"
      mcq={MODULE_7_MCQ}
      openQuestions={MODULE_7_OPEN_QUESTIONS}
    >
      <CategoriesSection />
    </ModulePage>
  )
}
