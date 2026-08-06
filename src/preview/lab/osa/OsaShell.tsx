import type { ReactNode } from 'react'
import { labRows } from '../labData'
import { currentUser } from '../../fixtures'

/**
 * Rám směru „Osa" (routine.co povrch) — sdílený všemi obrazovkami návrhu,
 * aby se posuzoval JAZYK, ne čtyři nezávislé kresby.
 *
 * Navigace je rozdělená na „Dnes / práce s lidmi / provoz" a u sekcí, kde
 * něco hoří, nese počet. Routine ukazuje počty u seznamů právě proto, aby
 * člověk nemusel klikat, aby zjistil, že nic nehoří.
 */
const NAV_GROUPS: Array<{ group: string; items: Array<{ label: string; count?: number; hot?: boolean }> }> = [
  { group: '', items: [{ label: 'Dnes' }, { label: 'Kalendář' }] },
  {
    group: 'Lidé',
    items: [{ label: 'Rodiny' }, { label: 'Pěstouni' }, { label: 'Děti' }, { label: 'Zájemci' }],
  },
  {
    group: 'Provoz',
    items: [{ label: 'Úkoly' }, { label: 'Zprávy' }, { label: 'Dokumenty' }, { label: 'Zaměstnanci' }, { label: 'Kvalita' }],
  },
]

/**
 * Spodní lišta pro telefon. Postranní navigace se na 390px nedá zúžit, dá se
 * jen schovat — a schovat ji bez náhrady znamená appku bez navigace (přesně
 * to ukázal první mobilní screenshot).
 *
 * Pět položek je strop, na který se dá mířit prstem. Vybíráme podle toho, co
 * klíčová osoba dělá v terénu: kde mám být (Dnes), za kým jdu (Rodiny), co
 * mám splnit (Úkoly), koho hledám (Hledat).
 */
const TABS: Array<{ label: string; icon: ReactNode }> = [
  { label: 'Dnes', icon: <path d="M3 8h14M6 3v3M14 3v3M3 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /> },
  { label: 'Rodiny', icon: <path d="M7.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5m6.5.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4M2.5 16v-1a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v1m1.5-6a3 3 0 0 1 3 3v1" /> },
  { label: 'Kalendář', icon: <path d="M3 8h14M3 6a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zm4 5h2v2H7z" /> },
  { label: 'Úkoly', icon: <path d="M4 6h12M4 10h12M4 14h7" /> },
  { label: 'Hledat', icon: <path d="M12.5 12.5 17 17M14 9a5 5 0 1 1-10 0 5 5 0 0 1 10 0" /> },
]

export function OsaShell({
  active,
  crumb,
  actions,
  children,
}: {
  active: string
  crumb: ReactNode
  actions?: ReactNode
  children: ReactNode
}) {
  const overdue = labRows.filter((r) => r.urgency === 'overdue').length

  return (
    <div className="osa">
      <nav className="osa__nav">
        <div className="osa__brand">
          <span className="osa__brandmark">D</span>
          Doprovázení
        </div>

        <div className="osa__search">
          <span>Hledat…</span>
          <span className="osa__kbd">⌘K</span>
        </div>

        {NAV_GROUPS.map(({ group, items }) => (
          <div key={group || 'top'}>
            {group && <div className="osa__navgroup">{group}</div>}
            {items.map(({ label }) => {
              const isActive = label === active
              const count = label === 'Rodiny' ? overdue : label === 'Úkoly' ? 3 : undefined
              return (
                <div key={label} className={`osa__navitem${isActive ? ' osa__navitem--active' : ''}`}>
                  <span className="osa__navdot" />
                  {label}
                  {count ? <span className="osa__navcount">{count}</span> : null}
                </div>
              )
            })}
          </div>
        ))}

        <div className="osa__me">
          {currentUser.avatarUrl ? (
            <img className="osa__meface" src={currentUser.avatarUrl} alt="" />
          ) : (
            <span className="osa__meface" />
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {currentUser.displayName}
          </span>
        </div>
      </nav>

      <div className="osa__main">
        <header className="osa__top">
          <span className="osa__brandmark osa__brandmark--top">D</span>
          <span className="osa__crumb">{crumb}</span>
          <span className="osa__topactions">{actions}</span>
        </header>
        <div className="osa__body">{children}</div>

        <nav className="osa__tabbar">
          {TABS.map(({ label, icon }) => {
            const isActive = label === active
            const count = label === 'Rodiny' ? overdue : label === 'Úkoly' ? 3 : 0
            return (
              <span key={label} className={`osa__tab2${isActive ? ' osa__tab2--active' : ''}`}>
                <span className="osa__tab2icon">
                  <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                    {icon}
                  </svg>
                  {count > 0 && <span className="osa__tab2dot" />}
                </span>
                {label}
              </span>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
