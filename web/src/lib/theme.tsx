'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'

export type ThemeMode = 'system' | 'light' | 'dark'

const STORAGE_KEY = 'll-theme'

interface ThemeContextType {
  mode: ThemeMode
  resolvedMode: 'light' | 'dark'
  setMode: (mode: ThemeMode) => void
}

const ThemeContext = createContext<ThemeContextType>({
  mode: 'system',
  resolvedMode: 'light',
  setMode: () => {},
})

function resolve(mode: ThemeMode, prefersDark: boolean): 'light' | 'dark' {
  if (mode === 'system') return prefersDark ? 'dark' : 'light'
  return mode
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<ThemeMode>('system')
  const [prefersDark, setPrefersDark] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  // Read persisted mode + current system preference after mount (SSR-safe, avoids hydration mismatch)
  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'system' || stored === 'light' || stored === 'dark') {
      setModeState(stored)
    }
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    setPrefersDark(mql.matches)
    setHydrated(true)

    const handleChange = (e: MediaQueryListEvent) => setPrefersDark(e.matches)
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])

  const resolvedMode = resolve(mode, prefersDark)

  // Apply .dark class to <html> whenever the resolved mode changes
  useEffect(() => {
    if (!hydrated) return
    document.documentElement.classList.toggle('dark', resolvedMode === 'dark')
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

const OPTIONS: { value: ThemeMode; label: string }[] = [
  { value: 'system', label: 'System' },
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
