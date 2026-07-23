import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * "Seskupený seznam" — iOS Nastavení/Kontakty vzor (M11, 2026-07-22,
 * Petrovo zadání "udělej appku do stylu aktuálního iOS"): JEDEN zaoblený
 * kontejner s tenkými dělítky mezi řádky, ne samostatné orámované karty
 * pro každou položku (to působilo víc Android/Material než iOS). Nahrazuje
 * dřívější `<button className="rounded-lg border ...">` vzor napříč
 * mobilními seznamy (Rodiny, Pěstouni, Děti, události Kalendáře/Dnes).
 */
export function IosList({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('overflow-hidden rounded-2xl border border-border-subtle bg-surface-soft', className)}>{children}</div>
}

/**
 * Jeden řádek seskupeného seznamu. `active:bg-overlay-active` dává řádku
 * okamžitou dotykovou odezvu (iOS řádky ztmavnou při stisku, nečekají na
 * navigaci) — `transition-colors` dělá i puštění plynulé, ne trhavé.
 */
export function IosListRow({
  children,
  onClick,
  className,
  style,
  as = 'button',
}: {
  children: ReactNode
  onClick?: () => void
  className?: string
  style?: CSSProperties
  /** `'div'` pro řádky, co samy nejsou klikatelné (mají vlastní vnořené akce, např. tel: odkaz). */
  as?: 'button' | 'div'
}) {
  const shared = cn(
    'flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors duration-100',
    '[&:not(:last-child)]:border-b [&:not(:last-child)]:border-border-subtle',
    onClick && 'active:bg-overlay-active',
    className,
  )
  if (as === 'div') return <div className={shared} style={style}>{children}</div>
  return (
    <button type="button" onClick={onClick} className={shared} style={style}>
      {children}
    </button>
  )
}
