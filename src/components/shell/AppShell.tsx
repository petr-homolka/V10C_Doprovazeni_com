import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

/**
 * Sidebar a hlavní obsah "plavou" jako dva samostatné zaoblené panely na
 * tmavší/světlejší ploše (--bg-void) s mezerou mezi nimi. TopBar je
 * `shrink-0` (nescroluje s obsahem) — přesně struktura naměřená na živé
 * Magnific appce (header h-14 mimo scrollovatelnou oblast, viz
 * CURRENT_STATE.md Dodatek 5). DESIGN_SYSTEM.md §4 (max-width 1200px
 * vycentrovaný obsah, px-8) platí uvnitř scrollovatelné oblasti beze změny.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-screen gap-2 bg-void p-2">
      <div className="shrink-0 overflow-hidden rounded-lg">
        <Sidebar />
      </div>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-app">
        <TopBar />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1200px] px-8 pb-8">{children}</div>
        </div>
      </main>
    </div>
  )
}
