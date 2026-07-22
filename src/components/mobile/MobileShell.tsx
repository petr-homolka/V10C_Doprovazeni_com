import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Calendar, Home, User, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

const TABS = [
  { to: '/', label: 'Domů', icon: Home, end: true },
  { to: '/rodiny', label: 'Rodiny', icon: Users, end: false },
  { to: '/kalendar', label: 'Kalendář', icon: Calendar, end: false },
  { to: '/mobil/ucet', label: 'Účet', icon: User, end: false },
] as const

/**
 * Mobilní/PWA shell (M11) — ÚPLNĚ jiná appka na telefonu, ne responzivní
 * zmenšenina staffového `AppShell`u (žádný sidebar, žádný TopBar
 * breadcrumb) — velký dolní tab bar (palcem dosažitelný), bezpečná zóna
 * pro iPhone home indicator (`env(safe-area-inset-bottom)`).
 *
 * Všechny 4 záložky mají VLASTNÍ mobilní stránku (`useIsMobile.ts`
 * přepínání v `App.tsx`) — žádná nevede na nepřestavěnou desktopovou
 * stránku.
 *
 * `backdrop-blur`+poloprůhledné pozadí — iOS "frosted glass" tab bar
 * (Petrovo zadání 2026-07-22, "styl aktuálního iOS"), ne plná barva.
 */
export function MobileShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex h-[100dvh] flex-col bg-app">
      <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      <nav
        className="grid shrink-0 grid-cols-4 border-t border-border bg-surface-soft/85 backdrop-blur-lg"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {TABS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-text-tertiary transition-all duration-150 active:scale-90',
                isActive && 'text-accent',
              )
            }
          >
            <Icon size={22} strokeWidth={1.75} />
            {label}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
