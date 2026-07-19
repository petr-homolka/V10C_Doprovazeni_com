import type { ReactNode } from 'react'
import { SettingsNav, type SettingsNavGroup } from './SettingsNav'

/**
 * Nastavení = celá stránka (ne modál, viz CURRENT_STATE.md Dodatek 9) —
 * breadcrumb žije v TopBaru (AppShell `breadcrumb` prop), tady je jen
 * vnořené menu + obsah. Naměřeno 2026-07-19: nav i obsah sdílí STEJNÝ
 * panelový tón (--bg-surface-soft), jeden krok nad hlavním --bg-app
 * panelem — vytváří to vizuálně oddělený "modul Nastavení" uvnitř appky,
 * přesně jak to má Magnific (jejich nav i content panel obojí bg-panel-4).
 */
export function SettingsLayout({
  navGroups,
  children,
}: {
  navGroups: SettingsNavGroup[]
  children: ReactNode
}) {
  return (
    <div className="flex flex-col gap-6 rounded-lg bg-surface-soft p-5 lg:flex-row lg:gap-8">
      <SettingsNav groups={navGroups} />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
