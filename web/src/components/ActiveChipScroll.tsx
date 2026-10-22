'use client'

import { useEffect } from 'react'

/* On a phone the chip row scrolls sideways: bring the active chip into view once on mount. */
export function ActiveChipScroll() {
  useEffect(() => {
    document
      .querySelector<HTMLElement>('nav[aria-label="Article categories"] [aria-current="page"]')
      ?.scrollIntoView({ inline: 'center', block: 'nearest' })
  }, [])
  return null
}
