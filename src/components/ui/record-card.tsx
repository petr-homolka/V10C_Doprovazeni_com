import { createContext, useContext, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Seznamový řádek (DESIGN_RULES.md §4).
 *
 * Sloupce metadat jsou **CSS grid se sdílenou šablonou**, kterou definuje
 * `RecordCardList` jednou pro celý seznam. Do 2026-07-24 si každý řádek
 * skládal metadata sám (flex + pevné šířky), takže jakmile některá hodnota
 * chyběla, sloupce se mezi řádky rozešly a seznam nešel skenovat očima
 * svisle. To byl nejhorší nalezený vizuální defekt — a nebyl to vkus, byla
 * to konstrukce.
 *
 * Sdílená šablona to řeší z principu: prázdná hodnota nechá buňku prázdnou,
 * ale sloupec zůstane na svém místě.
 */

export interface RecordColumns {
  /** Seznam má ≥ 860 px — všechny sloupce. */
  lg: string
  /** 640–859 px — o jeden sloupec méně (ubývá zprava). */
  md: string
  /** 440–639 px — o dva méně. */
  sm: string
}

interface RecordGrid {
  columns: RecordColumns
  /** Kolik buněk metadat řádek očekává (kvůli doplnění prázdných). */
  cellCount: number
}

const RecordGridContext = createContext<RecordGrid | null>(null)

export interface RecordCell {
  label: string
  value: ReactNode
  /** Číselné hodnoty a datumy doprava, text vlevo (DESIGN_RULES.md §4). */
  align?: 'left' | 'right'
}

export function RecordCard({
  leading,
  title,
  subtitle,
  cells,
  trailing,
  onClick,
  className,
}: {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  /** Sloupce metadat. Pořadí i počet MUSÍ odpovídat `columns` na seznamu. */
  cells?: RecordCell[]
  trailing?: ReactNode
  onClick?: () => void
  className?: string
}) {
  const grid = useContext(RecordGridContext)

  return (
    <div
      onClick={onClick}
      className={cn(
        'group flex items-center gap-4 rounded-lg bg-surface-soft px-4 py-3 shadow-raised transition-shadow duration-150',
        onClick && 'cursor-pointer hover:shadow-md',
        className,
      )}
    >
      {leading && <div className="flex shrink-0 items-center gap-2">{leading}</div>}

      {/* Jméno + podtext a všechny sloupce metadat žijí v JEDNÉ mřížce, aby
       * se zarovnaly napříč řádky. Jméno je první sloupec šablony. */}
      <div className={cn('record-row min-w-0 flex-1', !grid && 'flex items-center gap-4')} style={gridStyle(grid)}>
        <div className="min-w-0">
          <div className="truncate text-[15px] font-semibold text-text-primary">{title}</div>
          {subtitle && <div className="truncate text-sm text-text-secondary">{subtitle}</div>}
        </div>

        {padCells(cells, grid?.cellCount).map((cell, index) => (
          <div key={index} className={cn('record-cell min-w-0', cell?.align === 'right' && 'text-right')}>
            {cell ? (
              <>
                <p className="truncate whitespace-nowrap text-xs font-medium uppercase tracking-wide text-text-tertiary">
                  {cell.label}
                </p>
                <div className="mt-0.5 truncate text-sm text-text-secondary">{cell.value ?? '—'}</div>
              </>
            ) : null}
          </div>
        ))}
      </div>

      {trailing && <div className="flex shrink-0 items-center gap-1">{trailing}</div>}
    </div>
  )
}

function gridStyle(grid: RecordGrid | null) {
  if (!grid) return undefined
  return {
    '--record-cols-lg': grid.columns.lg,
    '--record-cols-md': grid.columns.md,
    '--record-cols-sm': grid.columns.sm,
  } as React.CSSProperties
}

/** Doplní chybějící buňky, ať mřížka nezůstane rozjezděná o jeden sloupec. */
function padCells(cells: RecordCell[] | undefined, expected: number | undefined): Array<RecordCell | null> {
  const list: Array<RecordCell | null> = [...(cells ?? [])]
  while (expected !== undefined && list.length < expected) list.push(null)
  return list
}

/**
 * Svislý stack řádků se SDÍLENOU šablonou sloupců.
 *
 * Buňky se řadí od NEJDŮLEŽITĚJŠÍ a na užších šířkách ubývají zprava, takže
 * poslední, co zmizí, je jméno (nikdy) a nejdůležitější metadatum. Nejvýš
 * TŘI sloupce metadat — víc už se na 15px řádku nedá skenovat, a čtvrtý
 * stejně zmizí na první užší šířce.
 */
export function RecordCardList({
  children,
  columns,
  cellCount,
  className,
}: {
  children: ReactNode
  /** Šablony pro tři šířky. První sloupec je VŽDY jméno a má
   * `minmax(220px, 1fr)`. Bez `columns` se řádky vykreslí jako dřív
   * (flex) — přechodný stav, dokud se všechny seznamy nepřepnou. */
  columns?: RecordColumns
  /** Počet sloupců metadat (bez jména). */
  cellCount?: number
  className?: string
}) {
  const grid = columns && cellCount !== undefined ? { columns, cellCount } : null
  return (
    <RecordGridContext.Provider value={grid}>
      {/* `record-list` = container pro dotazy na šířku (viz index.css) —
       * sloupce se řídí místem, které seznam má, ne velikostí okna. */}
      <div className={cn('record-list flex flex-col gap-2', className)}>{children}</div>
    </RecordGridContext.Provider>
  )
}
