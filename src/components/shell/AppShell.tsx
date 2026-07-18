import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'

/**
 * DESIGN_SYSTEM.md §4 — Layout desktop: sidebar + obsah na --bg-app (bez
 * vlastního bílého pozadí — bílé jsou až karty), max-width 1200px
 * vycentrovaný, px-8.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-app">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto px-8 py-8">
        <div className="mx-auto max-w-[1200px]">{children}</div>
      </main>
    </div>
  )
}
