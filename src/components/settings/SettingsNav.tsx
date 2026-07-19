import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

/**
 * Vnořená navigace Nastavení — přeměřeno 2026-07-19 na živé referenční
 * appce (Dodatek 8+11). Sekční label: 10px, --text-secondary, py-1.5 (bez
 * uppercase — reference ho taky nemá, jen barva/velikost dělá práci).
 * Položka: h-8, radius-sm, text VŽDY --text-primary (aktivní i neaktivní
 * stejně jasné — text se nedimuje), aktivní = --overlay-active pozadí.
 * Tohle byla sporná otázka (viz Dodatek 8/9) — druhé kolo měření na
 * jiné referenční stránce téže appky potvrdilo `aria-current="page"` +
 * přesně tenhle overlay, takže naše dřívější volba `bg-overlay-active`
 * pro aktivní stav byla správná i předtím, než se to potvrdilo.
 *
 * Bez vlastní šířky/pozadí/scrollu (Dodatek 12) — o to se teď stará
 * `AppShell`ův `secondaryPanel` wrapper (`<nav>`), aby stejný obsah šel
 * použít i pro budoucí vyhledávání+seznam (Rodiny/Pěstouni/Děti) beze
 * změny této komponenty. Vnější `<nav>` už poskytuje AppShell, takže
 * tady je jen `<div>` — dvě vnořené `<nav>` by byly sémanticky zbytečné.
 */
export interface SettingsNavGroup {
  label: string
  items: { to: string; label: string }[]
}

export function SettingsNav({ groups }: { groups: SettingsNavGroup[] }) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-2.5 py-1.5 text-[10px] leading-none text-text-secondary">{group.label}</p>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    'flex h-8 items-center rounded-sm px-2.5 text-xs font-medium text-text-primary transition-colors duration-150 hover:bg-overlay-active',
                    isActive && 'bg-overlay-active',
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
