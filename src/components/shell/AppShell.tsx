import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

/**
 * DESIGN_SYSTEM.md §4 — Layout desktop: sidebar + obsah na --bg-app (bez
 * vlastního bílého pozadí — bílé jsou až karty), max-width 1200px
 * vycentrovaný, px-8. TopBar (2026-07-19) je nový vzorek nad obsahem,
 * přes celou šířku hlavní plochy — ne omezený na 1200px jako obsah pod
 * ním, stejně jako v Magnific referenci.
 */
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen bg-app">
      <Sidebar />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <TopBar />
        <div className="mx-auto max-w-[1200px] px-8 pb-8">{children}</div>
      </main>
    </div>
  )
}
