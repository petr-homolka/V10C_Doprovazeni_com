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
          <span className="osa__crumb">{crumb}</span>
          <span className="osa__topactions">{actions}</span>
        </header>
        <div className="osa__body">{children}</div>
      </div>
    </div>
  )
}
