import type { Metadata } from 'next'
import { ScholarIndexView } from '@/components/vitalik-scholar'
import { scholarPosts } from '@/lib/vitalik-scholar'

export const metadata: Metadata = {
  title: 'Vitalik Scholar, Argo',
  description:
    "Study notes on Vitalik Buterin's talks and Ethereum: summaries, timestamps, short clips and key terms with further reading.",
  openGraph: {
    title: 'Vitalik Scholar',
    description: "Study notes on Vitalik Buterin's talks and Ethereum.",
  },
}

export default function VitalikScholarPage() {
  const sorted = [...scholarPosts].sort((a, b) => (a.isoDate < b.isoDate ? 1 : -1))
  return <ScholarIndexView posts={sorted} />
}
