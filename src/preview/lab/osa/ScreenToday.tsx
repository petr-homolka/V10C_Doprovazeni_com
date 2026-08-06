import { OsaShell } from './OsaShell'
import { labRows, initials } from '../labData'
import { calendarEvents, currentUser } from '../../fixtures'

/**
 * „Dnes" ve směru „Osa" — vstupní obrazovka.
 *
 * Rozhodnutí: úvodní obrazovka NENÍ mřížka widgetů s grafy. Je to odpověď
 * na tři otázky, které si klíčová osoba ráno klade v tomhle pořadí:
 * co mám dnes → komu už hoří → co jsem naposledy nechala nedokončené.
 * Čísla proto nejsou v barevných kartách, ale jako čísla s popiskem; barvu
 * dostane jen to, co hoří.
 */
export function OsaToday() {
  const overdue = labRows.filter((r) => r.urgency === 'overdue')
  const soon = labRows.filter((r) => r.urgency === 'soon')
  const today = calendarEvents
    .filter(({ event }) => new Date(event.start).getDate() === 24)
    .sort((a, b) => a.event.start.localeCompare(b.event.start))

  return (
    <OsaShell
      active="Dnes"
      crumb={
        <>
          <b>Dnes</b> · pátek 24. července
        </>
      }
      actions={
        <button type="button" className="osa__btn osa__btn--primary">
          Nadiktovat zápis
        </button>
      }
    >
      <h1 className="osa__h1">Dobré ráno, {currentUser.displayName.split(' ')[0]}</h1>
      <p className="osa__lede">
        Dnes máte {today.length} události. <b>{overdue.length} rodiny jsou po termínu návštěvy.</b>
      </p>

      <div className="osa__today" style={{ marginTop: 18 }}>
        <div>
          <h2 className="osa__section">Dnešní program</h2>
          {today.map(({ docId, event }) => {
            const start = new Date(event.start)
            const end = new Date(event.end)
            return (
              <div key={docId} className="osa__agenda">
                <span className="osa__agendatime">
                  {start.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}–
                  {end.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                </span>
                <span className="osa__agendabody">
                  <span className="osa__agendatitle">{event.title}</span>
                  <div className="osa__sub">
                    {event.familyDocId ? 'Rodina Novotných · Dlouhá 1247/12, Brno-střed' : 'Interní'}
                  </div>
                </span>
              </div>
            )
          })}

          <h2 className="osa__section">Po termínu</h2>
          {overdue.map((row) => (
            <div key={row.id} className="osa__agenda">
              <span className="osa__agendatime" style={{ color: 'var(--accent)', fontWeight: 650 }}>
                +{row.daysOverdue} dní
              </span>
              <span className="osa__agendabody" style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                {row.avatarUrl ? (
                  <img className="osa__face" src={row.avatarUrl} alt="" />
                ) : (
                  <span className="osa__face">{initials(row.name)}</span>
                )}
                <span style={{ minWidth: 0 }}>
                  <span className="osa__agendatitle" style={{ display: 'block' }}>
                    {row.name}
                  </span>
                  <span className="osa__sub">{row.keyWorker ?? 'bez klíčové osoby'}</span>
                </span>
              </span>
            </div>
          ))}
        </div>

        <aside style={{ display: 'grid', gap: 14 }}>
          <div className="osa__panel">
            <div className="osa__panelhead">Můj stav</div>
            <div className="osa__panelbody">
              <div className="osa__stat">
                <span className="osa__statnum osa__statnum--hot">{overdue.length}</span>
                <span className="osa__statlabel">rodin po termínu návštěvy</span>
              </div>
              <div className="osa__stat">
                <span className="osa__statnum">{soon.length}</span>
                <span className="osa__statlabel">návštěv do dvou týdnů</span>
              </div>
              <div className="osa__stat" style={{ borderBottom: 'none' }}>
                <span className="osa__statnum">{labRows.length}</span>
                <span className="osa__statlabel">rodin ve spisu celkem</span>
              </div>
            </div>
          </div>

          <div className="osa__panel">
            <div className="osa__panelhead">Nedokončené úkoly · 3</div>
            <div className="osa__panelbody" style={{ paddingTop: 4, paddingBottom: 4 }}>
              <div className="osa__tl">
                <span className="osa__tldate" style={{ color: 'var(--accent)' }}>
                  +3 dní
                </span>
                <span className="osa__tlbody">
                  <b>Zpráva pro OSPOD za 2. kvartál</b> — Novotní
                </span>
              </div>
              <div className="osa__tl">
                <span className="osa__tldate">30. 7.</span>
                <span className="osa__tlbody">
                  <b>Zajistit doučování matematiky</b> — Adélka
                </span>
              </div>
              <div className="osa__tl">
                <span className="osa__tldate">—</span>
                <span className="osa__tlbody">
                  <b>Objednat respitní pobyt</b> — Vondráčkovi
                </span>
              </div>
            </div>
          </div>

          <div className="osa__panel">
            <div className="osa__panelhead">Narozeniny a svátky</div>
            <div className="osa__panelbody" style={{ paddingTop: 4, paddingBottom: 4 }}>
              <div className="osa__tl">
                <span className="osa__tldate">dnes</span>
                <span className="osa__tlbody">
                  <b>Kristýna Vondráčková</b> má svátek
                </span>
              </div>
              <div className="osa__tl">
                <span className="osa__tldate">28. 7.</span>
                <span className="osa__tlbody">
                  <b>Dominik Novotný</b> — 14 let
                </span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </OsaShell>
  )
}
