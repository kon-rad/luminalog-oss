import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PageChrome from '@/components/card-game/PageChrome'
import { DECKS, getDeck } from '@/lib/card-game/deck'
import DeckHome from './DeckHome'

export function generateStaticParams() {
  return DECKS.map((deck) => ({ slug: deck.slug }))
}

export function generateMetadata({ params }: { params: { slug: string } }): Metadata {
  const deck = getDeck(params.slug)
  if (!deck) return { title: 'Card Game, Argo' }
  return {
    title: `${deck.title}, Argo`,
    description: deck.tagline,
    openGraph: { title: `${deck.title}, Argo`, description: deck.tagline },
  }
}

export default function DeckPage({ params }: { params: { slug: string } }) {
  const deck = getDeck(params.slug)
  if (!deck) notFound()

  return (
    <PageChrome>
      <DeckHome deck={deck} />
    </PageChrome>
  )
}
