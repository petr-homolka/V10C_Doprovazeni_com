import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Calendar, CheckSquare, FileText, Home, Users } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'

/**
 * Sidebar — přeměřeno 2026-07-19 přímo na živé Magnific.ai appce
 * (getComputedStyle, ne jen screenshot): šířka 224px (ne 240), položky
 * výšky ~32px s radius-sm (8px, ne radius-md), aktivní stav = jemný alpha
 * overlay (`--overlay-active`) přes CELOU plochu položky, NE plná barva
 * --primary-soft. Text nav položek je STEJNĚ jasný aktivní i neaktivní
 * (Magnific nedimuje text, rozlišuje jen přes pozadí) — to je změna oproti
 * předchozí verzi, kde neaktivní položky měly text-secondary.
 *
 * Sbalitelný na ikonový rail — sbalení/rozbalení se ovládá kliknutím na
 * logo nahoře. Nastavení + přepínač Světlý/Tmavý žijí v TopBar.tsx.
 *
 * Skutečná sada položek/oprávnění (kdo vidí co) je funkční záležitost M1+
 * (role-aware nav) — tady je jen reprezentativní sada, ne finální seznam.
 */
const NAV_ITEMS = [
  { to: '/', label: 'Dnes', icon: Home, end: true },
  { to: '/rodiny', label: 'Rodiny', icon: Users, end: false },
  { to: '/ukoly', label: 'Úkoly', icon: CheckSquare, end: false },
  { to: '/kalendar', label: 'Kalendář', icon: Calendar, end: false },
  { to: '/dokumenty', label: 'Dokumenty', icon: FileText, end: false },
] as const

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const { userDoc, firebaseUser } = useAuth()
  const displayName = userDoc?.displayName ?? firebaseUser?.email ?? ''
  const initials = displayName
    .split(' ')
    .map((part) => part[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <aside
      className={cn(
        'flex h-full flex-col bg-surface-soft transition-[width] duration-200',
        collapsed ? 'w-[72px]' : 'w-56',
      )}
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        aria-label={collapsed ? 'Rozbalit postranní panel' : 'Sbalit postranní panel'}
        title={collapsed ? 'Rozbalit postranní panel' : 'Sbalit postranní panel'}
        className={cn(
          'mx-3 mt-4 mb-2 flex items-center gap-2 rounded-sm px-2 py-1.5 transition-colors duration-150 hover:bg-overlay-active',
          collapsed && 'mx-0 justify-center px-0',
        )}
      >
        <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-primary text-[13px] font-semibold text-primary-foreground">
          D
        </div>
        {!collapsed && (
          <span className="truncate text-[15px] font-semibold text-text-primary">
            Doprovázení
          </span>
        )}
      </button>

      <nav className="flex-1 space-y-0.5 px-3">
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex h-8 items-center gap-2.5 rounded-sm px-2.5 text-[14px] font-medium text-text-primary transition-colors duration-150 hover:bg-overlay-active',
                collapsed && 'justify-center px-0',
                isActive && 'bg-overlay-active',
              )
            }
          >
            <Icon size={18} strokeWidth={1.75} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border px-3 py-3">
        <div className={cn('flex items-center gap-2.5 rounded-sm px-2.5 py-2', collapsed && 'justify-center px-0')}>
          <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-[11px] font-semibold text-primary">
            {initials || '?'}
          </div>
          {!collapsed && (
            <span className="truncate text-[13px] text-text-secondary">{displayName}</span>
          )}
        </div>
      </div>
    </aside>
  )
}
