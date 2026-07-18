import { useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'doprovazeni.theme'

function resolveInitialTheme(): Theme {
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark') return stored
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

/**
 * Dočasné úložiště volby Světlý/Tmavý — localStorage, dokud §5.6
 * (users/{uid}.preferences.appearance) nepřinese M9.5 skutečné, per-uživatel
 * uložené nastavení. Nastavuje `data-theme` na <html>, stejný mechanismus,
 * který bude Nastavení používat i pak.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(resolveInitialTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  function toggleTheme() {
    setThemeState((current) => (current === 'light' ? 'dark' : 'light'))
  }

  return { theme, toggleTheme }
}
