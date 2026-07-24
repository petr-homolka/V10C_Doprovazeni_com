import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Baby, Calendar, CheckSquare, ClipboardCheck, FileText, Home, MessageCircle, UserCog, UserPlus, UserRound, UserSquare2, Users } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { isStaffRole } from '@/types/user'

/**
 * Sidebar — Cesta B (2026-07-24). Distinktní `bg-surface-soft` (skoro
 * bílá) oproti hlavnímu obsahu `bg-app` (jemně namodralá) — na rozdíl od
 * Cesty A (sidebar STEJNÁ barva jako obsah, "splývá") tady navigace a
 * obsah vizuálně SOUTĚŽÍ o pozornost jasně odděleně (`border-r`),
 * klasický enterprise dashboard vzor. Aktivní položka dostává PLNÝ
 * `primary-soft` podklad + modrý text/ikonu + 3px LEVÝ AKCENT PRUH
 * (Lumo/enterprise "tady jsi" konvence) — Cesta A měla jen jemný alpha
 * overlay, tady je stav mnohem sebevědomější/čitelnější. Levý accent
 * pruh je REZERVOVANÝ (`border-l-[3px] border-transparent`) na VŠECH
 * položkách, ne jen aktivní — jinak by se text neaktivních posunul o 3px
 * doprava vůči aktivní (layout shift při přepnutí).
 */
const NAV_ITEMS = [
  { to: '/', label: 'Dnes', icon: Home, end: true, staffOnly: false },
  { to: '/rodiny', label: 'Rodiny', icon: Users, end: false, staffOnly: false },
  { to: '/pestouni', label: 'Pěstouni', icon: UserRound, end: false, staffOnly: false },
  { to: '/deti', label: 'Děti', icon: Baby, end: false, staffOnly: false },
  { to: '/zamestnanci', label: 'Zaměstnanci', icon: UserCog, end: false, staffOnly: true },
  { to: '/ukoly', label: 'Úkoly', icon: CheckSquare, end: false, staffOnly: false },
  { to: '/kalendar', label: 'Kalendář', icon: Calendar, end: false, staffOnly: false },
  { to: '/zpravy', label: 'Zprávy', icon: MessageCircle, end: false, staffOnly: false },
  { to: '/dokumenty', label: 'Dokumenty', icon: FileText, end: false, staffOnly: false },
  { to: '/zajemci', label: 'Zájemci', icon: UserPlus, end: false, staffOnly: true },
  { to: '/kvalita', label: 'Kvalita', icon: ClipboardCheck, end: false, staffOnly: true },
  { to: '/externiste', label: 'Externisté', icon: UserSquare2, end: false, staffOnly: true },
] as const

const COLLABORATOR_NAV_ITEM = { to: '/spolupracovnik', label: 'Spolupráce', icon: UserSquare2, end: false } as const

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { userDoc } = useAuth()
  const items: readonly { to: string; label: string; icon: typeof Home; end: boolean }[] =
    userDoc?.role === 'spolupracovnik'
      ? [COLLABORATOR_NAV_ITEM]
      : NAV_ITEMS.filter((item) => !item.staffOnly || (userDoc && isStaffRole(userDoc.role)))

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-border-default bg-surface-soft transition-[width] duration-200',
        collapsed ? 'w-[72px]' : 'w-60',
      )}
    >
      <div className="flex h-14 shrink-0 items-center border-b border-border-subtle px-3">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Rozbalit postranní panel' : 'Sbalit postranní panel'}
          title={collapsed ? 'Rozbalit postranní panel' : 'Sbalit postranní panel'}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5 transition-colors duration-150 hover:bg-overlay-active',
            collapsed && 'justify-center px-0',
          )}
        >
          <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary text-sm font-bold text-primary-foreground">
            D
          </div>
          {!collapsed && (
            <span className="truncate font-heading text-base font-bold text-text-primary">
              Doprovázení
            </span>
          )}
        </button>
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 pt-3">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex h-9 items-center gap-2.5 rounded-sm border-l-[3px] border-transparent px-2.5 text-base font-medium text-text-secondary transition-colors duration-150 hover:bg-overlay-active hover:text-text-primary',
                collapsed && 'justify-center px-0',
                isActive && 'border-primary bg-primary-soft font-semibold text-primary hover:bg-primary-soft hover:text-primary',
              )
            }
          >
            <Icon size={18} strokeWidth={1.9} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>
    </aside>
  )
}
