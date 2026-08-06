import type { ReactNode } from 'react'
import { useScrollTopOnRoute } from '@/hooks/useScrollTopOnRoute'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { ActiveVisitBanner } from './ActiveVisitBanner'

/**
 * `sidePanel` renders as a sibling of the sidebar/main column, not nested
 * inside `main` — that's what gives it full viewport height (spanning
 * past the TopBar row) instead of starting below the header.
 *
 * `breadcrumb` odsud 2026-07-25 ZMIZEL. Nesl jednu informaci, která je
 * zároveň v levém panelu (zvýrazněná položka) a v nadpisu stránky, takže
 * ji appka říkala třikrát. Hlavička teď nese šipky zpět/vpřed (`TopBar`).
 */
export function AppShell({
  children,
  secondaryPanel,
  fullBleed,
  sidePanel,
  pageContext,
  pageActions,
}: {
  children: ReactNode
  secondaryPanel?: ReactNode
  fullBleed?: boolean
  sidePanel?: ReactNode
  /** Kde jsem — drobečky/název, vedle šipek v hlavičce. */
  pageContext?: ReactNode
  /** Akce téhle stránky, vpravo v hlavičce. Jedna primární, zbytek tiše. */
  pageActions?: ReactNode
}) {
  const scrollRef = useScrollTopOnRoute<HTMLDivElement>()

  return (
    <div className="flex h-screen bg-app">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar context={pageContext} actions={pageActions} />
        <ActiveVisitBanner />
        {/*
          VŠECHNY TŘI VARIANTY MAJÍ TUTÉŽ PLOCHU: šedou stránku (`sp__page`)
          se sloupcem obsahu (`sp__sections`). Dřív měla každá vlastní
          odsazení a bílé pozadí, takže se stránky lišily podle toho, kterou
          větev zrovna použily — a „globální změna" znamenala tři změny.
        */}
        {secondaryPanel ? (
          <div className="sp sp__page flex min-h-0 flex-1">
            <nav className="w-56 shrink-0 overflow-y-auto border-r border-border-default bg-surface-soft p-4">
              {secondaryPanel}
            </nav>
            <div ref={scrollRef} className="min-w-0 flex-1 overflow-y-auto">
              <div className="sp__sections">{children}</div>
            </div>
          </div>
        ) : fullBleed ? (
          /* `fullBleed` si rolovací kontejner drží stránka sama (profil má
             vlastní `.sp`), takže scroll na začátek řeší `useScrollToTop`
             uvnitř ní — tady není co rolovat. */
          <div className="flex min-h-0 flex-1 overflow-hidden">{children}</div>
        ) : (
          <div ref={scrollRef} className="sp sp__page min-h-0 flex-1 overflow-y-auto">
            <div className="sp__sections">{children}</div>
          </div>
        )}
      </main>
      {sidePanel}
    </div>
  )
}
