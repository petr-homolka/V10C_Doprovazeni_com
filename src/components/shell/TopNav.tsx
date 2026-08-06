import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Bell, Search } from '@/components/ui/icons'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { isStaffRole, STAFF_ROLE_LABELS } from '@/types/user'
import { getOrganization } from '@/services/organizationService'
import { GlobalSearchModal, useGlobalSearchShortcut } from '@/components/search/GlobalSearchModal'
import { AccountMenu } from './AccountMenu'

/**
 * CESTA E — HLAVIČKA PODLE VERCELU. ŽÁDNÝ LEVÝ PANEL.
 *
 * Tohle je ta změna, kterou přebarvení tokenů neudělalo a bez které cesta E
 * vypadala jako cesta D v šedé. Vercel nemá postranní navigaci vůbec; má
 * DVĚ VODOROVNÉ ŘADY a všechno ostatní je obsah:
 *
 *   ŘADA 1 (64 px)  značka  /  organizace  /  kde jsem      hledání · zvonek · tvář
 *   ŘADA 2 (48 px)  Dnes  Rodiny  Pěstouni  Děti  …         (aktivní podtržená)
 *
 * ─── PROČ JE TO PRO NÁS OBHAJITELNÉ, NE JEN NAPODOBENÉ ────────────────
 *
 * 1. VRACÍ ŠÍŘKU OBSAHU. Levý panel bral 240 px a otevřený pravý panel
 *    dalších 380 px; na notebooku 1440 px zbylo na seznam 820 px a sloupce
 *    se začaly skrývat (viz `@container` v index.css). Vodorovná navigace
 *    nebere z šířky nic.
 *
 * 2. LOMÍTKA NESOU KONTEXT, KTERÝ JSME STEJNĚ POTŘEBOVALI. Cesta „značka /
 *    organizace / rodina Nováková" je totéž, co dělaly drobečky — jen na
 *    jednom místě a bez druhé lišty pod hlavičkou.
 *
 * 3. POLOŽEK JE DVANÁCT, NE PADESÁT. Vodorovně se vejdou; kdyby jich byly
 *    tři desítky, tohle rozvržení by nešlo a panel by musel zůstat.
 *
 * ─── CO SE TÍM ZTRATILO ───────────────────────────────────────────────
 *
 * ŠIPKY ZPĚT/VPŘED. Vercel je nemá a v jedné řadě s lomítky by neměly kde
 * stát, aniž by zdvojily to, co dělá tlačítko prohlížeče. Na cestách
 * B/C/D zůstávají. Kdyby chyběly, vrátí se do levého kraje druhé řady —
 * je to jeden blok kódu, ne přestavba.
 */

const NAV_ITEMS = [
  { to: '/', label: 'Dnes', end: true, staffOnly: false },
  { to: '/rodiny', label: 'Rodiny', end: false, staffOnly: false },
  { to: '/pestouni', label: 'Pěstouni', end: false, staffOnly: false },
  { to: '/deti', label: 'Děti', end: false, staffOnly: false },
  { to: '/zamestnanci', label: 'Zaměstnanci', end: false, staffOnly: true },
  { to: '/ukoly', label: 'Úkoly', end: false, staffOnly: false },
  { to: '/kalendar', label: 'Kalendář', end: false, staffOnly: false },
  { to: '/zpravy', label: 'Zprávy', end: false, staffOnly: false },
  { to: '/dokumenty', label: 'Dokumenty', end: false, staffOnly: false },
  { to: '/zajemci', label: 'Zájemci', end: false, staffOnly: true },
  { to: '/kvalita', label: 'Kvalita', end: false, staffOnly: true },
  { to: '/externiste', label: 'Externisté', end: false, staffOnly: true },
] as const

const COLLABORATOR_NAV_ITEM = { to: '/spolupracovnik', label: 'Spolupráce', end: false } as const

/** Nakloněné lomítko mezi články cesty — Vercelí dělič, ne obyčejné „/". */
function Slash() {
  return (
    <span aria-hidden className="select-none px-1 text-lg text-border-strong">
      /
    </span>
  )
}

