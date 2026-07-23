import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import { ActiveVisitBanner } from './ActiveVisitBanner'
import type { BreadcrumbItem } from '@/components/ui/breadcrumb'

/**
 * Cesta B (2026-07-24) — STRUKTURÁLNÍ odklon od Cesty A, ne jen retint.
 * Cesta A: sidebar a hlavní panel "plavou" jako dva zaoblené panely na
 * tmavší ploše s mezerou mezi nimi (macOS/iOS System Settings vzor).
 * Cesta B: klasický FULL-BLEED enterprise layout (Vaadin/Retool/admin
 * dashboard vzor) — sidebar přisedlý VLEVO na celou výšku, TopBar
 * přisedlý NAHOŘE na celou šířku s `border-b`, žádné zaoblené rohy/mezery
 * mezi chrome bloky. Sedí lépe k datově hutnému case-management nástroji
 * než ke konzumní "widget" estetice — a je to přesně ten typ "i změna
 * platformy je budiž" tahu, na který se Petr ptal.
 *
 * `secondaryPanel` (druhá úroveň menu, Nastavení/…) — stejný koncept jako
 * Cesta A (samostatný levý sloupec vedle obsahu), jen bez zaoblení/mezery
 * — `border-r` odděluje sloupce místo `bg-void` mezery.
 *
 * `fullBleed` (2026-07-23, přidáno pro Kalendář) — vypne padding/max-width
 * obalu úplně, obsah dostane celou výšku i šířku panelu beze zbytku (žádné
 * `overflow-y-auto` na obalu — o vlastní scrollování/layout se stará obsah
 * sám, typicky vlastní flex řádek s kalendářovou mřížkou + volitelným
 * pravým panelem vedle sebe).
 */
export function AppShell({
  children,
  breadcrumb,
  secondaryPanel,
  fullBleed,
}: {
  children: ReactNode
  breadcrumb?: BreadcrumbItem[]
  secondaryPanel?: ReactNode
  fullBleed?: boolean
}) {
  return (
    <div className="flex h-screen bg-app">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar breadcrumb={breadcrumb} />
        <ActiveVisitBanner />
        {secondaryPanel ? (
          <div className="flex min-h-0 flex-1">
            <nav className="w-56 shrink-0 overflow-y-auto border-r border-border-default bg-surface-soft p-4">
              {secondaryPanel}
            </nav>
            <div className="min-w-0 flex-1 overflow-y-auto bg-surface-soft p-6">{children}</div>
          </div>
        ) : fullBleed ? (
          <div className="flex min-h-0 flex-1 overflow-hidden">{children}</div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1440px] px-8 pb-8 pt-6">{children}</div>
          </div>
        )}
      </main>
    </div>
  )
}
