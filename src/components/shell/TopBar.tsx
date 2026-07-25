import { ChevronLeft, ChevronRight } from '@/components/ui/icons'
import { useHistoryArrows } from '@/hooks/useHistoryArrows'
import { cn } from '@/lib/utils'

/**
 * HLAVIČKA — dvě šipky. Nic víc.
 *
 * Vývoj v krocích, každý na Petrův podnět:
 *   1. Byl tu cluster pěti ovládacích prvků (hledání, motiv, nastavení,
 *      oznámení, účet). Hledání je první krok práce, ale bylo na konci
 *      cesty oka; zbytek se použije jednou za den. Všechno šlo do
 *      postranního panelu — hledání nahoru pod značku, účet dolů.
 *   2. Zůstala drobečková navigace. Sama o sobě už nic neřešila: na
 *      seznamech vypisovala jediné slovo, které je zároveň v levém panelu
 *      zvýrazněné a v nadpisu stránky pod ní. Tři místa, jedna informace.
 *
 * Teď tu jsou šipky zpět/vpřed, jak to má Routine. Ty dělají něco, co
 * drobečková navigace neumí: vrátí se PO CESTĚ, kterou člověk skutečně
 * prošel. V téhle práci se chodí do strany — z rodiny na dítě, z dítěte na
 * jeho školu, ze školy zpátky — a to není hierarchie, kterou by drobečky
 * dokázaly popsat.
 *
 * Šipka, kterou nejde použít, je ZTLUMENÁ a nekliká (viz `useHistoryArrows`).
 * Dvě vždy aktivní šipky, které někdy nedělají nic, jsou horší než žádné.
 *
 * Kontext „kde jsem" nezmizel — nese ho zvýrazněná položka v levém panelu
 * a nadpis stránky, kde byl vždycky.
 */
export function TopBar() {
  const { canGoBack, canGoForward, goBack, goForward } = useHistoryArrows()

  const arrow = (enabled: boolean) =>
    cn(
      'flex size-7 items-center justify-center rounded-md transition-colors duration-150',
      enabled
        ? 'text-text-tertiary hover:bg-overlay-active hover:text-text-primary'
        : 'cursor-default text-border-strong',
    )

  return (
    <div className="flex h-12 shrink-0 items-center gap-0.5 border-b border-border-subtle bg-app px-4">
      <button
        type="button"
        onClick={canGoBack ? goBack : undefined}
        disabled={!canGoBack}
        aria-label="Zpět"
        title="Zpět"
        className={arrow(canGoBack)}
      >
        <ChevronLeft size={17} />
      </button>
      <button
        type="button"
        onClick={canGoForward ? goForward : undefined}
        disabled={!canGoForward}
        aria-label="Vpřed"
        title="Vpřed"
        className={arrow(canGoForward)}
      >
        <ChevronRight size={17} />
      </button>
    </div>
  )
}
