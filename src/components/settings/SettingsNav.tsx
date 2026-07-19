import { NavLink } from 'react-router-dom'
import { cn } from '@/lib/utils'

/**
 * Vnořená navigace Nastavení — přeměřeno 2026-07-19 na Magnific Settings
 * (Dodatek 8+11). Sekční label: 10px, --text-secondary, py-1.5 (bez
 * uppercase — Magnific ho taky nemá, jen barva/velikost dělá práci).
 * Položka: h-8, radius-sm, text VŽDY --text-primary (aktivní i neaktivní
 * stejně jasné — Magnific nedimuje), aktivní = --overlay-active pozadí.
 * Tohle byla sporná otázka (viz Dodatek 8/9) — druhé kolo měření na
 * `people.html` potvrdilo `aria-current="page"` + přesně tenhle overlay,
 * takže naše dřívější volba `bg-overlay-active` pro aktivní stav byla
 * správná i předtím, než se to potvrdilo.
 */
export interface SettingsNavGroup {
  label: string
  items: { to: string; label: string }[]
}

export function SettingsNav({ groups }: { groups: SettingsNavGroup[] }) {
  return (
    <nav className="w-full shrink-0 space-y-4 lg:w-46">
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
    </nav>
  )
}
