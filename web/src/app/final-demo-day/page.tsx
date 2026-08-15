import type { Metadata } from 'next'
import Deck from '@/components/demo-day/Deck'

export const metadata: Metadata = {
  title: 'Final Demo Day, Argo',
  description:
    'The Argo final demo day presentation: the d/acc thesis, the product, the flywheel, and the results. Sixteen slides with speaker notes.',
  /* Internal presentation material, not something to surface in search. */
  robots: { index: false, follow: false },
}

export default function FinalDemoDayPage() {
  return <Deck />
}
