import type { Metadata } from 'next'
import Deck from './Deck'

/* The parent presentation, shown full screen. No navbar or footer here on
 * purpose: the deck owns the whole viewport so the slide can size itself. */

export const metadata: Metadata = {
  title: 'Core Skills, the parent presentation · Argo',
  description:
    'The slide deck for the Kids Wholistic Creativity & STEM class: why the class exists, what an hour looks like, what a family gets, and what it costs.',
}

export default function DeckPage() {
  return <Deck />
}
