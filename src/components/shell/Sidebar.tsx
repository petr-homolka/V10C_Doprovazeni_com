import { useCallback, useState } from 'react'
import { NavLink } from 'react-router-dom'
import {
  Baby, Bell, Calendar, CheckSquare, ClipboardCheck, FileText, Home, MessageCircle, Search,
  UserCog, UserPlus, UserRound, UserSquare2, Users,
} from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { isStaffRole } from '@/types/user'
import { GlobalSearchModal, useGlobalSearchShortcut } from '@/components/search/GlobalSearchModal'
import { AccountMenu } from './AccountMenu'

/**
 * POSTRANNÍ PANEL.
 *
 * Přestavěno 2026-07-25 na Petrův podnět („co máš v hlavičce, můžeš klidně
 * skrýt v levém sidebaru a nahoře nemusí být nic") do rozvržení, které má
 * Routine — a je to lepší z důvodu, který se dá pojmenovat:
 *
 *   NAHOŘE PATŘÍ HLEDÁNÍ, DOLE ČLOVĚK, MEZI TÍM PRÁCE.
 *
 * Hledání je první krok práce (zavolá pěstoun, přijde e-mail), takže má být
 * na začátku cesty oka, ne schované jako pátá ikonka vpravo. Účet, motiv,
 * nastavení a oznámení jsou naopak věci, které se za den použijí jednou nebo
 * vůbec — ty patří dolů, mimo hlavní tah, a motiv s nastavením ještě o krok
 * dál, do menu účtu. Hlavička se tím uvolní na to, na co je: KDE JSEM.
 *
 * Hledací pole vypadá jako pole, i když je to tlačítko: otevírá modál
 * (`GlobalSearchModal`). Viditelná zkratka ⌘K je záměr — nástroj se
 * přiznává, že se v něm dá pracovat rychle, a lidé se ji tak naučí.
 *
 * Ve sbaleném stavu (72 px) se z pole stane ikona a spodní blok zůstane,
 * jen bez textů. Levý accent pruh je REZERVOVANÝ na všech položkách, ne
 * jen na aktivní — jinak by se text neaktivních posunul o 3 px doprava
 * (poskakování při přepnutí).
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
  const [searchOpen, setSearchOpen] = useState(false)
  const { userDoc } = useAuth()

  // `useCallback`, aby zkratka nepřevazovala listener při každém překreslení.
  const openSearch = useCallback(() => setSearchOpen(true), [])
  useGlobalSearchShortcut(openSearch)

  const items: readonly { to: string; label: string; icon: typeof Home; end: boolean }[] =
    userDoc?.role === 'spolupracovnik'
      ? [COLLABORATOR_NAV_ITEM]
      : NAV_ITEMS.filter((item) => !item.staffOnly || (userDoc && isStaffRole(userDoc.role)))

  const iconButton =
    'flex size-8 shrink-0 items-center justify-center rounded-md text-text-tertiary transition-colors duration-150 hover:bg-overlay-active hover:text-text-primary'

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-border-default bg-surface-soft transition-[width] duration-200',
        collapsed ? 'w-[72px]' : 'w-60',
      )}
    >
      <div className="flex h-14 shrink-0 items-center px-3">
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Rozbalit postranní panel' : 'Sbalit postranní panel'}
          title={collapsed ? 'Rozbalit postranní panel' : 'Sbalit postranní panel'}
          className={cn(
            'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors duration-150 hover:bg-overlay-active',
            collapsed && 'justify-center px-0',
          )}
        >
          <div className="flex size-7 shrink-0 items-center justify-center rounded-md bg-primary text-xs font-medium text-primary-foreground">
            D
          </div>
          {!collapsed && <span className="truncate text-base font-medium text-text-primary">Doprovázení</span>}
        </button>
      </div>

      {/* Hledání — první věc pod značkou. */}
      {userDoc?.organizationId && (
        <div className={cn('shrink-0 px-3 pb-2', collapsed && 'px-0 text-center')}>
          {collapsed ? (
            <button type="button" onClick={openSearch} aria-label="Hledat" title="Hledat (Ctrl+K)" className={cn(iconButton, 'mx-auto')}>
              <Search size={17} />
            </button>
          ) : (
            <button
              type="button"
              onClick={openSearch}
              title="Hledat (Ctrl+K)"
              className="flex h-8 w-full items-center gap-2 rounded-md border border-border-default bg-surface px-2.5 text-left text-sm text-text-tertiary transition-colors duration-150 hover:border-border-strong"
            >
              <Search size={15} className="shrink-0" />
              <span className="flex-1 truncate">Hledat…</span>
              {/* Zkratka je vidět schválně — takhle se ji lidé naučí. */}
              <span className="shrink-0 rounded-sm border border-border-default px-1 text-2xs text-text-faint">
                ⌘K
              </span>
            </button>
          )}
        </div>
      )}

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 pt-1">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'flex h-9 items-center gap-2.5 rounded-md border-l-[3px] border-transparent px-2.5 text-base text-text-secondary transition-colors duration-150 hover:bg-overlay-active hover:text-text-primary',
                collapsed && 'justify-center px-0',
                isActive && 'border-primary bg-primary-soft font-medium text-text-primary hover:bg-primary-soft',
              )
            }
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span className="truncate">{label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Spodní blok: člověk a oznámení. Motiv a nastavení jsou v menu účtu
          — věci, které se za den použijí jednou, nemají trvale brát místo. */}
      <div className={cn('shrink-0 border-t border-border-subtle p-2', collapsed && 'px-0')}>
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <button type="button" aria-label="Oznámení" title="Oznámení" className={iconButton}>
              <Bell size={17} />
            </button>
            <AccountMenu align="top" />
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <div className="min-w-0 flex-1">
              <AccountMenu variant="row" align="top" />
            </div>
            {/* Oznámení zůstávají v řádku (můžou hořet), motiv je v menu
                účtu — jinak by dvě tlačítka sežrala jméno. */}
            <button type="button" aria-label="Oznámení" title="Oznámení" className={iconButton}>
              <Bell size={17} />
            </button>
          </div>
        )}
      </div>

      {searchOpen && userDoc?.organizationId && (
        <GlobalSearchModal organizationId={userDoc.organizationId} onClose={() => setSearchOpen(false)} />
      )}
    </aside>
  )
}