export function TopNav({ context, actions }: { context?: ReactNode; actions?: ReactNode }) {
  const [searchOpen, setSearchOpen] = useState(false)
  const [orgName, setOrgName] = useState<string | null>(null)
  const { userDoc } = useAuth()

  // V cestě stojí ORGANIZACE, ne uživatel — přesně jako u Vercelu, kde je
  // v hlavičce tým. Jméno člověka je o kus dál pod tváří vpravo a nemá
  // smysl ho říkat dvakrát; „čí data vidím" naopak nikde jinde není.
  // Chyba se spolkne: hlavička nesmí spadnout kvůli jednomu jménu, bez
  // něj se prostě článek cesty nevykreslí.
  useEffect(() => {
    if (!userDoc?.organizationId) return
    let alive = true
    getOrganization(userDoc.organizationId)
      .then((org) => alive && setOrgName(org?.name ?? null))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [userDoc?.organizationId])

  const openSearch = useCallback(() => setSearchOpen(true), [])
  useGlobalSearchShortcut(openSearch)

  const items: readonly { to: string; label: string; end: boolean }[] =
    userDoc?.role === 'spolupracovnik'
      ? [COLLABORATOR_NAV_ITEM]
      : NAV_ITEMS.filter((item) => !item.staffOnly || (userDoc && isStaffRole(userDoc.role)))

  return (
    <header className="shrink-0 bg-app">
      {/* ŘADA 1 — cesta a osobní věci. */}
      <div className="flex h-16 items-center gap-1 px-6">
        <NavLink to="/" className="flex shrink-0 items-center gap-2" title="Doprovázení">
          <span className="flex size-6 items-center justify-center rounded-md bg-primary text-2xs font-medium text-primary-foreground">
            D
          </span>
        </NavLink>

        <Slash />
        {/* Organizace stojí tam, kde ji Vercel má — je to majitel všeho pod
            tím a u víceorganizační platformy je „čí data vidím" podstatné. */}
        <span className="flex min-w-0 items-center gap-2">
          <span className="truncate text-sm font-medium text-text-primary">
            {orgName ?? 'Doprovázení'}
          </span>
          {userDoc?.role && (
            <span className="hidden shrink-0 rounded-full bg-primary-soft px-2 py-0.5 text-2xs text-text-tertiary sm:inline">
              {isStaffRole(userDoc.role) ? STAFF_ROLE_LABELS[userDoc.role] : 'Externí'}
            </span>
          )}
        </span>

        {context && (
          <>
            <Slash />
            <div className="flex min-w-0 items-center">{context}</div>
          </>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          {actions && <div className="flex shrink-0 items-center gap-1">{actions}</div>}
          {userDoc?.organizationId && (
            <button
              type="button"
              onClick={openSearch}
              title="Hledat (Ctrl+K)"
              className="flex h-8 items-center gap-2 rounded-md bg-surface px-2.5 text-left text-sm text-text-tertiary shadow-border transition-colors duration-150 hover:text-text-primary"
            >
              <Search size={15} className="shrink-0" />
              <span className="hidden w-28 truncate md:inline">Hledat…</span>
              <span className="hidden shrink-0 rounded-sm px-1 text-2xs text-text-faint shadow-border md:inline">
                ⌘K
              </span>
            </button>
          )}
          <button
            type="button"
            aria-label="Oznámení"
            title="Oznámení"
            className="flex size-8 items-center justify-center rounded-md text-text-tertiary transition-colors duration-150 hover:bg-overlay-active hover:text-text-primary"
          >
            <Bell size={17} />
          </button>
          <AccountMenu />
        </div>
      </div>

      {/*
        ŘADA 2 — záložky. Spodní linka patří CELÉ ŘADĚ a podtržení aktivní
        položky na ní sedí; proto je linka na kontejneru a podtržení je
        posunuté o pixel dolů, aby ji překrylo, ne aby vedle ní vzniklo
        druhé vlákno.

        `overflow-x-auto`: na užším okně se dvanáct položek nevejde a musí
        jít odscrollovat, ne zalomit — zalomená druhá řada by posunula
        obsah stránky a hlavička by měnila výšku podle šířky okna.
      */}
      <nav className="flex h-12 items-end gap-0.5 overflow-x-auto border-b border-border-subtle px-6">
        {items.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              cn(
                'group relative flex h-full shrink-0 items-center px-0.5 pb-2.5',
                isActive ? 'text-text-primary' : 'text-text-tertiary hover:text-text-primary',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className="rounded-md px-2 py-1 text-sm transition-colors duration-150 group-hover:bg-overlay-active">
                  {label}
                </span>
                <span
                  aria-hidden
                  className={cn(
                    'absolute inset-x-0 -bottom-px h-0.5 rounded-full transition-colors duration-150',
                    isActive ? 'bg-primary' : 'bg-transparent',
                  )}
                />
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {searchOpen && userDoc?.organizationId && (
        <GlobalSearchModal organizationId={userDoc.organizationId} onClose={() => setSearchOpen(false)} />
      )}
    </header>
  )
}
