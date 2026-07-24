import { OsaShell } from './OsaShell'
import { labRows, formatDate, initials, type LabRow } from '../labData'

/**
 * Seznam rodin ve směru „Osa" — bez přepínače řazení, s osou lhůt.
 * Skupiny jsou lhůty, ne abeceda; zpoždění je číslo.
 */
const BUCKETS: Array<{ key: LabRow['urgency']; label: string; hot?: boolean }> = [
  { key: 'overdue', label: 'Po termínu', hot: true },
  { key: 'soon', label: 'Do dvou týdnů' },
  { key: 'ok', label: 'V pořádku' },
]

export function OsaFamilies() {
  const overdue = labRows.filter((r) => r.urgency === 'overdue')
  const worst = overdue.length ? Math.max(...overdue.map((r) => r.daysOverdue ?? 0)) : 0

  return (
    <OsaShell
      active="Rodiny"
      // Horní lišta nedubluje titulek stránky — nese kontext, který v H1 není.
      crumb={<>{labRows.length} rodin · {overdue.length} po termínu</>}
      actions={
        <>
          <button type="button" className="osa__btn">
            Import
          </button>
          <button type="button" className="osa__btn osa__btn--primary">
            Nová rodina
          </button>
        </>
      }
    >
      <h1 className="osa__h1">Rodiny</h1>
      <p className="osa__lede">
        {overdue.length > 0 ? (
          <>
            <b>
              {overdue.length} {overdue.length === 1 ? 'rodina je' : 'rodiny jsou'} po termínu návštěvy
            </b>
            , nejdéle {worst} dní. Ostatní jsou v pořádku.
          </>
        ) : (
          <>Všechny rodiny mají návštěvu v termínu.</>
        )}
      </p>

      {BUCKETS.map(({ key, label, hot }) => {
        const rows = labRows.filter((r) => r.urgency === key)
        if (!rows.length) return null
        return (
          <section key={key} className="osa__bucket">
            <h2 className={`osa__buckethead${hot ? ' osa__buckethead--hot' : ''}`}>
              {label} · {rows.length}
            </h2>
            {rows.map((row) => (
              <Row key={row.id} row={row} />
            ))}
          </section>
        )
      })}
    </OsaShell>
  )
}

function Row({ row }: { row: LabRow }) {
  const dot = row.urgency === 'overdue' ? ' osa__dot--hot' : row.urgency === 'soon' ? ' osa__dot--warm' : ''

  return (
    <div className="osa__row">
      <span className={`osa__dot${dot}`} />

      <span className="osa__who">
        {row.avatarUrl ? (
          <img className="osa__face" src={row.avatarUrl} alt="" />
        ) : (
          <span className="osa__face">{initials(row.name)}</span>
        )}
        <span style={{ minWidth: 0 }}>
          <span className="osa__name" style={{ display: 'block' }}>
            {row.name}
          </span>
          {!row.nameIsAddress && <span className="osa__sub">{row.address}</span>}
        </span>
      </span>

      <span className="osa__cell">
        {row.children > 0 ? (
          <span className="osa__chip">{row.children === 1 ? '1 dítě' : `${row.children} děti`}</span>
        ) : (
          // Tichá pomlčka, ne věta. „Bez dětí ve spisu" devětkrát pod sebou
          // je šum, ze kterého se nic nedozvíš.
          <span style={{ color: 'var(--hair-strong)' }}>—</span>
        )}
      </span>

      <span className="osa__cell" title={row.keyWorker ?? undefined}>
        {row.keyWorker ?? '— bez klíčové osoby'}
      </span>

      <span
        className={`osa__delay${
          row.urgency === 'soon' ? ' osa__delay--warm' : row.urgency === 'ok' ? ' osa__delay--calm' : ''
        }`}
      >
        {row.urgency === 'overdue' && row.daysOverdue != null
          ? `+${row.daysOverdue} dní`
          : row.urgency === 'soon' && row.daysOverdue != null
            ? `za ${Math.abs(row.daysOverdue)} dní`
            : formatDate(row.lastVisit)}
      </span>

      <span className="osa__more">⋯</span>
    </div>
  )
}
