// @vitest-environment jsdom
import { renderHook, act, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createElement, ReactNode } from 'react'
import { ThemeProvider, useTheme } from './theme'

// createElement rather than JSX: this vitest config has no React plugin, so
// test files stay .ts (matching useEntitlement.test.ts).
const wrapper = ({ children }: { children: ReactNode }) =>
  createElement(ThemeProvider, null, children)

const isDark = () => document.documentElement.classList.contains('dark')

/** The OS preference the old implementation followed. Nothing may read it now. */
function stubOsPrefersDark(prefersDark: boolean) {
  const matchMedia = vi.fn().mockReturnValue({
    matches: prefersDark,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  })
  Object.defineProperty(window, 'matchMedia', { writable: true, value: matchMedia })
  return matchMedia
}

beforeEach(() => {
  window.localStorage.clear()
  document.documentElement.classList.remove('dark')
})

describe('ThemeProvider', () => {
  it('defaults to light when nothing has been chosen, even if the OS prefers dark', async () => {
    const matchMedia = stubOsPrefersDark(true)
    const { result } = renderHook(() => useTheme(), { wrapper })

    await waitFor(() => expect(result.current.resolvedMode).toBe('light'))
    expect(isDark()).toBe(false)
    // The OS preference must not even be consulted.
    expect(matchMedia).not.toHaveBeenCalled()
  })

  it('ignores a legacy stored "system" value rather than following the OS', async () => {
    stubOsPrefersDark(true)
    window.localStorage.setItem('ll-theme', 'system')
    const { result } = renderHook(() => useTheme(), { wrapper })

    await waitFor(() => expect(result.current.resolvedMode).toBe('light'))
    expect(isDark()).toBe(false)
  })

  it('honours an explicit dark choice, because dark is still a supported mode', async () => {
    stubOsPrefersDark(false)
    window.localStorage.setItem('ll-theme', 'dark')
    const { result } = renderHook(() => useTheme(), { wrapper })

    await waitFor(() => expect(result.current.resolvedMode).toBe('dark'))
    expect(isDark()).toBe(true)
  })

  it('toggles to dark and back, persisting each choice', async () => {
    stubOsPrefersDark(false)
    const { result } = renderHook(() => useTheme(), { wrapper })
    await waitFor(() => expect(result.current.resolvedMode).toBe('light'))

    act(() => result.current.setMode('dark'))
    await waitFor(() => expect(isDark()).toBe(true))
    expect(window.localStorage.getItem('ll-theme')).toBe('dark')

    act(() => result.current.setMode('light'))
    await waitFor(() => expect(isDark()).toBe(false))
    expect(window.localStorage.getItem('ll-theme')).toBe('light')
  })

  it('strips the dark class on unmount so it cannot leak onto marketing pages', async () => {
    stubOsPrefersDark(false)
    window.localStorage.setItem('ll-theme', 'dark')
    const { unmount } = renderHook(() => useTheme(), { wrapper })
    await waitFor(() => expect(isDark()).toBe(true))

    // ThemeProvider mounts only under (app); a client-side navigation out to a
    // marketing page unmounts it, and those pages have no provider to reset it.
    unmount()
    expect(isDark()).toBe(false)
  })
})
