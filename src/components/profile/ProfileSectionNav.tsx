import { cn } from '@/lib/utils'

/**
 * Druhá úroveň navigace pro profilové stránky (rodina/Dohoda/pěstoun/
 * dítě) — UX zpětná vazba 2026-07-20, stejný vizuální vzor jako
 * `SettingsNav` (Nastavení, schválený a zamčený). Na rozdíl od
 * `SettingsNav` NEJDE o samostatné routy (`NavLink`) — sekce jedné
 * entity sdílejí JEDNO načtení dat (rodina/pěstoun/dítě se nenačítá
 * znovu při přepnutí sekce), takže aktivní sekce je lokální state, ne
 * URL. Vizuálně identické (h-8, radius-sm, `bg-overlay-active` pro
 * aktivní), jen `button` místo `NavLink`.
 */
export interface ProfileSection {
  key: string
  label: string
}

export function ProfileSectionNav({
  sections,
  active,
  onSelect,
}: {
  sections: ProfileSection[]
  active: string
  onSelect: (key: string) => void
}) {
  return (
    <div className="space-y-0.5">
      {sections.map((section) => (
        <button
          key={section.key}
          type="button"
          onClick={() => onSelect(section.key)}
          className={cn(
            'flex h-8 w-full items-center rounded-sm px-2.5 text-left text-xs font-medium text-text-primary transition-colors duration-150 hover:bg-overlay-active',
            active === section.key && 'bg-overlay-active',
          )}
        >
          {section.label}
        </button>
      ))}
    </div>
  )
}
