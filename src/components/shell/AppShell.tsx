import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

/**
 * NOVÝ vzorek (2026-07-19, inspirace Magnific.ai) — sidebar a hlavní obsah
 * "plavou" jako dva samostatné zaoblené panely na tmavší/světlejší ploše
 * (--bg-void) s mezerou mezi nimi, místo dřívějšího edge-to-edge layoutu.
 * DESIGN_SYSTEM.md §4 (max-width 1200px vycentrovaný obsah, px-8) platí
 * uvnitř hlavního panelu beze změny.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen gap-2 bg-void p-2">
      <div className="shrink-0 overflow-hidden rounded-lg">
        <Sidebar />
      </div>
      <main className="min-w-0 flex-1 overflow-y-auto rounded-lg bg-app">
        <TopBar />
        <div className="mx-auto max-w-[1200px] px-8 pb-8">{children}</div>
      </main>
    </div>
  )
}
