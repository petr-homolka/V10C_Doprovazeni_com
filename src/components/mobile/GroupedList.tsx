import type { CSSProperties, ReactNode } from 'react'
import { cn } from '@/lib/utils'

/**
 * "Seskupený seznam" (Cesta B, 2026-07-24, přejmenováno z `IosList` — viz
 * `DESIGN_PATH_B.md`) — interakční VZOR (jeden zaoblený kontejner místo
 * samostatných karet) je pořád dobrý, jen vizuál teď Lumo-inspirovaný:
 * `radius-md` (crisp, ne přehnaně kulaté `2xl`), o krok výraznější
 * `border-default` místo `border-subtle`, jemný `shadow-xs` (na Cestě A
 * seznam neměl žádný stín — tady dostává lehkou "kartu nad plochou"
 * hloubku, souhlasí s obecně bohatší stínovou škálou Cesty B).
 */
export function GroupedList({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-hidden rounded-md border border-border-default bg-surface-soft shadow-xs', className)}>
      {children}
    </div>
  )
}

/**
 * Jeden řádek seskupeného seznamu. `active:bg-overlay-active` dává řádku
 * okamžitou dotykovou odezvu.
 */
export function GroupedListRow({
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
  if (as === 'div') {
    return (
      <div
        className={shared}
        style={style}
        onClick={onClick}
        role={onClick ? 'button' : undefined}
        tabIndex={onClick ? 0 : undefined}
        onKeyDown={
          onClick
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  onClick()
                }
              }
            : undefined
        }
      >
        {children}
      </div>
    )
  }
  return (
    <button type="button" onClick={onClick} className={shared} style={style}>
      {children}
    </button>
  )
}
