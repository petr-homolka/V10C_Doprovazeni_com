import type { ReactNode } from 'react'

/**
 * Cesta D — titulek plave VOLNĚ na ploše appky, bez karty/rámečku/pruhu,
 * přesně jak Woorkroom reference ukazuje Dashboard/Messenger/Calendar:
 * velký tučný `H1` (Poppins), volitelný šedý podtext. Karty jsou
 * vyhrazené pro OBSAH pod titulkem (widgety), ne pro hlavičku samotnou.
 */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string
  description?: string
  actions?: ReactNode
  /** @deprecated ponecháno jen kvůli zpětné kompatibilitě volajících z
   * dřívějších cest — na Cestě D nemá vizuální efekt. */
  variant?: 'default' | 'settings'
}) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <h1 className="truncate font-heading text-[26px] font-bold leading-tight text-text-primary">{title}</h1>
        {description && <p className="mt-1 text-sm text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
