import type { Metadata } from 'next'
import { TbdLessonPage } from '@/components/course'
import { DAYS } from '@/lib/ai-power-users/course'

export const metadata: Metadata = {
  title: 'Day 3 · TBD — AI Power Users — Argo',
  description:
    'The topic for Day 3 is coming soon. Every day runs a 45-minute workshop and a 45-minute hands-on mentoring session, each followed by a 15-minute break.',
}

const day = DAYS.find((d) => d.slug === 'day-3')!

export default function Day3Page() {
  return <TbdLessonPage day={day} />
}
