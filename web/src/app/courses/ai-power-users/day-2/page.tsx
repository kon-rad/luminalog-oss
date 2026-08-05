import type { Metadata } from 'next'
import { TbdLessonPage } from '@/components/course'
import { DAYS } from '@/lib/ai-power-users/course'

export const metadata: Metadata = {
  title: 'Day 2 · TBD — AI Power Users — Argo',
  description:
    'The topic for Day 2 is coming soon. Every day runs a 45-minute workshop and a 45-minute hands-on mentoring session, each followed by a 15-minute break.',
}

const day = DAYS.find((d) => d.slug === 'day-2')!

export default function Day2Page() {
  return <TbdLessonPage day={day} />
}
