import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Calendar, Home, User, Users } from '@/components/ui/icons'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/', label: 'Domů', icon: Home, end: true },
  { to: '/rodiny', label: 'Rodiny', icon: Users, end: false },
  { to: '/kalendar', label: 'Kalendář', icon: Calendar, end: false },
  { to: '/mobil/ucet', label: 'Účet', icon: User, end: false },
] as const

/**
 * Mobilní/PWA shell — Cesta B (2026-07-24). Stejná struktura jako Cesta A
 * (velký dolní tab bar, bezpečná zóna pro home indicator), ale JINÝ
 * vizuální jazyk: SOLID pozadí místo Cesty A "iOS frosted glass"
 * (`backdrop-blur` je typicky Apple afordance, tady záměrně pryč — Lumo/
 * enterprise nástroje nepoužívají průhlednost jako chrome), a aktivní
 * záložka dostává VYPLNĚNOU pilulku za ikonou (Material 3 "active
 * indicator" vzor) namísto Cesty A pouhého probarvení ikony/textu —
 * jasnější, sebevědomější signál "tady jsi".
 */
export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[100dvh] flex-col bg-app">
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      <nav
        className="grid shrink-0 grid-cols-4 border-t border-border-default bg-surface-soft"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 py-2.5 text-xs font-semibold text-text-tertiary transition-transform duration-150 active:scale-90',
                isActive && 'text-primary',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span
                  className={cn(
                    'flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-150',
                    isActive && 'bg-primary-soft',
                  )}
                >
                  <Icon size={20} strokeWidth={isActive ? 2.25 : 1.75} />
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
