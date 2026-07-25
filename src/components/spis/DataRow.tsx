import type { KeyboardEvent, ReactNode } from 'react'
import { ChevronRight, Plus } from '@/components/ui/icons'

/**
 * ŘÁDEK — NENÍ TLAČÍTKO A NENÍ KARTA.
 *
 * Do 2026-07-25 byl každý řádek v profilu karta: rám, vlastní pozadí, uvnitř
 * avatar a napravo dvě trvale viditelná tlačítka. Deset takových karet pod
 * sebou je deset rámů a dvacet tlačítek — Petr o tom napsal „ty tlačítka, ty
 * jednotlivé řádky … je to hnusné". Měl pravdu: karta je krabice, a když je
 * krabic dvacet, člověk nevidí obsah, vidí krabice.
 *
 * Řádek je teď řádek tabulky: JEDNA vlasová linka dole, sloupce, žádný rám.
 * Akce se ukazuje až na řádku, na kterém člověk je (`.sp__reveal`) — dokud
 * na něj nemíří, jsou to data.
 *
 * `div role="button"` místo `<button>` je záměr, ne lenost: v řádku bývají
 * prokliky na profily (`<a>`), a `<a>` uvnitř `<button>` je nevalidní HTML.
 * Klávesnice se proto obsluhuje ručně.
 *
 * Mřížka sloupců je v CSS (`.sp__row--lide|zapis|blizi`), protože se sloupce
 * ubírají podle šířky PLÁTNA (`@container`) — na to Tailwind nemá třídy a
 * hlavně se tak hlavička i řádky ubírají SPOLEČNĚ.
 */
export function DataRow({
  variant,
  onOpen,
  children,
}: {
  variant: 'lide' | 'zapis' | 'blizi'
  /** Otevře náhled vedle seznamu. Bez něj je řádek jen řádek. */
  onOpen?: () => void
  children: ReactNode
}) {
  function onKeyDown(e: KeyboardEvent) {
    if (!onOpen) return
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onOpen()
    }
  }

  return (
    <div
      role={onOpen ? 'button' : undefined}
      tabIndex={onOpen ? 0 : undefined}
      onClick={onOpen}
      onKeyDown={onKeyDown}
      className={`sp__row sp__row--${variant}${onOpen ? ' cursor-pointer' : ''}`}
    >
      {children}
    </div>
  )
}

/** Šipka na konci řádku — vidět až při hover. */
export function DataRowReveal() {
  return (
    <span className="sp__reveal sp__col--rev text-text-tertiary">
      <ChevronRight size={15} />
    </span>
  )
}

/** Řádek se štítky sloupců. Zůstává vidět při rolování dlouhého bloku. */
export function DataLabels({ variant, children }: { variant: 'lide' | 'zapis' | 'blizi'; children: ReactNode }) {
  return <div className={`sp__labels sp__row sp__row--${variant} mt-2`}>{children}</div>
}

/**
 * Poslední řádek bloku: přidání. Celou šířkou a tiše.
 *
 * Zakládání patří na KONEC seznamu, ne do hlavičky bloku: „+ Přidat dítě"
 * jako tmavé tlačítko vedle nadpisu bylo stejně silné jako primární akce
 * stránky, přitom se použije dvakrát za rok. Tady je z něj popisek, který
 * zesílí, až na něj člověk najede — a je přesně tam, kde seznam končí.
 */
export function DataAddRow({
  label,
  onClick,
  disabled,
  title,
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  title?: string
}) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={title} className="sp__add disabled:opacity-50">
      <Plus size={14} />
      {label}
    </button>
  )
}

/**
 * Popisek skupiny uvnitř sekce („Pěstouni 2", „červenec 2026 3").
 *
 * Dělí obsah rolí nebo časem, ne rámem — proto je to jen tichý text. Kdyby
 * měla skupina vlastní hlavičku tabulky, byla by na stránce hierarchie
 * o dvě úrovně hlubší, než kolik ta informace unese.
 */
export function SpisGroupLabel({ label, count }: { label: string; count?: number }) {
  return (
    <p className="pb-1 pt-5 text-sm text-text-faint">
      {label}
      {count !== undefined && <span className="ml-2">{count}</span>}
    </p>
  )
}
