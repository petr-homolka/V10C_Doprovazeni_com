import type { ReactNode } from 'react'

/**
 * Cesta B, druhý průchod (2026-07-23) — Vaadin/Lumo "view toolbar" pruh:
 * titulek žije ve VLASTNÍM ohraničeném pruhu na celou šířku obsahu,
 * vizuálně navazujícím na TopBar nahoře (záporné okraje ruší padding
 * `AppShell`ova obsahového kontejneru — `-mx-8 -mt-6`, párováno s jeho
 * `px-8 pt-6`), NE volně plovoucí `<h1>` v odsazeném obsahu jako předtím.
 * Tohle byla ta část, co Petr označil za "jen obarvené" — stejná kostra
 * stránky jako Cesta A, jen jiné barvy. Tenhle pruh mění samotnou siluetu.
 */
/**
 * `variant="settings"` — `AppShell`'s `secondaryPanel` branch wraps content
 * in `p-6` (not `px-8 pt-6` like the default branch), so the negative
 * margins that cancel it out have to match: `-mx-6 -mt-6` / `px-6` instead
 * of `-mx-8 -mt-6` / `px-8`. Use this on every `/nastaveni/*` page.
 */
export function PageHeader({
  title,
  description,
  actions,
  variant = 'default',
}: {
  title: string
  description?: string
  actions?: ReactNode
  variant?: 'default' | 'settings'
}) {
  return (
    <div
      className={
        variant === 'settings'
          ? '-mx-6 -mt-6 mb-6 flex items-center justify-between gap-4 border-b border-border-default bg-surface-soft px-6 py-5'
          : '-mx-8 -mt-6 mb-6 flex items-center justify-between gap-4 border-b border-border-default bg-surface-soft px-8 py-5'
      }
    >
      <div className="min-w-0">
        <h1 className="truncate text-[22px] font-bold leading-tight text-text-primary">{title}</h1>
        {description && <p className="mt-0.5 text-sm text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
