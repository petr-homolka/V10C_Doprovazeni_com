import { Bell, Moon, Settings, Sun } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useTheme } from '@/hooks/useTheme'

/**
 * Ikonový cluster vpravo nahoře (2026-07-19, inspirace Magnific.ai) —
 * Nastavení a přepínač Světlý/Tmavý se sem přesunuly ze sidebaru, jen
 * ikony (bez textového labelu), v tomhle pořadí před avatarem: motiv/téma
 * → nastavení → oznámení → účet.
 *
 * DŮLEŽITÝ PRINCIP pro budoucí stavové ikony (zapsáno na žádost uživatele):
 * pokud ikona představuje zapnutou/vypnutou "službu" (např. ztlumená
 * oznámení), MUSÍ vizuálně odlišit stav (přeškrtnutá/jiná ikona jako
 * BellOff), ne stejná ikona bez ohledu na stav. Zvonek tady zatím jen
 * OTEVÍRÁ panel oznámení (není to on/off přepínač), takže se ho princip
 * netýká — až M9 přinese možnost oznámení ztlumit, doplnit BellOff stav.
 * Theme toggle princip už splňuje (ikona = cílový stav, Moon/Sun).
 */
export function TopBar() {
  const { theme, toggleTheme } = useTheme()
  const { userDoc, firebaseUser } = useAuth()
  const displayName = userDoc?.displayName ?? firebaseUser?.email ?? ''
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <div className="flex items-center justify-end gap-1 px-8 py-3">
      <button
        type="button"
        onClick={toggleTheme}
        aria-label={theme === 'light' ? 'Přepnout na tmavý režim' : 'Přepnout na světlý režim'}
        title={theme === 'light' ? 'Přepnout na tmavý režim' : 'Přepnout na světlý režim'}
        className="flex size-9 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-surface-soft"
      >
        {theme === 'light' ? <Moon size={18} strokeWidth={1.75} /> : <Sun size={18} strokeWidth={1.75} />}
      </button>

      <button
        type="button"
        aria-label="Nastavení"
        title="Nastavení"
        className="flex size-9 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-surface-soft"
      >
        <Settings size={18} strokeWidth={1.75} />
      </button>

      <button
        type="button"
        aria-label="Oznámení"
        title="Oznámení"
        className="flex size-9 items-center justify-center rounded-md text-text-secondary transition-colors duration-150 hover:bg-surface-soft"
      >
        <Bell size={18} strokeWidth={1.75} />
      </button>

      <button
        type="button"
        aria-label="Účet"
        title={displayName}
        className="ml-1 flex size-8 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary"
      >
        {initials || '?'}
      </button>
    </div>
  )
}
