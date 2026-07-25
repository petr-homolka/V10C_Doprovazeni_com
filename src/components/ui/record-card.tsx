import { createContext, useContext, useState, type CSSProperties, type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

/**
 * Seznamový řádek (DESIGN_RULES.md §4).
 *
 * MŘÍŽKA DRŽÍ CELÝ ŘÁDEK, včetně avataru vlevo a akcí vpravo.
 *
 * Vývoj téhle komponenty je poučný, protože každý krok opravoval vadu, kterou
 * odhalil až screenshot:
 *
 *   1. Nejdřív si každý řádek skládal metadata sám (flex + pevné šířky).
 *      Jakmile některá hodnota chyběla, sloupce se mezi řádky rozešly.
 *   2. Pak dostal seznam SDÍLENOU šablonu mřížky. Sloupce se srovnaly mezi
 *      řádky, ale avatar vlevo a akce vpravo zůstaly mimo mřížku, ve flexu.
 *   3. Když nad seznam přišla HLAVIČKA s popisky sloupců, ukázalo se, proč je
 *      to špatně: hlavička nemá avatar ani akce, takže jejímu `1fr` zbylo
 *      o 80 px víc místa než řádkům — a popisek stál vedle svého sloupce.
 *      Doplnit hlavičce jen levou mezeru nepomohlo, protože chyběla i pravá.
 *
 * Proto teď mřížka obsahuje VŠECHNO: `lead` (avatar/zaškrtávátko) je první
 * sloupec, `trail` (akce) poslední, oba s šířkou, kterou seznam vyhlásí
 * jednou. Hlavička a řádky pak nemohou být rozjezděné z principu — ne proto,
 * že jsem dopočítal správné číslo.
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
  /** Šířka sloupce pro avatar/zaškrtávátko v px. */
  lead: number
  /** Šířka sloupce pro akce vpravo v px. */
  trail: number
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

  // Bez mřížky (seznamy, které se ještě nepřepnuly) zůstává starý flex.
  if (!grid) {
    return (
      <div
        onClick={onClick}
        className={cn('record-item group flex items-center gap-3 py-2', onClick && 'cursor-pointer', className)}
      >
        {leading && <div className="flex shrink-0 items-center gap-2">{leading}</div>}
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <Title title={title} subtitle={subtitle} />
          {(cells ?? []).map((cell, i) => (
            <div key={i} className={cn('min-w-0', cell.align === 'right' && 'text-right')}>
              <div className="truncate text-sm text-text-tertiary">{cell.value ?? '—'}</div>
            </div>
          ))}
        </div>
        {trailing && <div className="flex shrink-0 items-center gap-1">{trailing}</div>}
      </div>
    )
  }

  return (
    <div
      onClick={onClick}
      className={cn('record-item record-row px-3 py-2', onClick && 'cursor-pointer', 'group', className)}
      style={gridStyle(grid)}
    >
      <div className="flex items-center gap-2">{leading}</div>
      <Title title={title} subtitle={subtitle} />
      {padCells(cells, grid.cellCount).map((cell, index) => (
        <div key={index} className={cn('record-cell min-w-0', cell?.align === 'right' && 'text-right')}>
          {cell ? <div className="truncate text-sm text-text-tertiary">{cell.value ?? '—'}</div> : null}
        </div>
      ))}
      <div className="record-trail flex items-center justify-end gap-1">{trailing}</div>
    </div>
  )
}

function Title({ title, subtitle }: { title: ReactNode; subtitle?: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="truncate text-base font-medium text-text-primary">{title}</div>
      {subtitle && <div className="truncate text-sm text-text-tertiary">{subtitle}</div>}
    </div>
  )
}

