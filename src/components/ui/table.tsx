import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * Cesta B, třetí průchod (2026-07-23) — hlavička sloupců přepsána z
 * uppercase/tracking-wide (obecná "enterprise dashboard" konvence, co
 * ale NENÍ v referenčním Lumo screenshotu) na obyčejný semibold text
 * přesného casu ("First"/"Last"/…, ne "FIRST"/"LAST") — přímo podle
 * ukázky datové tabulky v `.fig` component showcase.
 */
const gridStyle = (columns: string): CSSProperties => ({ gridTemplateColumns: columns })

export function Table({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-md border border-border-default', className)}>{children}</div>
  )
}

export function TableHeaderRow({ columns, labels }: { columns: string; labels: string[] }) {
  return (
    <div
      className="grid items-center gap-x-2 border-b border-border-default bg-surface px-4 py-2.5"
      style={gridStyle(columns)}
    >
      {/* Index jako key je tu správně, ne zkratka — `labels` je pevná,
       * neřazená sada sloupců (stejná délka/pořadí po celou dobu života
       * tabulky), ne dynamický seznam entit. Klíčování podle TEXTU labelu
       * selhalo naživo (FamilyDetailPage FOSTER_COLUMNS má dva sloupce
       * bez nadpisu, '' se objevilo dvakrát → React "duplicate key"
       * varování v konzoli na každé stránce s touhle tabulkou). */}
      {labels.map((label, i) => (
        <span key={i} className="text-sm font-semibold text-text-secondary">
          {label}
        </span>
      ))}
    </div>
  )
}

export function TableRow({
  columns,
  children,
  className,
}: {
  columns: string
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'grid items-center gap-x-2 border-b border-border-subtle px-4 py-3 transition-colors duration-100 last:border-b-0 hover:bg-overlay-active',
        className,
      )}
      style={gridStyle(columns)}
    >
      {children}
    </div>
  )
}
