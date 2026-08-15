'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

/* The OS colour-scheme preference is deliberately NOT consulted. Argo is a
 * light, warm-paper product; dark is an explicit opt-in only, never something a
 * system setting can impose. 'system' survives in the type solely so previously
 * persisted values still parse, and it resolves to light. */
export type ThemeMode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'll-theme'
const DEFAULT_MODE: ThemeMode = 'light'

interface ThemeContextType {
  mode: ThemeMode
  resolvedMode: 'light' | 'dark'
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextType>({
  mode: DEFAULT_MODE,
  resolvedMode: 'light',
  setMode: () => {},
})

function resolve(mode: ThemeMode): 'light' | 'dark' {
  // Only an explicit 'dark' is dark. 'system' (legacy stored value) is light.
  return mode === 'dark' ? 'dark' : 'light'
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>(DEFAULT_MODE)
  const [hydrated, setHydrated] = useState(false)

  // Read the persisted mode after mount (SSR-safe, avoids a hydration mismatch).
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    // A stored 'system' is intentionally ignored: it used to mean "follow the
    // OS", which is exactly the behaviour being removed.
    if (stored === 'light' || stored === 'dark') {
      setModeState(stored)
    }
    setHydrated(true)
  }, [])

  const resolvedMode = resolve(mode)

  // Apply .dark to <html> whenever the resolved mode changes, and strip it on
  // unmount. Without the cleanup the class outlives this provider: it is only
  // mounted under (app), so a client-side navigation out to a marketing page
  // (which has no ThemeProvider to reset it) would leave that page dark.
  useEffect(() => {
    if (!hydrated) return
    document.documentElement.classList.toggle('dark', resolvedMode === 'dark')
    return () => document.documentElement.classList.remove('dark')
  }, [resolvedMode, hydrated])

  const setMode = (next: ThemeMode) => {
    setModeState(next)
    window.localStorage.setItem(STORAGE_KEY, next)
  }

  return (
    <ThemeContext.Provider value={{ mode, resolvedMode, setMode }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)

/* No 'System' option: following the OS is no longer a behaviour we offer, so
 * showing it would promise something the resolver does not do. */
const OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

export function ThemeToggle() {
  const { mode, setMode } = useTheme()

  return (
    <div
      className="inline-flex items-center rounded-btn p-1"
      style={{ background: 'var(--surfaceAlt)', border: '1px solid var(--hairline)' }}
    >
      {OPTIONS.map((opt) => {
        const active = mode === opt.value
        return (
          <button
            key={opt.value}
            onClick={() => setMode(opt.value)}
            className="rounded-[10px] px-3.5 py-1.5 text-sm font-semibold transition-all duration-150"
            style={
              active
                ? { background: 'var(--accent)', color: '#fff' }
                : { color: 'var(--text2)' }
            }
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
