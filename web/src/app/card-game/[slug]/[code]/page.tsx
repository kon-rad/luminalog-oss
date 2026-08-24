import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import PageChrome from '@/components/card-game/PageChrome'
import { getDeck } from '@/lib/card-game/deck'
import { normalizeRoomCode } from '@/lib/card-game/room'
import RoomTable from './RoomTable'

export function generateMetadata({ params }: { params: { slug: string; code: string } }): Metadata {
  const deck = getDeck(params.slug)
  const code = normalizeRoomCode(params.code)
  if (!deck) return { title: 'Card Game, Argo' }
  return {
    title: `${code} · ${deck.title}, Argo`,
    description: deck.tagline,
  }
}

export default function RoomPage({ params }: { params: { slug: string; code: string } }) {
  const deck = getDeck(params.slug)
  if (!deck) notFound()

  // Normalized so a code shared in lowercase still opens the right document.
  const code = normalizeRoomCode(params.code)

  return (
    <PageChrome>
      <RoomTable deck={deck} code={code} />
    </PageChrome>
  )
}
