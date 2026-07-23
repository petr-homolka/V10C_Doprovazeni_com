import { Bell, Moon, Settings, Sun } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useTheme } from '@/hooks/useTheme'
import { Breadcrumb, type BreadcrumbItem } from '@/components/ui/breadcrumb'
import { AccountMenu } from './AccountMenu'

/**
 * Header řádek — přeměřeno 2026-07-19 přímo na živé referenční appce
 * (getComputedStyle): výška 56px (h-14), padding px-4 (ne px-8), ikonová
 * tlačítka 32px (size-8) s radius-sm (8px), hover = jemný alpha overlay
 * (`--overlay-active`), STEJNÁ jasnost textu/ikony jako zbytek chrome
 * appky (žádné ztlumení pro "neaktivní" stav).
 *
 * Breadcrumb (pokud stránka nějaký má) žije VLEVO ve STEJNÉM řádku jako
 * ikonový cluster vpravo — přesně stejná struktura headeru (breadcrumb
 * a ikony jsou sourozenci v jednom flex řádku, ne breadcrumb v obsahu pod
 * headerem). Bez breadcrumbu (stránky bez drill-down navigace, např.
 * "Dnes") zůstává levá strana prázdná.
 *
 * Nastavení a přepínač Světlý/Tmavý žijí tady, jen ikony (bez textového
 * labelu), v tomhle pořadí před avatarem: motiv/téma → nastavení →
 * oznámení → účet. Ikona Nastavení vede na /nastaveni/vzhled (Nastavení
 * = celá stránka s breadcrumbem, ne modál — viz CURRENT_STATE.md
 * Dodatek 9).
 *
 * DŮLEŽITÝ PRINCIP pro budoucí stavové ikony (zapsáno na žádost uživatele):
 * pokud ikona představuje zapnutou/vypnutou "službu" (např. ztlumená
 * oznámení), MUSÍ vizuálně odlišit stav (přeškrtnutá/jiná ikona jako
 * BellOff), ne stejná ikona bez ohledu na stav. Zvonek tady zatím jen
 * OTEVÍRÁ panel oznámení (není to on/off přepínač), takže se ho princip
 * netýká — až M9 přinese možnost oznámení ztlumit, doplnit BellOff stav.
 * Theme toggle princip už splňuje (ikona = cílový stav, Moon/Sun).
 *
 * Cesta D — "plovoucí pilulka" místo celo-šířkové lišty s `border-b`:
 * hlavička je samostatná plně zaoblená bílá karta se stínem, s mezerou
 * (`bg-app`) kolem sebe na všech stranách — Woorkroom reference (SPEC.md
 * "Top bar / header"), kde titulek stránky žije POD pilulkou, ne uvnitř ní.
 */
export function TopBar({ breadcrumb }: { breadcrumb?: BreadcrumbItem[] }) {
  const { resolvedTheme, toggleTheme } = useTheme()
  const themeLabel =
    resolvedTheme === 'light' ? 'Přepnout na tmavý režim' : 'Přepnout na světlý režim'

  return (
    <div className="shrink-0 bg-app px-4 pt-3">
      <div className="flex h-14 items-center justify-between gap-4 rounded-full bg-surface-soft px-4 shadow-raised">
        <div className="min-w-0 flex-1">{breadcrumb && <Breadcrumb items={breadcrumb} />}</div>

        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={themeLabel}
            title={themeLabel}
            className="flex size-9 items-center justify-center rounded-full text-text-primary transition-colors duration-150 hover:bg-overlay-active"
          >
            {resolvedTheme === 'light' ? <Moon size={18} strokeWidth={1.75} /> : <Sun size={18} strokeWidth={1.75} />}
          </button>

          <Link
            to="/nastaveni/vzhled"
            aria-label="Nastavení"
            title="Nastavení"
            className="flex size-9 items-center justify-center rounded-full text-text-primary transition-colors duration-150 hover:bg-overlay-active"
          >
            <Settings size={18} strokeWidth={1.75} />
          </Link>

          <button
            type="button"
            aria-label="Oznámení"
            title="Oznámení"
            className="flex size-9 items-center justify-center rounded-full text-text-primary transition-colors duration-150 hover:bg-overlay-active"
          >
            <Bell size={18} strokeWidth={1.75} />
          </button>

          <AccountMenu />
        </div>
      </div>
    </div>
  )
}
