import type { ReactNode } from 'react'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'
import type { BreadcrumbItem } from '@/components/ui/breadcrumb'

/**
 * Sidebar a hlavní obsah "plavou" jako dva samostatné zaoblené panely na
 * tmavší/světlejší ploše (--bg-void) s mezerou mezi nimi. TopBar je
 * `shrink-0` (nescroluje s obsahem) — přesně struktura naměřená na živé
 * referenční appce (header h-14 mimo scrollovatelnou oblast, viz
 * CURRENT_STATE.md Dodatek 5). DESIGN_SYSTEM.md §4 (max-width 1200px
 * vycentrovaný obsah, px-8) platí uvnitř scrollovatelné oblasti beze změny,
 * ale JEN když `secondaryPanel` není zadán (viz níž).
 *
 * `breadcrumb` (volitelný) se předává do TopBaru, kde žije VLEVO ve
 * stejném řádku jako ikonový cluster — ne v obsahu pod headerem (viz
 * CURRENT_STATE.md Dodatek 10).
 *
 * `secondaryPanel` (volitelný) — druhá úroveň menu (zatím Nastavení,
 * později filtrovatelné seznamy Rodiny/Pěstouni/Děti). PŘEMĚŘENO
 * 2026-07-19 přímo na dvou nezávislých referenčních stránkách stejné
 * appky (identická struktura na obou, takže jde o jejich sdílený layout
 * komponent, ne shodu náhodou): nav sloupec a obsah jsou DVA SAMOSTATNÉ
 * zaoblené panely (`bg-surface-soft`) s MEZEROU mezi sebou — ne jeden
 * sdílený box s vnořeným paddingem, jak jsme to měli předtím (oprava
 * chyby z Dodatku 9 — viz Dodatek 12). Oba mají VLASTNÍ nezávislý scroll
 * (`overflow-y-auto`) — důležité pro budoucí dlouhé seznamy s
 * vyhledáváním nahoře. TopBar zůstává NAD oběma sloupci napříč celou
 * šířkou (breadcrumb začíná na stejné X souřadnici jako nav sloupec, ne
 * až u obsahu) — to už tenhle shell dělal správně, jen obsah pod ním byl
 * špatně vnořený. Šířka nav sloupce `w-56` (224px) = naměřená hodnota
 * (celý nav element včetně vlastního paddingu). Mezera mezi sloupci
 * sjednocena na naši existující `gap-2` (naměřeno 4px — vědomě upraveno
 * na 8px kvůli konzistenci s vnějším sidebar/main gapem, ne kvůli chybě
 * v měření).
 */
export function AppShell({
  children,
  breadcrumb,
  secondaryPanel,
}: {
  children: ReactNode
  breadcrumb?: BreadcrumbItem[]
  secondaryPanel?: ReactNode
}) {
  return (
    <div className="flex h-screen gap-2 bg-void p-2">
      <div className="shrink-0 overflow-hidden rounded-lg">
        <Sidebar />
      </div>
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-app">
        <TopBar breadcrumb={breadcrumb} />
        {secondaryPanel ? (
          <div className="flex min-h-0 flex-1 gap-2 p-2">
            <nav className="w-56 shrink-0 overflow-y-auto rounded-lg bg-surface-soft p-4">
              {secondaryPanel}
            </nav>
            <div className="min-w-0 flex-1 overflow-y-auto rounded-lg bg-surface-soft p-6">
              {children}
            </div>
          </div>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="mx-auto max-w-[1200px] px-8 pb-8">{children}</div>
          </div>
        )}
      </main>
    </div>
  )
}
