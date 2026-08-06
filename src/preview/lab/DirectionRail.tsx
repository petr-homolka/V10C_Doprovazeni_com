import { labRows, formatDate, NAV_ITEMS, type LabRow } from './labData'

/**
 * SMĚR C — „OSA".
 *
 * Teze: tahle práce je řízená ČASEM, ne abecedou. Klíčová osoba se neptá
 * „která rodina je pod N", ptá se „komu už jsem měla dávno zavolat".
 * Seznam proto nemá přepínač řazení — má lhůty. Vlevo prochází svislá osa
 * a rodiny jsou zastávky na ní; zpoždění je ČÍSLO, ne štítek, protože
 * „+17 dní" nese víc informace než slovo „po termínu".
 *
 * Za co platíme: abecední hledání zmizelo (patří do hledání, ne do výpisu)
 * a kdo chce „prostě seznam všech", tady ho nedostane.
 */
const BUCKETS: Array<{ key: LabRow['urgency']; label: string }> = [
  { key: 'overdue', label: 'Po termínu' },
  { key: 'soon', label: 'Blíží se termín' },
  { key: 'ok', label: 'V pořádku' },
]

export function DirectionRail() {
  const overdue = labRows.filter((r) => r.urgency === 'overdue')

  return (
    <div className="lab-rail">
      <nav className="lab-rail__nav">
        <div className="lab-rail__brand">Doprovázení</div>
        {NAV_ITEMS.map((item) => (
          <span key={item} className={`lab-rail__navitem${item === 'Rodiny' ? ' lab-rail__navitem--active' : ''}`}>
            {item}
          </span>
        ))}
      </nav>

      <main className="lab-rail__main">
        <div className="lab-rail__head">
          <h1 className="lab-rail__title">Rodiny</h1>
          {/* Titulek stránky říká STAV, ne jen jméno sekce. */}
          <p className="lab-rail__lede">
            {overdue.length > 0 ? (
              <>
                <b>{overdue.length} rodin je po termínu návštěvy</b>, nejdéle{' '}
                {Math.max(...overdue.map((r) => r.daysOverdue ?? 0))} dní. Zbytek je v pořádku.
              </>
            ) : (
              <>Všechny rodiny mají návštěvu v termínu.</>
            )}
          </p>
        </div>

        {BUCKETS.map(({ key, label }) => {
          const rows = labRows.filter((r) => r.urgency === key)
          if (rows.length === 0) return null
          return (
            <section key={key} className="lab-rail__bucket">
              <h2 className={`lab-rail__bucketlabel${key === 'overdue' ? ' lab-rail__bucketlabel--overdue' : ''}`}>
                {label} · {rows.length}
              </h2>
              {rows.map((row) => (
                <Stop key={row.id} row={row} />
              ))}
            </section>
          )
        })}
      </main>
    </div>
  )
}

function Stop({ row }: { row: LabRow }) {
  return (
    <div className="lab-rail__stop">
      <span className={`lab-rail__dot lab-rail__dot--${row.urgency}`} />
      <div style={{ minWidth: 0 }}>
        <div className="lab-rail__name">{row.name}</div>
        <div className="lab-rail__meta">
          {!row.nameIsAddress && row.address}
          {row.children > 0 &&
            `${row.nameIsAddress ? '' : ' · '}${row.children === 1 ? '1 dítě' : `${row.children} děti`}`}
        </div>
      </div>

      <span className="lab-rail__ko">
        {row.keyWorkerAvatar ? (
          <img className="lab-rail__koface" src={row.keyWorkerAvatar} alt="" />
        ) : (
          <span className="lab-rail__koface" />
        )}
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {row.keyWorker ?? 'Bez klíčové osoby'}
        </span>
      </span>

      <span className={`lab-rail__delay lab-rail__delay--${row.urgency}`}>
        {row.urgency === 'overdue' && row.daysOverdue != null
          ? `+${row.daysOverdue} dní`
          : row.urgency === 'soon' && row.daysOverdue != null
            ? `za ${Math.abs(row.daysOverdue)} dní`
            : formatDate(row.lastVisit)}
      </span>
    </div>
  )
}
