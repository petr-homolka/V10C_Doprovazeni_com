import type { CSSProperties, ReactNode } from 'react'

/**
 * Table — přeměřeno 2026-07-19 na živé referenční appce (People stránka,
 * Members/Role/Credits): CSS grid řádky (ne <table>), border-strong dělítko mezi řádky
 * (poslední bez), padding 12px/16px. DESIGN_SYSTEM.md §6.5: tabulku použij
 * jen tam, kde se sloupce SKUTEČNĚ porovnávají (jejich vlastní příklad:
 * "přehled vzdělávání per pěstoun vs. limit hodin") — jinak seznam karet.
 */
const gridStyle = (columns: string): CSSProperties => ({ gridTemplateColumns: columns })

export function Table({ children }: { children: ReactNode }) {
  return <div className="overflow-hidden rounded-lg border border-border-subtle">{children}</div>
}

export function TableHeaderRow({ columns, labels }: { columns: string; labels: string[] }) {
  return (
    <div
      className="grid items-center gap-x-2 border-b border-border-strong px-4 py-3"
      style={gridStyle(columns)}
    >
      {/* Index jako key je tu správně, ne zkratka — `labels` je pevná,
       * neřazená sada sloupců (stejná délka/pořadí po celou dobu života
       * tabulky), ne dynamický seznam entit. Klíčování podle TEXTU labelu
       * selhalo naživo (FamilyDetailPage FOSTER_COLUMNS má dva sloupce
       * bez nadpisu, '' se objevilo dvakrát → React "duplicate key"
       * varování v konzoli na každé stránce s touhle tabulkou). */}
      {labels.map((label, i) => (
        <span key={i} className="text-xs font-medium text-text-primary">
          {label}
        </span>
      ))}
    </div>
  )
}

export function TableRow({ columns, children }: { columns: string; children: ReactNode }) {
  return (
    <div
      className="grid items-center gap-x-2 border-b border-border-strong px-4 py-3 last:border-b-0"
      style={gridStyle(columns)}
    >
      {children}
    </div>
  )
}