/** Šablony pro tři šířky, obalené sloupcem pro avatar a sloupcem pro akce. */
function gridStyle(grid: RecordGrid): CSSProperties {
  const wrap = (tpl: string) => `${grid.lead}px ${tpl} ${grid.trail}px`
  return {
    '--record-cols-lg': wrap(grid.columns.lg),
    '--record-cols-md': wrap(grid.columns.md),
    '--record-cols-sm': wrap(grid.columns.sm),
  } as CSSProperties
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
 * TŘI sloupce metadat — víc už se na řádku nedá skenovat, a čtvrtý stejně
 * zmizí na první užší šířce.
 */
export function RecordCardList({
  children,
  columns,
  cellCount,
  headers,
  lead = 32,
  trail = 32,
  className,
}: {
  children: ReactNode
  /** Šablony pro tři šířky. První sloupec je VŽDY jméno a má
   * `minmax(220px, 1fr)`. Bez `columns` se řádky vykreslí jako dřív
   * (flex) — přechodný stav, dokud se všechny seznamy nepřepnou. */
  columns?: RecordColumns
  /** Počet sloupců metadat (bez jména). */
  cellCount?: number
  /** Popisky sloupců. Odpovídají `cells` v řádcích, jen jsou JEDNOU nahoře. */
  headers?: string[]
  /** Šířka avataru / zaškrtávátka vlevo (32 = avatar, 56 = zaškrtávátko + avatar). */
  lead?: number
  /** Šířka akcí vpravo (32 = jedno tlačítko, 64 = dvě). */
  trail?: number
  className?: string
}) {
  const grid = columns && cellCount !== undefined ? { columns, cellCount, lead, trail } : null
  return (
    <RecordGridContext.Provider value={grid}>
      {/*
        `sp__card` = tatáž bílá karta na šedé ploše jako sekce v profilu
        (`styles/spis.css`). Je TADY, ne na dvaceti stránkách: kdo změní
        vzhled karty, změní ho pro všechny seznamy v platformě najednou.
        `record-list` je container pro dotazy na šířku — sloupce se řídí
        místem, které seznam má, ne velikostí okna.
      */}
      <div className={cn('sp__card record-list', className)}>
        {headers && grid && (
          /* Popisky sloupců patří do hlavičky, ne nad každou hodnotu.
             Dřív nesl „STAV / POSLEDNÍ KONTAKT / KLÍČOVÁ OSOBA" KAŽDÝ řádek,
             takže seznam dvanácti rodin obsahoval popisky šestatřicetkrát.
             To je přesně ten šum, kvůli kterému appka nevypadala vzdušně:
             informace byla ve třetině plochy, zbytek byly nadpisy. */
          <div className="record-head record-row pb-2 pt-1" style={gridStyle(grid)}>
            <div />
            <div />
            {padCells(
              headers.map((label) => ({ label, value: null })),
              grid.cellCount,
            ).map((cell, index) => (
              <div
                key={index}
                className="record-cell truncate whitespace-nowrap text-xs text-text-faint"
              >
                {cell?.label ?? ''}
              </div>
            ))}
            <div className="record-trail" />
          </div>
        )}
        {children}
      </div>
    </RecordGridContext.Provider>
  )
}


/**
 * SKUPINA V SEZNAMU — nadpis, POČET a rozbalování.
 *
 * Vzato z Routine (jejich tabulka seskupuje řádky do „Leads 6" /
 * „Qualified 7" a skupiny se dají sbalit). U nás to dělá víc než pořádek:
 * seznam rodin seřazený podle data říká „tady je dvanáct rodin", zatímco
 * seznam SESKUPENÝ podle lhůty říká „tři hoří, dvě se blíží, sedm je
 * v pořádku" — a to je odpověď na otázku, se kterou tam člověk chodí.
 *
 * Počet je v nadpisu schválně: kdo chce vědět, kolik toho hoří, nemá to
 * počítat očima. U skupiny, která hoří, je počet v akcentu; jinde tiše.
 *
 * Sbalení si drží skupina sama (`useState`), protože je to zobrazovací
 * rozmar, ne stav dat — a přežít překreslení stránky nemusí.
 */
export function RecordGroup({
  title,
  count,
  tone = 'calm',
  defaultOpen = true,
  children,
}: {
  title: string
  count: number
  tone?: 'calm' | 'hot' | 'warm'
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <section className="mt-1 first:mt-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 rounded-md py-2 text-left transition-colors duration-150 hover:bg-overlay-active"
      >
        <span className="text-text-faint">
          {open ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
        </span>
        <span className="text-sm text-text-faint">{title}</span>
        <span
          className={cn(
            'rounded-md px-1.5 text-sm',
            tone === 'hot' && 'bg-danger-bg text-danger',
            tone === 'warm' && 'bg-warning-bg text-warning',
            tone === 'calm' && 'text-text-faint',
          )}
        >
          {count}
        </span>
      </button>
      {open && children}
    </section>
  )
}
