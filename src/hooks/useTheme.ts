import { useEffect, useState } from 'react'

/** §5.6 users/{uid}.preferences.appearance — 'system' respektuje OS/prohlížeč. */
export type ThemePreference = 'light' | 'dark' | 'system'
/** Co se AKTUÁLNĚ zobrazuje (po vyřešení 'system' přes matchMedia). */
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'doprovazeni.theme'
const DARK_QUERY = '(prefers-color-scheme: dark)'

function resolveInitialPreference(): ThemePreference {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === 'system') {
    return window.matchMedia(DARK_QUERY).matches ? 'dark' : 'light'
  }
  return preference
}

/**
 * Dočasné úložiště volby Světlý/Tmavý/Systémový — localStorage, dokud §5.6
 * (users/{uid}.preferences.appearance) nepřinese M9.5 skutečné, per-uživatel
 * uložené nastavení. `preference='system'` odstraní `data-theme` z <html>
 * úplně, ať převezme kontrolu `@media (prefers-color-scheme)` v index.css;
 * `light`/`dark` ho nastaví explicitně (přebije OS volbu).
 */
export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(resolveInitialPreference)
  const [resolvedTheme, setResolvedTheme] = useState<ResolvedTheme>(() =>
    resolveTheme(resolveInitialPreference()),
  )

  useEffect(() => {
    if (preference === 'system') {
      delete document.documentElement.dataset.theme
    } else {
      document.documentElement.dataset.theme = preference
    }
    localStorage.setItem(STORAGE_KEY, preference)
    setResolvedTheme(resolveTheme(preference))
  }, [preference])

  useEffect(() => {
    if (preference !== 'system') return
    const mql = window.matchMedia(DARK_QUERY)
    const onChange = () => setResolvedTheme(resolveTheme('system'))
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [preference])

  /** Rychlý binární přepínač pro ikonu v TopBaru — vždy nastaví explicitní
   * light/dark (ne system), podle toho, co je PRÁVĚ vidět. */
  function toggleTheme() {
    setPreference(resolvedTheme === 'light' ? 'dark' : 'light')
  }

  return { preference, setPreference, resolvedTheme, toggleTheme }
}
