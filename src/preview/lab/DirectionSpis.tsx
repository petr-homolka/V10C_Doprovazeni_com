import { labRows, formatDate, initials, NAV_ITEMS, type LabRow } from './labData'

/**
 * SMĚR A — „SPIS".
 *
 * Teze: tohle není dashboard, je to pečlivě vedený spis o lidech. Papírový
 * list místo třiceti plovoucích karet, vlasové linky místo třiceti stínů,
 * serif u jmen (jméno je člověk, ne datový řádek), inkoust místo modrého
 * plastu. Hlavička sloupců je JEDNOU nad výpisem, ne u každého řádku.
 *
 * Za co platíme: méně „moderního SaaS" pocitu, víc úřednosti. Kdo čeká
 * barevný dashboard, bude zklamaný.
 */
export function DirectionSpis() {
  const overdue = labRows.filter((r) => r.urgency === 'overdue').length

  return (
    <div className="lab-spis">
      <nav className="lab-spis__nav">
        <div className="lab-spis__brand">Doprovázení</div>
        {NAV_ITEMS.map((item) => (
          <span key={item} className={`lab-spis__navitem${item === 'Rodiny' ? ' lab-spis__navitem--active' : ''}`}>
            {item}
          </span>
        ))}
      </nav>

      <main className="lab-spis__main">
        <div className="lab-spis__head">
          <h1 className="lab-spis__title">
            Rodiny <span className="lab-spis__count">{labRows.length} spisů · {overdue} po termínu</span>
          </h1>
          <button type="button" className="lab-spis__btn">
            Nová rodina
          </button>
        </div>

        <div className="lab-spis__sheet">
          <div className="lab-spis__cols">
            <span />
            <span />
            <span>Rodina</span>
            <span>Poslední návštěva</span>
            <span className="lab-spis__num">Dní</span>
            <span>Klíčová osoba</span>
            <span className="lab-spis__num">Dětí</span>
          </div>

          {labRows.map((row) => (
            <Row key={row.id} row={row} />
          ))}
        </div>
      </main>
    </div>
  )
}

function Row({ row }: { row: LabRow }) {
  return (
    <div className={`lab-spis__row lab-spis__row--${row.urgency}`}>
      <span className="lab-spis__edge" />
      {row.avatarUrl ? (
        <img className="lab-spis__avatar" src={row.avatarUrl} alt="" />
      ) : (
        <span className="lab-spis__avatar">{initials(row.name)}</span>
      )}
      <div style={{ minWidth: 0 }}>
        <div className="lab-spis__name">{row.name}</div>
        {!row.nameIsAddress && <div className="lab-spis__sub">{row.address}</div>}
      </div>
      <span className="lab-spis__cell">{formatDate(row.lastVisit)}</span>
      <span className={`lab-spis__cell lab-spis__num lab-spis__state lab-spis__state--${row.urgency}`}>
        {row.daysSince != null ? row.daysSince : '—'}
      </span>
      <span className="lab-spis__cell">{row.keyWorker ?? '—'}</span>
      <span className="lab-spis__cell lab-spis__num">{row.children || '—'}</span>
    </div>
  )
}
