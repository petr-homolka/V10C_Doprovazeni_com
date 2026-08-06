import { labRows, initials, NAV_ITEMS, type LabRow } from './labData'

const STATE_LABEL: Record<LabRow['urgency'], string> = {
  overdue: 'Po termínu',
  soon: 'Blíží se termín',
  ok: 'V pořádku',
}

/**
 * SMĚR B — „TVÁŘE".
 *
 * Teze: klíčová osoba nemyslí v řádcích, myslí v lidech — „ti od nádraží",
 * „Novotní s Adélkou". Seznam je proto stěna tváří, ne tabulka. Stav nese
 * prstenec kolem fotky, takže se pozná periferním viděním, aniž by kvůli
 * tomu zčervenala celá obrazovka.
 *
 * Navigace je zúžená na 76 px (jen zkratky sekcí), protože u stěny tváří je
 * každý pixel šířky vidět na počtu rodin v řádku.
 *
 * Za co platíme: HUSTOTU. Do výšky obrazovky se vejde ~8 rodin místo ~14.
 * Kdo má 30 rodin, bude scrollovat víc. To je vědomá cena téhle teze, ne
 * nedodělek.
 */
export function DirectionFaces() {
  const overdue = labRows.filter((r) => r.urgency === 'overdue').length

  return (
    <div className="lab-faces">
      <nav className="lab-faces__nav">
        <div className="lab-faces__brandmark">D</div>
        {NAV_ITEMS.map((item) => (
          <span
            key={item}
            title={item}
            className={`lab-faces__navitem${item === 'Rodiny' ? ' lab-faces__navitem--active' : ''}`}
          >
            {item.slice(0, 3)}
          </span>
        ))}
      </nav>

      <main className="lab-faces__main">
        <div className="lab-faces__head">
          <div>
            <h1 className="lab-faces__title">Rodiny</h1>
            <p className="lab-faces__subtitle">
              {labRows.length} rodin, {overdue} po termínu návštěvy
            </p>
          </div>
          <button type="button" className="lab-faces__btn">
            + Nová rodina
          </button>
        </div>

        <div className="lab-faces__grid">
          {labRows.map((row) => (
            <Tile key={row.id} row={row} />
          ))}
        </div>
      </main>
    </div>
  )
}

function Tile({ row }: { row: LabRow }) {
  return (
    <article className="lab-faces__tile">
      <div className={`lab-faces__ring lab-faces__ring--${row.urgency}`}>
        {row.avatarUrl ? (
          <img className="lab-faces__face" src={row.avatarUrl} alt="" />
        ) : (
          <span className="lab-faces__face">{initials(row.name)}</span>
        )}
      </div>

      <div>
        <h2 className="lab-faces__name">{row.name}</h2>
        {!row.nameIsAddress && <p className="lab-faces__addr">{row.address}</p>}
      </div>

      <div className="lab-faces__foot">
        <span className={`lab-faces__state lab-faces__state--${row.urgency}`}>
          {STATE_LABEL[row.urgency]}
          {row.urgency === 'overdue' && row.daysOverdue != null && ` · ${row.daysOverdue} dní`}
        </span>
        {row.keyWorker && (
          <span className="lab-faces__ko">
            {row.keyWorkerAvatar ? (
              <img className="lab-faces__koface" src={row.keyWorkerAvatar} alt="" />
            ) : (
              <span className="lab-faces__koface" />
            )}
            {row.keyWorker.split(' ')[0]}
          </span>
        )}
      </div>
    </article>
  )
}
