import type { ReactNode } from 'react'

/**
 * Cesta B, druhý průchod (2026-07-23) — Vaadin Grid+Toolbar vzor: filtr/
 * řazení/hromadné akce žijí v OHRANIČENÉM pruhu přímo nad tabulkou (ne
 * volně v odsazeném obsahu), vizuálně SROSTLÉ s tabulkou pod ním —
 * `rounded-b-none` tady + `<Table className="rounded-t-none border-t-0">`
 * na volajícím místě tvoří jeden souvislý blok.
 */
export function ListToolbar({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-t-md border border-b-0 border-border-default bg-surface-soft px-4 py-2.5">
      {children}
    </div>
  )
}
