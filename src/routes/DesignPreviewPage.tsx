import { useState } from 'react'
import { AppShell } from '@/components/shell/AppShell'
import { TodaySampleSections } from '@/components/TodaySampleSections'
import { AuthContext } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'

const MOCK_AUTH_VALUE = {
  firebaseUser: null,
  loading: false,
  userDoc: {
    uid: 'preview',
    role: 'klicova_osoba' as const,
    displayName: 'Jana Málková',
    email: 'jana@example.com',
    organizationId: 'preview-org',
    createdAt: 'preview',
  },
}

/**
 * DOČASNÁ stránka pro vizuální review (§11 "vzorek před sweepem") —
 * NEPROCHÁZÍ RequireAuth, protože v tuhle chvíli neexistuje žádný fungující
 * backend (Auth emulátor na tomhle stroji nestartuje), přes který by šlo
 * ukázat reálně přihlášenou obrazovku. AuthContext se tu lokálně přepíše
 * mock hodnotou, ať Sidebar/Dashboard vidí "přihlášeného" uživatele stejně
 * jako v ostrém provozu. Smazat, jakmile M1 přinese reálná data a
 * přihlášení přes tenhle shell jde ověřit normální cestou (/login).
 *
 * Přepínač Světlý/Tmavý dole je JEN pro tuhle review stránku — nastavuje
 * `data-theme` na <html>, stejný mechanismus, který později použije
 * skutečné nastavení Vzhled (§5.6, M9.5). Nepřežívá reload.
 */
export default function DesignPreviewPage() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light')

  function toggleTheme() {
    const next = theme === 'light' ? 'dark' : 'light'
    setTheme(next)
    document.documentElement.dataset.theme = next
  }

  return (
    <AuthContext.Provider value={MOCK_AUTH_VALUE}>
      <AppShell>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-serif text-[28px] font-semibold leading-tight text-text-primary">
              Dnes
            </h1>
            <p className="mt-1 text-[13px] text-text-secondary">
              Přihlášen jako Jana Málková · klicova_osoba (ukázková data pro review)
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={toggleTheme}>
            {theme === 'light' ? 'Přepnout na tmavý' : 'Přepnout na světlý'}
          </Button>
        </div>

        <TodaySampleSections />
      </AppShell>
    </AuthContext.Provider>
  )
}
