'use client'

import { useEffect, useMemo, useRef } from 'react'
import { mountCognitiveMap, type MapHandle } from './mount'
import type { CognitiveMap } from './types'

export interface CognitiveMapViewProps {
  map: CognitiveMap
  onSelectBeat?: (beatId: string) => void
  theme?: Record<string, string>
  colorScheme?: 'light' | 'dark'
  className?: string
}

/**
 * React wrapper around the framework-free mount. The handle is created once per host
 * element and reused across map changes, so a redraw does not rebind the pointer
 * listeners.
 *
 * `onSelectBeat` is held in a ref so a caller passing an inline arrow function (the
 * normal case) does not force a remount on every parent render.
 */
export function CognitiveMapView({
  map,
  onSelectBeat,
  theme,
  colorScheme,
  className,
}: CognitiveMapViewProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const handleRef = useRef<MapHandle | null>(null)
  const selectRef = useRef(onSelectBeat)
  selectRef.current = onSelectBeat

  // Remount only when the palette actually changes value, not identity.
  const themeKey = useMemo(() => JSON.stringify(theme ?? {}), [theme])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    handleRef.current = mountCognitiveMap(host, map, {
      theme,
      colorScheme,
      onSelectBeat: (beatId) => selectRef.current?.(beatId),
    })
    return () => {
      handleRef.current?.destroy()
      handleRef.current = null
    }
    // `map` is applied by the update effect below, so it must not remount here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colorScheme, themeKey])

  useEffect(() => {
    handleRef.current?.update(map)
  }, [map])

  return <div ref={hostRef} className={className} style={{ width: '100%', height: '100%' }} />
}
