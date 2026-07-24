import { OsaShell } from './OsaShell'
import { calendarEvents, families, fosterPersons, children as childFixtures } from '../../fixtures'
import { initials } from '../labData'

const DAY_START = 8
const DAY_END = 19
const SLOT_PX = 46

const WEEK = [
  { label: 'po', day: 20 },
  { label: 'út', day: 21 },
  { label: 'st', day: 22 },
  { label: 'čt', day: 23 },
  { label: 'pá', day: 24, today: true },
  { label: 'so', day: 25 },
  { label: 'ne', day: 26 },
]

/** Jméno + fotka subjektu pro avatary v události. */
const SUBJECTS = new Map<string, { label: string; avatarUrl?: string | null }>([
  ...families.map(
    ({ docId, family }) => [`family:${docId}`, { label: family.displayName ?? 'Rodina', avatarUrl: family.avatarUrl }] as const,
  ),
  ...fosterPersons.map(
    ({ docId, fosterPerson: f }) =>
      [`fosterPerson:${docId}`, { label: `${f.firstName} ${f.lastName}`, avatarUrl: f.avatarUrl }] as const,
  ),
  ...childFixtures.map(
    ({ docId, child: c }) => [`child:${docId}`, { label: `${c.firstName} ${c.lastName}`, avatarUrl: c.avatarUrl }] as const,
  ),
])

/**
 * Týdenní kalendář ve směru „Osa".
 *
 * Opravuje konkrétní vadu, kterou jsem si sám způsobil: avatary účastníků
 * byly PŘED názvem, takže na 150px sloupci sežraly půlku textu a
 * z „Případová konference" zbylo „Příp…". Teď jsou POD názvem — název má
 * celou šířku a avatary se pořád ukazují vždycky.
 *
 * Událost je bílá s vlasovou linkou a barevným levým okrajem, ne plná
 * pastelová plocha. Sedm dní plných barevných bloků je patchwork, ve kterém
 * nic nevystoupí; okraj nese stejnou informaci a nechá text být textem.
 */
export function OsaCalendar() {
  return (
    <OsaShell
      active="Kalendář"
      crumb={
        <>
          <b>Kalendář</b> · 20.–26. července 2026
        </>
      }
      actions={
        <>
          <button type="button" className="osa__btn">
            Dnes
          </button>
          <button type="button" className="osa__btn">
            Týden
          </button>
          <button type="button" className="osa__btn osa__btn--primary">
            Nová událost
          </button>
        </>
      }
    >
      <h1 className="osa__h1">Červenec 2026</h1>
      <p className="osa__lede">
        Tento týden 5 událostí. <b>Jedna návštěva je po termínu</b> — Svobodovi, +35 dní.
      </p>

      <div className="osa__cal" style={{ marginTop: 16 }}>
        <div className="osa__caldays">
          <div className="osa__calday" style={{ borderLeft: 'none' }} />
          {WEEK.map(({ label, day, today }) => (
            <div key={day} className={`osa__calday${today ? ' osa__calday--today' : ''}`}>
              {label} <b>{day}</b>
            </div>
          ))}
        </div>

        <div className="osa__calgrid">
          <div className="osa__calhours">
            {Array.from({ length: DAY_END - DAY_START }, (_, i) => (
              <div key={i} className="osa__calhour">
                {DAY_START + i}:00
              </div>
            ))}
          </div>

          {WEEK.map(({ day, today }) => (
            <div key={day} className={`osa__calcol${today ? ' osa__calcol--today' : ''}`}>
              {Array.from({ length: DAY_END - DAY_START }, (_, i) => (
                <div key={i} className="osa__calslot" />
              ))}
              {calendarEvents
                .filter(({ event }) => new Date(event.start).getDate() === day)
                .map(({ docId, event }) => {
                  const start = new Date(event.start)
                  const end = new Date(event.end)
                  const top = (start.getHours() + start.getMinutes() / 60 - DAY_START) * SLOT_PX
                  const height = Math.max(
                    34,
                    ((end.getTime() - start.getTime()) / 3_600_000) * SLOT_PX - 4,
                  )
                  const subjects = (event.subjectKeys ?? [])
                    .map((key) => SUBJECTS.get(key))
                    .filter((s): s is { label: string; avatarUrl?: string | null } => !!s)
                    .slice(0, 4)
                  const hot = event.kind === 'navsteva-rodiny'
                  return (
                    <div
                      key={docId}
                      className={`osa__event${hot ? ' osa__event--hot' : ''}`}
                      style={{ top, height }}
                    >
                      <div className="osa__eventtime">
                        {start.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      <div className="osa__eventtitle">{event.title}</div>
                      {subjects.length > 0 && (
                        <div className="osa__eventfaces">
                          {subjects.map((s, i) =>
                            s.avatarUrl ? (
                              <img key={i} src={s.avatarUrl} alt="" title={s.label} />
                            ) : (
                              <span key={i} title={s.label}>
                                {initials(s.label)}
                              </span>
                            ),
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}
            </div>
          ))}
        </div>
      </div>

      {/* Na telefonu se týdenní mřížka NEZOBRAZUJE. Sedm sloupců na 390px je
          buď nečitelné, nebo se posouvá vodorovně — a v obou případech není
          vidět dnešek, což je jediné, na co se člověk v terénu dívá. Místo
          toho svislá agenda: den je nadpis, čas je osa. */}
      <div className="osa__agendaweek">
        {WEEK.map(({ label, day, today }) => {
          const dayEvents = calendarEvents
            .filter(({ event }) => new Date(event.start).getDate() === day)
            .sort((a, b) => a.event.start.localeCompare(b.event.start))
          if (!dayEvents.length) return null
          return (
            <section key={day}>
              <h2 className={`osa__section${today ? ' osa__section--today' : ''}`}>
                {label} {day}. 7.{today && ' · dnes'}
              </h2>
              {dayEvents.map(({ docId, event }) => {
                const start = new Date(event.start)
                const end = new Date(event.end)
                const subjects = (event.subjectKeys ?? [])
                  .map((key) => SUBJECTS.get(key))
                  .filter((s): s is { label: string; avatarUrl?: string | null } => !!s)
                  .slice(0, 4)
                return (
                  <div key={docId} className="osa__agenda">
                    <span className="osa__agendatime">
                      {start.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                      <br />
                      <span style={{ color: 'var(--ink-3)' }}>
                        {end.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </span>
                    <span className="osa__agendabody">
                      <span className="osa__agendatitle" style={{ display: 'block' }}>
                        {event.title}
                      </span>
                      {subjects.length > 0 && (
                        <span className="osa__eventfaces">
                          {subjects.map((s, i) =>
                            s.avatarUrl ? (
                              <img key={i} src={s.avatarUrl} alt="" title={s.label} />
                            ) : (
                              <span key={i} title={s.label}>
                                {initials(s.label)}
                              </span>
                            ),
                          )}
                        </span>
                      )}
                    </span>
                  </div>
                )
              })}
            </section>
          )
        })}
      </div>
    </OsaShell>
  )
}
