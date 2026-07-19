import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Calendar, CheckSquare, FileText, Home, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Sidebar — přeměřeno 2026-07-19 přímo na živé referenční appce
 * (getComputedStyle, ne jen screenshot): šířka 224px (ne 240), položky
 * výšky ~32px s radius-sm (8px, ne radius-md), aktivní stav = jemný alpha
 * overlay (`--overlay-active`) přes CELOU plochu položky, NE plná barva
 * --primary-soft. Text nav položek je STEJNĚ jasný aktivní i neaktivní
 * (text se nedimuje, rozlišuje jen přes pozadí).
 *
 * `bg-app` (STEJNÁ barva jako hlavní obsah, ne --bg-surface-soft) — na
 * žádost uživatele sidebar a hlavní panel splývají barevně, odlišuje je
 * jen mezera (--bg-void) mezi nimi, ne odstín.
 *
 * Sbalitelný na ikonový rail — sbalení/rozbalení se ovládá kliknutím na
 * logo nahoře. Nastavení, přepínač Světlý/Tmavý a účet/profil žijí v
 * TopBar.tsx — sidebar dole už nemá žádnou identitu/akci, jen navigaci.
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

  return (
    <aside
      className={cn(
        'flex h-full flex-col bg-app transition-[width] duration-200',
        collapsed ? 'w-[72px]' : 'w-56',
      )}
    >
      {/* h-14 = STEJNÁ výška jako TopBar.tsx header — zarovnává logo s
          breadcrumbem/ikonami napravo přesně na stejnou osu (na žádost
          uživatele, viz CURRENT_STATE.md Dodatek 10). */}
      <div className="flex h-14 shrink-0 items-center px-3">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Rozbalit postranní panel' : 'Sbalit postranní panel'}
          title={collapsed ? 'Rozbalit postranní panel' : 'Sbalit postranní panel'}
          className={cn(
            'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 transition-colors duration-150 hover:bg-overlay-active',
            collapsed && 'justify-center px-0',
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
      </div>

      <nav className="flex-1 space-y-0.5 px-3 pt-2">
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
    </aside>
  )
}
